import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ComplaintService } from '@/lib/services/complaint.service';
import { updateComplaintStatusSchema } from '@/lib/validations/complaint.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/v1/complaints/[id]/status
 * Executes a controlled statutory lifecycle status mutation with audit trail tracking.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

    const parseResult = updateComplaintStatusSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid status mutation payload', parseResult.error.flatten());
    }

    const updatedComplaint = await ComplaintService.updateStatus(session, id, parseResult.data);

    return successResponse(updatedComplaint, 'Complaint status updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

