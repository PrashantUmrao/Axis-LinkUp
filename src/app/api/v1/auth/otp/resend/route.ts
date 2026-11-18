import type { NextRequest } from 'next/server';
import { OtpService } from '@/lib/services/otp.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { resendOtpSchema } from '@/lib/validations/otp.schema';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
  getClientIp,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/otp/resend
 * Resends a fresh 6-digit verification code to the recipient.
 * Enforces sliding-window IP rate limiting (5/60s) and 60-second cooldown.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`auth:otp-resend:${getClientIp(req)}`, {
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

    const validated = resendOtpSchema.parse(body);
    const result = await OtpService.resendOtp(validated);

    return successResponse(
      result,
      'A fresh verification code has been dispatched to your institutional email.',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

