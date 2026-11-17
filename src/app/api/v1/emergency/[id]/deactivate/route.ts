import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
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
 * POST /api/v1/emergency/[id]/deactivate
 * Stands down an active emergency broadcast with mandatory all-clear summary (Super Admin exclusive).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      'super_admin',
      'Only Super Administrators may stand down campus emergency broadcasts.'
    );

    const { id } = await params;
    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid emergency alert ID format');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;
    const userAgent = req.headers.get('user-agent') || null;

    const updated = await EmergencyService.deactivateAlert(session, id, rawBody, {
      ipAddress,
      userAgent,
    });

    return successResponse(updated, 'Emergency alert deactivated — All Clear broadcasted');
  } catch (error) {
    return handleApiError(error);
  }
}
