import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { AuditService } from '@/lib/services/audit.service';
import { auditLogQuerySchema } from '@/lib/validations/governance.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/audit/logs
 * Retrieves paginated immutable security audit logs.
 * Department-scoped for 'admin'; global access for 'super_admin'.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(
      ['admin', 'super_admin'],
      'Access denied. Security audit logs are restricted to Administrators and Super Administrators.'
    );

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('module')) rawQuery.module = searchParams.get('module');
    if (searchParams.get('severity')) rawQuery.severity = searchParams.get('severity');
    if (searchParams.get('action')) rawQuery.action = searchParams.get('action');
    if (searchParams.get('actorId')) rawQuery.actorId = searchParams.get('actorId');
    if (searchParams.get('targetEntityId')) {
      rawQuery.targetEntityId = searchParams.get('targetEntityId');
    }
    if (searchParams.get('department')) rawQuery.department = searchParams.get('department');
    if (searchParams.get('search')) rawQuery.search = searchParams.get('search');
    if (searchParams.get('dateFrom')) rawQuery.dateFrom = searchParams.get('dateFrom');
    if (searchParams.get('dateTo')) rawQuery.dateTo = searchParams.get('dateTo');
    if (searchParams.get('page')) rawQuery.page = searchParams.get('page');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');

    const parseResult = auditLogQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid audit log filter parameters', parseResult.error.flatten());
    }

    const result = await AuditService.listAuditLogs(session, parseResult.data);
    return successResponse(result, 'Security audit logs retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
