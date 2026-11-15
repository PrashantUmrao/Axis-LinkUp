import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAuth } from '@/lib/auth/server';
import { ProfileService } from '@/lib/services/profile.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/users/[id]/profile
 * Retrieves another collegiate user's profile with context-aware privacy projection.
 * Applies faculty phone privacy rules, student PII masking, and role boundaries.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid target user identifier format.');
    }

    const profile = await ProfileService.getProfileById(id, session);

    return successResponse(profile, 'User profile retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

