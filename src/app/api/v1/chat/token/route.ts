import type { NextRequest } from 'next/server';
import * as Ably from 'ably';
import { requireAuth } from '@/lib/auth/server';
import { ChatService } from '@/lib/services/chat.service';
import { AblyBroker, ABLY_TOKEN_TTL_MS } from '@/lib/realtime/ably-broker';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { AppError } from '@/lib/errors/app-error';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';
import { logger } from '@/lib/logging/logger';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/chat/token
 * Generates a short-lived (10-minute) Ably client capability token for real-time WebSocket subscriptions.
 * Conforms to DOC-ARCH-006 Section 4, AUD-C10, and AUD-H11 (20/60s per-user rate limit).
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requireAuth();

    const rateLimit = checkRateLimit(`chat:token:${session.userId}`, {
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    // 1. Resolve user's authorized channels (zero-trust: only conversations where user is an active participant)
    const conversations = await ChatService.getUserConversations(session, { limit: 100 });

    const capabilities: Record<string, string[]> = {
      [AblyBroker.getUserNotificationChannel(session.userId)]: ['subscribe'],
      [AblyBroker.getEmergencyBroadcastChannel()]: ['subscribe'],
    };

    // Mint exact channel capability per authorized conversation (no wildcards permitted)
    for (const conv of conversations) {
      const channelName = AblyBroker.getConversationChannel(conv.id, conv.type);
      capabilities[channelName] = ['subscribe', 'presence'];
    }

    const apiKey = process.env.ABLY_API_KEY?.trim();

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[ChatToken] Production token request aborted: ABLY_API_KEY is not configured.');
        throw new AppError(
          'Realtime messaging service is currently unavailable.',
          ERROR_CODES.INTERNAL_ERROR,
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      logger.debug(
        '[ChatToken] ABLY_API_KEY is not configured. Returning local development capability envelope.'
      );
      return successResponse(
        {
          clientId: session.userId,
          capability: JSON.stringify(capabilities),
          token: `dev-mock-token-${session.userId}`,
          ttl: ABLY_TOKEN_TTL_MS,
          expires: Date.now() + ABLY_TOKEN_TTL_MS,
          isMock: true,
        },
        'Development capability token minted'
      );
    }

    // When ABLY_API_KEY is configured, mint a cryptographically signed 10-minute Ably TokenRequest.
    // Never fall back to unsigned parameters or expose keyName on failure.
    try {
      const rest = new Ably.Rest({ key: apiKey });
      const tokenRequest = await rest.auth.createTokenRequest({
        clientId: session.userId,
        capability: JSON.stringify(capabilities),
        ttl: ABLY_TOKEN_TTL_MS,
      });
      return successResponse(tokenRequest, 'Ably token request minted successfully');
    } catch (err) {
      logger.error('[ChatToken] Failed to mint Ably token request', {
        userId: session.userId,
        error: err instanceof Error ? err.message : 'Unknown Ably error',
      });
      throw new AppError(
        'Realtime messaging service is temporarily unavailable. Please retry shortly.',
        ERROR_CODES.INTERNAL_ERROR,
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
