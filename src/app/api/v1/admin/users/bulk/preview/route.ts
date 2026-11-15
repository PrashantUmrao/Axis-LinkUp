import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import { BulkProvisioningService } from '@/lib/services/bulk-provisioning.service';
import { bulkPreviewRequestSchema } from '@/lib/validations/bulk-provision.schema';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/admin/users/bulk/preview
 * Dry-run validation and collision preview for bulk roster CSV uploads.
 * Validates syntax, schemas, intra-batch duplicates, and database existence.
 * Does NOT persist users or create external Clerk identities.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    assertCanManageUserRoles(
      session,
      'Only System Administrators are authorized to preview bulk user provisioning.'
    );

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validated = bulkPreviewRequestSchema.parse(body);

    const previewResult = await BulkProvisioningService.previewCsv(
      validated.csvContent,
      validated.role,
      session
    );

    return successResponse(
      previewResult,
      'CSV validation preview generated successfully',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

