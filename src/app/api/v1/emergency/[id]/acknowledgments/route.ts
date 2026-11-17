import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { EmergencyService } from '@/lib/services/emergency.service';
import { acknowledgmentQuerySchema } from '@/lib/validations/emergency.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/emergency/[id]/acknowledgments
 * Returns paginated acknowledgment roster and role/campus coverage stats (admin & super_admin).
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      ['admin', 'super_admin'],
      'Access denied. Emergency acknowledgment rosters are restricted to Administrators and Super Administrators.'
    );

    const { id } = await params;
    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid emergency alert ID format');
    }

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('role')) rawQuery.role = searchParams.get('role');
    if (searchParams.get('department')) rawQuery.department = searchParams.get('department');
    if (searchParams.get('search')) rawQuery.search = searchParams.get('search');
    if (searchParams.get('page')) rawQuery.page = searchParams.get('page');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');

    const parseResult = acknowledgmentQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid acknowledgment roster filters', parseResult.error.flatten());
    }

    const result = await EmergencyService.getAlertAcknowledgments(session, id, parseResult.data);
    return successResponse(result, 'Emergency acknowledgments retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
