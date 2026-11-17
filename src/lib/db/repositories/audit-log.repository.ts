/**
 * AuditLog Repository (Data Access Layer - DAL).
 * Strictly append-only persistence for MOD-19 Immutable Security Audit Logs.
 * Exposes NO update or delete operations by design.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { AuditLogModel } from '@/lib/db/models/audit-log.model';
import type { IAuditLog, AuditStatsDTO, AuditSeverity } from '@/types/governance';

export class AuditLogRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Appends a new immutable audit log record.
   */
  public static async create(data: Partial<IAuditLog>): Promise<IAuditLog> {
    await this.ensureConnection();
    const doc = new AuditLogModel(data);
    return await doc.save();
  }

  /**
   * Retrieves a single audit log entry by ObjectId.
   */
  public static async findById(id: string | Types.ObjectId): Promise<IAuditLog | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await AuditLogModel.findById(id).exec();
  }

  /**
   * Retrieves the most recent audit log entry (used to obtain previousHash for SHA-256 chaining).
   */
  public static async findLatestEntry(): Promise<IAuditLog | null> {
    await this.ensureConnection();
    return await AuditLogModel.findOne({}).sort({ createdAt: -1, _id: -1 }).exec();
  }

  /**
   * Queries paginated audit log entries in reverse chronological order.
   */
  public static async findLogs(
    filter: Record<string, unknown>,
    page = 1,
    limit = 25
  ): Promise<{ logs: IAuditLog[]; total: number }> {
    await this.ensureConnection();
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(1000, limit));
    const skip = (validPage - 1) * validLimit;

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      AuditLogModel.countDocuments(filter).exec(),
    ]);

    return { logs, total };
  }

  /**
   * Retrieves the most recent N entries ordered chronologically (oldest -> newest)
   * for deterministic hash-chain verification.
   */
  public static async getRecentChain(limit = 500): Promise<{
    entries: IAuditLog[];
    totalCount: number;
  }> {
    await this.ensureConnection();
    const validLimit = Math.max(1, Math.min(2000, limit));

    const [recentDesc, totalCount] = await Promise.all([
      AuditLogModel.find({})
        .sort({ createdAt: -1, _id: -1 })
        .limit(validLimit)
        .exec(),
      AuditLogModel.countDocuments({}).exec(),
    ]);

    // Reverse into chronological order for sequential chain verification
    return {
      entries: recentDesc.reverse(),
      totalCount,
    };
  }

  /**
   * Generates a collision-resistant institutional audit event ID.
   * Format: AUD-YYYY-XXXXXX (e.g., AUD-2026-100001).
   */
  public static async getNextEventId(year?: number): Promise<string> {
    await this.ensureConnection();
    const currentYear = year || new Date().getFullYear();
    const prefix = `AUD-${currentYear}-`;

    const count = await AuditLogModel.countDocuments({
      eventId: { $regex: `^${prefix}` },
    }).exec();

    const sequence = String(100001 + count).padStart(6, '0');
    let candidate = `${prefix}${sequence}`;

    const collision = await AuditLogModel.exists({ eventId: candidate });
    if (collision) {
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      candidate = `${prefix}${randomSuffix}`;
    }

    return candidate;
  }

  /**
   * Computes aggregated audit metrics: total count, high/critical last 24h,
   * module breakdown, severity breakdown, and latest hash anchor.
   */
  public static async getStats(filter: Record<string, unknown> = {}): Promise<AuditStatsDTO> {
    await this.ensureConnection();

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [aggResult, latest] = await Promise.all([
      AuditLogModel.aggregate([
        { $match: filter },
        {
          $facet: {
            totalCount: [{ $count: 'total' }],
            highCritical24h: [
              {
                $match: {
                  severity: { $in: ['high', 'critical'] },
                  createdAt: { $gte: since24h },
                },
              },
              { $count: 'count' },
            ],
            byModule: [{ $group: { _id: '$module', count: { $sum: 1 } } }],
            bySeverity: [{ $group: { _id: '$severity', count: { $sum: 1 } } }],
          },
        },
      ]).exec(),
      AuditLogModel.findOne(filter).sort({ createdAt: -1, _id: -1 }).exec(),
    ]);

    const facet = aggResult?.[0];
    const totalLogs = facet?.totalCount?.[0]?.total || 0;
    const highCriticalLast24h = facet?.highCritical24h?.[0]?.count || 0;

    const byModule: Record<string, number> = {};
    facet?.byModule?.forEach((item: { _id: string; count: number }) => {
      if (item._id) byModule[item._id] = item.count;
    });

    const bySeverity: Record<AuditSeverity, number> = {
      info: 0,
      warning: 0,
      high: 0,
      critical: 0,
    };
    facet?.bySeverity?.forEach((item: { _id: AuditSeverity; count: number }) => {
      if (item._id && item._id in bySeverity) {
        bySeverity[item._id] = item.count;
      }
    });

    return {
      totalLogs,
      highCriticalLast24h,
      byModule,
      bySeverity,
      latestEventId: latest?.eventId || null,
      latestEntryHash: latest?.entryHash || null,
    };
  }
}
