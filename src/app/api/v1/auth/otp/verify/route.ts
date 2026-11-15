import type { NextRequest } from 'next/server';
import { OtpService } from '@/lib/services/otp.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { verifyOtpSchema } from '@/lib/validations/otp.schema';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/otp/verify
 * Validates a 6-digit verification code with timing-safe SHA-256 comparison,
 * tracks attempt limits (max 5), consumes code upon success, and updates
 * institutional verification status or issues a cryptographic proof token.
 */
export async function POST(req: NextRequest) {
  try {
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

