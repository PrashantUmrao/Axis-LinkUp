import type { NextRequest } from 'next/server';
import { ActivationService } from '@/lib/services/activation.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
  getClientIp,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/auth/activation/validate
 * Public verification endpoint for first-time account activation invitations.
 * Enforces sliding-window IP rate limiting (15/60s) and anti-enumeration checks.
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`auth:activation-validate:${getClientIp(req)}`, {
      maxRequests: 15,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get('token') || '';
    const email = searchParams.get('email') || '';

    const validationResult = await ActivationService.validateInvitation(token, email);

    return successResponse(
      validationResult,
      'Activation invitation is valid',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

