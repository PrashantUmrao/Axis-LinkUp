import mongoose, { Schema, type Model } from 'mongoose';
import type { IConversation } from '@/types/chat';

const AcademicContextSchema = new Schema(
  {
    courseCode: { type: String, trim: true },
    courseName: { type: String, trim: true },
    semester: { type: Number, min: 1, max: 12 },
    section: { type: String, trim: true, uppercase: true },
    batchYear: { type: Number, min: 2000, max: 2100 },
  },
  { _id: false }
);

const ConversationMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date },
    lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
  },
  { _id: false }
);

const ConversationLastMessageSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    text: { type: String, required: true, maxlength: 1000 },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    senderRole: {
      type: String,
      enum: ['student', 'faculty', 'admin', 'super_admin'],
      required: true,
    },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    academicContext: {
      type: AcademicContextSchema,
      default: undefined,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    directKey: {
      type: String,
      default: undefined,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },
    ],
    members: {
      type: [ConversationMemberSchema],
      default: [],
    },
    groupPolicy: {
      type: String,
      enum: ['broadcast_only', 'open_discussion'],
      default: 'open_discussion',
    },
    lastMessage: {
      type: ConversationLastMessageSchema,
      default: undefined,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'conversations',
  }
);

// Ensure group conversations NEVER persist directKey (prevents null/empty key collisions)
ConversationSchema.pre('validate', function () {
  if (this.type === 'group') {
    this.directKey = undefined;
  }
});

// Compound indexes (AUD-C06: partial unique index strictly scoped to direct conversations)
ConversationSchema.index(
  { directKey: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'direct', directKey: { $type: 'string' } },
  }
);
ConversationSchema.index({ participants: 1, updatedAt: -1 });
ConversationSchema.index({ departmentId: 1, type: 1, isArchived: 1 });

export const ConversationModel: Model<IConversation> =
  mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);
