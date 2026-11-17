import type { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/server';
import { FacilityService } from '@/lib/services/facility.service';
import { updateFacilitySchema } from '@/lib/validations/facility.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/facilities/[id]
 * Retrieves facility specifications alongside upcoming approved bookings.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid facility ID format');
    }

    const detail = await FacilityService.getFacilityById(session, id);
    return successResponse(detail, 'Facility details retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/facilities/[id]
 * Updates facility specifications or maintenance status (admin & super_admin only).
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      ['admin', 'super_admin'],
      'Only administrators can modify campus facility details or maintenance status.'
    );

    const { id } = await params;
    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid facility ID format');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = updateFacilitySchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid facility update payload', parseResult.error.flatten());
    }

    const updated = await FacilityService.updateFacility(session, id, parseResult.data);
    return successResponse(updated, 'Campus facility updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
