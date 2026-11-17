import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { AssignmentService } from '@/lib/services/assignment.service';
import { evaluateSubmissionSchema } from '@/lib/validations/assignment.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; submissionId: string }>;
}

/**
 * POST /api/v1/assignments/[id]/submissions/[submissionId]/evaluate
 * Grades a student submission and awards marks (Faculty author or HOD only).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id, submissionId } = await params;

    const body = await req.json();
    const parseResult = evaluateSubmissionSchema.safeParse(body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid evaluation payload', parseResult.error.flatten());
    }

    const evaluated = await AssignmentService.evaluateSubmission(
      session,
      id,
      submissionId,
      parseResult.data
    );

    return successResponse(evaluated, 'Submission evaluated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
