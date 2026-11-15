/**
 * Mongoose Model & Schema for Notices (Phase 5.4).
 * Enforces collegiate bulletin taxonomies, compound query indexing, and indefinite retention.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type { INotice, NoticeDTO } from '@/types/notice';

const NoticeAttachmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    url: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const NoticeTargetScopeSchema = new Schema(
  {
    scopeType: {
      type: String,
      enum: ['institution_wide', 'department', 'role_specific', 'cohort'],
      default: 'institution_wide',
      required: true,
    },
    departmentIds: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    roles: [{ type: String, enum: ['student', 'faculty', 'admin', 'super_admin'] }],
    programs: [{ type: String, trim: true }],
    batchYears: [{ type: Number }],
    semesters: [{ type: Number }],
    sections: [{ type: String, trim: true }],
    courseCode: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const NoticeAuthorSnapshotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true },
    adminSubRole: { type: String, default: null },
    departmentName: { type: String, default: null },
    departmentCode: { type: String, default: null },
  },
  { _id: false }
);

const NoticeSchema = new Schema<INotice>(
  {
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
      minlength: [3, 'Notice title must be at least 3 characters'],
      maxlength: [150, 'Notice title cannot exceed 150 characters'],
    },
    contentMarkdown: {
      type: String,
      required: [true, 'Notice content is required'],
      trim: true,
      minlength: [10, 'Notice content must be at least 10 characters'],
      maxlength: [25000, 'Notice content cannot exceed 25,000 characters'],
    },
    summary: {
      type: String,
      trim: true,
      maxlength: [300, 'Summary cannot exceed 300 characters'],
      default: null,
    },
    category: {
      type: String,
      enum: [
        'academic',
        'examination',
        'fee_accounts',
        'event_cultural',
        'placement',
        'administrative',
        'emergency',
      ],
      required: [true, 'Notice category is required'],
      index: true,
    },
    priority: {
      type: String,
      enum: ['normal', 'important', 'urgent'],
      default: 'normal',
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    targetScope: {
      type: NoticeTargetScopeSchema,
      required: true,
      default: () => ({ scopeType: 'institution_wide' }),
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author reference is required'],
      index: true,
    },
    authorSnapshot: {
      type: NoticeAuthorSnapshotSchema,
      required: true,
    },
    attachments: {
      type: [NoticeAttachmentSchema],
      default: [],
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    requiresAcknowledgment: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    readCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    acknowledgmentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Query Indexes for Fast Feed Assembly
NoticeSchema.index(
  { 'targetScope.scopeType': 1, status: 1, isDeleted: 1, isPinned: -1, publishedAt: -1 },
  { name: 'idx_notices_feed_scope' }
);

NoticeSchema.index(
  { 'targetScope.departmentIds': 1, status: 1, isDeleted: 1, publishedAt: -1 },
  { name: 'idx_notices_dept_feed' }
);

NoticeSchema.index(
  { authorId: 1, status: 1, isDeleted: 1, createdAt: -1 },
  { name: 'idx_notices_author_desk' }
);

NoticeSchema.index(
  { title: 'text', contentMarkdown: 'text' },
  { name: 'idx_notices_text_search' }
);

/**
 * Serializes an INotice document into a client-safe NoticeDTO.
 */
export function toNoticeDTO(
  notice: INotice,
  hasRead = false,
  hasAcknowledged = false
): NoticeDTO {
  return {
    id: notice._id.toString(),
    title: notice.title,
    contentMarkdown: notice.contentMarkdown,
    summary: notice.summary ?? null,
    category: notice.category,
    priority: notice.priority,
    status: notice.status,
    targetScope: {
      scopeType: notice.targetScope.scopeType,
      departmentIds: notice.targetScope.departmentIds?.map((id) => id.toString()),
      roles: notice.targetScope.roles,
      programs: notice.targetScope.programs,
      batchYears: notice.targetScope.batchYears,
      semesters: notice.targetScope.semesters,
      sections: notice.targetScope.sections,
      courseCode: notice.targetScope.courseCode,
    },
    author: {
      id: notice.authorId.toString(),
      name: notice.authorSnapshot.name,
      role: notice.authorSnapshot.role,
      adminSubRole: notice.authorSnapshot.adminSubRole ?? null,
      departmentCode: notice.authorSnapshot.departmentCode ?? null,
    },
    attachments: notice.attachments ?? [],
    isPinned: notice.isPinned ?? false,
    requiresAcknowledgment: notice.requiresAcknowledgment ?? false,
    publishedAt: notice.publishedAt ? notice.publishedAt.toISOString() : null,
    expiresAt: notice.expiresAt ? notice.expiresAt.toISOString() : null,
    readCount: notice.readCount ?? 0,
    acknowledgmentCount: notice.acknowledgmentCount ?? 0,
    hasRead,
    hasAcknowledged,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
  };
}

export const NoticeModel: Model<INotice> =
  mongoose.models.Notice || mongoose.model<INotice>('Notice', NoticeSchema);

