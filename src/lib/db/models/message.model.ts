import mongoose, { Schema, type Model } from 'mongoose';
import type { IMessage } from '@/types/chat';

const MessageAttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
    type: { type: String, required: true },
  },
  { _id: false }
);

const MessageSenderSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true },
    role: {
      type: String,
      enum: ['student', 'faculty', 'admin', 'super_admin'],
      required: true,
    },
    username: { type: String },
    avatarUrl: { type: String },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderSnapshot: {
      type: MessageSenderSnapshotSchema,
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    attachments: {
      type: [MessageAttachmentSchema],
      default: undefined,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: 'messages',
  }
);

// Compound indexes for high-speed chronological message retrieval and cursor pagination
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, _id: -1 });

export const MessageModel: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
