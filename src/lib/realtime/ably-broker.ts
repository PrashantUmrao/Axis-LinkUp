import * as Ably from 'ably';
import { logger } from '@/lib/logging/logger';

export const ABLY_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes (AUD-C10)
export const ABLY_REVOKE_TIMEOUT_MS = 10_000;

export interface AblyPublishPayload {
  name: string;
  data: unknown;
}

export interface AblyPublishResult {
  published: boolean;
  channel: string;
  error?: string;
}

export interface AblyRevokeResult {
  revoked: boolean;
  userId: string;
  error?: string;
}

/**
 * Server-side stateless Ably Realtime Broker helper.
 * Conforms to ADR-007 (Real-Time Communication Engine — Ably Realtime).
 * Interacts statelessly via Ably REST API with identified system client.
 */
export class AblyBroker {
  private static restClient: Ably.Rest | null = null;

  private static getRestClient(): Ably.Rest | null {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) return null;
    if (!this.restClient) {
      this.restClient = new Ably.Rest({
        key: apiKey,
        clientId: 'axis-server',
      });
    }
    return this.restClient;
  }

  /**
   * Deterministically constructs channel names according to DOC-ARCH-006 Section 3 & ADR-007:
   * Direct Chat: chat:direct:[conversationId] (or chat:direct:[userA]_[userB] if two user IDs provided)
   * Group Chat: chat:group:[conversationId]
   * User Notifications: user:[userId]:notifications
   */
  public static getDirectChannel(conversationIdOrUserA: string, maybeUserB?: string): string {
    if (maybeUserB) {
      const sorted = [conversationIdOrUserA, maybeUserB].sort();
      return `chat:direct:${sorted[0]}_${sorted[1]}`;
    }
    return `chat:direct:${conversationIdOrUserA}`;
  }

  public static getGroupChannel(conversationId: string): string {
    return `chat:group:${conversationId}`;
  }

  public static getConversationChannel(
    conversationId: string,
    type: 'direct' | 'group' = 'group'
  ): string {
    return type === 'direct'
      ? this.getDirectChannel(conversationId)
      : this.getGroupChannel(conversationId);
  }

  public static getUserNotificationChannel(userId: string): string {
    return `user:${userId}:notifications`;
  }

  public static getEmergencyBroadcastChannel(): string {
    return 'campus:emergency:broadcast';
  }

  /**
   * Publishes an event to an Ably channel via stateless REST client.
   * If ABLY_API_KEY is not configured, logs a trace and safely succeeds (offline/mock mode).
   */
  public static async publish(
    channel: string,
    eventName: string,
    data: unknown
  ): Promise<AblyPublishResult> {
    const client = this.getRestClient();

    if (!client) {
      logger.debug(
        `[AblyBroker] ABLY_API_KEY not configured. Event '${eventName}' to channel '${channel}' persisted to DB only.`
      );
      return { published: false, channel };
    }

    try {
      const ablyChannel = client.channels.get(channel);
      await ablyChannel.publish(eventName, data);
      return { published: true, channel };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`[AblyBroker] Error publishing to Ably channel ${channel}`, {
        error: errorMessage,
      });
      return { published: false, channel, error: errorMessage };
    }
  }

  /**
   * Non-blockingly revokes all active Ably realtime tokens for a given userId (clientId)
   * via the Ably REST Token Revocation API (AUD-C10).
   * Invoked when removing a user from a group chat or suspending/deactivating an account.
   */
  public static async revokeUserTokens(userId: string): Promise<AblyRevokeResult> {
    const apiKey = process.env.ABLY_API_KEY?.trim();
    if (!apiKey) {
      logger.debug(
        `[AblyBroker] ABLY_API_KEY not configured. Skipping token revocation for userId=${userId}.`
      );
      return { revoked: false, userId };
    }

    const colonIndex = apiKey.indexOf(':');
    if (colonIndex <= 0) {
      logger.warn('[AblyBroker] Invalid ABLY_API_KEY format; cannot revoke user tokens.');
      return { revoked: false, userId, error: 'Invalid ABLY_API_KEY format' };
    }

    const keyName = apiKey.slice(0, colonIndex);
    const basicAuth = Buffer.from(apiKey).toString('base64');
    const revokeUrl = `https://rest.ably.io/keys/${encodeURIComponent(keyName)}/revokeTokens`;

    try {
      const response = await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targets: [`clientId:${userId}`],
          issuedBefore: Date.now(),
        }),
        signal: AbortSignal.timeout(ABLY_REVOKE_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errMsg = `Ably token revocation returned HTTP ${response.status}`;
        logger.warn(`[AblyBroker] ${errMsg} for userId=${userId}`);
        return { revoked: false, userId, error: errMsg };
      }

      logger.info(`[AblyBroker] Revoked active Ably realtime tokens for userId=${userId}`);
      return { revoked: true, userId };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(`[AblyBroker] Failed to revoke Ably tokens for userId=${userId}`, {
        error: errorMessage,
      });
      return { revoked: false, userId, error: errorMessage };
    }
  }
}
