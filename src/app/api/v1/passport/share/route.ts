import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { PassportService } from '@/lib/services/passport.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/passport/share
 * Retrieves the student's current public recruiter share configuration.
 */
export async function GET() {
  try {
    const session = await requireRole(
      'student',
      'Only students may manage their public Skill Passport link.'
    );
    const share = await PassportService.getShareSettings(session);
    return successResponse(share, 'Public passport share settings retrieved');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/passport/share
 * Toggles, updates headline, or rotates the student's public recruiter share token.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireRole(
      'student',
      'Only students may update their public Skill Passport link.'
    );

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const updated = await PassportService.updateShareSettings(session, rawBody);
    return successResponse(updated, 'Public passport share settings updated');
  } catch (error) {
    return handleApiError(error);
  }
}
