import { requireAuth } from '@/lib/auth/server';
import { FacilityService } from '@/lib/services/facility.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/facilities/stats
 * Returns aggregated facility inventory and booking queue metrics.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const stats = await FacilityService.getBookingStats(session);
    return successResponse(stats, 'Facility statistics retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
