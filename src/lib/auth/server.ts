/**
 * Server-Side Authentication & Authorization Guards.
 * Securely extracts authenticated identity from Clerk session claims and MongoDB Atlas.
 * Validates permissions, roles, and resource boundaries in Server Actions and Route Handlers.
 */

import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors/app-error';
import {
  assertRole,
  assertPermission,
  assertResourceOwnership,
  assertDepartmentScope,
} from './rbac';
import type { Permission, ResourceContext } from './permissions';
import type { UserRole, UserSession, UserStatus, AdminSubRole } from '@/types/user';

let __testSessionOverride: UserSession | null | undefined = undefined;

/**
 * Test helper to override current user session in automated test environments.
 * Set to undefined in afterEach/cleanup to restore default Clerk behavior.
 */
export function __setTestSession(session: UserSession | null | undefined): void {
  __testSessionOverride = session;
}

/**
 * Resolves the currently authenticated user session.
 * Returns null if the request is unauthenticated or user record does not exist.
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  if (__testSessionOverride !== undefined) {
    return __testSessionOverride;
  }

  const { userId, sessionId, sessionClaims } = await auth();
  if (!userId) {
    return null;
  }

  // Connect to DB and fetch authoritative identity
  await connectToDatabase();
  const user = await UserRepository.findByAuthProviderId(userId);

  if (!user) {
    // If webhook sync is still executing, use session claims fallback
    const metadata =
      (sessionClaims?.publicMetadata as {
        role?: UserRole;
        adminSubRole?: AdminSubRole;
        status?: UserStatus;
        departmentId?: string;
      }) ?? {};

    return {
      userId,
      sessionId: sessionId ?? undefined,
      authProviderId: userId,
      email: (sessionClaims?.email as string) || '',
      username: (sessionClaims?.username as string) || undefined,
      fullName: (sessionClaims?.fullName as string) || (sessionClaims?.name as string) || undefined,
      avatarUrl:
        (sessionClaims?.picture as string) || (sessionClaims?.imageUrl as string) || undefined,
      role: metadata.role || 'student',
      adminSubRole: metadata.adminSubRole,
      status: metadata.status || 'active',
      departmentId: metadata.departmentId,
    };
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
 * Asserts that the caller is authenticated and holds an active, non-suspended account.
 * Throws UnauthorizedError (401) if unauthenticated.
 * Throws ForbiddenError (403) if account is suspended, deactivated, or pending verification.
 */
export async function requireAuth(): Promise<UserSession> {
  const session = await getCurrentSession();

  if (!session) {
    throw new UnauthorizedError('Authentication required. Please sign in to continue.');
  }

  // Account Lifecycle Status Gates
  if (session.status === 'suspended') {
    throw new ForbiddenError(
      'Account under administrative hold. Contact the Office of Academic Affairs.'
    );
  }

  if (session.status === 'pending_verification') {
    throw new ForbiddenError(
      'Account registration is pending official registrar roster verification.'
    );
  }

  if (session.status === 'deactivated' || session.status === 'archived') {
    throw new ForbiddenError('Collegiate account is inactive or has been archived.');
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
