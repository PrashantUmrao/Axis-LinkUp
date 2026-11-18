import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { clerkClient } from '@clerk/nextjs/server';
import { requireAuth } from '@/lib/auth';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import { SessionService } from '@/lib/auth/session';
import { connectToDatabase } from '@/lib/db/mongodb';
import UserModel, { toUserDTO } from '@/lib/db/models/user.model';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import type { UserStatus } from '@/types/user';

export const dynamic = 'force-dynamic';

const adminPatchUserSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100).optional(),
    phoneNumber: z.string().trim().max(20).nullable().optional(),
    status: z
      .enum([
        'active',
        'pending_verification',
        'suspended',
        'deactivated',
        'archived',
        'graduated',
        'invited',
      ])
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.fullName !== undefined || data.phoneNumber !== undefined || data.status !== undefined,
    { message: 'At least one updatable field (fullName, phoneNumber, or status) must be provided.' }
  );

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

    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
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
 * Update collegiate user account details or status with strict Zod validation (AUD-M04).
 * Protects self and any active Super Administrator from being transitioned to ANY non-active status,
 * and revokes active Clerk sessions on non-active transitions (AUD-H12).
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

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON request body.');
    }

    const parsed = adminPatchUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ValidationError('Invalid user update payload', parsed.error.flatten());
    }

    const { fullName, phoneNumber, status } = parsed.data;

    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
    const user = await UserModel.findById(id).exec();
    if (!user) {
      throw new NotFoundError(`User with identifier "${id}" not found.`);
    }

    // AUD-M04 Safety Invariant: Block transitioning self OR any active root/super_admin
    // to ANY non-active status (suspended, deactivated, archived, pending_verification, graduated, invited)
    if (status && status !== 'active') {
      const isSelf = user._id.toString() === session.userId;
      const isActiveSuperAdmin = user.role === 'super_admin' && user.status === 'active';
      const isLegacyRoot = user.username === 'admin01';

      if (isSelf || isActiveSuperAdmin || isLegacyRoot) {
        throw new ForbiddenError(
          'Critical Security Invariant: Self-disabling or transitioning an active Super Administrator to a non-active status is prohibited.'
        );
      }
    }

    // Apply validated updates to MongoDB document
    let hasNameChange = false;
    let hasStatusChange = false;

    if (fullName !== undefined) {
      user.fullName = fullName;
      hasNameChange = true;
    }

    if (phoneNumber !== undefined) {
      user.phoneNumber = phoneNumber ? phoneNumber.trim() || null : null;
    }

    if (status !== undefined) {
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

      // AUD-H12: Revoke active Clerk sessions when transitioning to any non-active status
      if (hasStatusChange && user.status !== 'active') {
        try {
          await SessionService.revokeAllUserSessions(
            user.authProviderId,
            `Administrative status change to ${user.status}`
          );
        } catch {
          // Non-blocking revocation
        }
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
