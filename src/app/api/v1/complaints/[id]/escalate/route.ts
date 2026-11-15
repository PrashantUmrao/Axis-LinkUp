import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ComplaintService } from '@/lib/services/complaint.service';
import { escalateComplaintSchema } from '@/lib/validations/complaint.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/complaints/[id]/escalate
 * Escalates a department-level grievance to the Directorate Ombudsman.
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

    const parseResult = escalateComplaintSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid escalation payload', parseResult.error.flatten());
    }

    const escalatedComplaint = await ComplaintService.escalateComplaint(session, id, parseResult.data);

    return successResponse(escalatedComplaint, 'Complaint escalated to Directorate successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

