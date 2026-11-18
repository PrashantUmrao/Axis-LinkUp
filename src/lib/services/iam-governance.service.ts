/**
 * IAM Governance Service (Business Logic Layer - BLL).
 * Super Administrator governance console backend for managing institutional roles,
 * administrative sub-roles, departmental assignments, account statuses, and inspecting
 * the live canonical RBAC Permission Matrix (DOC-AUTH-005).
 *
 * Every mutation reuses core UserService invariants and records an immutable SHA-256
 * chained AuditLog entry via AuditService.
 */

import { Types } from 'mongoose';
import { clerkClient } from '@clerk/nextjs/server';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { UserService } from '@/lib/services/user.service';
import { AuditService } from '@/lib/services/audit.service';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { SessionService } from '@/lib/auth/session';
import { toUserDTO } from '@/lib/db/models/user.model';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS_MATRIX,
  type Permission,
} from '@/lib/auth/permissions';
import { assertCanManageUserRoles, hasPermission } from '@/lib/auth/rbac';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors/app-error';
import type { UserRole, UserSession } from '@/types/user';
import type {
  AuditRequestMeta,
  GovernedUserDTO,
  IamMutationResultDTO,
  IamRoleDistributionStatsDTO,
  PaginatedGovernedUsersDTO,
  PermissionMatrixDTO,
  PermissionMatrixRowDTO,
} from '@/types/governance';
import type {
  IamUpdateRoleInput,
  IamUpdateStatusInput,
  IamUserQueryParams,
} from '@/lib/validations/governance.schema';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MODULE_PREFIX_LABELS: Record<string, string> = {
  users: '01. Users & Identity',
  rbac: '02. RBAC & IAM Governance',
  student_dash: '03. Student Dashboard',
  faculty_dash: '04. Faculty Dashboard',
  admin_dash: '05. Admin Dashboard',
  super_admin: '06. Executive Console',
  notices: '07. Campus Notices',
  chat: '08. Chat & Discussions',
  polls: '09. Campus Polls',
  calendar: '10. Academic Schedule (Disabled)',
  assignments: '11. Coursework & Assignments',
  notes: '12. Notes & Materials',
  requests: '13. Student Service Requests',
  spaces: '14. Facility Bookings',
  passport: '15. Skill Passport',
  emergency: '16. Emergency Broadcasts',
  alerts: '17. Broadcast Alerts',
  analytics: '18. Analytics & Reporting',
  audit: '19. Security Audit Logs',
};

export class IamGovernanceService {
  /**
   * Enforces strict Super Administrator IAM Governance clearance.
   */
  private static assertIamGovernanceAuthority(session: UserSession): void {
    if (
      session.role !== 'super_admin' ||
      !hasPermission(session.role, PERMISSIONS.RBAC_MODIFY_ROLES)
    ) {
      throw new ForbiddenError(
        'Access denied. IAM Governance Console is restricted strictly to Super Administrators.'
      );
    }

    assertCanManageUserRoles(
      session,
      'Access denied. Only System Administrators / Super Administrators may perform IAM role governance.'
    );
  }

  /**
   * Best-effort Clerk publicMetadata sync (never blocks MongoDB commit if Clerk is unconfigured).
   */
  private static async syncClerkMetadataNonBlocking(
    authProviderId: string | undefined | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    if (!authProviderId || !process.env.CLERK_SECRET_KEY) return;
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(authProviderId, {
        publicMetadata: metadata,
      });
    } catch {
      // Non-blocking external IAM sync
    }
  }

  /**
   * Lists paginated institutional users across all personas with department metadata.
   */
  public static async listGovernedUsers(
    session: UserSession,
    query: Partial<IamUserQueryParams> = {}
  ): Promise<PaginatedGovernedUsersDTO> {
    this.assertIamGovernanceAuthority(session);

    const filter: Record<string, unknown> = {};

    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;

    if (query.department && query.department.trim()) {
      const dept = await DepartmentRepository.findActiveByIdOrCode(query.department.trim());
      if (dept) {
        filter.departmentId = dept._id;
      } else if (Types.ObjectId.isValid(query.department.trim())) {
        filter.departmentId = new Types.ObjectId(query.department.trim());
      }
    }

    if (query.search && query.search.trim()) {
      const term = escapeRegex(query.search.trim());
      filter.$or = [
        { fullName: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { username: { $regex: term, $options: 'i' } },
        { 'studentProfile.rollNumber': { $regex: term, $options: 'i' } },
        { 'facultyProfile.employeeId': { $regex: term, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 25;

    const { users, total } = await UserRepository.findGovernedUsers(filter, page, limit);

    // Resolve department labels efficiently
    const deptCache = new Map<string, { name: string; code: string }>();
    const governedUsers: GovernedUserDTO[] = [];

    for (const userDoc of users) {
      const dto = toUserDTO(userDoc);
      let departmentName: string | null = null;
      let departmentCode: string | null = null;

      if (dto.departmentId) {
        let deptInfo = deptCache.get(dto.departmentId);
        if (!deptInfo) {
          try {
            const deptDoc = await DepartmentRepository.findById(dto.departmentId);
            if (deptDoc) {
              deptInfo = { name: deptDoc.name, code: deptDoc.code };
              deptCache.set(dto.departmentId, deptInfo);
            }
          } catch {
            // Optional enrichment
          }
        }
        if (deptInfo) {
          departmentName = deptInfo.name;
          departmentCode = deptInfo.code;
        }
      }

      governedUsers.push({
        ...dto,
        departmentName,
        departmentCode,
      });
    }

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      users: governedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Returns aggregated user role and lifecycle status KPI counts.
   */
  public static async getRoleDistributionStats(
    session: UserSession
  ): Promise<IamRoleDistributionStatsDTO> {
    this.assertIamGovernanceAuthority(session);
    return await UserRepository.getRoleDistributionStats();
  }

  /**
   * Modifies a user's institutional role, administrative sub-role, and/or department.
   * Enforces:
   * - No self-demotion
   * - Never demote the last remaining active super_admin
   * - Mandatory audit justification and immutable SHA-256 AuditLog record
   */
  public static async changeUserRole(
    session: UserSession,
    targetUserId: string,
    input: IamUpdateRoleInput,
    requestMeta: AuditRequestMeta = {}
  ): Promise<IamMutationResultDTO> {
    this.assertIamGovernanceAuthority(session);

    // 1. Block self-demotion unconditionally
    if (targetUserId === session.userId && input.role !== 'super_admin') {
      throw new BadRequestError(
        'Self-demotion is prohibited. Another Super Administrator must modify your institutional role.'
      );
    }

    // 2. Fetch existing target user
    const targetUser = await UserRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('User', targetUserId);
    }

    // 3. Protect the last remaining active Super Administrator
    if (
      targetUser.role === 'super_admin' &&
      targetUser.status === 'active' &&
      input.role !== 'super_admin'
    ) {
      const activeSuperAdmins = await UserRepository.countByRole('super_admin');
      if (activeSuperAdmins <= 1) {
        throw new BadRequestError(
          'Cannot demote the last remaining active Super Administrator account.'
        );
      }
    }

    // Resolve old department name for accurate audit snapshot
    let oldDeptName: string | null = null;
    if (targetUser.departmentId) {
      try {
        const oldDept = await DepartmentRepository.findById(targetUser.departmentId.toString());
        if (oldDept) oldDeptName = oldDept.name;
      } catch {
        // Fallback
      }
    }

    const oldState = {
      role: targetUser.role,
      adminSubRole: targetUser.adminSubRole ?? null,
      departmentId: targetUser.departmentId ? targetUser.departmentId.toString() : null,
      department: oldDeptName,
    };

    // Resolve target department if provided
    let resolvedDeptId: string | null | undefined = undefined;
    let newDeptName: string | null = oldDeptName;
    let newDeptCode: string | null = null;

    if (input.department !== undefined) {
      if (input.department === null) {
        resolvedDeptId = null;
        newDeptName = null;
      } else {
        const matchedDept = await DepartmentRepository.findActiveByIdOrCode(input.department);
        if (matchedDept) {
          resolvedDeptId = matchedDept._id.toString();
          newDeptName = matchedDept.name;
          newDeptCode = matchedDept.code;
        } else if (Types.ObjectId.isValid(input.department)) {
          resolvedDeptId = input.department;
          newDeptName = input.department;
        } else {
          throw new BadRequestError(
            `Department "${input.department}" could not be found in the institutional registry.`
          );
        }
      }
    }

    // 4. Execute mutations via existing UserService core & UserRepository
    let updatedDTO = toUserDTO(targetUser);

    if (input.role !== targetUser.role) {
      updatedDTO = await UserService.updateUserRole(targetUserId, input.role, session);
    }

    // Determine effective adminSubRole (clear if moving to student/faculty unless explicitly set)
    const nextSubRole =
      input.adminSubRole !== undefined
        ? input.adminSubRole
        : input.role === 'student' || input.role === 'faculty'
          ? null
          : (targetUser.adminSubRole ?? null);

    if (nextSubRole !== (targetUser.adminSubRole ?? null)) {
      updatedDTO = await UserService.updateAdminSubRole(targetUserId, nextSubRole, session);
    }

    if (resolvedDeptId !== undefined) {
      const deptUpdated = await UserRepository.updateDepartment(targetUserId, resolvedDeptId);
      if (deptUpdated) {
        updatedDTO = toUserDTO(deptUpdated);
      }
    }

    // 5. Non-blocking Clerk metadata sync
    await this.syncClerkMetadataNonBlocking(targetUser.authProviderId, {
      role: updatedDTO.role,
      adminSubRole: updatedDTO.adminSubRole ?? null,
      departmentId: updatedDTO.departmentId ?? null,
    });

    // AUD-H12: Non-blockingly revoke active Clerk sessions when institutional role changes
    if (input.role !== targetUser.role && targetUser.authProviderId) {
      try {
        await SessionService.revokeAllUserSessions(
          targetUser.authProviderId,
          `Institutional role changed from ${targetUser.role} to ${input.role}`
        );
      } catch {
        // Non-blocking session revocation
      }
    }

    const newState = {
      role: updatedDTO.role,
      adminSubRole: updatedDTO.adminSubRole ?? null,
      departmentId: updatedDTO.departmentId ?? null,
      department: newDeptName,
    };

    const action =
      oldState.role !== newState.role
        ? 'ROLE_CHANGED'
        : oldState.adminSubRole !== newState.adminSubRole
          ? 'ADMIN_SUBROLE_CHANGED'
          : 'DEPARTMENT_ASSIGNED';

    // 6. Write immutable high-severity AuditLog entry
    const auditEvent = await AuditService.recordEvent({
      actorId: session.userId,
      actorSnapshot: {
        fullName: session.fullName || 'Super Administrator',
        email: session.email,
        role: session.role,
        department: null,
      },
      action,
      module: 'IAM',
      severity: 'high',
      targetEntityType: 'User',
      targetEntityId: targetUserId,
      targetLabel: updatedDTO.email,
      department: newDeptName || oldDeptName,
      oldState,
      newState,
      reason: input.reason,
      ipAddress: requestMeta.ipAddress ?? null,
      userAgent: requestMeta.userAgent ?? null,
    });

    return {
      user: {
        ...updatedDTO,
        departmentName: newDeptName,
        departmentCode: newDeptCode,
      },
      auditEvent,
    };
  }

  /**
   * Transitions a user's account status (active / suspended / deactivated).
   * Enforces:
   * - No self-suspension or self-deactivation
   * - Never suspend or deactivate the last remaining active super_admin
   * - Mandatory justification and immutable high/critical AuditLog entry
   */
  public static async changeUserStatus(
    session: UserSession,
    targetUserId: string,
    input: IamUpdateStatusInput,
    requestMeta: AuditRequestMeta = {}
  ): Promise<IamMutationResultDTO> {
    this.assertIamGovernanceAuthority(session);

    // 1. Block self-suspension / self-deactivation
    if (targetUserId === session.userId && input.status !== 'active') {
      throw new BadRequestError(
        'Self-suspension or self-deactivation is prohibited to prevent executive lockout.'
      );
    }

    const targetUser = await UserRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('User', targetUserId);
    }

    // 2. Prevent disabling the last active Super Administrator
    if (
      targetUser.role === 'super_admin' &&
      targetUser.status === 'active' &&
      input.status !== 'active'
    ) {
      const activeSuperAdmins = await UserRepository.countByRole('super_admin');
      if (activeSuperAdmins <= 1) {
        throw new BadRequestError(
          'Cannot suspend or deactivate the last remaining active Super Administrator account.'
        );
      }
    }

    let deptName: string | null = null;
    if (targetUser.departmentId) {
      try {
        const dept = await DepartmentRepository.findById(targetUser.departmentId.toString());
        if (dept) deptName = dept.name;
      } catch {
        // Optional enrichment
      }
    }

    const oldState = {
      status: targetUser.status,
      role: targetUser.role,
    };

    const updatedDTO = await UserService.updateUserStatus(targetUserId, input.status, session);

    await this.syncClerkMetadataNonBlocking(targetUser.authProviderId, {
      status: updatedDTO.status,
    });

    // AUD-C10 & AUD-H12: Non-blockingly revoke active Ably realtime tokens and Clerk sessions
    // when suspending or deactivating an account
    if (input.status === 'suspended' || input.status === 'deactivated') {
      try {
        await AblyBroker.revokeUserTokens(targetUserId);
      } catch {
        // Non-blocking revocation
      }
      if (targetUser.authProviderId) {
        try {
          await SessionService.revokeAllUserSessions(
            targetUser.authProviderId,
            `Account status transitioned to ${input.status}`
          );
        } catch {
          // Non-blocking revocation
        }
      }
    }

    const newState = {
      status: updatedDTO.status,
      role: updatedDTO.role,
    };

    const severity = input.status === 'active' ? 'high' : 'critical';

    const auditEvent = await AuditService.recordEvent({
      actorId: session.userId,
      actorSnapshot: {
        fullName: session.fullName || 'Super Administrator',
        email: session.email,
        role: session.role,
        department: null,
      },
      action: 'ACCOUNT_STATUS_CHANGED',
      module: 'IAM',
      severity,
      targetEntityType: 'User',
      targetEntityId: targetUserId,
      targetLabel: updatedDTO.email,
      department: deptName,
      oldState,
      newState,
      reason: input.reason,
      ipAddress: requestMeta.ipAddress ?? null,
      userAgent: requestMeta.userAgent ?? null,
    });

    return {
      user: {
        ...updatedDTO,
        departmentName: deptName,
      },
      auditEvent,
    };
  }

  /**
   * Returns the live canonical RBAC Permission Matrix derived directly from
   * src/lib/auth/permissions.ts for Super Admin inspection.
   */
  public static getPermissionMatrix(session: UserSession): PermissionMatrixDTO {
    this.assertIamGovernanceAuthority(session);

    const roles: UserRole[] = ['student', 'faculty', 'admin', 'super_admin'];
    const permissionsList = Object.values(PERMISSIONS) as Permission[];

    const rows: PermissionMatrixRowDTO[] = permissionsList.map((permission) => {
      const prefix = permission.split(':')[0] || 'system';
      return {
        permission,
        module: MODULE_PREFIX_LABELS[prefix] || prefix.toUpperCase(),
        scopes: {
          student: ROLE_PERMISSIONS_MATRIX.student[permission] ?? 'DENY',
          faculty: ROLE_PERMISSIONS_MATRIX.faculty[permission] ?? 'DENY',
          admin: ROLE_PERMISSIONS_MATRIX.admin[permission] ?? 'DENY',
          super_admin: ROLE_PERMISSIONS_MATRIX.super_admin[permission] ?? 'DENY',
        },
      };
    });

    return {
      roles,
      rows,
      totalPermissions: rows.length,
    };
  }
}
