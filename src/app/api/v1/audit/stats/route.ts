import { requireRole } from '@/lib/auth/server';
import { AuditService } from '@/lib/services/audit.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/audit/stats
 * Returns aggregated audit counters and module/severity breakdown.
 */
export async function GET() {
  try {
    const session = await requireRole(
      ['admin', 'super_admin'],
      'Access denied. Audit telemetry is restricted to Administrators and Super Administrators.'
    );

    const stats = await AuditService.getAuditStats(session);
    return successResponse(stats, 'Audit statistics retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
