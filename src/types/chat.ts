/**
 * Internal Chat & Group Messaging Type Definitions.
 * Conforms to Phase 4.8.2 communication specification and Phase 5.6 Real-Time Chat & Faculty Academic Groups.
 */

import type { Types } from 'mongoose';
import type { UserRole } from './user';

export type ConversationType = 'direct' | 'group';
export type GroupPolicy = 'broadcast_only' | 'open_discussion';
export type ConversationMemberRole = 'admin' | 'member';

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
  readBy?: string[];
  isDeleted?: boolean;
}

export interface ConversationMember {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  isModerator?: boolean;
}

export interface ConversationMemberDTO {
  userId: string;
  role: ConversationMemberRole;
  joinedAt: string;
  lastReadAt?: string;
  lastReadMessageId?: string;
  userSnapshot?: {
    fullName: string;
    role: UserRole;
    username?: string;
    avatarUrl?: string;
  };
}

export interface AcademicContextDTO {
  courseCode?: string;
  courseName?: string;
  semester?: number;
  section?: string;
  batchYear?: number;
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
  groupPolicy?: GroupPolicy;
  moderatorId?: string;
  description?: string;
  departmentId?: string;
  academicContext?: AcademicContextDTO;
  createdBy?: string;
  members?: ConversationMember[];
  memberDetails?: ConversationMemberDTO[];
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ConversationDTO = Conversation;

export type MessageDTO = ChatMessage;

export interface PaginatedMessagesDTO {
  messages: MessageDTO[];
  hasMore: boolean;
  nextCursor?: string;
  totalCount?: number;
}

/* ========================================================================== */
/* MongoDB Document Interfaces (Internal to Server / Data Access Layer)        */
/* ========================================================================== */

export interface IAcademicContext {
  courseCode?: string;
  courseName?: string;
  semester?: number;
  section?: string;
  batchYear?: number;
}

export interface IConversationMemberSubdoc {
  userId: Types.ObjectId;
  role: ConversationMemberRole;
  joinedAt: Date;
  lastReadAt?: Date;
  lastReadMessageId?: Types.ObjectId;
}

export interface IConversationLastMessageSubdoc {
  messageId: Types.ObjectId;
  text: string;
  senderId: Types.ObjectId;
  senderName: string;
  senderRole: UserRole;
  sentAt: Date;
}

export interface IConversation {
  _id: Types.ObjectId;
  type: ConversationType;
  name?: string;
  description?: string;
  departmentId?: Types.ObjectId;
  academicContext?: IAcademicContext;
  createdBy: Types.ObjectId;
  directKey?: string;
  participants: Types.ObjectId[];
  members: IConversationMemberSubdoc[];
  groupPolicy: GroupPolicy;
  lastMessage?: IConversationLastMessageSubdoc;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageAttachmentSubdoc {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface IMessageSenderSnapshotSubdoc {
  fullName: string;
  role: UserRole;
  username?: string;
  avatarUrl?: string;
}

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderSnapshot: IMessageSenderSnapshotSubdoc;
  content: string;
  attachments?: IMessageAttachmentSubdoc[];
  readBy: Types.ObjectId[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
