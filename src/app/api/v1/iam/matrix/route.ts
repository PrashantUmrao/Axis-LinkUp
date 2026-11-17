import { requireRole } from '@/lib/auth/server';
import { IamGovernanceService } from '@/lib/services/iam-governance.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/iam/matrix
 * Returns the canonical RBAC Permission Matrix derived directly from src/lib/auth/permissions.ts.
 */
export async function GET() {
  try {
    const session = await requireRole(
      'super_admin',
      'Only Super Administrators may inspect the canonical RBAC Permission Matrix.'
    );

    const matrix = IamGovernanceService.getPermissionMatrix(session);
    return successResponse(matrix, 'Canonical RBAC permission matrix retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
