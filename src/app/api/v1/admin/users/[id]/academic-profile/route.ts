import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAuth } from '@/lib/auth/server';
import { ProfileService } from '@/lib/services/profile.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/admin/users/[id]/academic-profile
 * Administrative Academic Profile Mutation Route Handler.
 * Restricted to System Administrators and Department HODs (within departmental scope).
 * Enforces active department-program validation, and keeps rollNumber/enrollmentNumber immutable.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id: targetUserId } = await context.params;

    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError('Invalid target user identifier format.');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const updatedProfile = await ProfileService.updateAcademicProfile(
      targetUserId,
      body,
      session
    );

    logger.info(
      `[Audit] Administrative academic profile update for user ${targetUserId} by caller ${session.userId} (${session.role}${session.adminSubRole ? `/${session.adminSubRole}` : ''})`
    );

    return successResponse(updatedProfile, 'Academic profile updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

