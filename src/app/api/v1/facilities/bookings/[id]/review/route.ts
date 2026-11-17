import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { FacilityService } from '@/lib/services/facility.service';
import { reviewBookingSchema } from '@/lib/validations/facility.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/facilities/bookings/[id]/review
 * Approves or rejects a pending space reservation with atomic overlap verification.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      ['admin', 'super_admin'],
      'Only administrators may approve or reject facility booking requests.'
    );

    const { id } = await params;
    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid booking ID format');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = reviewBookingSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid review decision payload', parseResult.error.flatten());
    }

    const updated = await FacilityService.reviewBooking(session, id, parseResult.data);
    return successResponse(
      updated,
      parseResult.data.action === 'approve'
        ? 'Facility booking approved successfully'
        : 'Facility booking rejected'
    );
  } catch (error) {
    return handleApiError(error);
  }
}
