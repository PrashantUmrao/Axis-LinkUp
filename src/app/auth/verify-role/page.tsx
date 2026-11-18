import { auth, clerkClient } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/db/mongodb';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import {
  getRoleDashboard,
  isValidPortalForRole,
  isAuthorizedRouteForRole,
  sanitizeRedirectUrl,
} from '@/lib/auth/routing';
import { logger } from '@/lib/logging/logger';

export const dynamic = 'force-dynamic';

interface VerifyRolePageProps {
  searchParams: Promise<{
    portal?: string;
    redirect_url?: string;
  }>;
}

export default async function VerifyRolePage({ searchParams }: VerifyRolePageProps) {
  const { portal: portalParam, redirect_url: redirectUrl } = await searchParams;
  const cookieStore = await cookies();
  const portalCookie = cookieStore.get('axis_selected_portal')?.value;
  const portal = portalParam || portalCookie;
  const { userId } = await auth();

  // 1. Unauthenticated boundary
  if (!userId) {
    redirect(portal ? `/sign-in?portal=${encodeURIComponent(portal)}` : '/sign-in');
  }

  // 2. Connect to MongoDB Atlas
  await connectToDatabase();

  // 3. Resolve authoritative collegiate identity
  let user = await UserRepository.findByAuthProviderId(userId);

  if (!user) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      const username = clerkUser.username;

      for (const emailObj of clerkUser.emailAddresses) {
        if (!user && emailObj.emailAddress) {
          user = await UserRepository.findByEmail(emailObj.emailAddress.toLowerCase().trim());
        }
      }
      if (!user && username) {
        user = await UserRepository.findByUsername(username.toLowerCase().trim());
      }

      if (user) {
        await UserRepository.linkAuthProviderId(user.email, userId);
        logger.info(`[VerifyRole] Linked Clerk authProviderId (${userId}) to user ${user.email}`);
      }
    } catch (lookupErr) {
      logger.error('[VerifyRole] Failed resolving Clerk user profile during verify', {
        error: lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
      });
    }
  }

  // 4. Closed Registration Gate: Account must be pre-provisioned in MongoDB (fail-closed)
  if (!user) {
    logger.warn(`[VerifyRole] Rejected unprovisioned user: ${userId}`);
    try {
      cookieStore.delete('axis_selected_portal');
    } catch {
      // Non-fatal if response headers already committed
    }
    redirect('/unauthorized?error=not_provisioned');
  }

  // 5. Account Lifecycle Status Ingress Gates
  if (user.status === 'suspended') {
    redirect('/account-suspended');
  }

  if (user.status === 'pending_verification') {
    redirect('/pending-approval');
  }

  if (user.status === 'deactivated' || user.status === 'archived' || user.status === 'graduated') {
    redirect('/unauthorized?error=inactive_account');
  }

  if (user.status !== 'active') {
    redirect('/unauthorized?error=not_active');
  }

  // 6. Zero-Trust Portal Door vs. Authoritative Role Verification
  if (portal) {
    const isPortalAllowed = isValidPortalForRole(
      portal,
      user.role,
      user.adminSubRole ?? undefined
    );

    if (!isPortalAllowed) {
      logger.warn(
        `[VerifyRole] Role mismatch detected. User ${user.email} (role: ${user.role}) selected ${portal} portal.`
      );
      redirect(
        `/role-mismatch?expected=${encodeURIComponent(portal)}&actual=${encodeURIComponent(
          user.role
        )}&portal=${encodeURIComponent(portal)}`
      );
    }
  }

  // 7. Synchronize Clerk User Metadata to ensure Edge Middleware JWT freshness
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const existingMeta = (clerkUser.publicMetadata as Record<string, unknown>) ?? {};

    if (
      existingMeta.role !== user.role ||
      existingMeta.status !== user.status ||
      existingMeta.adminSubRole !== user.adminSubRole
    ) {
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          role: user.role,
          adminSubRole: user.adminSubRole || undefined,
          status: user.status,
          departmentId: user.departmentId ? user.departmentId.toString() : undefined,
        },
      });
      logger.info(`[VerifyRole] Synchronized Clerk publicMetadata for user ${user.email}`);
    }
  } catch (syncErr) {
    logger.warn('[VerifyRole] Non-fatal Clerk publicMetadata sync deferred', {
      error: syncErr instanceof Error ? syncErr.message : String(syncErr),
    });
  }

  // 8. Authorized Target Navigation
  try {
    cookieStore.delete('axis_selected_portal');
  } catch {
    // Non-fatal if response stream started
  }

  const defaultDashboard = getRoleDashboard(user.role, user.adminSubRole ?? undefined);

  if (redirectUrl) {
    const safeUrl = sanitizeRedirectUrl(redirectUrl);
    if (
      safeUrl !== '/' &&
      safeUrl !== '/sign-in' &&
      isAuthorizedRouteForRole(safeUrl, user.role, user.adminSubRole ?? undefined)
    ) {
      redirect(safeUrl);
    }
  }

  redirect(defaultDashboard);
}

