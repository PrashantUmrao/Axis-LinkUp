import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';
import { ChatRepository } from '@/lib/db/repositories/chat.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import type { UserSession, UserRole } from '@/types/user';
import type {
  ConversationDTO,
  MessageDTO,
  PaginatedMessagesDTO,
  ConversationMember,
  ConversationMemberDTO,
  IConversation,
  IMessage,
} from '@/types/chat';
import type {
  CreateDirectChatInput,
  CreateGroupChatInput,
  UpdateGroupChatInput,
  ManageGroupMembersInput,
  SendMessageInput,
  MessagePaginationQueryInput,
  ConversationQueryInput,
} from '@/lib/validations/chat.schema';

export class ChatService {
  /**
   * Asserts caller holds an active, non-suspended session.
   */
  private static assertActiveSession(session: UserSession | null): asserts session is UserSession {
    if (!session || !session.userId) {
      throw new UnauthorizedError('Authentication required to access chat services.');
    }
    if (session.status === 'suspended') {
      throw new ForbiddenError('Account is suspended. Chat privileges are revoked.');
    }
    if (session.status !== 'active') {
      throw new ForbiddenError('Account is not in active collegiate status.');
    }
  }

  /**
   * Ensures MongoDB connection is established if MONGODB_URI is configured.
   */
  private static async ensureDatabase(): Promise<void> {
    if (process.env.MONGODB_URI) {
      try {
        await connectToDatabase();
      } catch (err) {
        logger.warn('[ChatService] Database connection skipped or failed:', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Serializes an internal IConversation document to a client-facing ConversationDTO.
   */
  public static async toConversationDTO(
    conv: IConversation,
    currentUserId: string
  ): Promise<ConversationDTO> {
    const isGroup = conv.type === 'group';
    let displayName = conv.name || 'Conversation';
    let displayAvatar = null;
    let handle: string | undefined = undefined;

    if (!isGroup) {
      // Direct conversation: Name and avatar belong to the counterpart user
      const otherParticipantId = conv.participants.find(
        (p) => p.toString() !== currentUserId
      );

      if (otherParticipantId) {
        const otherUser = await UserRepository.findById(otherParticipantId.toString());
        if (otherUser) {
          displayName = otherUser.fullName;
          displayAvatar = otherUser.avatarUrl || null;
          handle = otherUser.username ? `@${otherUser.username}` : undefined;
        }
      }
    }

    const unreadCount = await ChatRepository.countUnreadMessages(
      conv._id.toString(),
      currentUserId
    );

    const memberDetails: ConversationMemberDTO[] = conv.members?.map((m) => ({
      userId: m.userId.toString(),
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      lastReadAt: m.lastReadAt?.toISOString(),
      lastReadMessageId: m.lastReadMessageId?.toString(),
    })) || [];

    let members: ConversationMember[] | undefined;
    if (conv.members && conv.members.length > 0) {
      if (mongoose.connection?.readyState === 1) {
        try {
          const memberUserIds = conv.members.map((m) => m.userId.toString());
          const users = await UserRepository.findByIds(memberUserIds);
          const userMap = new Map(users.map((u) => [u._id.toString(), u]));

          members = conv.members.map((m) => {
            const u = userMap.get(m.userId.toString());
            return {
              id: m.userId.toString(),
              name: u?.fullName || 'Collegiate Member',
              role: (u?.role as UserRole) || 'student',
              avatarUrl: u?.avatarUrl || null,
              isModerator: m.role === 'admin' || conv.createdBy?.toString() === m.userId.toString(),
            };
          });
        } catch {
          // Fallback below
        }
      }

      if (!members) {
        members = conv.members.map((m) => ({
          id: m.userId.toString(),
          name: 'Collegiate Member',
          role: 'student',
          isModerator: m.role === 'admin',
        }));
      }
    }

    return {
      id: conv._id.toString(),
      type: conv.type,
      name: displayName,
      handle,
      avatarUrl: displayAvatar,
      lastMessage: conv.lastMessage?.text,
      lastMessageTime: conv.lastMessage?.sentAt?.toISOString(),
      unreadCount,
      isOnline: false,
      isGroup,
      groupPolicy: conv.groupPolicy,
      moderatorId: conv.createdBy?.toString(),
      description: conv.description,
      departmentId: conv.departmentId?.toString(),
      academicContext: conv.academicContext,
      createdBy: conv.createdBy?.toString(),
      members,
      memberDetails,
      isArchived: conv.isArchived,
      createdAt: conv.createdAt?.toISOString(),
      updatedAt: conv.updatedAt?.toISOString(),
    };
  }

  /**
   * Serializes an internal IMessage document to a client-facing MessageDTO.
   */
  public static toMessageDTO(msg: IMessage, currentUserId: string): MessageDTO {
    const isOwn = msg.senderId.toString() === currentUserId;

    return {
      id: msg._id.toString(),
      conversationId: msg.conversationId.toString(),
      senderId: msg.senderId.toString(),
      senderName: msg.senderSnapshot?.fullName || 'Collegiate User',
      senderRole: (msg.senderSnapshot?.role as UserRole) || 'student',
      senderAvatar: msg.senderSnapshot?.avatarUrl || null,
      content: msg.content,
      timestamp: msg.createdAt.toISOString(),
      isOwn,
      status: msg.readBy && msg.readBy.length > 1 ? 'read' : 'sent',
      attachments: msg.attachments,
      readBy: msg.readBy?.map((id) => id.toString()),
      isDeleted: msg.isDeleted,
    };
  }

  /**
   * Establishes or retrieves a 1-to-1 direct messaging conversation between two users.
   */
  public static async getOrCreateDirectChat(
    session: UserSession | null,
    input: CreateDirectChatInput
  ): Promise<ConversationDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    if (session.userId === input.recipientId) {
      throw new BadRequestError('You cannot establish a direct conversation with yourself.');
    }

    const recipient = await UserRepository.findById(input.recipientId);
    if (!recipient) {
      throw new NotFoundError('Recipient account not found in collegiate roster.');
    }

    if (recipient.status !== 'active') {
      throw new BadRequestError('Cannot message a collegiate user whose account is inactive.');
    }

    const conversation = await ChatRepository.findOrCreateDirectConversation({
      userAId: session.userId,
      userBId: input.recipientId,
    });

    logger.info(`[ChatService] Direct conversation resolved: ${conversation._id} between ${session.email} and ${recipient.email}`);
    return this.toConversationDTO(conversation, session.userId);
  }

  /**
   * Creates a faculty-managed academic group conversation.
   * Scoped to Faculty or Administrative personas. Students cannot create groups.
   */
  public static async createAcademicGroup(
    session: UserSession | null,
    input: CreateGroupChatInput
  ): Promise<ConversationDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    // Zero-Trust Role Gate: Only faculty and admins can author academic groups
    if (session.role === 'student') {
      throw new ForbiddenError('Students are not authorized to create collegiate academic groups.');
    }

    let departmentId = input.departmentId;

    // Default to faculty caller's own department if omitted
    if (!departmentId && session.departmentId) {
      departmentId = session.departmentId;
    }

    if (departmentId) {
      const deptExists = await DepartmentRepository.findById(departmentId);
      if (!deptExists) {
        throw new NotFoundError('Specified academic department does not exist.');
      }
    }

    // Verify all initial member IDs exist in MongoDB
    if (input.initialMemberIds && input.initialMemberIds.length > 0) {
      for (const memberId of input.initialMemberIds) {
        const studentUser = await UserRepository.findById(memberId);
        if (!studentUser) {
          throw new NotFoundError(`Member ID ${memberId} is not a registered user.`);
        }
        if (studentUser.status !== 'active') {
          throw new BadRequestError(`Cannot add inactive user ${studentUser.email} to academic group.`);
        }
      }
    }

    const conversation = await ChatRepository.createGroupConversation({
      name: input.name,
      description: input.description,
      departmentId,
      academicContext: input.academicContext,
      createdBy: session.userId,
      initialMemberIds: input.initialMemberIds,
      groupPolicy: input.groupPolicy,
    });

    logger.info(`[ChatService] Created academic group '${conversation.name}' (${conversation._id}) by ${session.email}`);
    return this.toConversationDTO(conversation, session.userId);
  }

  /**
   * Retrieves conversations for the authenticated user with unread counts and previews.
   */
  public static async getUserConversations(
    session: UserSession | null,
    query?: ConversationQueryInput
  ): Promise<ConversationDTO[]> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const conversations = await ChatRepository.findUserConversations({
      userId: session.userId,
      type: query?.type,
      departmentId: query?.departmentId,
      limit: query?.limit,
    });

    const dtos = await Promise.all(
      conversations.map((conv) => this.toConversationDTO(conv, session.userId))
    );

    if (query?.search) {
      const q = query.search.toLowerCase();
      return dtos.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.lastMessage?.toLowerCase().includes(q) ||
          c.handle?.toLowerCase().includes(q)
      );
    }

    return dtos;
  }

  /**
   * Retrieves conversation details by ID, validating membership.
   */
  public static async getConversationDetails(
    session: UserSession | null,
    conversationId: string
  ): Promise<ConversationDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const conv = await ChatRepository.findConversationById(conversationId);
    if (!conv) {
      throw new NotFoundError('Conversation not found.');
    }

    const isMember = conv.participants.some((p) => p.toString() === session.userId);
    if (!isMember) {
      throw new ForbiddenError('Access clearance denied. You are not a member of this conversation.');
    }

    return this.toConversationDTO(conv, session.userId);
  }

  /**
   * Updates group metadata (faculty group admin only).
   */
  public static async updateGroup(
    session: UserSession | null,
    conversationId: string,
    input: UpdateGroupChatInput
  ): Promise<ConversationDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const conv = await ChatRepository.findConversationById(conversationId);
    if (!conv) {
      throw new NotFoundError('Academic group not found.');
    }

    if (conv.type !== 'group') {
      throw new BadRequestError('Cannot update metadata on direct conversations.');
    }

    // Role Gate: Caller must be the creator, an admin member, or super_admin
    const isAdmin =
      conv.createdBy.toString() === session.userId ||
      session.role === 'super_admin' ||
      conv.members.some(
        (m) => m.userId.toString() === session.userId && m.role === 'admin'
      );

    if (!isAdmin) {
      throw new ForbiddenError('Only academic group administrators can update group settings.');
    }

    const updated = await ChatRepository.updateGroup(conversationId, input);
    if (!updated) {
      throw new NotFoundError('Failed to update academic group.');
    }

    return this.toConversationDTO(updated, session.userId);
  }

  /**
   * Adds or removes members from an academic group (faculty group admin only).
   */
  public static async manageGroupMembers(
    session: UserSession | null,
    conversationId: string,
    input: ManageGroupMembersInput
  ): Promise<ConversationDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const conv = await ChatRepository.findConversationById(conversationId);
    if (!conv) {
      throw new NotFoundError('Academic group not found.');
    }

    if (conv.type !== 'group') {
      throw new BadRequestError('Cannot manage members on direct conversations.');
    }

    const isAdmin =
      conv.createdBy.toString() === session.userId ||
      session.role === 'super_admin' ||
      conv.members.some(
        (m) => m.userId.toString() === session.userId && m.role === 'admin'
      );

    if (!isAdmin) {
      throw new ForbiddenError('Only academic group administrators can manage group membership.');
    }

    if (input.action === 'remove') {
      if (input.userIds.includes(conv.createdBy.toString())) {
        throw new BadRequestError('The faculty group creator cannot be removed from the academic group.');
      }

      const updated = await ChatRepository.removeMembersFromGroup(
        conversationId,
        input.userIds
      );
      if (!updated) {
        throw new NotFoundError('Failed to update group membership.');
      }
      return this.toConversationDTO(updated, session.userId);
    }

    // Action: add
    for (const userId of input.userIds) {
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(`User ${userId} not found in collegiate roster.`);
      }
      if (user.status !== 'active') {
        throw new BadRequestError(`Cannot add inactive user ${user.email} to academic group.`);
      }
    }

    const updated = await ChatRepository.addMembersToGroup(conversationId, input.userIds);
    if (!updated) {
      throw new NotFoundError('Failed to update group membership.');
    }

    return this.toConversationDTO(updated, session.userId);
  }

  /**
   * Sends a message into a direct conversation or academic group.
   * Persists message to MongoDB first, then statelessly dispatches to Ably.
   */
  public static async sendMessage(
    session: UserSession | null,
    conversationId: string,
    input: SendMessageInput
  ): Promise<MessageDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const conv = await ChatRepository.findConversationById(conversationId);
    if (!conv) {
      throw new NotFoundError('Conversation not found.');
    }

    const isMember = conv.participants.some((p) => p.toString() === session.userId);
    if (!isMember) {
      throw new ForbiddenError('Access clearance denied. You are not a member of this conversation.');
    }

    if (conv.isArchived) {
      throw new BadRequestError('This conversation has been archived and is read-only.');
    }

    // Broadcast-Only Policy Check: Only group admins may post
    if (conv.type === 'group' && conv.groupPolicy === 'broadcast_only') {
      const isGroupAdmin =
        conv.createdBy.toString() === session.userId ||
        session.role === 'super_admin' ||
        conv.members.some(
          (m) => m.userId.toString() === session.userId && m.role === 'admin'
        );

      if (!isGroupAdmin) {
        throw new ForbiddenError(
          'This academic group is in broadcast-only mode. Only faculty administrators can post announcements.'
        );
      }
    }

    const message = await ChatRepository.saveMessage({
      conversationId,
      senderId: session.userId,
      senderSnapshot: {
        fullName: session.fullName || 'Collegiate User',
        role: session.role,
        username: session.username,
        avatarUrl: session.avatarUrl ?? undefined,
      },
      content: input.content,
      attachments: input.attachments,
    });

    const messageDto = this.toMessageDTO(message, session.userId);

    // Real-Time Dispatch (stateless Ably REST broadcast to exact conversation channel)
    const channel = AblyBroker.getConversationChannel(conversationId, conv.type);

    await AblyBroker.publish(channel, 'chat.message.new', messageDto);

    // Notify unread updates to all participants on their private channels
    for (const participant of conv.participants) {
      const pIdStr = participant.toString();
      if (pIdStr !== session.userId) {
        await AblyBroker.publish(
          AblyBroker.getUserNotificationChannel(pIdStr),
          'chat.unread.update',
          {
            conversationId,
            unreadDelta: 1,
            lastMessage: messageDto.content,
            sentAt: messageDto.timestamp,
          }
        );
      }
    }

    return messageDto;
  }

  /**
   * Retrieves paginated messages in reverse-chronological order, marking them as read.
   */
  public static async getConversationMessages(
    session: UserSession | null,
    conversationId: string,
    query: MessagePaginationQueryInput
  ): Promise<PaginatedMessagesDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const conv = await ChatRepository.findConversationById(conversationId);
    if (!conv) {
      throw new NotFoundError('Conversation not found.');
    }

    const isMember = conv.participants.some((p) => p.toString() === session.userId);
    if (!isMember) {
      throw new ForbiddenError('Access clearance denied. You are not a member of this conversation.');
    }

    const { messages, hasMore } = await ChatRepository.getConversationMessages({
      conversationId,
      limit: query.limit,
      before: query.before,
      after: query.after,
    });

    // Mark messages as read for this user:
    // With chronological ordering, the latest message is the last element
    const latestMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
    if (latestMessage) {
      await ChatRepository.markMessagesAsRead(
        conversationId,
        session.userId,
        latestMessage._id.toString()
      );
    }

    const messageDtos = messages.map((m) => this.toMessageDTO(m, session.userId));
    // The cursor for loading earlier messages before this batch is the oldest message in the batch (index 0)
    const oldestItem = messages.length > 0 ? messages[0] : undefined;
    const nextCursor = hasMore && oldestItem ? oldestItem._id.toString() : undefined;

    return {
      messages: messageDtos,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Soft-deletes a message (Author or Faculty Group Administrator).
   */
  public static async softDeleteMessage(
    session: UserSession | null,
    conversationId: string,
    messageId: string
  ): Promise<MessageDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const conv = await ChatRepository.findConversationById(conversationId);
    if (!conv) {
      throw new NotFoundError('Conversation not found.');
    }

    const msg = await ChatRepository.findMessageById(messageId);
    if (!msg || msg.conversationId.toString() !== conversationId) {
      throw new NotFoundError('Message not found in this conversation.');
    }

    const isAuthor = msg.senderId.toString() === session.userId;
    const isGroupAdmin =
      conv.type === 'group' &&
      (conv.createdBy.toString() === session.userId ||
        session.role === 'super_admin' ||
        conv.members.some(
          (m) => m.userId.toString() === session.userId && m.role === 'admin'
        ));

    if (!isAuthor && !isGroupAdmin) {
      throw new ForbiddenError('You are not authorized to delete this message.');
    }

    const deleted = await ChatRepository.softDeleteMessage(messageId, session.userId);
    if (!deleted) {
      throw new NotFoundError('Failed to soft delete message.');
    }

    const deletedDto = this.toMessageDTO(deleted, session.userId);

    // Real-Time Dispatch of message deletion event to exact channel
    const channel = AblyBroker.getConversationChannel(conversationId, conv.type);

    await AblyBroker.publish(channel, 'chat.message.deleted', {
      messageId,
      conversationId,
    });

    return deletedDto;
  }

  /**
   * Explicitly marks conversation messages as read.
   */
  public static async markConversationAsRead(
    session: UserSession | null,
    conversationId: string
  ): Promise<{ success: boolean; conversationId: string }> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const conv = await ChatRepository.findConversationById(conversationId);
    if (!conv) {
      throw new NotFoundError('Conversation not found.');
    }

    const isMember = conv.participants.some((p) => p.toString() === session.userId);
    if (!isMember) {
      throw new ForbiddenError('Access clearance denied. You are not a member of this conversation.');
    }

    await ChatRepository.markMessagesAsRead(conversationId, session.userId);

    // Notify channel participants about read receipt on exact channel
    const channel = AblyBroker.getConversationChannel(conversationId, conv.type);

    await AblyBroker.publish(channel, 'chat.read', {
      conversationId,
      userId: session.userId,
      readAt: new Date().toISOString(),
    });

    return { success: true, conversationId };
  }
}
