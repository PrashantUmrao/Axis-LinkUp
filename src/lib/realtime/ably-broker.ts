import * as Ably from 'ably';
import { logger } from '@/lib/logging/logger';

export interface AblyPublishPayload {
  name: string;
  data: unknown;
}

export interface AblyPublishResult {
  published: boolean;
  channel: string;
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
}
