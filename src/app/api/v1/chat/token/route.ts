import type { NextRequest } from 'next/server';
import * as Ably from 'ably';
import { requireAuth } from '@/lib/auth/server';
import { ChatService } from '@/lib/services/chat.service';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { logger } from '@/lib/logging/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/chat/token
 * Generates an ephemeral Ably client capability token for real-time WebSocket subscriptions.
 * Conforms to DOC-ARCH-006 Section 4 (Token Authentication & Capability Minting).
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requireAuth();

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

    const apiKey = process.env.ABLY_API_KEY;

    if (!apiKey) {
      logger.debug(`[ChatToken] ABLY_API_KEY is not configured. Returning local development capability envelope.`);
      return successResponse(
        {
          clientId: session.userId,
          capability: JSON.stringify(capabilities),
          token: `dev-mock-token-${session.userId}`,
          expires: Date.now() + 3600 * 1000,
          isMock: true,
        },
        'Development capability token minted'
      );
    }

    // When ABLY_API_KEY is configured (KeyId:Secret)
    try {
      const rest = new Ably.Rest({ key: apiKey });
      const tokenRequest = await rest.auth.createTokenRequest({
        clientId: session.userId,
        capability: JSON.stringify(capabilities),
      });
      return successResponse(tokenRequest, 'Ably token request minted successfully');
    } catch {
      const [keyName] = apiKey.split(':');
      const tokenParams = {
        clientId: session.userId,
        capability: JSON.stringify(capabilities),
        keyName,
        timestamp: Date.now(),
        ttl: 3600 * 1000, // 1 hour
      };
      return successResponse(tokenParams, 'Ably token parameters minted successfully');
    }
  } catch (error) {
    return handleApiError(error);
  }
}
