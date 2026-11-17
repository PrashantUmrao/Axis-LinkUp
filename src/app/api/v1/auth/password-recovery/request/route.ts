import type { NextRequest } from 'next/server';
import { PasswordRecoveryService } from '@/lib/services/password-recovery.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { passwordRecoveryRequestSchema } from '@/lib/validations/password-recovery.schema';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
  getClientIp,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/password-recovery/request
 * Initiates the password recovery workflow.
 * Accepts institutional email or username, enforces account enumeration defense,
 * and dispatches a 6-digit OTP code to the verified user's email.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`pwd-rec:${ip}`, {
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (!rateCheck.allowed) {
      return createRateLimitErrorResponse(rateCheck);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validated = passwordRecoveryRequestSchema.parse(body);
    const result = await PasswordRecoveryService.requestRecovery(validated);

    return successResponse(
      result,
      result.message,
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

