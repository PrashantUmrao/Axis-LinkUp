/**
 * EmergencyAlert Repository (Data Access Layer - DAL).
 * Manages MongoDB persistence for Campus Emergency Mode & Broadcasts (MOD-16 / Phase 5.11).
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { EmergencyAlertModel } from '@/lib/db/models/emergency-alert.model';
import type {
  IEmergencyAlert,
  IEmergencyActorSnapshot,
  EmergencyHistoryStatsDTO,
} from '@/types/emergency';

export class EmergencyAlertRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Persists a new emergency alert document.
   */
  public static async create(data: Partial<IEmergencyAlert>): Promise<IEmergencyAlert> {
    await this.ensureConnection();
    const doc = new EmergencyAlertModel(data);
    return await doc.save();
  }

  /**
   * Retrieves the currently active campus emergency alert (if any).
   */
  public static async findActiveAlert(): Promise<IEmergencyAlert | null> {
    await this.ensureConnection();
    return await EmergencyAlertModel.findOne({ isActive: true })
      .sort({ triggeredAt: -1 })
      .exec();
  }

  /**
   * Retrieves an emergency alert by ObjectId.
   */
  public static async findById(id: string | Types.ObjectId): Promise<IEmergencyAlert | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await EmergencyAlertModel.findById(id).exec();
  }

  /**
   * Atomically deactivates an active emergency alert with all-clear metadata.
   */
  public static async deactivate(
    id: string | Types.ObjectId,
    deactivatedBy: string | Types.ObjectId,
    deactivatedBySnapshot: IEmergencyActorSnapshot,
    deactivationNotes: string
  ): Promise<IEmergencyAlert | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;

    return await EmergencyAlertModel.findOneAndUpdate(
      { _id: new Types.ObjectId(String(id)), isActive: true },
      {
        $set: {
          isActive: false,
          deactivatedBy: new Types.ObjectId(String(deactivatedBy)),
          deactivatedBySnapshot,
          deactivatedAt: new Date(),
          deactivationNotes,
        },
      },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Atomically increments the denormalized acknowledgmentCount on unique user receipt.
   */
  public static async incrementAcknowledgmentCount(
    id: string | Types.ObjectId
  ): Promise<IEmergencyAlert | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;

    return await EmergencyAlertModel.findByIdAndUpdate(
      id,
      { $inc: { acknowledgmentCount: 1 } },
      { new: true }
    ).exec();
  }

  /**
   * Queries paginated emergency broadcast history.
   */
  public static async findHistory(
    filter: Record<string, unknown>,
    page = 1,
    limit = 20
  ): Promise<{ alerts: IEmergencyAlert[]; total: number }> {
    await this.ensureConnection();
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const skip = (validPage - 1) * validLimit;

    const [alerts, total] = await Promise.all([
      EmergencyAlertModel.find(filter)
        .sort({ triggeredAt: -1, _id: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      EmergencyAlertModel.countDocuments(filter).exec(),
    ]);

    return { alerts, total };
  }

  /**
   * Generates a collision-resistant institutional emergency alert code.
   * Format: EMG-YYYY-XXXXX (e.g., EMG-2026-10001).
   */
  public static async getNextAlertCode(year?: number): Promise<string> {
    await this.ensureConnection();
    const currentYear = year || new Date().getFullYear();
    const prefix = `EMG-${currentYear}-`;

    const count = await EmergencyAlertModel.countDocuments({
      alertCode: { $regex: `^${prefix}` },
    }).exec();

    const sequence = String(10001 + count).padStart(5, '0');
    let candidate = `${prefix}${sequence}`;

    const collision = await EmergencyAlertModel.exists({ alertCode: candidate });
    if (collision) {
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      candidate = `${prefix}${randomSuffix}`;
    }

    return candidate;
  }

  /**
   * Computes aggregated statistics across all emergency alerts.
   */
  public static async getStats(): Promise<EmergencyHistoryStatsDTO> {
    await this.ensureConnection();

    const [agg] = await EmergencyAlertModel.aggregate([
      {
        $facet: {
          totalCount: [{ $count: 'total' }],
          activeCount: [{ $match: { isActive: true } }, { $count: 'count' }],
          bySeverity: [{ $group: { _id: '$severity', count: { $sum: 1 } } }],
        },
      },
    ]).exec();

    const sevMap = new Map<string, number>();
    agg?.bySeverity?.forEach((item: { _id: string; count: number }) => {
      sevMap.set(item._id, item.count);
    });

    return {
      totalAlerts: agg?.totalCount?.[0]?.total || 0,
      activeCount: agg?.activeCount?.[0]?.count || 0,
      redCount: sevMap.get('red') || 0,
      amberCount: sevMap.get('amber') || 0,
      yellowCount: sevMap.get('yellow') || 0,
    };
  }
}
