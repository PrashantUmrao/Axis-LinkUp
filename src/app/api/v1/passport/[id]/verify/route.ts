import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { PassportService } from '@/lib/services/passport.service';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/passport/[id]/verify
 * Endorses (verify + SHA-256 stamp) or rejects a student achievement claim.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      ['faculty', 'admin', 'super_admin'],
      'Only faculty and administrators may verify or reject student passport claims.'
    );

    const { id } = await params;
    if (!objectIdSchema.safeParse(id).success) {
      throw new ValidationError('Invalid achievement claim ID format');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const updated = await PassportService.verifyOrRejectAchievement(session, id, rawBody);
    return successResponse(
      updated,
      updated.verificationStatus === 'verified'
        ? 'Achievement claim verified and cryptographically stamped'
        : 'Achievement claim rejected'
    );
  } catch (error) {
    return handleApiError(error);
  }
}
