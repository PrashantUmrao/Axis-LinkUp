'use client';

/**
 * Master Chat & Group Messaging Layout (WhatsApp Web Architecture).
 * Coordinates multi-column responsive layout:
 * - Left: ChatSidebar
 * - Center: ChatConversationView
 * - Right: ChatInfoPanel (collapsible)
 * - Dialogs: CreateGroupDialog, NewDirectChatDialog
 *
 * Conforms to Phase 5.6 & ADR-007:
 * - Integrates useAblyChat for live message push, read receipts, and unread badges
 * - Dynamically loads conversation history and pagination via Next.js Route Handlers
 * - Dispatches outgoing messages and marks conversations as read
 * - Enforces Zero-Trust collegiate access rules
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChatSidebar } from './chat-sidebar';
import { ChatConversationView } from './chat-conversation-view';
import { ChatInfoPanel } from './chat-info-panel';
import { CreateGroupDialog } from './create-group-dialog';
import { NewDirectChatDialog } from './new-direct-chat-dialog';
import { useAblyChat } from '@/hooks/use-ably-chat';
import type { Conversation, ChatMessage, MessageDTO } from '@/types/chat';
import type { UserRole } from '@/types/user';

interface ChatLayoutProps {
  initialConversations?: Conversation[];
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserName: string;
  currentUserDepartmentId?: string;
}

export function ChatLayout({
  initialConversations = [],
  currentUserRole,
  currentUserId,
  currentUserName,
  currentUserDepartmentId,
}: ChatLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isNewDirectChatOpen, setIsNewDirectChatOpen] = useState(false);
  const [directChatInitialQuery, setDirectChatInitialQuery] = useState('');

  // Message cache: conversationId -> ChatMessage[]
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);

  // 1. Mark conversation as read on server & update local unread count
  const markAsRead = useCallback(async (convId: string) => {
    try {
      await fetch(`/api/v1/chat/conversations/${convId}/read`, { method: 'POST' });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
    } catch {
      // Safe fallback
    }
  }, []);

  // 2. Load conversation messages when activeConversationId changes
  useEffect(() => {
    if (!activeConversationId) return;
    const convId = activeConversationId;

    let isMounted = true;
    async function fetchMessages(targetId: string) {
      if (messagesMap[targetId]) {
        // Already loaded in memory; just mark as read
        markAsRead(targetId);
        return;
      }

      try {
        const res = await fetch(
          `/api/v1/chat/conversations/${targetId}/messages?limit=50`
        );
        if (!res.ok) return;

        const json = await res.json();
        const data = json.data;
        if (isMounted && data) {
          setMessagesMap((prev) => ({
            ...prev,
            [targetId]: data.messages || [],
          }));
          setHasMoreMap((prev) => ({
            ...prev,
            [targetId]: !!data.hasMore,
          }));
          markAsRead(targetId);
        }
      } catch {
        // Safe fallback
      }
    }

    fetchMessages(convId);
    return () => {
      isMounted = false;
    };
  }, [activeConversationId, markAsRead, messagesMap]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;
  const activeMessages = activeConversationId ? messagesMap[activeConversationId] || [] : [];
  const hasMoreMessages = activeConversationId ? !!hasMoreMap[activeConversationId] : false;

  // 3. Real-Time Ably WebSocket Integration
  const { status: ablyStatus, refreshAuth } = useAblyChat({
    activeConversationId,
    activeConversationType: activeConversation?.type ?? null,
    currentUserId,
    onNewMessage: (newMsg: MessageDTO) => {
      const isOwn = newMsg.senderId === currentUserId;
      const normalizedMsg: ChatMessage = {
        ...newMsg,
        isOwn,
      };

      setMessagesMap((prev) => {
        const existing = prev[normalizedMsg.conversationId] || [];
        // Deduplicate if already present
        if (existing.some((m) => m.id === normalizedMsg.id)) {
          return prev;
        }

        // Reconcile optimistic message if pending with matching temporary ID
        const pendingTempIndex = existing.findIndex(
          (m) =>
            m.id.startsWith('temp-') &&
            m.senderId === normalizedMsg.senderId &&
            m.content === normalizedMsg.content
        );

        if (pendingTempIndex !== -1) {
          const updated = [...existing];
          updated[pendingTempIndex] = normalizedMsg;
          return {
            ...prev,
            [normalizedMsg.conversationId]: updated,
          };
        }

        return {
          ...prev,
          [normalizedMsg.conversationId]: [...existing, normalizedMsg],
        };
      });

      // Update conversation lastMessage & unread count
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === newMsg.conversationId) {
            const isCurrent = c.id === activeConversationId;
            return {
              ...c,
              lastMessage: newMsg.content,
              lastMessageTime: newMsg.timestamp,
              unreadCount: isCurrent ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );

      // If viewing active conversation, immediately mark as read
      if (newMsg.conversationId === activeConversationId && !isOwn) {
        markAsRead(newMsg.conversationId);
      }
    },
    onMessageDeleted: ({ messageId, conversationId }) => {
      setMessagesMap((prev) => {
        const existing = prev[conversationId];
        if (!existing) return prev;
        return {
          ...prev,
          [conversationId]: existing.map((m) =>
            m.id === messageId ? { ...m, isDeleted: true } : m
          ),
        };
      });
    },
    onReadReceipt: ({ conversationId }) => {
      setMessagesMap((prev) => {
        const existing = prev[conversationId];
        if (!existing) return prev;
        return {
          ...prev,
          [conversationId]: existing.map((m) =>
            m.isOwn ? { ...m, status: 'read' as const } : m
          ),
        };
      });
    },
    onUnreadUpdate: ({ conversationId, lastMessage, sentAt }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            const isCurrent = c.id === activeConversationId;
            return {
              ...c,
              lastMessage: lastMessage || c.lastMessage,
              lastMessageTime: sentAt || c.lastMessageTime,
              unreadCount: isCurrent ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    },
  });

  // 4. Send Message Handler
  const handleSendMessage = async (content: string) => {
    if (!activeConversationId) return;

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId: activeConversationId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      content,
      timestamp: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isOwn: true,
      status: 'sent',
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), optimisticMessage],
    }));

    // Update conversation list preview
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              lastMessage: content,
              lastMessageTime: 'Just now',
            }
          : c
      )
    );

    try {
      const res = await fetch(`/api/v1/chat/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        throw new Error(`Failed to send message: HTTP ${res.status}`);
      }

      const json = await res.json();
      const serverMessage: MessageDTO = json.data;
      const reconciledMsg: ChatMessage = {
        ...serverMessage,
        isOwn: true,
      };

      // Replace optimistic message with confirmed server message and deduplicate
      setMessagesMap((prev) => {
        const currentList = prev[activeConversationId] || [];
        const replaced = currentList.map((m) => (m.id === tempId ? reconciledMsg : m));
        const seen = new Set<string>();
        const deduped: ChatMessage[] = [];
        for (const m of replaced) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            deduped.push(m);
          }
        }
        return {
          ...prev,
          [activeConversationId]: deduped,
        };
      });
    } catch {
      // Retain optimistic with failure state or refresh
    }
  };

  // 5. Delete Message Handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConversationId) return;

    // Optimistic soft delete
    setMessagesMap((prev) => ({
      ...prev,
      [activeConversationId]: (prev[activeConversationId] || []).map((m) =>
        m.id === messageId ? { ...m, isDeleted: true } : m
      ),
    }));

    try {
      await fetch(
        `/api/v1/chat/conversations/${activeConversationId}/messages/${messageId}`,
        { method: 'DELETE' }
      );
    } catch {
      // Revert if needed
    }
  };

  // 6. Pagination Handler (Load earlier messages)
  const handleLoadEarlier = async () => {
    if (!activeConversationId || isLoadingEarlier || !hasMoreMessages) return;

    const currentList = messagesMap[activeConversationId] || [];
    const oldestMessageId = currentList[0]?.id;
    if (!oldestMessageId) return;

    setIsLoadingEarlier(true);
    try {
      const res = await fetch(
        `/api/v1/chat/conversations/${activeConversationId}/messages?before=${oldestMessageId}&limit=50`
      );
      if (!res.ok) return;

      const json = await res.json();
      const data = json.data;
      if (data && data.messages) {
        setMessagesMap((prev) => {
          const existing = prev[activeConversationId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const newEarlier = (data.messages as ChatMessage[]).filter(
            (m) => !existingIds.has(m.id)
          );
          return {
            ...prev,
            [activeConversationId]: [...newEarlier, ...existing],
          };
        });
        setHasMoreMap((prev) => ({
          ...prev,
          [activeConversationId]: !!data.hasMore,
        }));
      }
    } finally {
      setIsLoadingEarlier(false);
    }
  };

  const handleGroupCreated = (newGroup: Conversation) => {
    setConversations((prev) => [newGroup, ...prev]);
    setActiveConversationId(newGroup.id);
    refreshAuth();
  };

  const handleConversationCreated = (newConv: Conversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === newConv.id);
      if (exists) return prev;
      return [newConv, ...prev];
    });
    setActiveConversationId(newConv.id);
    refreshAuth();
  };

  const handleConversationUpdated = (updated: Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  return (
    <div className="border-glass-border bg-card/40 relative flex h-[calc(100vh-8.5rem)] min-h-[580px] overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl">
      {/* 1. Left Sidebar (Fixed on desktop, toggled on mobile) */}
      <div
        className={`h-full w-full shrink-0 lg:w-80 ${
          activeConversationId ? 'hidden lg:block' : 'block'
        }`}
      >
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => setActiveConversationId(id)}
          currentUserRole={currentUserRole}
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
          onOpenNewDirectChat={(query) => {
            setDirectChatInitialQuery(query || '');
            setIsNewDirectChatOpen(true);
          }}
          ablyStatus={ablyStatus}
        />
      </div>

      {/* 2. Main Conversation Area */}
      <div
        className={`flex h-full flex-1 flex-col ${
          !activeConversationId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <ChatConversationView
          conversation={activeConversation}
          messages={activeMessages}
          onSendMessage={handleSendMessage}
          onDeleteMessage={handleDeleteMessage}
          onLoadEarlier={handleLoadEarlier}
          hasMore={hasMoreMessages}
          isLoadingEarlier={isLoadingEarlier}
          onBackMobile={() => setActiveConversationId(null)}
          onToggleInfoPanel={() => setIsInfoPanelOpen((prev) => !prev)}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          isInfoPanelOpen={isInfoPanelOpen}
          ablyStatus={ablyStatus}
        />
      </div>

      {/* 3. Optional Right Information Panel */}
      {isInfoPanelOpen && activeConversation && (
        <div className="hidden h-full shrink-0 md:block">
          <ChatInfoPanel
            conversation={activeConversation}
            onClose={() => setIsInfoPanelOpen(false)}
            currentUserRole={currentUserRole}
            currentUserId={currentUserId}
            onConversationUpdated={handleConversationUpdated}
          />
        </div>
      )}

      {/* 4. Faculty Academic Group Creation Dialog */}
      <CreateGroupDialog
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={handleGroupCreated}
        departmentId={currentUserDepartmentId}
      />

      {/* 5. Collegiate New Direct Advisory Message Dialog */}
      <NewDirectChatDialog
        isOpen={isNewDirectChatOpen}
        onClose={() => setIsNewDirectChatOpen(false)}
        onConversationCreated={handleConversationCreated}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        departmentId={currentUserDepartmentId}
        initialQuery={directChatInitialQuery}
      />
    </div>
  );
}
