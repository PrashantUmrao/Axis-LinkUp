import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ComplaintService } from '@/lib/services/complaint.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/complaints/stats
 * Retrieves aggregated grievance redressal triage and SLA breach statistics.
 * Scoped strictly to the caller's persona (Student, Department HOD, Directorate, System Admin).
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requireAuth();

    const stats = await ComplaintService.getStats(session);

    return successResponse(stats, 'Grievance statistics retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

