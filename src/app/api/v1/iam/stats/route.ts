import { requireRole } from '@/lib/auth/server';
import { IamGovernanceService } from '@/lib/services/iam-governance.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/iam/stats
 * Returns institutional role and account lifecycle status KPI distribution.
 */
export async function GET() {
  try {
    const session = await requireRole(
      'super_admin',
      'Only Super Administrators may inspect IAM distribution telemetry.'
    );

    const stats = await IamGovernanceService.getRoleDistributionStats(session);
    return successResponse(stats, 'IAM distribution statistics retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
