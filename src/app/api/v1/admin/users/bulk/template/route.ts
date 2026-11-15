import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import { BulkProvisioningService } from '@/lib/services/bulk-provisioning.service';
import { handleApiError } from '@/lib/api/api-error-handler';
import type { BulkProvisionRole } from '@/types/bulk-provision';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/users/bulk/template
 * Returns standard CSV template file for student or faculty bulk onboarding.
 * Restricted to System Administrators.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    assertCanManageUserRoles(
      session,
      'Only System Administrators are authorized to download provisioning templates.'
    );

    const searchParams = req.nextUrl.searchParams;
    const rawRole = searchParams.get('role');
    const role: BulkProvisionRole = rawRole === 'faculty' ? 'faculty' : 'student';

    const csvContent = BulkProvisioningService.getTemplate(role);
    const filename = `axis-linkup-${role}-roster-template.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

