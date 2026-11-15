import type { NextRequest } from 'next/server';
import { ActivationService } from '@/lib/services/activation.service';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/auth/activation/validate
 * Public verification endpoint for first-time account activation invitations.
 * Inspects token authenticity, expiration, and account lifecycle validity without mutating state.
 */
export async function GET(req: NextRequest) {
  try {
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

