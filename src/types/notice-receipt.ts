/**
 * Notice Read Receipt & Acknowledgment Types (Phase 5.4).
 * Enforces privacy-preserving receipt tracking (zero IP logging by default).
 */

import type { Types } from 'mongoose';

export interface INoticeReceipt {
  _id: Types.ObjectId;
  noticeId: Types.ObjectId;
  userId: Types.ObjectId;
  readAt: Date;
  acknowledgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoticeReceiptDTO {
  id: string;
  noticeId: string;
  userId: string;
  userName?: string;
  userRole?: string;
  readAt: string;
  acknowledgedAt: string | null;
}

export interface NoticeReceiptStatsDTO {
  noticeId: string;
  totalReads: number;
  totalAcknowledgments: number;
  receipts: NoticeReceiptDTO[];
}

