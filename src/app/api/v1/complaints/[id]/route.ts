import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ComplaintService } from '@/lib/services/complaint.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/complaints/[id]
 * Retrieves a detailed grievance complaint record with timeline and dialogue thread.
 * Enforces Zero-Trust resource-level authorization and department isolation.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid complaint ID format');
    }

    const complaint = await ComplaintService.getComplaintById(session, id);

    return successResponse(complaint, 'Complaint retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

