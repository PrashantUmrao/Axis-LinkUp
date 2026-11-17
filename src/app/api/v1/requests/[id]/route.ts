import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ServiceRequestService } from '@/lib/services/service-request.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/requests/[id]
 * Retrieves a detailed service request record including immutable review audit logs.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid request ID format');
    }

    const request = await ServiceRequestService.getRequestById(session, id);

    return successResponse(request, 'Service request retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

