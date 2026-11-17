import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { EmergencyService } from '@/lib/services/emergency.service';
import { emergencyHistoryQuerySchema } from '@/lib/validations/emergency.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/emergency/history
 * Returns historical emergency broadcasts and summary counters (admin & super_admin).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(
      ['admin', 'super_admin'],
      'Access denied. Emergency broadcast history is restricted to Administrators and Super Administrators.'
    );

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('severity')) rawQuery.severity = searchParams.get('severity');
    if (searchParams.get('category')) rawQuery.category = searchParams.get('category');
    if (searchParams.get('isActive')) rawQuery.isActive = searchParams.get('isActive');
    if (searchParams.get('page')) rawQuery.page = searchParams.get('page');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');

    const parseResult = emergencyHistoryQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid emergency history filters', parseResult.error.flatten());
    }

    const result = await EmergencyService.listAlertHistory(session, parseResult.data);
    return successResponse(result, 'Emergency broadcast history retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
