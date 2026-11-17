import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { AuditService } from '@/lib/services/audit.service';
import { auditExportQuerySchema } from '@/lib/validations/governance.schema';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/audit/export
 * Downloads filtered compliance export (?format=csv or ?format=json).
 * Strictly restricted to Super Administrators.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(
      'super_admin',
      'Only Super Administrators may export institutional security audit logs.'
    );

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('format')) rawQuery.format = searchParams.get('format');
    if (searchParams.get('module')) rawQuery.module = searchParams.get('module');
    if (searchParams.get('severity')) rawQuery.severity = searchParams.get('severity');
    if (searchParams.get('action')) rawQuery.action = searchParams.get('action');
    if (searchParams.get('department')) rawQuery.department = searchParams.get('department');
    if (searchParams.get('search')) rawQuery.search = searchParams.get('search');
    if (searchParams.get('dateFrom')) rawQuery.dateFrom = searchParams.get('dateFrom');
    if (searchParams.get('dateTo')) rawQuery.dateTo = searchParams.get('dateTo');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');

    const parseResult = auditExportQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid audit export parameters', parseResult.error.flatten());
    }

    const exported = await AuditService.exportAuditLogs(session, parseResult.data);

    return new NextResponse(exported.body, {
      status: 200,
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename="${exported.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
