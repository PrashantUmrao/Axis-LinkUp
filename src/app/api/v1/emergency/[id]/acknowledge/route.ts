import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { EmergencyService } from '@/lib/services/emergency.service';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/emergency/[id]/acknowledge
 * Records an idempotent per-user acknowledgment receipt for an active campus emergency.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid emergency alert ID format');
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;
    const userAgent = req.headers.get('user-agent') || null;

    const result = await EmergencyService.acknowledgeAlert(session, id, {
      ipAddress,
      userAgent,
    });

    return successResponse(
      result,
      result.alreadyAcknowledged
        ? 'Emergency directive was already acknowledged'
        : 'Emergency directive acknowledged successfully'
    );
  } catch (error) {
    return handleApiError(error);
  }
}
