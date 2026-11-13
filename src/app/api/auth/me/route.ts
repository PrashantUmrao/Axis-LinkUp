import { requireAuth } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { successResponse, errorResponse } from '@/lib/api/api-response';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me
 * Protected Route Handler returning the caller's verified collegiate identity and profile.
 * Rejects unauthenticated callers with HTTP 401.
 * Rejects suspended / deactivated callers with HTTP 403.
 */
export async function GET() {
  try {
    // 1. Assert Authentication and active lifecycle status
    const session = await requireAuth();

    // 2. Query authoritative MongoDB user document
    const user = await UserRepository.findById(session.userId);

    if (!user) {
      return errorResponse(
        'Collegiate user record not found',
        ERROR_CODES.NOT_FOUND,
        HTTP_STATUS.NOT_FOUND
      );
    }

    // 3. Return sanitized User DTO
    return successResponse(
      { user: toUserDTO(user) },
      'User session verified successfully',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}
