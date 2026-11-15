/**
 * Mongoose Model & Schema for Notice Read Receipts (Phase 5.4).
 * Enforces single-receipt uniqueness and privacy-preserving compliance tracking.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type { INoticeReceipt, NoticeReceiptDTO } from '@/types/notice-receipt';

const NoticeReceiptSchema = new Schema<INoticeReceipt>(
  {
    noticeId: {
      type: Schema.Types.ObjectId,
      ref: 'Notice',
      required: [true, 'Notice reference is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Single Receipt Per User Compound Unique Constraint
NoticeReceiptSchema.index(
  { noticeId: 1, userId: 1 },
  { unique: true, name: 'uniq_notice_user_receipt' }
);

// Reverse Lookup Index for Computing Unread Notices
NoticeReceiptSchema.index(
  { userId: 1, noticeId: 1 },
  { name: 'idx_user_read_notices' }
);

// Analytical Index for Acknowledgment Stats
NoticeReceiptSchema.index(
  { noticeId: 1, acknowledgedAt: 1 },
  { name: 'idx_notice_acknowledgments' }
);

/**
 * Serializes an INoticeReceipt into a NoticeReceiptDTO.
 */
export function toNoticeReceiptDTO(
  receipt: INoticeReceipt,
  userSnapshot?: { name?: string; role?: string }
): NoticeReceiptDTO {
  return {
    id: receipt._id.toString(),
    noticeId: receipt.noticeId.toString(),
    userId: receipt.userId.toString(),
    userName: userSnapshot?.name,
    userRole: userSnapshot?.role,
    readAt: receipt.readAt.toISOString(),
    acknowledgedAt: receipt.acknowledgedAt ? receipt.acknowledgedAt.toISOString() : null,
  };
}

export const NoticeReceiptModel: Model<INoticeReceipt> =
  mongoose.models.NoticeReceipt ||
  mongoose.model<INoticeReceipt>('NoticeReceipt', NoticeReceiptSchema, 'notice_receipts');

