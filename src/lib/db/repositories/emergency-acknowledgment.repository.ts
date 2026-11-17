/**
 * EmergencyAcknowledgment Repository (Data Access Layer - DAL).
 * Manages idempotent per-user acknowledgment receipts and role coverage aggregation
 * for MOD-16 Emergency Broadcasts.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { EmergencyAcknowledgmentModel } from '@/lib/db/models/emergency-acknowledgment.model';
import type {
  IEmergencyAcknowledgment,
  IEmergencyAckUserSnapshot,
} from '@/types/emergency';

export interface RecordAckInput {
  alertId: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  userSnapshot: IEmergencyAckUserSnapshot;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class EmergencyAcknowledgmentRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Finds an existing acknowledgment receipt for a given alert + user pair.
   */
  public static async findByAlertAndUser(
    alertId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IEmergencyAcknowledgment | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(alertId)) || !Types.ObjectId.isValid(String(userId))) {
      return null;
    }

    return await EmergencyAcknowledgmentModel.findOne({
      alertId: new Types.ObjectId(String(alertId)),
      userId: new Types.ObjectId(String(userId)),
    }).exec();
  }

  /**
   * Idempotently persists a per-user acknowledgment receipt.
   * Returns { record, created: boolean } so callers know whether to increment the alert counter.
   */
  public static async recordAcknowledgment(
    input: RecordAckInput
  ): Promise<{ record: IEmergencyAcknowledgment; created: boolean }> {
    await this.ensureConnection();

    const existing = await this.findByAlertAndUser(input.alertId, input.userId);
    if (existing) {
      return { record: existing, created: false };
    }

    try {
      const doc = new EmergencyAcknowledgmentModel({
        alertId: new Types.ObjectId(String(input.alertId)),
        userId: new Types.ObjectId(String(input.userId)),
        userSnapshot: input.userSnapshot,
        acknowledgedAt: new Date(),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 500) : null,
      });
      const saved = await doc.save();
      return { record: saved, created: true };
    } catch (err) {
      // Handle race-condition duplicate key (E11000) cleanly
      const mongoErr = err as { code?: number };
      if (mongoErr?.code === 11000) {
        const dup = await this.findByAlertAndUser(input.alertId, input.userId);
        if (dup) {
          return { record: dup, created: false };
        }
      }
      throw err;
    }
  }

  /**
   * Lists paginated acknowledgments for an emergency alert with optional filters.
   */
  public static async listByAlert(
    alertId: string | Types.ObjectId,
    filter: Record<string, unknown> = {},
    page = 1,
    limit = 25
  ): Promise<{ acknowledgments: IEmergencyAcknowledgment[]; total: number }> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(alertId))) {
      return { acknowledgments: [], total: 0 };
    }

    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const skip = (validPage - 1) * validLimit;

    const query: Record<string, unknown> = {
      ...filter,
      alertId: new Types.ObjectId(String(alertId)),
    };

    const [acknowledgments, total] = await Promise.all([
      EmergencyAcknowledgmentModel.find(query)
        .sort({ acknowledgedAt: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      EmergencyAcknowledgmentModel.countDocuments(query).exec(),
    ]);

    return { acknowledgments, total };
  }

  /**
   * Aggregates acknowledgment counts grouped by institutional user role.
   */
  public static async getRoleBreakdown(
    alertId: string | Types.ObjectId
  ): Promise<{
    student: number;
    faculty: number;
    admin: number;
    super_admin: number;
    totalAcknowledged: number;
  }> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(alertId))) {
      return { student: 0, faculty: 0, admin: 0, super_admin: 0, totalAcknowledged: 0 };
    }

    const rows = await EmergencyAcknowledgmentModel.aggregate([
      { $match: { alertId: new Types.ObjectId(String(alertId)) } },
      { $group: { _id: '$userSnapshot.role', count: { $sum: 1 } } },
    ]).exec();

    const breakdown = {
      student: 0,
      faculty: 0,
      admin: 0,
      super_admin: 0,
      totalAcknowledged: 0,
    };

    for (const row of rows as Array<{ _id: string; count: number }>) {
      if (row._id === 'student') breakdown.student = row.count;
      else if (row._id === 'faculty') breakdown.faculty = row.count;
      else if (row._id === 'admin') breakdown.admin = row.count;
      else if (row._id === 'super_admin') breakdown.super_admin = row.count;
      breakdown.totalAcknowledged += row.count;
    }

    return breakdown;
  }
}
