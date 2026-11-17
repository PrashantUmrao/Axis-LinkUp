import type { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/server';
import { PassportService } from '@/lib/services/passport.service';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/passport/[id]
 * Retrieves detailed view of a single achievement claim (author or authorized verifier).
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    if (!objectIdSchema.safeParse(id).success) {
      throw new ValidationError('Invalid achievement claim ID format');
    }

    const claim = await PassportService.getAchievementById(session, id);
    return successResponse(claim, 'Achievement claim retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/passport/[id]
 * Resubmits a rejected achievement claim with updated proof/details (students only, max 1 resubmission).
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      'student',
      'Only enrolled students may resubmit their rejected achievement claims.'
    );

    const { id } = await params;
    if (!objectIdSchema.safeParse(id).success) {
      throw new ValidationError('Invalid achievement claim ID format');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const updated = await PassportService.resubmitAchievement(session, id, rawBody);
    return successResponse(updated, 'Achievement claim resubmitted for faculty verification');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/passport/[id]
 * Withdraws an unverified pending claim (students only; verified claims are locked).
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      'student',
      'Only enrolled students may withdraw their pending achievement claims.'
    );

    const { id } = await params;
    if (!objectIdSchema.safeParse(id).success) {
      throw new ValidationError('Invalid achievement claim ID format');
    }

    const result = await PassportService.deleteOwnPendingAchievement(session, id);
    return successResponse(result, 'Pending achievement claim withdrawn successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
