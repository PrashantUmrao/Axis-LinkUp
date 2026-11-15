import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import { ProvisioningService } from '@/lib/services/provisioning.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/admin/users/provision
 * Single-Account Provisioning Route Handler.
 * Strictly restricted to authorized System Administrators.
 * Generates Clerk identity with closed access policy and persists linked MongoDB document.
 * Supports Student, Faculty, and Admin (HOD, Director, SysAdmin) provisioning.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller session and active lifecycle status
    const session = await requireAuth();

    // 2. Strict authorization: Only System Administrators can provision accounts
    assertCanManageUserRoles(
      session,
      'Only System Administrators are authorized to provision user accounts.'
    );

    // 3. Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // 4. Execute provisioning domain workflow based on target role
    let userDTO;
    if (body.role === 'admin' || body.role === 'super_admin') {
      userDTO = await ProvisioningService.provisionAdminAccount(body, session);
    } else {
      userDTO = await ProvisioningService.provisionSingleAccount(body, session);
    }

    return successResponse(
      { user: userDTO },
      'Collegiate account provisioned successfully',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    return handleApiError(error);
  }
}
