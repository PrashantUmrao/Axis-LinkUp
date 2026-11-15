/**
 * Core Role-Based Access Control (RBAC) & Attribute-Based (ABAC) Engine.
 * Evaluates fine-grained permissions, ownership gates, and departmental boundaries.
 * Strictly enforces Deny-by-Default (DOC-AUTH-005).
 */

import {
  ROLE_PERMISSIONS_MATRIX,
  ROLE_HIERARCHY,
  type Permission,
  type PermissionScope,
  type ResourceContext,
} from './permissions';
import { ForbiddenError } from '@/lib/errors/app-error';
import type { UserRole, UserSession } from '@/types/user';

/**
 * Resolves the permission scope for a given role and permission.
 * Denies by default if role or permission is unmapped.
 */
export function getPermissionScope(role: UserRole, permission: Permission): PermissionScope {
  const roleMapping = ROLE_PERMISSIONS_MATRIX[role];
  if (!roleMapping) return 'DENY';
  return roleMapping[permission] ?? 'DENY';
}

/**
 * Checks whether a given role holds the capability to execute a permission,
 * optionally evaluating resource-level ownership or departmental scopes (ABAC).
 */
export function hasPermission(
  role: UserRole,
  permission: Permission,
  context?: ResourceContext,
  user?: Pick<UserSession, 'userId' | 'departmentId'>
): boolean {
  const scope = getPermissionScope(role, permission);

  // 1. Prohibited unconditionally
  if (scope === 'DENY') {
    return false;
  }

  // 2. Allowed unconditionally across role scope
  if (scope === 'ALLOW') {
    return true;
  }

  // 3. Resource Ownership Gate (ABAC)
  if (scope === 'OWN') {
    if (!context || !user?.userId) {
      // Cannot grant OWN without verified caller ID and resource context
      return false;
    }

    // Direct creator/owner match
    if (context.ownerId && context.ownerId === user.userId) {
      return true;
    }

    // Assigned course instructor match
    if (context.instructorIds && context.instructorIds.includes(user.userId)) {
      return true;
    }

    // Assigned academic mentor match
    if (context.mentorId && context.mentorId === user.userId) {
      return true;
    }

    return false;
  }

  // 4. Departmental Scope Gate (ABAC)
  if (scope === 'DEPT') {
    if (role === 'super_admin') {
      return true;
    }

    if (!context?.departmentId || !user?.departmentId) {
      return false;
    }

    return user.departmentId === context.departmentId;
  }

  // Fallback: Deny by default
  return false;
}

/**
 * Evaluates whether an authenticated UserSession can execute an action on a target resource.
 */
export function canAccessResource(
  user: UserSession,
  permission: Permission,
  context?: ResourceContext
): boolean {
  if (!user || !user.role) return false;
  return hasPermission(user.role, permission, context, user);
}

/**
 * Evaluates role hierarchy (e.g. checking if user is at least 'faculty').
 */
export function isRoleAtLeast(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 999;
  return userLevel >= requiredLevel;
}

/**
 * Asserts that the caller holds one of the specified allowed roles.
 * Throws ForbiddenError if caller's role is not in the set.
 */
export function assertRole(
  userRole: UserRole,
  allowedRoles: UserRole | UserRole[],
  customMessage?: string
): void {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!roles.includes(userRole)) {
    throw new ForbiddenError(
      customMessage ??
        `Access denied. Requires one of [${roles.join(', ')}], but current role is '${userRole}'.`
    );
  }
}

/**
 * Asserts that the authenticated user possesses permission to access the resource.
 * Throws ForbiddenError on denial.
 */
export function assertPermission(
  user: UserSession,
  permission: Permission,
  context?: ResourceContext,
  customMessage?: string
): void {
  const permitted = canAccessResource(user, permission, context);
  if (!permitted) {
    throw new ForbiddenError(
      customMessage ?? `Access denied. Insufficient permissions for action '${permission}'.`
    );
  }
}

/**
 * Asserts that the caller is the verified owner of a resource.
 * Throws ForbiddenError if caller ID does not match resource owner ID.
 */
export function assertResourceOwnership(
  callerId: string,
  resourceOwnerId: string,
  customMessage?: string
): void {
  if (!callerId || !resourceOwnerId || callerId !== resourceOwnerId) {
    throw new ForbiddenError(
      customMessage ?? 'Access denied. You can only view or modify your own resources.'
    );
  }
}

/**
 * Asserts departmental scoping for administrative operations.
 * Super Admins bypass departmental isolation.
 */
export function assertDepartmentScope(
  userDeptId: string | undefined,
  resourceDeptId: string | undefined,
  role: UserRole,
  customMessage?: string
): void {
  if (role === 'super_admin') return;

  if (!userDeptId || !resourceDeptId || userDeptId !== resourceDeptId) {
    throw new ForbiddenError(
      customMessage ??
        'Access denied. Operation restricted to resources within your assigned department.'
    );
  }
}

/**
 * Checks whether an authenticated user is a System Administrator.
 * System Administrators possess global IAM provisioning and configuration authority.
 */
export function isSysAdmin(user: Pick<UserSession, 'role' | 'adminSubRole'>): boolean {
  return (
    user.role === 'super_admin' && (user.adminSubRole === 'sys_admin' || !user.adminSubRole)
  );
}

/**
 * Checks whether an authenticated user is a Department Head (HOD).
 * HODs possess department-scoped academic and grievance review privileges.
 */
export function isHOD(user: Pick<UserSession, 'role' | 'adminSubRole'>): boolean {
  return user.role === 'admin' && user.adminSubRole === 'hod';
}

/**
 * Checks whether an authenticated user is the Executive Director.
 * The Director possesses global executive grievance and appellate resolution privileges,
 * but does not perform routine IAM account provisioning.
 */
export function isDirector(user: Pick<UserSession, 'role' | 'adminSubRole'>): boolean {
  return user.role === 'super_admin' && user.adminSubRole === 'director';
}

/**
 * Checks whether an authenticated user holds authority to provision accounts or mutate roles.
 * Restricted to System Administrators (or root super admins), excluding Department HODs and Director.
 */
export function canManageUserRoles(user: Pick<UserSession, 'role' | 'adminSubRole'>): boolean {
  return (
    user.role === 'super_admin' && (user.adminSubRole === 'sys_admin' || !user.adminSubRole)
  );
}

/**
 * Asserts that the caller is authorized to modify user roles or administrative sub-roles.
 * Throws ForbiddenError if caller does not possess IAM management authority.
 */
export function assertCanManageUserRoles(
  user: Pick<UserSession, 'role' | 'adminSubRole'>,
  customMessage?: string
): void {
  if (!canManageUserRoles(user)) {
    throw new ForbiddenError(
      customMessage ??
        'Access denied. Only System Administrators are authorized to manage user roles and administrative assignments.'
    );
  }
}
