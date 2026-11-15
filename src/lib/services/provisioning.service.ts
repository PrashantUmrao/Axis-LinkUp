/**
 * Single-Account Provisioning Service (Domain Business Logic Layer).
 * Enforces System Administrator authorization, multi-level uniqueness checks,
 * Clerk identity creation without permanent passwords, MongoDB persistence,
 * and automatic rollback (compensating transactions) upon database failure.
 */

import { clerkClient } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { provisionUserSchema, provisionAdminSchema } from '@/lib/validations/provision.schema';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import {
  ConflictError,
  ValidationError,
  AppError,
} from '@/lib/errors/app-error';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';
import { logger } from '@/lib/logging/logger';
import type { UserDTO, UserSession, IUser } from '@/types/user';
import { ActivationService } from './activation.service';

export class ProvisioningService {
  /**
   * Internal Clerk client resolver (allows injection for testing and resilience).
   */
  public static async getClerkClient() {
    return clerkClient();
  }

  /**
   * Database connectivity hook (overridable for unit test mock injection).
   */
  public static async ensureDbConnected(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Translates Clerk API error responses into clear, sanitized application exceptions.
   * Maps 422/conflict to ConflictError (409) or ValidationError (400) instead of generic 502.
   * Never exposes secret tokens or internal sensitive details.
   */
  public static parseClerkError(clerkErr: unknown, email: string, username: string): Error {
    if (clerkErr instanceof AppError) return clerkErr;

    const errObj = clerkErr as {
      status?: number;
      message?: string;
      errors?: Array<{
        code?: string;
        message?: string;
        longMessage?: string;
        meta?: { paramName?: string };
      }>;
    };

    const errors = Array.isArray(errObj?.errors) ? errObj.errors : [];
    const status = errObj?.status;

    if (errors.length > 0) {
      const first = errors[0];
      const code = first?.code || '';
      const paramName = first?.meta?.paramName || '';
      const detailMsg = first?.longMessage || first?.message || 'Identity provider validation failed';

      // 1. Conflict / Duplicate Identifiers in Identity Provider
      if (code === 'form_identifier_exists') {
        if (paramName === 'email_address' || detailMsg.toLowerCase().includes('email')) {
          return new ConflictError(
            `A collegiate user with institutional email "${email}" already exists in the identity provider.`
          );
        }
        if (paramName === 'username' || detailMsg.toLowerCase().includes('username')) {
          return new ConflictError(
            `A collegiate user with username "${username}" already exists in the identity provider.`
          );
        }
        return new ConflictError(detailMsg);
      }

      // 2. Username Format Violations (Length, Disallowed Characters)
      if (
        code === 'form_username_invalid_character' ||
        code === 'form_username_invalid_length' ||
        code.includes('username')
      ) {
        return new ValidationError(detailMsg);
      }

      // 3. Password Policy Violations (Pwned, Length, Complexity)
      if (
        code === 'form_password_pwned' ||
        code === 'form_password_length_too_short' ||
        code.includes('password')
      ) {
        return new ValidationError(detailMsg);
      }

      // 4. Client Request Error Codes
      if (status === 400 || status === 422) {
        return new ValidationError(detailMsg);
      }
    }

    const rawMsg = errObj?.message ? String(errObj.message) : '';
    if (
      rawMsg.toLowerCase().includes('already exists') ||
      rawMsg.toLowerCase().includes('taken')
    ) {
      return new ConflictError(
        `External authentication identity for "${email}" or "${username}" already exists.`
      );
    }

    if (
      rawMsg.toLowerCase().includes('password') ||
      rawMsg.toLowerCase().includes('length') ||
      rawMsg.toLowerCase().includes('character')
    ) {
      return new ValidationError(rawMsg);
    }

    return new AppError(
      'Failed to provision authentication identity with external provider.',
      ERROR_CODES.INTERNAL_ERROR,
      HTTP_STATUS.BAD_GATEWAY
    );
  }

  /**
   * Provisions a single student or faculty account.
   * Strictly restricted to System Administrators.
   */
  public static async provisionSingleAccount(
    rawInput: unknown,
    callerSession: UserSession
  ): Promise<UserDTO> {
    // 1. Authorization Gate: Strictly System Administrator (or root super admin)
    assertCanManageUserRoles(
      callerSession,
      'Only System Administrators are authorized to provision student and faculty accounts.'
    );

    // 2. Strict Input Validation via Zod
    const validated = provisionUserSchema.parse(rawInput);

    // 3. Ensure MongoDB connectivity
    await this.ensureDbConnected();

    // 4. Resolve and validate academic department
    const department = await DepartmentRepository.findActiveByIdOrCode(validated.departmentId);
    if (!department) {
      throw new ValidationError(
        `Academic department "${validated.departmentId}" is invalid, inactive, or not found.`
      );
    }

    // 4.1 Academic Program Verification: Program must belong to the assigned department and be active
    if (validated.role === 'student' && validated.studentProfile?.program && department) {
      const programCheck = await DepartmentRepository.isProgramApprovedForDepartment(
        department.code,
        validated.studentProfile.program
      );
      if (!programCheck.valid) {
        throw new ValidationError(
          programCheck.reason ||
            `Program "${validated.studentProfile.program}" is not active or approved for Department "${department.code}".`
        );
      }
    }

    // 5. Pre-Flight Uniqueness Checks
    // 5.1 Institutional Email Uniqueness
    const existingEmail = await UserRepository.findByEmail(validated.email);
    if (existingEmail) {
      throw new ConflictError(
        `A collegiate user with institutional email "${validated.email}" already exists.`
      );
    }

    // 5.2 Institutional Username Uniqueness
    const existingUsername = await UserRepository.findByUsername(validated.username);
    if (existingUsername) {
      throw new ConflictError(
        `A collegiate user with username "${validated.username}" already exists.`
      );
    }

    // 5.3 Role-Specific Identifier Uniqueness
    if (validated.role === 'student' && validated.studentProfile?.rollNumber) {
      const existingRoll = await UserRepository.findByRollNumber(
        validated.studentProfile.rollNumber
      );
      if (existingRoll) {
        throw new ConflictError(
          `A student with roll number "${validated.studentProfile.rollNumber}" already exists.`
        );
      }
    }

    if (validated.role === 'faculty' && validated.facultyProfile?.employeeId) {
      const existingEmployee = await UserRepository.findByEmployeeId(
        validated.facultyProfile.employeeId
      );
      if (existingEmployee) {
        throw new ConflictError(
          `A faculty member with employee ID "${validated.facultyProfile.employeeId}" already exists.`
        );
      }
    }

    // 6. Split full name into first and last name for identity provider
    const nameSegments = validated.fullName.trim().split(/\s+/);
    const firstName = nameSegments[0] || 'Collegiate';
    const lastName = nameSegments.slice(1).join(' ') || 'Member';

    // 6.1 Clerk Username Normalization:
    // Clerk strictly requires usernames to be between 4 and 64 characters,
    // containing only letters, numbers, hyphens (-), and underscores (_).
    // Normalize any periods to underscores and ensure minimum 4 character length.
    let clerkUsername = validated.username.replace(/\./g, '_');
    if (clerkUsername.length < 4) {
      clerkUsername = `${clerkUsername}_${validated.role.slice(0, 3)}`;
    }

    // 7. Clerk Identity Creation
    const initialStatus = validated.password ? 'active' : 'pending_verification';
    const isEmailVerified = Boolean(validated.password);

    const clerkPayload: Record<string, unknown> = {
      emailAddress: [validated.email],
      username: clerkUsername,
      firstName,
      lastName,
      publicMetadata: {
        role: validated.role,
        departmentId: department._id.toString(),
        status: initialStatus,
      },
    };

    if (validated.password) {
      clerkPayload.password = validated.password;
    } else {
      clerkPayload.skipPasswordRequirement = true;
    }

    let clerkUser: { id: string } | undefined = undefined;
    let wasAdopted = false;
    const client = await ProvisioningService.getClerkClient();

    try {
      clerkUser = await client.users.createUser(
        clerkPayload as unknown as Parameters<typeof client.users.createUser>[0]
      );

      logger.info(
        `[ProvisioningService] Created Clerk identity: ${clerkUser.id} for ${validated.email}`
      );
    } catch (clerkErr: unknown) {
      const parsedErr = ProvisioningService.parseClerkError(clerkErr, validated.email, clerkUsername);

      // Handle retry after interrupted previous attempt:
      // If Clerk identity exists but has NO MongoDB record, safely adopt it.
      if (parsedErr instanceof ConflictError && client.users?.getUserList) {
        try {
          const existingList = await client.users.getUserList({ emailAddress: [validated.email] });
          const orphan = existingList.data?.find(
            (u) =>
              u.emailAddresses.some((e) => e.emailAddress.toLowerCase() === validated.email.toLowerCase()) ||
              u.username?.toLowerCase() === clerkUsername.toLowerCase()
          );

          if (orphan) {
            const alreadyLinked = await UserRepository.findByAuthProviderId(orphan.id);
            if (!alreadyLinked) {
              logger.info(
                `[ProvisioningService] Adopting unlinked Clerk identity ${orphan.id} for retry on ${validated.email}`
              );
              if (client.users.updateUser) {
                await client.users.updateUser(orphan.id, {
                  firstName,
                  lastName,
                  username: clerkUsername,
                });
              }
              if (client.users.updateUserMetadata) {
                await client.users.updateUserMetadata(orphan.id, {
                  publicMetadata: clerkPayload.publicMetadata as Record<string, unknown>,
                });
              }
              if (validated.password && client.users.updateUser) {
                await client.users.updateUser(orphan.id, {
                  password: validated.password,
                });
              }
              clerkUser = { id: orphan.id };
              wasAdopted = true;
            }
          }
        } catch (adoptErr) {
          logger.warn('[ProvisioningService] Orphan check deferred during retry', {
            error: adoptErr instanceof Error ? adoptErr.message : String(adoptErr),
          });
        }
      }

      if (!clerkUser) {
        logger.error('[ProvisioningService] Clerk user creation failed', {
          error: parsedErr.message,
        });
        throw parsedErr;
      }
    }

    // 8. MongoDB Record Persistence with Compensating Transaction (Rollback)
    let createdUser: IUser;
    try {
      createdUser = await UserRepository.create({
        authProviderId: clerkUser.id,
        email: validated.email,
        username: validated.username,
        fullName: validated.fullName,
        role: validated.role,
        status: initialStatus,
        isEmailVerified,
        departmentId: department._id.toString(),
        provisionedBy: callerSession.userId,
        phoneNumber: validated.phoneNumber,
        studentProfile: validated.studentProfile,
        facultyProfile: validated.facultyProfile,
      });

      logger.info(
        `[ProvisioningService] Persisted user ${createdUser._id} (Clerk: ${clerkUser.id}) provisioned by admin ${callerSession.userId}`
      );

      // 9. Generate Initial Activation Invitation Token (only for unactivated accounts)
      if (initialStatus === 'pending_verification') {
        try {
          await ActivationService.createActivationToken(createdUser);
        } catch (actErr) {
          logger.warn(
            `[ProvisioningService] Initial activation token generation deferred: ${actErr instanceof Error ? actErr.message : String(actErr)}`
          );
        }
      }
    } catch (dbErr: unknown) {
      // COMPENSATING TRANSACTION: Roll back the created Clerk user only if newly created
      if (!wasAdopted) {
        logger.error(
          `[ProvisioningService] Database write failed for user ${clerkUser.id}. Initiating compensating Clerk rollback...`,
          { error: dbErr instanceof Error ? dbErr.message : String(dbErr) }
        );

        try {
          await client.users.deleteUser(clerkUser.id);
          logger.info(
            `[ProvisioningService] Successfully rolled back Clerk user ${clerkUser.id} after database persistence failure.`
          );
        } catch (rollbackErr: unknown) {
          logger.error(
            `[ProvisioningService] CRITICAL: Failed to roll back Clerk user ${clerkUser.id}`,
            { error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr) }
          );
        }
      }

      throw dbErr;
    }

    return toUserDTO(createdUser);
  }

  /**
   * Provisions an authorized administrative account (HOD, Director, SysAdmin).
   * Strictly restricted to System Administrators.
   */
  public static async provisionAdminAccount(
    rawInput: unknown,
    callerSession: UserSession
  ): Promise<UserDTO> {
    assertCanManageUserRoles(
      callerSession,
      'Only System Administrators are authorized to provision administrative accounts.'
    );

    const validated = provisionAdminSchema.parse(rawInput);
    await this.ensureDbConnected();

    let department = null;
    if (validated.departmentId) {
      department = await DepartmentRepository.findActiveByIdOrCode(validated.departmentId);
      if (!department && validated.adminSubRole === 'hod') {
        throw new ValidationError(
          `Academic department "${validated.departmentId}" is invalid, inactive, or not found.`
        );
      }
    } else if (validated.adminSubRole === 'hod') {
      throw new ValidationError('Department scope is required when provisioning Department HOD accounts.');
    }

    const existingEmail = await UserRepository.findByEmail(validated.email);
    if (existingEmail) {
      throw new ConflictError(
        `A collegiate user with institutional email "${validated.email}" already exists.`
      );
    }

    const existingUsername = await UserRepository.findByUsername(validated.username);
    if (existingUsername) {
      throw new ConflictError(
        `A collegiate user with username "${validated.username}" already exists.`
      );
    }

    if (validated.adminProfile?.adminStaffId) {
      const existingStaff = await UserRepository.findByAdminStaffId(validated.adminProfile.adminStaffId);
      if (existingStaff) {
        throw new ConflictError(
          `An administrator with staff ID "${validated.adminProfile.adminStaffId}" already exists.`
        );
      }
    }

    const adminProfile = validated.adminProfile || {
      adminStaffId: `ADM-${Date.now().toString().slice(-6)}`,
      administrativeDomain:
        validated.adminSubRole === 'hod'
          ? 'Departmental Governance'
          : validated.adminSubRole === 'director'
          ? 'Directorate Leadership'
          : 'Central IT Administration',
      assignedQueueScopes: ['all'],
      emergencyOverridePermitted: validated.role === 'super_admin',
    };

    const nameSegments = validated.fullName.trim().split(/\s+/);
    const firstName = nameSegments[0] || 'Administrative';
    const lastName = nameSegments.slice(1).join(' ') || 'Officer';

    // Clerk Username Normalization:
    let clerkUsername = validated.username.replace(/\./g, '_');
    if (clerkUsername.length < 4) {
      clerkUsername = `${clerkUsername}_adm`;
    }

    const initialStatus = validated.password ? 'active' : 'pending_verification';
    const isEmailVerified = Boolean(validated.password);

    const clerkPayload: Record<string, unknown> = {
      emailAddress: [validated.email],
      username: clerkUsername,
      firstName,
      lastName,
      publicMetadata: {
        role: validated.role,
        adminSubRole: validated.adminSubRole,
        departmentId: department ? department._id.toString() : undefined,
        status: initialStatus,
      },
    };

    if (validated.password) {
      clerkPayload.password = validated.password;
    } else {
      clerkPayload.skipPasswordRequirement = true;
    }

    const client = await ProvisioningService.getClerkClient();
    let clerkUser: { id: string } | undefined = undefined;
    let wasAdopted = false;

    try {
      clerkUser = await client.users.createUser(
        clerkPayload as unknown as Parameters<typeof client.users.createUser>[0]
      );

      logger.info(
        `[ProvisioningService] Created Clerk identity: ${clerkUser.id} for admin ${validated.email}`
      );
    } catch (clerkErr: unknown) {
      const parsedErr = ProvisioningService.parseClerkError(clerkErr, validated.email, clerkUsername);

      // Handle retry after interrupted previous attempt:
      // If Clerk identity exists but has NO MongoDB record, safely adopt it.
      if (parsedErr instanceof ConflictError && client.users?.getUserList) {
        try {
          const existingList = await client.users.getUserList({ emailAddress: [validated.email] });
          const orphan = existingList.data?.find(
            (u) =>
              u.emailAddresses.some((e) => e.emailAddress.toLowerCase() === validated.email.toLowerCase()) ||
              u.username?.toLowerCase() === clerkUsername.toLowerCase()
          );

          if (orphan) {
            const alreadyLinked = await UserRepository.findByAuthProviderId(orphan.id);
            if (!alreadyLinked) {
              logger.info(
                `[ProvisioningService] Adopting unlinked Clerk identity ${orphan.id} for retry on admin ${validated.email}`
              );
              if (client.users.updateUser) {
                await client.users.updateUser(orphan.id, {
                  firstName,
                  lastName,
                  username: clerkUsername,
                });
              }
              if (client.users.updateUserMetadata) {
                await client.users.updateUserMetadata(orphan.id, {
                  publicMetadata: clerkPayload.publicMetadata as Record<string, unknown>,
                });
              }
              if (validated.password && client.users.updateUser) {
                await client.users.updateUser(orphan.id, {
                  password: validated.password,
                });
              }
              clerkUser = { id: orphan.id };
              wasAdopted = true;
            }
          }
        } catch (adoptErr) {
          logger.warn('[ProvisioningService] Orphan check deferred during admin retry', {
            error: adoptErr instanceof Error ? adoptErr.message : String(adoptErr),
          });
        }
      }

      if (!clerkUser) {
        logger.error('[ProvisioningService] Admin Clerk user creation failed', {
          error: parsedErr.message,
        });
        throw parsedErr;
      }
    }

    let createdUser: IUser;
    try {
      createdUser = await UserRepository.create({
        authProviderId: clerkUser.id,
        email: validated.email,
        username: validated.username,
        fullName: validated.fullName,
        role: validated.role,
        adminSubRole: validated.adminSubRole,
        status: initialStatus,
        isEmailVerified,
        departmentId: department ? department._id.toString() : undefined,
        provisionedBy: callerSession.userId,
        phoneNumber: validated.phoneNumber,
        adminProfile,
      });

      if (initialStatus === 'pending_verification') {
        try {
          await ActivationService.createActivationToken(createdUser);
        } catch (actErr) {
          logger.warn(
            `[ProvisioningService] Initial activation token generation deferred: ${actErr instanceof Error ? actErr.message : String(actErr)}`
          );
        }
      }
    } catch (dbErr: unknown) {
      if (!wasAdopted) {
        try {
          await client.users.deleteUser(clerkUser.id);
        } catch (rollbackErr) {
          logger.error(`[ProvisioningService] Failed rollback for ${clerkUser.id}`, { error: rollbackErr });
        }
      }
      throw dbErr;
    }

    return toUserDTO(createdUser);
  }
}

export default ProvisioningService;
