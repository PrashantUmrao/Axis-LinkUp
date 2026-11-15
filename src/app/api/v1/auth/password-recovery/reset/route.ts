import type { NextRequest } from 'next/server';
import { PasswordRecoveryService } from '@/lib/services/password-recovery.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { passwordResetSchema } from '@/lib/validations/password-recovery.schema';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/password-recovery/reset
 * Completes the password recovery workflow.
 * Validates cryptographic verification proof, enforces single-use replay defense,
 * updates password via Clerk backend SDK, and revokes active sessions.
 */
export async function POST(req: NextRequest) {
  try {
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

