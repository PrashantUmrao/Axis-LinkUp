'use client';

/**
 * useAblyChat — Collegiate Real-Time Pub/Sub Hook for Axis LinkUp
 *
 * Conforms to:
 * - ADR-007 (Stateless Realtime Broker & Ably Edge Pub/Sub)
 * - DOC-ARCH-006 Section 4 & 5 (Token Authentication & Capability Minting)
 *
 * Features:
 * - Ephemeral token authentication via /api/v1/chat/token (never exposes secrets in client code)
 * - Automatic graceful fallback to 'offline' mode when ABLY_API_KEY is unset or server is in mock mode
 * - Subscribes to active conversation channels (group and direct) and user notifications channel
 * - Real-time event handling: chat.message.new, chat.message.deleted, chat.read, chat.unread.update
 * - In-memory event deduplication to prevent double-rendering optimistic and broadcast messages
 * - Clean lifecycle management with unmount teardown and channel switching cleanup
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Ably from 'ably';
import type { MessageDTO } from '@/types/chat';

export type AblyConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'suspended'
  | 'failed'
  | 'offline';

export interface UseAblyChatOptions {
  activeConversationId: string | null;
  activeConversationType?: 'direct' | 'group' | null;
  currentUserId: string;
  onNewMessage?: (message: MessageDTO) => void;
  onMessageDeleted?: (data: { messageId: string; conversationId: string }) => void;
  onReadReceipt?: (data: { conversationId: string; userId: string; readAt: string }) => void;
  onUnreadUpdate?: (data: {
    conversationId: string;
    unreadDelta?: number;
    lastMessage?: string;
    sentAt?: string;
  }) => void;
  enabled?: boolean;
}

export interface UseAblyChatReturn {
  status: AblyConnectionStatus;
  isRealtimeConnected: boolean;
  reconnect: () => void;
  refreshAuth: () => Promise<void>;
  error: string | null;
}

export function useAblyChat({
  activeConversationId,
  activeConversationType,
  currentUserId,
  onNewMessage,
  onMessageDeleted,
  onReadReceipt,
  onUnreadUpdate,
  enabled = true,
}: UseAblyChatOptions): UseAblyChatReturn {
  const [status, setStatus] = useState<AblyConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  // References to keep callbacks current without re-triggering subscription effects
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageDeletedRef = useRef(onMessageDeleted);
  const onReadReceiptRef = useRef(onReadReceipt);
  const onUnreadUpdateRef = useRef(onUnreadUpdate);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onMessageDeletedRef.current = onMessageDeleted;
    onReadReceiptRef.current = onReadReceipt;
    onUnreadUpdateRef.current = onUnreadUpdate;
  });

  const ablyClientRef = useRef<Ably.Realtime | null>(null);
  const activeChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const userNotifChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // Connection management
  const connect = useCallback(async () => {
    if (!enabled || typeof window === 'undefined' || !currentUserId) {
      setStatus('offline');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);

      // 1. Fetch capability token or mock envelope from secure server endpoint
      const res = await fetch('/api/v1/chat/token');
      if (!res.ok) {
        throw new Error(`Token endpoint returned HTTP ${res.status}`);
      }

      const json = await res.json();
      const tokenPayload = json.data;

      // Handle local development or offline mode when ABLY_API_KEY is not configured
      if (!tokenPayload || tokenPayload.isMock) {
        setStatus('offline');
        return;
      }

      // If already connected with an existing instance, close cleanly first
      if (ablyClientRef.current) {
        ablyClientRef.current.close();
        ablyClientRef.current = null;
      }

      // 2. Instantiate Ably Realtime client using authCallback to preserve server abstraction
      const client = new Ably.Realtime({
        authCallback: async (_data, callback) => {
          try {
            const tokenRes = await fetch('/api/v1/chat/token');
            const tokenJson = await tokenRes.json();
            callback(null, tokenJson.data);
          } catch (err) {
            callback(err as Ably.ErrorInfo, null as unknown as Ably.TokenRequest);
          }
        },
        autoConnect: true,
        transportParams: { agent: 'pubsub-device/3.1.0' },
      });

      ablyClientRef.current = client;

      // 3. Attach connection listeners
      client.connection.on('connected', () => {
        setStatus('connected');
        setError(null);
      });

      client.connection.on('connecting', () => {
        setStatus('connecting');
      });

      client.connection.on('disconnected', () => {
        setStatus('disconnected');
      });

      client.connection.on('suspended', () => {
        setStatus('suspended');
      });

      client.connection.on('failed', (stateChange) => {
        setStatus('failed');
        setError(stateChange.reason?.message || 'Ably connection failed');
      });

      // 4. Subscribe to user personal notification channel (for unread badges)
      const userNotifChannelName = `user:${currentUserId}:notifications`;
      const notifChannel = client.channels.get(userNotifChannelName);
      userNotifChannelRef.current = notifChannel;

      await notifChannel.subscribe('chat.unread.update', (message) => {
        const data = message.data;
        if (data && onUnreadUpdateRef.current) {
          onUnreadUpdateRef.current(data);
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('offline');
      setError(msg);
    }
  }, [enabled, currentUserId]);

  // Initial connect on mount or credentials change
  useEffect(() => {
    connect();

    return () => {
      if (activeChannelRef.current) {
        activeChannelRef.current.unsubscribe();
        activeChannelRef.current = null;
      }
      if (userNotifChannelRef.current) {
        userNotifChannelRef.current.unsubscribe();
        userNotifChannelRef.current = null;
      }
      if (ablyClientRef.current) {
        ablyClientRef.current.close();
        ablyClientRef.current = null;
      }
    };
  }, [connect]);

  // Handle active conversation channel subscription
  useEffect(() => {
    const client = ablyClientRef.current;
    if (!client || status !== 'connected' || !activeConversationId) {
      return;
    }

    // Unsubscribe from previous conversation channel
    if (activeChannelRef.current) {
      activeChannelRef.current.unsubscribe();
      activeChannelRef.current = null;
    }

    const channelName =
      activeConversationType === 'direct'
        ? `chat:direct:${activeConversationId}`
        : `chat:group:${activeConversationId}`;

    const channel = client.channels.get(channelName);
    activeChannelRef.current = channel;

    // Listen for channel failure (e.g. capability error on newly created conversation)
    channel.on('failed', async (stateChange) => {
      const isCapabilityDenied =
        stateChange.reason?.code === 40160 ||
        stateChange.reason?.message?.toLowerCase().includes('capability');
      if (isCapabilityDenied && ablyClientRef.current) {
        try {
          await ablyClientRef.current.auth.authorize();
          channel.attach();
        } catch {
          // Graceful fallback
        }
      }
    });

    // 1. Listen for new messages
    channel.subscribe('chat.message.new', (message) => {
      const msgData = message.data as MessageDTO;
      if (!msgData || !msgData.id) return;

      // In-memory deduplication check
      if (processedMessageIdsRef.current.has(msgData.id)) {
        return;
      }
      processedMessageIdsRef.current.add(msgData.id);

      // Keep recent set bounded to last 200 message IDs
      if (processedMessageIdsRef.current.size > 200) {
        const first = processedMessageIdsRef.current.values().next().value;
        if (first) processedMessageIdsRef.current.delete(first);
      }

      if (onNewMessageRef.current) {
        onNewMessageRef.current(msgData);
      }
    });

    // 2. Listen for soft-deleted messages
    channel.subscribe('chat.message.deleted', (message) => {
      const data = message.data as { messageId: string; conversationId: string };
      if (data && onMessageDeletedRef.current) {
        onMessageDeletedRef.current(data);
      }
    });

    // 3. Listen for read receipts
    channel.subscribe('chat.read', (message) => {
      const data = message.data as { conversationId: string; userId: string; readAt: string };
      if (data && onReadReceiptRef.current) {
        onReadReceiptRef.current(data);
      }
    });

    return () => {
      channel.unsubscribe();
      if (activeChannelRef.current === channel) {
        activeChannelRef.current = null;
      }
    };
  }, [activeConversationId, activeConversationType, status]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  const refreshAuth = useCallback(async () => {
    if (ablyClientRef.current) {
      try {
        await ablyClientRef.current.auth.authorize();
      } catch {
        // Safe fallback
      }
    }
  }, []);

  return {
    status,
    isRealtimeConnected: status === 'connected',
    reconnect,
    refreshAuth,
    error,
  };
}
