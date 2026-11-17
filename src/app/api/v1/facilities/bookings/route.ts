import type { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/server';
import { FacilityService } from '@/lib/services/facility.service';
import {
  bookingQuerySchema,
  createBookingSchema,
} from '@/lib/validations/facility.schema';
import { successResponse, createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/facilities/bookings
 * Lists persona-scoped facility bookings.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('search')) rawQuery.search = searchParams.get('search');
    if (searchParams.get('facilityId')) rawQuery.facilityId = searchParams.get('facilityId');
    if (searchParams.get('status')) rawQuery.status = searchParams.get('status');
    if (searchParams.get('dateFrom')) rawQuery.dateFrom = searchParams.get('dateFrom');
    if (searchParams.get('dateTo')) rawQuery.dateTo = searchParams.get('dateTo');
    if (searchParams.get('scope')) rawQuery.scope = searchParams.get('scope');
    if (searchParams.get('page')) rawQuery.page = searchParams.get('page');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');

    const parseResult = bookingQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid booking filter parameters', parseResult.error.flatten());
    }

    const result = await FacilityService.listBookings(session, parseResult.data);
    return successResponse(result, 'Facility bookings retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/facilities/bookings
 * Submits a campus space reservation request (faculty, admin, super_admin).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(
      ['faculty', 'admin', 'super_admin'],
      'Only faculty and administrators are permitted to book campus facilities.'
    );

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = createBookingSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid booking reservation payload', parseResult.error.flatten());
    }

    const created = await FacilityService.createBooking(session, parseResult.data);
    return createdResponse(created, 'Facility booking request submitted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
