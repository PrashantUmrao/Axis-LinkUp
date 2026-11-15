import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { clerkClient } from '@clerk/nextjs/server';
import { requireAuth } from '@/lib/auth';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import { connectToDatabase } from '@/lib/db/mongodb';
import UserModel, { toUserDTO } from '@/lib/db/models/user.model';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import type { UserStatus } from '@/types/user';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/admin/users/[id]
 * Fetch single user account details.
 * Strictly restricted to authorized System Administrators.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    assertCanManageUserRoles(session, 'Only System Administrators can inspect user accounts.');

    const { id } = await context.params;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid collegiate user identifier format.');
    }

    await connectToDatabase();
    const user = await UserModel.findById(id).exec();
    if (!user) {
      throw new NotFoundError(`User with identifier "${id}" not found.`);
    }

    return successResponse({ user: toUserDTO(user) }, 'User account retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/admin/users/[id]
 * Update collegiate user account details or status.
 * Supports:
 * - Status activation/deactivation/suspension (with Clerk IAM synchronization)
 * - Full name updates (with Clerk IAM synchronization)
 * - Phone number updates
 * Strictly isolates role elevation and protects the root System Administrator from deactivation.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    assertCanManageUserRoles(
      session,
      'Only System Administrators are authorized to update user account status or details.'
    );

    const { id } = await context.params;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid collegiate user identifier format.');
    }

    await connectToDatabase();
    const user = await UserModel.findById(id).exec();
    if (!user) {
      throw new NotFoundError(`User with identifier "${id}" not found.`);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { fullName, phoneNumber, status } = body;

    // Safety Invariant: Prevent deactivation or suspension of the root System Administrator
    if (
      status &&
      (status === 'deactivated' || status === 'suspended') &&
      (user.username === 'admin01' ||
        (user.role === 'super_admin' && user.adminSubRole === 'sys_admin' && user._id.toString() === session.userId))
    ) {
      throw new ForbiddenError(
        'Critical Security Invariant: The primary System Administrator account cannot be deactivated or suspended.'
      );
    }

    // Apply updates to MongoDB document
    let hasNameChange = false;
    let hasStatusChange = false;

    if (typeof fullName === 'string' && fullName.trim().length >= 2) {
      user.fullName = fullName.trim();
      hasNameChange = true;
    }

    if (typeof phoneNumber === 'string') {
      user.phoneNumber = phoneNumber.trim() || null;
    }

    if (
      typeof status === 'string' &&
      ['active', 'pending_verification', 'suspended', 'deactivated', 'archived'].includes(status)
    ) {
      user.status = status as UserStatus;
      hasStatusChange = true;
    }

    await user.save();

    // Synchronize changes to external Clerk IAM identity provider
    if (user.authProviderId && (hasNameChange || hasStatusChange)) {
      try {
        const client = await clerkClient();

        if (hasNameChange) {
          const nameSegments = user.fullName.split(/\s+/);
          const firstName = nameSegments[0] || 'Collegiate';
          const lastName = nameSegments.slice(1).join(' ') || '';
          await client.users.updateUser(user.authProviderId, {
            firstName,
            lastName,
          });
        }

        if (hasStatusChange) {
          await client.users.updateUserMetadata(user.authProviderId, {
            publicMetadata: {
              status: user.status,
            },
          });
        }

        logger.info(
          `[AdminUserUpdate] Synchronized Clerk identity ${user.authProviderId} for user ${user.email} (status: ${user.status})`
        );
      } catch (clerkErr) {
        logger.warn(
          `[AdminUserUpdate] Clerk identity synchronization deferred: ${clerkErr instanceof Error ? clerkErr.message : String(clerkErr)}`
        );
      }
    }

    logger.info(
      `[Audit] System Administrator ${session.userId} updated user ${user.email} (${user._id})`
    );

    return successResponse(
      { user: toUserDTO(user) },
      'User account updated successfully',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

