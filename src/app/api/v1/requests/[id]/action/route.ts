import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ServiceRequestService } from '@/lib/services/service-request.service';
import { reviewServiceRequestSchema } from '@/lib/validations/service-request.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError, ForbiddenError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/requests/[id]/action
 * Processes an administrative review action on a student service request.
 * Permitted actions: under_review, action_required, approved, rejected, fulfilled.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw new ForbiddenError('Only administrative personnel may review and act on service requests.');
    }

    const { id } = await params;
    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid request ID format');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = reviewServiceRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid review action payload', parseResult.error.flatten());
    }

    const updated = await ServiceRequestService.processRequestAction(
      session,
      id,
      parseResult.data
    );

    return successResponse(updated, 'Service request updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

