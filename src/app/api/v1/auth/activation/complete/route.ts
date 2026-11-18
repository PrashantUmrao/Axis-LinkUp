import type { NextRequest } from 'next/server';
import { ActivationService } from '@/lib/services/activation.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { activateAccountSchema } from '@/lib/validations/activation.schema';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
  getClientIp,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/activation/complete
 * Completes the first-time account activation workflow.
 * Enforces sliding-window IP rate limiting (5/60s) and atomic replay prevention.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`auth:activation-complete:${getClientIp(req)}`, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validated = activateAccountSchema.parse(body);

    const activationResult = await ActivationService.activateAccount(validated);

    return successResponse(
      activationResult,
      'Account activated successfully. You can now sign in with your permanent credentials.',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

