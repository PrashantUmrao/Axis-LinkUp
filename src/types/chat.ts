/**
 * Internal Chat & Group Messaging Type Definitions.
 * Conforms to Phase 4.8.2 communication specification and WhatsApp Web UI layout.
 */

import type { UserRole } from './user';

export type ConversationType = 'direct' | 'group';

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar?: string | null;
  content: string;
  timestamp: string;
  isOwn: boolean;
  status: 'sent' | 'delivered' | 'read';
  attachments?: ChatAttachment[];
}

export interface ConversationMember {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  isModerator?: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  handle?: string;
  avatarUrl?: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isOnline?: boolean;
  isGroup: boolean;
  groupPolicy?: 'broadcast_only' | 'open_discussion';
  moderatorId?: string;
  description?: string;
  members?: ConversationMember[];
}
