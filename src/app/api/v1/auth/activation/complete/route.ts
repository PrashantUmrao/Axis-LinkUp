import type { NextRequest } from 'next/server';
import { ActivationService } from '@/lib/services/activation.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';
import { activateAccountSchema } from '@/lib/validations/activation.schema';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/activation/complete
 * Completes the first-time account activation workflow.
 * Sets the user's permanent password in Clerk IAM and transitions status from
 * 'pending_verification' to 'active' in MongoDB with atomic replay prevention.
 */
export async function POST(req: NextRequest) {
  try {
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

