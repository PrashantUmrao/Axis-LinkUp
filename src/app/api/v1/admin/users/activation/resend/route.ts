import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ActivationService } from '@/lib/services/activation.service';
import { resendActivationSchema } from '@/lib/validations/activation.schema';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/admin/users/activation/resend
 * Administrative endpoint to re-generate and re-issue an activation invitation link.
 * Strictly restricted to authorized System Administrators.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validated = resendActivationSchema.parse(body);

    const tokenResult = await ActivationService.resendActivationInvitation(
      validated.email,
      session
    );

    return successResponse(
      tokenResult,
      `Activation invitation link successfully generated for ${validated.email}`,
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

