import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { NotificationService } from '@/lib/services/notification.service';
import { createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/notifications/broadcast
 * Dispatches a targeted ad-hoc alert broadcast respecting PERMISSIONS.ALERTS_DISPATCH.
 * Strictly blocks students (403); scopes faculty/admin to own department or specific recipients.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(
      ['faculty', 'admin', 'super_admin'],
      'Access denied. Only faculty, administrators, and super administrators may dispatch alert broadcasts.'
    );

    const rateCheck = checkRateLimit(`notif-bcast:${session.userId}`, {
      maxRequests: 10,
      windowMs: 60_000,
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

    const result = await NotificationService.broadcastAlert(session, rawBody);
    return createdResponse(result, 'Targeted alert broadcast dispatched successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
