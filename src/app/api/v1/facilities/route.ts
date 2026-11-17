import type { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/server';
import { FacilityService } from '@/lib/services/facility.service';
import {
  createFacilitySchema,
  facilityQuerySchema,
} from '@/lib/validations/facility.schema';
import { successResponse, createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/facilities
 * Lists and searches campus spaces, laboratories, seminar halls, and auditoriums.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('search')) rawQuery.search = searchParams.get('search');
    if (searchParams.get('building')) rawQuery.building = searchParams.get('building');
    if (searchParams.get('type')) rawQuery.type = searchParams.get('type');
    if (searchParams.get('status')) rawQuery.status = searchParams.get('status');
    if (searchParams.get('department')) rawQuery.department = searchParams.get('department');
    if (searchParams.get('minCapacity')) rawQuery.minCapacity = searchParams.get('minCapacity');
    if (searchParams.get('amenity')) rawQuery.amenity = searchParams.get('amenity');
    if (searchParams.get('page')) rawQuery.page = searchParams.get('page');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');

    const parseResult = facilityQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid facility filter parameters', parseResult.error.flatten());
    }

    const result = await FacilityService.listFacilities(session, parseResult.data);
    return successResponse(result, 'Campus facilities retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/facilities
 * Creates a new campus facility/space (admin & super_admin only).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(
      ['admin', 'super_admin'],
      'Only administrators can register new campus spaces and laboratories.'
    );

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = createFacilitySchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid facility creation payload', parseResult.error.flatten());
    }

    const created = await FacilityService.createFacility(session, parseResult.data);
    return createdResponse(created, 'Campus facility created successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
