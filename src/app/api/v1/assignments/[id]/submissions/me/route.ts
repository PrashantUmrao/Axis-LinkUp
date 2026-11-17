import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { AssignmentService } from '@/lib/services/assignment.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/assignments/[id]/submissions/me
 * Retrieves current student's own submission and evaluation.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const submission = await AssignmentService.getStudentSubmission(session, id);
    return successResponse(submission, 'Student submission retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
