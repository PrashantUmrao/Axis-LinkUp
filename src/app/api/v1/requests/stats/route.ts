import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ServiceRequestService } from '@/lib/services/service-request.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/requests/stats
 * Retrieves aggregated service request counts and metrics scoped to caller persona.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requireAuth();

    const stats = await ServiceRequestService.getRequestStats(session);

    return successResponse(stats, 'Service request statistics retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

