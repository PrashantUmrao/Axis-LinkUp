import type { NextRequest } from 'next/server';
import { OtpService } from '@/lib/services/otp.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { requestOtpSchema } from '@/lib/validations/otp.schema';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/otp/request
 * Initiates an email OTP verification request.
 * Generates a 6-digit cryptographic code, stores SHA-256 hash with 5-minute TTL,
 * enforces a 60-second resend cooldown, and dispatches the code via email.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validated = requestOtpSchema.parse(body);
    const result = await OtpService.requestOtp(validated);

    return successResponse(
      result,
      'Verification code sent successfully to your institutional email.',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

