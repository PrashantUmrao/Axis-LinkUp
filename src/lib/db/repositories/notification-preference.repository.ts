/**
 * NotificationPreference Repository (Data Access Layer - DAL).
 * Manages per-user notification toggles (1 document per user).
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { NotificationPreferenceModel } from '@/lib/db/models/notification-preference.model';
import type { INotificationPreference } from '@/types/notification';

export class NotificationPreferenceRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Retrieves a user's saved notification preferences (or null if defaults apply).
   */
  public static async findByUserId(
    userId: string | Types.ObjectId
  ): Promise<INotificationPreference | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(userId))) return null;
    return await NotificationPreferenceModel.findOne({
      userId: new Types.ObjectId(String(userId)),
    }).exec();
  }

  /**
   * Creates or updates a user's notification preferences atomically.
   */
  public static async upsertByUserId(
    userId: string | Types.ObjectId,
    data: {
      inAppEnabled?: boolean;
      emailEnabled?: boolean;
      soundEnabled?: boolean;
      categories?: Partial<INotificationPreference['categories']>;
    }
  ): Promise<INotificationPreference> {
    await this.ensureConnection();
    const userObjId = new Types.ObjectId(String(userId));

    const setFields: Record<string, unknown> = {};
    if (data.inAppEnabled !== undefined) setFields.inAppEnabled = data.inAppEnabled;
    if (data.emailEnabled !== undefined) setFields.emailEnabled = data.emailEnabled;
    if (data.soundEnabled !== undefined) setFields.soundEnabled = data.soundEnabled;

    if (data.categories) {
      for (const [key, val] of Object.entries(data.categories)) {
        if (val !== undefined && key !== 'emergency') {
          setFields[`categories.${key}`] = val;
        }
      }
    }

    const updated = await NotificationPreferenceModel.findOneAndUpdate(
      { userId: userObjId },
      {
        $set: setFields,
        $setOnInsert: { userId: userObjId },
      },
      { new: true, upsert: true, runValidators: true }
    ).exec();

    return updated;
  }
}
