import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { AssignmentService } from '@/lib/services/assignment.service';
import {
  createAssignmentSchema,
  assignmentFilterSchema,
} from '@/lib/validations/assignment.schema';
import { successResponse, createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/assignments
 * Lists assignments with role-based visibility and filters.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      status: searchParams.get('status') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      courseCode: searchParams.get('courseCode') || undefined,
      semester: searchParams.get('semester') || undefined,
      section: searchParams.get('section') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    };

    const parseResult = assignmentFilterSchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid assignment filter parameters', parseResult.error.flatten());
    }

    const result = await AssignmentService.getAssignments(session, parseResult.data);
    return successResponse(result, 'Assignments retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/assignments
 * Creates a new assignment (Faculty or HOD only).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await req.json();
    const parseResult = createAssignmentSchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid assignment payload', parseResult.error.flatten());
    }

    const created = await AssignmentService.createAssignment(session, parseResult.data);
    return createdResponse(created, 'Assignment created successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
