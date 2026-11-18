import type { NextRequest } from 'next/server';
import { PasswordRecoveryService } from '@/lib/services/password-recovery.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { passwordResetSchema } from '@/lib/validations/password-recovery.schema';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
  getClientIp,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/password-recovery/reset
 * Completes the password recovery workflow.
 * Enforces sliding-window IP rate limiting (5/60s), atomic replay defense, and session revocation.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`auth:password-recovery-reset:${getClientIp(req)}`, {
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

    const validated = passwordResetSchema.parse(body);
    const result = await PasswordRecoveryService.resetPassword(validated);

    return successResponse(
      result,
      result.message,
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

