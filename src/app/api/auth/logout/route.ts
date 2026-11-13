import { getCurrentSession, SessionService } from '@/lib/auth';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { logger } from '@/lib/logging/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout
 * Server-side endpoint to revoke active session and return canonical sign-in redirect.
 */
export async function POST() {
  try {
    const session = await getCurrentSession();

    if (session?.sessionId) {
      logger.info(`[Logout Route] Revoking active session: ${session.sessionId}`);
      await SessionService.revokeSession(session.sessionId);
    }

    return successResponse(
      {
        loggedOut: true,
        redirectUrl: '/sign-in',
      },
      'User signed out successfully',
      HTTP_STATUS.OK
    );
  } catch (error) {
    logger.warn(
      '[Logout Route] Error encountered during logout processing, defaulting to sign-in',
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );

    // Fail-safe: Always return success and route user to sign-in to prevent client lockouts
    return successResponse(
      {
        loggedOut: true,
        redirectUrl: '/sign-in',
      },
      'Sign-out completed',
      HTTP_STATUS.OK
    );
  }
}
