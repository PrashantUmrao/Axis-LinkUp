import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { FacilityService } from '@/lib/services/facility.service';
import { cancelBookingSchema } from '@/lib/validations/facility.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/facilities/bookings/[id]/cancel
 * Cancels a pending or upcoming approved facility booking.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      ['faculty', 'admin', 'super_admin'],
      'Only faculty and administrators may cancel facility bookings.'
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

    const parseResult = cancelBookingSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid cancellation payload', parseResult.error.flatten());
    }

    const updated = await FacilityService.cancelBooking(session, id, parseResult.data);
    return successResponse(updated, 'Facility booking cancelled successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
