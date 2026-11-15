import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ComplaintService } from '@/lib/services/complaint.service';
import { addComplaintResponseSchema } from '@/lib/validations/complaint.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/complaints/[id]/responses
 * Appends a follow-up (Student) or official response (Authority) to the grievance thread.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid complaint ID format');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = addComplaintResponseSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid response payload', parseResult.error.flatten());
    }

    const updatedComplaint = await ComplaintService.addResponse(session, id, parseResult.data);

    return createdResponse(updatedComplaint, 'Response appended successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

