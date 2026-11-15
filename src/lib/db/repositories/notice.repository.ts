/**
 * Notice & Bulletin Repository (Phase 5.4).
 * Encapsulates MongoDB persistence, audience filtering, and receipt queries.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { NoticeModel } from '@/lib/db/models/notice.model';
import { NoticeReceiptModel } from '@/lib/db/models/notice-receipt.model';
import type { INotice } from '@/types/notice';
import type { INoticeReceipt } from '@/types/notice-receipt';

export class NoticeRepository {
  /**
   * Persists a new notice document.
   */
  public static async create(noticeData: Partial<INotice>): Promise<INotice> {
    await connectToDatabase();
    const notice = await NoticeModel.create(noticeData);
    return notice.toObject();
  }

  /**
   * Finds a notice by its ObjectId (excluding soft-deleted records).
   */
  public static async findById(id: string): Promise<INotice | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(id)) return null;

    const notice = await NoticeModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
    }).lean();

    return notice as INotice | null;
  }

  /**
   * Updates a notice by its ObjectId.
   */
  public static async update(id: string, updates: Partial<INotice>): Promise<INotice | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(id)) return null;

    const updated = await NoticeModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), isDeleted: false },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return updated as INotice | null;
  }

  /**
   * Soft deletes a notice.
   */
  public static async softDelete(id: string, deletedById: string): Promise<boolean> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(id)) return false;

    const res = await NoticeModel.updateOne(
      { _id: new Types.ObjectId(id), isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: new Types.ObjectId(deletedById),
        },
      }
    );

    return res.modifiedCount > 0;
  }

  /**
   * Fetches paginated notices matching audience filters using cursor-based pagination.
   */
  public static async findFeed(
    filterQuery: Record<string, unknown>,
    limit = 20,
    cursor?: string
  ): Promise<{ notices: INotice[]; nextCursor: string | null; hasMore: boolean }> {
    await connectToDatabase();

    const query: Record<string, unknown> = {
      ...filterQuery,
      isDeleted: false,
    };

    if (cursor && Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const effectiveLimit = Math.min(100, Math.max(1, limit));
    const docs = await NoticeModel.find(query)
      .sort({ isPinned: -1, publishedAt: -1, createdAt: -1, _id: -1 })
      .limit(effectiveLimit + 1)
      .lean();

    const hasMore = docs.length > effectiveLimit;
    const notices = (hasMore ? docs.slice(0, effectiveLimit) : docs) as INotice[];
    const lastNotice = notices[notices.length - 1];
    const nextCursor = hasMore && lastNotice ? lastNotice._id.toString() : null;

    return {
      notices,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Records or updates a read receipt for a notice atomically.
   */
  public static async createOrUpdateReceipt(
    noticeId: string,
    userId: string,
    isAcknowledgment = false
  ): Promise<INoticeReceipt> {
    await connectToDatabase();

    const noticeObjectId = new Types.ObjectId(noticeId);
    const userObjectId = new Types.ObjectId(userId);

    const updateFields: Record<string, unknown> = {
      readAt: new Date(),
    };

    if (isAcknowledgment) {
      updateFields.acknowledgedAt = new Date();
    }

    const receipt = await NoticeReceiptModel.findOneAndUpdate(
      { noticeId: noticeObjectId, userId: userObjectId },
      { $set: updateFields, $setOnInsert: { noticeId: noticeObjectId, userId: userObjectId } },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    return receipt as INoticeReceipt;
  }

  /**
   * Finds an existing receipt for a user and notice.
   */
  public static async findReceipt(noticeId: string, userId: string): Promise<INoticeReceipt | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(noticeId) || !Types.ObjectId.isValid(userId)) return null;

    const receipt = await NoticeReceiptModel.findOne({
      noticeId: new Types.ObjectId(noticeId),
      userId: new Types.ObjectId(userId),
    }).lean();

    return receipt as INoticeReceipt | null;
  }

  /**
   * Batch fetches read receipts for a specific user across multiple notice IDs.
   */
  public static async findReceiptsForUser(
    userId: string,
    noticeIds: string[]
  ): Promise<Map<string, { hasRead: boolean; hasAcknowledged: boolean }>> {
    await connectToDatabase();
    const map = new Map<string, { hasRead: boolean; hasAcknowledged: boolean }>();

    if (!Types.ObjectId.isValid(userId) || noticeIds.length === 0) return map;

    const validNoticeObjectIds = noticeIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const receipts = await NoticeReceiptModel.find({
      userId: new Types.ObjectId(userId),
      noticeId: { $in: validNoticeObjectIds },
    }).lean();

    for (const receipt of receipts) {
      map.set(receipt.noticeId.toString(), {
        hasRead: Boolean(receipt.readAt),
        hasAcknowledged: Boolean(receipt.acknowledgedAt),
      });
    }

    return map;
  }

  /**
   * Fetches paginated receipts for a specific notice (author & admin compliance view).
   */
  public static async findReceiptsByNotice(
    noticeId: string,
    limit = 50,
    cursor?: string
  ): Promise<{ receipts: INoticeReceipt[]; totalCount: number; nextCursor: string | null; hasMore: boolean }> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(noticeId)) {
      return { receipts: [], totalCount: 0, nextCursor: null, hasMore: false };
    }

    const noticeObjectId = new Types.ObjectId(noticeId);
    const query: Record<string, unknown> = { noticeId: noticeObjectId };

    if (cursor && Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const effectiveLimit = Math.min(100, Math.max(1, limit));

    const [docs, totalCount] = await Promise.all([
      NoticeReceiptModel.find(query)
        .sort({ readAt: -1, _id: -1 })
        .limit(effectiveLimit + 1)
        .lean(),
      NoticeReceiptModel.countDocuments({ noticeId: noticeObjectId }),
    ]);

    const hasMore = docs.length > effectiveLimit;
    const receipts = (hasMore ? docs.slice(0, effectiveLimit) : docs) as INoticeReceipt[];
    const lastReceipt = receipts[receipts.length - 1];
    const nextCursor = hasMore && lastReceipt ? lastReceipt._id.toString() : null;

    return {
      receipts,
      totalCount,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Counts unread published notices targeted to a user.
   */
  public static async countUnreadForUser(
    userId: string,
    audienceFilterQuery: Record<string, unknown>
  ): Promise<number> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(userId)) return 0;

    const userObjectId = new Types.ObjectId(userId);

    // 1. Get all notice IDs read by this user
    const readReceipts = await NoticeReceiptModel.find({ userId: userObjectId }, { noticeId: 1 }).lean();
    const readNoticeIds = readReceipts.map((r) => r.noticeId);

    // 2. Count active published notices matching caller audience that have NOT been read
    const unreadCount = await NoticeModel.countDocuments({
      ...audienceFilterQuery,
      status: 'published',
      isDeleted: false,
      _id: { $nin: readNoticeIds },
    });

    return unreadCount;
  }

  /**
   * Atomically increments the read counter on a notice.
   */
  public static async incrementReadCount(noticeId: string): Promise<void> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(noticeId)) return;

    await NoticeModel.updateOne(
      { _id: new Types.ObjectId(noticeId) },
      { $inc: { readCount: 1 } }
    );
  }

  /**
   * Atomically increments the acknowledgment counter on a notice.
   */
  public static async incrementAcknowledgmentCount(noticeId: string): Promise<void> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(noticeId)) return;

    await NoticeModel.updateOne(
      { _id: new Types.ObjectId(noticeId) },
      { $inc: { acknowledgmentCount: 1 } }
    );
  }
}
