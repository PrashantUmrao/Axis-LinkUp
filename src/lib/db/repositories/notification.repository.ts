/**
 * Notification Repository (Data Access Layer - DAL).
 * Manages MongoDB persistence for unified personal notifications, 60-second dedupe lookup,
 * unread summaries, mark-read, and archiving (MOD-17 / Phase 5.13).
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { NotificationModel } from '@/lib/db/models/notification.model';
import type { INotification, NotificationCategory } from '@/types/notification';

export class NotificationRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Persists a single notification record.
   */
  public static async create(data: Partial<INotification>): Promise<INotification> {
    await this.ensureConnection();
    const doc = new NotificationModel(data);
    return await doc.save();
  }

  /**
   * Bulk-inserts multiple notification records.
   */
  public static async createMany(items: Partial<INotification>[]): Promise<INotification[]> {
    await this.ensureConnection();
    if (items.length === 0) return [];
    const inserted = await NotificationModel.insertMany(items, { ordered: false });
    return inserted as unknown as INotification[];
  }

  /**
   * Finds a recent duplicate notification matching (userId, dedupeKey) within windowMs (default 60s).
   */
  public static async findRecentDuplicate(
    userId: string | Types.ObjectId,
    dedupeKey: string,
    windowMs = 60_000
  ): Promise<INotification | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(userId)) || !dedupeKey.trim()) return null;

    const cutoff = new Date(Date.now() - windowMs);
    return await NotificationModel.findOne({
      userId: new Types.ObjectId(String(userId)),
      dedupeKey: dedupeKey.trim(),
      createdAt: { $gte: cutoff },
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Finds a notification by ObjectId.
   */
  public static async findById(id: string | Types.ObjectId): Promise<INotification | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await NotificationModel.findById(id).exec();
  }

  /**
   * Lists paginated non-archived notifications strictly scoped to userId.
   */
  public static async findByUser(
    userId: string | Types.ObjectId,
    filter: Record<string, unknown> = {},
    page = 1,
    limit = 20
  ): Promise<{ notifications: INotification[]; total: number }> {
    await this.ensureConnection();
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(50, limit));
    const skip = (validPage - 1) * validLimit;

    const query: Record<string, unknown> = {
      ...filter,
      userId: new Types.ObjectId(String(userId)),
      isArchived: false,
    };

    const [notifications, total] = await Promise.all([
      NotificationModel.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      NotificationModel.countDocuments(query).exec(),
    ]);

    return { notifications, total };
  }

  /**
   * Counts unread, non-archived notifications for a user.
   */
  public static async countUnread(userId: string | Types.ObjectId): Promise<number> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(userId))) return 0;
    return await NotificationModel.countDocuments({
      userId: new Types.ObjectId(String(userId)),
      isArchived: false,
      isRead: false,
    }).exec();
  }

  /**
   * Computes per-category unread counts + latest 5 unread notifications for the Topbar bell.
   */
  public static async getUnreadBreakdownAndRecent(
    userId: string | Types.ObjectId,
    recentLimit = 5
  ): Promise<{
    unreadCount: number;
    byCategory: Partial<Record<NotificationCategory, number>>;
    recent: INotification[];
  }> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(userId))) {
      return { unreadCount: 0, byCategory: {}, recent: [] };
    }

    const userObjId = new Types.ObjectId(String(userId));
    const baseMatch = { userId: userObjId, isArchived: false, isRead: false };

    const [catAgg, recent] = await Promise.all([
      NotificationModel.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]).exec(),
      NotificationModel.find(baseMatch)
        .sort({ createdAt: -1, _id: -1 })
        .limit(recentLimit)
        .exec(),
    ]);

    const byCategory: Partial<Record<NotificationCategory, number>> = {};
    let unreadCount = 0;

    for (const row of catAgg as Array<{ _id: NotificationCategory; count: number }>) {
      if (row._id) {
        byCategory[row._id] = row.count;
        unreadCount += row.count;
      }
    }

    return { unreadCount, byCategory, recent };
  }

  /**
   * Marks a single notification owned by userId as read.
   */
  public static async markAsRead(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<INotification | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id)) || !Types.ObjectId.isValid(String(userId))) {
      return null;
    }

    return await NotificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(String(id)),
        userId: new Types.ObjectId(String(userId)),
        isArchived: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Marks all unread notifications (optionally within a single category) as read for userId.
   */
  public static async markAllAsRead(
    userId: string | Types.ObjectId,
    category?: NotificationCategory
  ): Promise<number> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(userId))) return 0;

    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(String(userId)),
      isArchived: false,
      isRead: false,
    };
    if (category) filter.category = category;

    const res = await NotificationModel.updateMany(filter, {
      $set: { isRead: true, readAt: new Date() },
    }).exec();

    return res.modifiedCount || 0;
  }

  /**
   * Archives/dismisses a single notification owned by userId.
   */
  public static async archiveNotification(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<INotification | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id)) || !Types.ObjectId.isValid(String(userId))) {
      return null;
    }

    return await NotificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(String(id)),
        userId: new Types.ObjectId(String(userId)),
      },
      {
        $set: { isArchived: true, isRead: true, readAt: new Date() },
      },
      { new: true }
    ).exec();
  }
}
