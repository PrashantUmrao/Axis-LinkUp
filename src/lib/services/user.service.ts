/**
 * User Service (Domain Business Logic Layer).
 * Enforces institutional business rules, permission checks, and mass-assignment protection.
 */

import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { createUserSchema, updateUserProfileSchema } from '@/lib/validations/user.schema';
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '@/lib/errors/app-error';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import { SessionService } from '@/lib/auth/session';
import type { UserDTO, UserSession, UserRole, UserStatus, AdminSubRole } from '@/types/user';

export class UserService {
  /**
   * Retrieves a sanitized user profile by internal MongoDB ObjectId.
   */
  public static async getUserById(id: string): Promise<UserDTO | null> {
    const user = await UserRepository.findById(id);
    return user ? toUserDTO(user) : null;
  }

  /**
   * Retrieves a user profile by institutional email.
   */
  public static async getUserByEmail(email: string): Promise<UserDTO | null> {
    const user = await UserRepository.findByEmail(email);
    return user ? toUserDTO(user) : null;
  }

  /**
   * Retrieves a user profile by institutional username.
   */
  public static async getUserByUsername(username: string): Promise<UserDTO | null> {
    const user = await UserRepository.findByUsername(username);
    return user ? toUserDTO(user) : null;
  }

  /**
   * Retrieves a user profile by identifier (either email or institutional username).
   */
  public static async getUserByIdentifier(identifier: string): Promise<UserDTO | null> {
    const user = await UserRepository.findByIdentifier(identifier);
    return user ? toUserDTO(user) : null;
  }

  /**
   * Retrieves a user profile by external authentication provider ID.
   */
  public static async getUserByAuthProviderId(providerId: string): Promise<UserDTO | null> {
    const user = await UserRepository.findByAuthProviderId(providerId);
    return user ? toUserDTO(user) : null;
  }

  /**
   * Creates a new user profile with strict uniqueness and constraint validation.
   */
  public static async createUser(rawInput: unknown): Promise<UserDTO> {
    const validated = createUserSchema.parse(rawInput);

    // 1. Assert email uniqueness
    const existingEmail = await UserRepository.findByEmail(validated.email);
    if (existingEmail) {
      throw new ConflictError(`A user with email "${validated.email}" already exists.`);
    }

    // 2. Assert username uniqueness if present
    if (validated.username) {
      const existingUsername = await UserRepository.findByUsername(validated.username);
      if (existingUsername) {
        throw new ConflictError(`A user with username "${validated.username}" already exists.`);
      }
    }

    // 3. Assert student roll number uniqueness if present
    if (validated.studentProfile?.rollNumber) {
      const existingRoll = await UserRepository.findByRollNumber(
        validated.studentProfile.rollNumber
      );
      if (existingRoll) {
        throw new ConflictError(
          `A student with roll number "${validated.studentProfile.rollNumber}" already exists.`
        );
      }
    }

    // 3. Assert faculty employee ID uniqueness if present
    if (validated.facultyProfile?.employeeId) {
      const existingEmployee = await UserRepository.findByEmployeeId(
        validated.facultyProfile.employeeId
      );
      if (existingEmployee) {
        throw new ConflictError(
          `A faculty member with employee ID "${validated.facultyProfile.employeeId}" already exists.`
        );
      }
    }

    // 4. Assert external authProviderId uniqueness if present
    if (validated.authProviderId) {
      const existingProvider = await UserRepository.findByAuthProviderId(validated.authProviderId);
      if (existingProvider) {
        throw new ConflictError('This external authentication account is already linked.');
      }
    }

    const created = await UserRepository.create(validated);
    return toUserDTO(created);
  }

  /**
   * Updates permitted self-service profile fields.
   * Enforces caller ownership and prevents mass-assignment of role or status.
   */
  public static async updateUserProfile(
    targetUserId: string,
    rawInput: unknown,
    callerSession: UserSession
  ): Promise<UserDTO> {
    // 1. Authorization Gate: Only the user themselves or Super Admin can edit profile
    if (callerSession.userId !== targetUserId && callerSession.role !== 'super_admin') {
      throw new ForbiddenError('You do not have permission to modify another user’s profile.');
    }

    // 2. Strict Whitelist Validation (Strips role, status, authProviderId, departmentId)
    const validatedUpdate = updateUserProfileSchema.parse(rawInput);

    // 3. Check target exists
    const existing = await UserRepository.findById(targetUserId);
    if (!existing) {
      throw new NotFoundError('User', targetUserId);
    }

    const updated = await UserRepository.updateProfile(targetUserId, validatedUpdate);
    if (!updated) {
      throw new NotFoundError('User', targetUserId);
    }

    return toUserDTO(updated);
  }

  /**
   * Mutates a user's system role (Protected Super Admin Gate).
   * Prevents self-demotion lockout if the caller is the last remaining Super Admin.
   */
  public static async updateUserRole(
    targetUserId: string,
    newRole: UserRole,
    callerSession: UserSession
  ): Promise<UserDTO> {
    // 1. Enforce System Administrator authority (DOC-REQ-003-REV2)
    assertCanManageUserRoles(
      callerSession,
      'Only Super Administrators or System Administrators are authorized to modify user roles.'
    );

    // 2. Prevent self-demotion lockout
    if (callerSession.userId === targetUserId && newRole !== 'super_admin') {
      const superAdminCount = await UserRepository.countByRole('super_admin');
      if (superAdminCount <= 1) {
        throw new ValidationError('Cannot demote the last remaining Super Administrator account.');
      }
    }

    const updated = await UserRepository.updateRole(targetUserId, newRole);
    if (!updated) {
      throw new NotFoundError('User', targetUserId);
    }

    // AUD-H12: Non-blockingly revoke active Clerk sessions on institutional role mutation
    if (updated.authProviderId) {
      try {
        await SessionService.revokeAllUserSessions(
          updated.authProviderId,
          `Institutional role updated to ${newRole}`
        );
      } catch {
        // Non-blocking revocation
      }
    }

    return toUserDTO(updated);
  }

  /**
   * Mutates account lifecycle status (Protected Admin Gate).
   */
  public static async updateUserStatus(
    targetUserId: string,
    newStatus: UserStatus,
    callerSession: UserSession
  ): Promise<UserDTO> {
    if (callerSession.role !== 'admin' && callerSession.role !== 'super_admin') {
      throw new ForbiddenError(
        'Only Administrators or Super Administrators may alter account status.'
      );
    }

    const updated = await UserRepository.updateStatus(targetUserId, newStatus);
    if (!updated) {
      throw new NotFoundError('User', targetUserId);
    }

    // AUD-H12: Non-blockingly revoke active Clerk sessions whenever account transitions to non-active status
    if (newStatus !== 'active' && updated.authProviderId) {
      try {
        await SessionService.revokeAllUserSessions(
          updated.authProviderId,
          `Account status updated to ${newStatus}`
        );
      } catch {
        // Non-blocking revocation
      }
    }

    return toUserDTO(updated);
  }

  /**
   * Mutates administrative sub-role (Protected Super Admin Gate).
   */
  public static async updateAdminSubRole(
    targetUserId: string,
    adminSubRole: AdminSubRole | null,
    callerSession: UserSession
  ): Promise<UserDTO> {
    // 1. Enforce System Administrator authority (DOC-REQ-003-REV2)
    assertCanManageUserRoles(
      callerSession,
      'Only Super Administrators or System Administrators are authorized to modify administrative sub-roles.'
    );

    const updated = await UserRepository.updateAdminSubRole(targetUserId, adminSubRole);
    if (!updated) {
      throw new NotFoundError('User', targetUserId);
    }

    return toUserDTO(updated);
  }

  /**
   * Verifies the active operational standing of an account.
   */
  public static async checkAccountStatus(
    userId: string
  ): Promise<{ isActive: boolean; status: UserStatus; isSuspended: boolean }> {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    return {
      isActive: user.status === 'active',
      status: user.status,
      isSuspended: user.status === 'suspended',
    };
  }
}

export default UserService;
