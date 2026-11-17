import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { AssignmentService } from '@/lib/services/assignment.service';
import {
  submitAssignmentSchema,
  submissionFilterSchema,
} from '@/lib/validations/assignment.schema';
import { successResponse, createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/assignments/[id]/submissions
 * Lists all student submissions for an assignment (Faculty or HOD only).
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      status: searchParams.get('status') || undefined,
      isLate: searchParams.get('isLate') || undefined,
      isGraded: searchParams.get('isGraded') || undefined,
      limit: searchParams.get('limit') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    };

    const parseResult = submissionFilterSchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid submission filter parameters', parseResult.error.flatten());
    }

    const result = await AssignmentService.getAssignmentSubmissions(session, id, parseResult.data);
    return successResponse(result, 'Submissions retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/assignments/[id]/submissions
 * Dispatches a coursework submission or resubmission (Student only).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await req.json();
    const parseResult = submitAssignmentSchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid submission payload', parseResult.error.flatten());
    }

    const created = await AssignmentService.submitAssignment(session, id, parseResult.data);
    return createdResponse(created, 'Assignment submitted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
