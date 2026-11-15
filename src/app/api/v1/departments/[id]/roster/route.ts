import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAuth } from '@/lib/auth/server';
import { ProfileService } from '@/lib/services/profile.service';
import { departmentRosterQuerySchema } from '@/lib/validations/user.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/departments/[id]/roster
 * Retrieves academic student roster for an academic department.
 * Restricted to department Faculty, HOD, Director, and System Administrators.
 * Students receive HTTP 403 Forbidden.
 * Supports program, batchYear, currentSemester, section filters, and cursor/page pagination.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id: departmentId } = await context.params;

    if (!departmentId || !Types.ObjectId.isValid(departmentId)) {
      throw new ValidationError('Invalid department identifier format.');
    }

    // Extract search parameters
    const { searchParams } = new URL(req.url);
    const rawQuery = {
      program: searchParams.get('program') || undefined,
      batchYear: searchParams.get('batchYear') || undefined,
      currentSemester: searchParams.get('currentSemester') || undefined,
      section: searchParams.get('section') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    };

    const queryOptions = departmentRosterQuerySchema.parse(rawQuery);

    const roster = await ProfileService.getDepartmentRoster(departmentId, session, queryOptions);

    return successResponse(roster, 'Department academic roster retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

