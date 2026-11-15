import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import { BulkProvisioningService } from '@/lib/services/bulk-provisioning.service';
import { bulkProvisionRequestSchema } from '@/lib/validations/bulk-provision.schema';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/admin/users/bulk/provision
 * Executes bulk student and faculty account provisioning.
 * Strictly restricted to authorized System Administrators.
 * Bounded concurrency, independent row error tracking, and compensating rollback.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    assertCanManageUserRoles(
      session,
      'Only System Administrators are authorized to execute bulk user provisioning.'
    );

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validated = bulkProvisionRequestSchema.parse(body);

    const result = await BulkProvisioningService.executeBulkProvision(
      validated.csvContent,
      validated.role,
      session,
      { skipInvalid: validated.skipInvalid }
    );

    return successResponse(
      result,
      'Bulk account provisioning completed successfully',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

