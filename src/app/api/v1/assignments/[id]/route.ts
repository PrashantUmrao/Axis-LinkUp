import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { AssignmentService } from '@/lib/services/assignment.service';
import { updateAssignmentSchema } from '@/lib/validations/assignment.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/assignments/[id]
 * Retrieves details of a specific assignment.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const assignment = await AssignmentService.getAssignmentById(session, id);
    return successResponse(assignment, 'Assignment details retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/assignments/[id]
 * Updates an assignment (Author or HOD only).
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await req.json();
    const parseResult = updateAssignmentSchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid assignment update payload', parseResult.error.flatten());
    }

    const updated = await AssignmentService.updateAssignment(session, id, parseResult.data);
    return successResponse(updated, 'Assignment updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/assignments/[id]
 * Permanently removes a draft assignment with zero submissions.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const result = await AssignmentService.deleteAssignment(session, id);
    return successResponse(result, 'Assignment deleted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
