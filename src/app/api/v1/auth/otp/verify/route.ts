import type { NextRequest } from 'next/server';
import { OtpService } from '@/lib/services/otp.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { verifyOtpSchema } from '@/lib/validations/otp.schema';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
  getClientIp,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/otp/verify
 * Validates a 6-digit verification code with timing-safe SHA-256 comparison,
 * sliding-window IP rate limiting (10/60s), and attempt limits (max 5).
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`auth:otp-verify:${getClientIp(req)}`, {
      maxRequests: 10,
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

    const validated = verifyOtpSchema.parse(body);
    const result = await OtpService.verifyOtp(validated);

    return successResponse(
      result,
      'Email verification code confirmed successfully.',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

