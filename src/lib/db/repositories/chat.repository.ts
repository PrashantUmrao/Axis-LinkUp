import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { ConversationModel, MessageModel } from '../models';
import type {
  IConversation,
  IMessage,
  ConversationType,
  GroupPolicy,
  ConversationMemberRole,
  IAcademicContext,
  IMessageAttachmentSubdoc,
  IMessageSenderSnapshotSubdoc,
} from '@/types/chat';

export interface CreateDirectConversationParams {
  userAId: string;
  userBId: string;
}

export interface CreateGroupConversationParams {
  name: string;
  description?: string;
  departmentId?: string;
  academicContext?: IAcademicContext;
  createdBy: string;
  initialMemberIds?: string[];
  groupPolicy?: GroupPolicy;
}

export interface FindUserConversationsParams {
  userId: string;
  type?: ConversationType;
  departmentId?: string;
  limit?: number;
}

export interface GetMessagesParams {
  conversationId: string;
  limit?: number;
  before?: string; // ISO date string or ObjectId
  after?: string; // ISO date string or ObjectId
}

export class ChatRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Helper to construct unique deterministic direct conversation key
   */
  public static getDirectKey(userAId: string, userBId: string): string {
    return [userAId, userBId].sort().join(':');
  }

  /**
   * Finds an existing 1-to-1 direct conversation or creates one idempotently.
   */
  public static async findOrCreateDirectConversation(
    params: CreateDirectConversationParams
  ): Promise<IConversation> {
    await this.ensureConnection();
    const directKey = this.getDirectKey(params.userAId, params.userBId);

    const existing = await ConversationModel.findOne({
      directKey,
      type: 'direct',
    }).exec();

    if (existing) {
      return existing;
    }

    const objA = new Types.ObjectId(params.userAId);
    const objB = new Types.ObjectId(params.userBId);

    try {
      const created = await ConversationModel.create({
        type: 'direct',
        createdBy: objA,
        directKey,
        participants: [objA, objB],
        members: [
          { userId: objA, role: 'member' as ConversationMemberRole, joinedAt: new Date() },
          { userId: objB, role: 'member' as ConversationMemberRole, joinedAt: new Date() },
        ],
        groupPolicy: 'open_discussion',
        isArchived: false,
      });

      return created;
    } catch (err: unknown) {
      // Handle race condition duplicate key error (E11000)
      if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
        const raceFound = await ConversationModel.findOne({ directKey, type: 'direct' }).exec();
        if (raceFound) {
          return raceFound;
        }
      }
      throw err;
    }
  }

  /**
   * Creates a faculty-managed academic group conversation.
   */
  public static async createGroupConversation(
    params: CreateGroupConversationParams
  ): Promise<IConversation> {
    await this.ensureConnection();
    const creatorId = new Types.ObjectId(params.createdBy);

    // Build distinct participant IDs starting with creator
    const participantIdSet = new Set<string>([params.createdBy]);
    if (params.initialMemberIds) {
      for (const id of params.initialMemberIds) {
        participantIdSet.add(id);
      }
    }

    const participants = Array.from(participantIdSet).map((id) => new Types.ObjectId(id));

    const members = [
      {
        userId: creatorId,
        role: 'admin' as ConversationMemberRole,
        joinedAt: new Date(),
      },
      ...Array.from(participantIdSet)
        .filter((id) => id !== params.createdBy)
        .map((id) => ({
          userId: new Types.ObjectId(id),
          role: 'member' as ConversationMemberRole,
          joinedAt: new Date(),
        })),
    ];

    const group = await ConversationModel.create({
      type: 'group',
      name: params.name,
      description: params.description,
      departmentId: params.departmentId ? new Types.ObjectId(params.departmentId) : undefined,
      academicContext: params.academicContext,
      createdBy: creatorId,
      participants,
      members,
      groupPolicy: params.groupPolicy || 'open_discussion',
      isArchived: false,
    });

    return group;
  }

  /**
   * Retrieves conversation by ID.
   */
  public static async findConversationById(id: string): Promise<IConversation | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    return ConversationModel.findById(id).exec();
  }

  /**
   * Retrieves conversations for a user, sorted by most recent activity.
   */
  public static async findUserConversations(
    params: FindUserConversationsParams
  ): Promise<IConversation[]> {
    await this.ensureConnection();
    const query: Record<string, unknown> = {
      participants: new Types.ObjectId(params.userId),
    };

    if (params.type) {
      query.type = params.type;
    }

    if (params.departmentId && Types.ObjectId.isValid(params.departmentId)) {
      query.departmentId = new Types.ObjectId(params.departmentId);
    }

    const limit = params.limit ?? 50;

    return ConversationModel.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Updates group metadata.
   */
  public static async updateGroup(
    id: string,
    updates: {
      name?: string;
      description?: string;
      groupPolicy?: GroupPolicy;
      isArchived?: boolean;
    }
  ): Promise<IConversation | null> {
    await this.ensureConnection();
    return ConversationModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Adds student members to an academic group.
   */
  public static async addMembersToGroup(
    conversationId: string,
    userIds: string[]
  ): Promise<IConversation | null> {
    await this.ensureConnection();
    const objectIds = userIds.map((id) => new Types.ObjectId(id));
    const newMembers = objectIds.map((objId) => ({
      userId: objId,
      role: 'member' as ConversationMemberRole,
      joinedAt: new Date(),
    }));

    return ConversationModel.findByIdAndUpdate(
      conversationId,
      {
        $addToSet: {
          participants: { $each: objectIds },
          members: { $each: newMembers },
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Removes members from an academic group.
   */
  public static async removeMembersFromGroup(
    conversationId: string,
    userIds: string[]
  ): Promise<IConversation | null> {
    await this.ensureConnection();
    const objectIds = userIds.map((id) => new Types.ObjectId(id));

    return ConversationModel.findByIdAndUpdate(
      conversationId,
      {
        $pull: {
          participants: { $in: objectIds },
          members: { userId: { $in: objectIds } },
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Persists a chat message and updates the parent conversation's lastMessage preview.
   */
  public static async saveMessage(params: {
    conversationId: string;
    senderId: string;
    senderSnapshot: IMessageSenderSnapshotSubdoc;
    content: string;
    attachments?: IMessageAttachmentSubdoc[];
  }): Promise<IMessage> {
    await this.ensureConnection();
    const convId = new Types.ObjectId(params.conversationId);
    const senderObjId = new Types.ObjectId(params.senderId);

    const message = await MessageModel.create({
      conversationId: convId,
      senderId: senderObjId,
      senderSnapshot: params.senderSnapshot,
      content: params.content,
      attachments: params.attachments,
      readBy: [senderObjId],
      isDeleted: false,
    });

    // Update conversation's lastMessage and bump updatedAt
    await ConversationModel.findByIdAndUpdate(convId, {
      $set: {
        lastMessage: {
          messageId: message._id,
          text: params.content.slice(0, 200),
          senderId: senderObjId,
          senderName: params.senderSnapshot.fullName,
          senderRole: params.senderSnapshot.role,
          sentAt: message.createdAt,
        },
      },
    }).exec();

    return message;
  }

  /**
   * Fetches paginated messages in consistent chronological order (oldest first, newest last).
   * Queries descending by createdAt and _id for deterministic pagination, then normalizes
   * to ascending chronological order so timeline order is consistent before and after refresh.
   */
  public static async getConversationMessages(
    params: GetMessagesParams
  ): Promise<{ messages: IMessage[]; hasMore: boolean }> {
    await this.ensureConnection();
    const convId = new Types.ObjectId(params.conversationId);
    const limit = params.limit ?? 50;

    const filter: Record<string, unknown> = {
      conversationId: convId,
    };

    if (params.before) {
      if (Types.ObjectId.isValid(params.before)) {
        filter._id = { $lt: new Types.ObjectId(params.before) };
      } else {
        const parsedDate = new Date(params.before);
        if (!isNaN(parsedDate.getTime())) {
          filter.createdAt = { $lt: parsedDate };
        }
      }
    } else if (params.after) {
      if (Types.ObjectId.isValid(params.after)) {
        filter._id = { $gt: new Types.ObjectId(params.after) };
      } else {
        const parsedDate = new Date(params.after);
        if (!isNaN(parsedDate.getTime())) {
          filter.createdAt = { $gt: parsedDate };
        }
      }
    }

    const sortOrder: Record<string, 1 | -1> = params.after
      ? { createdAt: 1, _id: 1 }
      : { createdAt: -1, _id: -1 };

    const fetched = await MessageModel.find(filter)
      .sort(sortOrder)
      .limit(limit + 1)
      .exec();

    const hasMore = fetched.length > limit;
    const slice = hasMore ? fetched.slice(0, limit) : fetched;

    // Normalize descending results to ascending chronological order:
    // index 0 is oldest, index [length - 1] is newest
    const messages = params.after ? slice : [...slice].reverse();

    return { messages, hasMore };
  }

  /**
   * Marks all messages in a conversation as read by a specific user.
   */
  public static async markMessagesAsRead(
    conversationId: string,
    userId: string,
    lastMessageId?: string
  ): Promise<void> {
    await this.ensureConnection();
    const convId = new Types.ObjectId(conversationId);
    const userObjId = new Types.ObjectId(userId);
    const now = new Date();

    // 1. Add userId to readBy array for messages where not already present
    await MessageModel.updateMany(
      {
        conversationId: convId,
        readBy: { $ne: userObjId },
      },
      {
        $addToSet: { readBy: userObjId },
      }
    ).exec();

    // 2. Update the member subdoc in Conversation
    const updateQuery: Record<string, unknown> = {
      'members.$.lastReadAt': now,
    };
    if (lastMessageId && Types.ObjectId.isValid(lastMessageId)) {
      updateQuery['members.$.lastReadMessageId'] = new Types.ObjectId(lastMessageId);
    }

    await ConversationModel.updateOne(
      {
        _id: convId,
        'members.userId': userObjId,
      },
      {
        $set: updateQuery,
      }
    ).exec();
  }

  /**
   * Counts unread messages for a given user in a conversation.
   */
  public static async countUnreadMessages(
    conversationId: string,
    userId: string
  ): Promise<number> {
    await this.ensureConnection();
    const convId = new Types.ObjectId(conversationId);
    const userObjId = new Types.ObjectId(userId);

    return MessageModel.countDocuments({
      conversationId: convId,
      senderId: { $ne: userObjId },
      readBy: { $ne: userObjId },
      isDeleted: false,
    }).exec();
  }

  /**
   * Retrieves message by ID.
   */
  public static async findMessageById(messageId: string): Promise<IMessage | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(messageId)) return null;
    return MessageModel.findById(messageId).exec();
  }

  /**
   * Soft-deletes a message.
   */
  public static async softDeleteMessage(
    messageId: string,
    userId: string
  ): Promise<IMessage | null> {
    await this.ensureConnection();
    return MessageModel.findByIdAndUpdate(
      messageId,
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: new Types.ObjectId(userId),
          content: 'This message was deleted',
        },
      },
      { new: true }
    ).exec();
  }
}
