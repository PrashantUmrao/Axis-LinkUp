/**
 * Server-Side Authentication & Authorization Guards.
 * Securely extracts authenticated identity from Clerk session claims and MongoDB Atlas.
 * Validates permissions, roles, and resource boundaries in Server Actions and Route Handlers.
 */

import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import {
  assertRole,
  assertPermission,
  assertResourceOwnership,
  assertDepartmentScope,
} from './rbac';
import type { Permission, ResourceContext } from './permissions';
import type { UserRole, UserSession } from '@/types/user';

let __testSessionOverride: UserSession | null | undefined = undefined;

/**
 * Test helper to override current user session in automated test environments.
 * Strictly prohibited in production builds (throws if NODE_ENV === 'production').
 * Set to undefined in afterEach/cleanup to restore default Clerk behavior.
 */
export function __setTestSession(session: UserSession | null | undefined): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('__setTestSession is strictly prohibited in production environments.');
  }
  __testSessionOverride = session;
}

/**
 * Resolves an authoritative UserSession strictly from a pre-provisioned MongoDB user record.
 * Fail-closed: NEVER synthesizes an active session from Clerk JWT claims if no DB user exists.
 */
export async function resolveProvisionedSession(
  userId: string,
  sessionId?: string | null
): Promise<UserSession | null> {
  const user = await UserRepository.findByAuthProviderId(userId);

  if (!user) {
    logger.warn(
      `[Auth] Fail-closed: rejecting unprovisioned Clerk identity (${userId}) with no MongoDB user record.`
    );
    return null;
  }

  return {
    userId: user._id.toString(),
    sessionId: sessionId ?? undefined,
    authProviderId: user.authProviderId,
    email: user.email,
    username: user.username ?? undefined,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? undefined,
    role: user.role,
    adminSubRole: user.adminSubRole ?? undefined,
    status: user.status,
    departmentId: user.departmentId ? user.departmentId.toString() : undefined,
  };
}

/**
 * Resolves the currently authenticated user session.
 * Returns null if the request is unauthenticated or if no provisioned MongoDB user record exists.
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  if (process.env.NODE_ENV !== 'production' && __testSessionOverride !== undefined) {
    return __testSessionOverride;
  }

  const { userId, sessionId } = await auth();
  if (!userId) {
    return null;
  }

  // Connect to DB and fetch authoritative provisioned identity (fail-closed)
  await connectToDatabase();
  return resolveProvisionedSession(userId, sessionId);
}

/**
 * Asserts that the caller is authenticated and holds an active, non-suspended account.
 * Throws UnauthorizedError (401) if unauthenticated.
 * Throws ForbiddenError (403) if account is suspended, deactivated, or pending verification.
 */
export async function requireAuth(): Promise<UserSession> {
  const session = await getCurrentSession();

  if (!session) {
    throw new UnauthorizedError('Authentication required. Please sign in to continue.');
  }

  // Account Lifecycle Status Gates (AUD-H12: uniformly enforce status === 'active')
  const effectiveStatus = session.status ?? 'active';

  if (effectiveStatus === 'suspended') {
    throw new ForbiddenError(
      'Account under administrative hold. Contact the Office of Academic Affairs.'
    );
  }

  if (effectiveStatus === 'pending_verification' || effectiveStatus === 'invited') {
    throw new ForbiddenError(
      'Account registration is pending activation or official registrar roster verification.'
    );
  }

  if (effectiveStatus !== 'active') {
    throw new ForbiddenError(
      `Collegiate account is not active (current status: ${effectiveStatus}).`
    );
  }

  return session;
}

/**
 * Requires the caller to hold one of the specified roles.
 * Resolves authenticated identity and asserts role membership.
 */
export async function requireRole(
  allowedRoles: UserRole | UserRole[],
  customMessage?: string
): Promise<UserSession> {
  const session = await requireAuth();
  assertRole(session.role, allowedRoles, customMessage);
  return session;
}

/**
 * Requires the caller to possess a specific fine-grained permission,
 * optionally verifying ABAC resource ownership or departmental scoping.
 */
export async function requirePermission(
  permission: Permission,
  context?: ResourceContext,
  customMessage?: string
): Promise<UserSession> {
  const session = await requireAuth();
  assertPermission(session, permission, context, customMessage);
  return session;
}

/**
 * Requires the caller to be the direct owner of the specified resource.
 */
export async function requireResourceOwnership(
  resourceOwnerId: string,
  customMessage?: string
): Promise<UserSession> {
  const session = await requireAuth();
  assertResourceOwnership(session.userId, resourceOwnerId, customMessage);
  return session;
}

/**
 * Requires the caller to operate within their assigned department.
 * Super Admins bypass departmental isolation.
 */
export async function requireDepartmentScope(
  resourceDeptId: string | undefined,
  customMessage?: string
): Promise<UserSession> {
  const session = await requireAuth();
  assertDepartmentScope(session.departmentId, resourceDeptId, session.role, customMessage);
  return session;
}
