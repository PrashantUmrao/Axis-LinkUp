import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { EmergencyService } from '@/lib/services/emergency.service';
import { createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/emergency/trigger
 * Triggers a new campus emergency broadcast (Super Admin exclusive, dual-confirmation phrase required).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(
      'super_admin',
      'Only Super Administrators may trigger campus emergency broadcasts.'
    );

    const rateCheck = checkRateLimit(`emg-trigger:${session.userId}`, {
      maxRequests: 5,
      windowMs: 300_000,
    });
    if (!rateCheck.allowed) {
      return createRateLimitErrorResponse(rateCheck);
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

    const created = await EmergencyService.triggerAlert(session, rawBody, {
      ipAddress,
      userAgent,
    });

    return createdResponse(created, 'Campus emergency broadcast activated');
  } catch (error) {
    return handleApiError(error);
  }
}
