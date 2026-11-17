/**
 * StudentAchievement Repository (Data Access Layer - DAL).
 * Manages MongoDB persistence for MOD-15 Skill & Achievement Passport claims.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { StudentAchievementModel } from '@/lib/db/models/student-achievement.model';
import type {
  IStudentAchievement,
  AchievementCategory,
  StudentPassportStatsDTO,
  PassportVerificationStatsDTO,
} from '@/types/passport';

export class StudentAchievementRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Persists a new student achievement claim.
   */
  public static async create(
    data: Partial<IStudentAchievement>
  ): Promise<IStudentAchievement> {
    await this.ensureConnection();
    const doc = new StudentAchievementModel(data);
    return await doc.save();
  }

  /**
   * Finds an achievement claim by ObjectId.
   */
  public static async findById(
    id: string | Types.ObjectId
  ): Promise<IStudentAchievement | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await StudentAchievementModel.findById(id).exec();
  }

  /**
   * Finds an achievement claim by unique claimCode (AXP-YYYY-XXXXXX).
   */
  public static async findByClaimCode(claimCode: string): Promise<IStudentAchievement | null> {
    await this.ensureConnection();
    return await StudentAchievementModel.findOne({
      claimCode: claimCode.trim().toUpperCase(),
    }).exec();
  }

  /**
   * Queries paginated achievements belonging to a specific student.
   */
  public static async findByStudent(
    studentId: string | Types.ObjectId,
    filter: Record<string, unknown> = {},
    page = 1,
    limit = 25
  ): Promise<{ achievements: IStudentAchievement[]; total: number }> {
    await this.ensureConnection();
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(200, limit));
    const skip = (validPage - 1) * validLimit;

    const query: Record<string, unknown> = {
      ...filter,
      studentId: new Types.ObjectId(String(studentId)),
    };

    const [achievements, total] = await Promise.all([
      StudentAchievementModel.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      StudentAchievementModel.countDocuments(query).exec(),
    ]);

    return { achievements, total };
  }

  /**
   * Queries paginated achievements for faculty/admin verification queues or accreditation export.
   */
  public static async findForVerificationQueue(
    filter: Record<string, unknown>,
    page = 1,
    limit = 25
  ): Promise<{ achievements: IStudentAchievement[]; total: number }> {
    await this.ensureConnection();
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(1000, limit));
    const skip = (validPage - 1) * validLimit;

    const [achievements, total] = await Promise.all([
      StudentAchievementModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      StudentAchievementModel.countDocuments(filter).exec(),
    ]);

    return { achievements, total };
  }

  /**
   * Updates an achievement claim by ObjectId.
   */
  public static async updateClaim(
    id: string | Types.ObjectId,
    updates: Partial<IStudentAchievement>
  ): Promise<IStudentAchievement | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await StudentAchievementModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Deletes an unverified pending claim by ObjectId.
   */
  public static async deleteClaim(id: string | Types.ObjectId): Promise<boolean> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return false;
    const deleted = await StudentAchievementModel.findByIdAndDelete(id).exec();
    return Boolean(deleted);
  }

  /**
   * Generates a collision-resistant institutional passport claim code.
   * Format: AXP-YYYY-XXXXXX (e.g., AXP-2026-100001).
   */
  public static async getNextClaimCode(year?: number): Promise<string> {
    await this.ensureConnection();
    const currentYear = year || new Date().getFullYear();
    const prefix = `AXP-${currentYear}-`;

    const count = await StudentAchievementModel.countDocuments({
      claimCode: { $regex: `^${prefix}` },
    }).exec();

    const sequence = String(100001 + count).padStart(6, '0');
    let candidate = `${prefix}${sequence}`;

    const collision = await StudentAchievementModel.exists({ claimCode: candidate });
    if (collision) {
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      candidate = `${prefix}${randomSuffix}`;
    }

    return candidate;
  }

  /**
   * Computes summary metrics for a student's Skill & Achievement Passport.
   */
  public static async getStudentSummaryStats(
    studentId: string | Types.ObjectId
  ): Promise<StudentPassportStatsDTO> {
    await this.ensureConnection();
    const stuObjId = new Types.ObjectId(String(studentId));

    const [agg] = await StudentAchievementModel.aggregate([
      { $match: { studentId: stuObjId } },
      {
        $facet: {
          totalCount: [{ $count: 'total' }],
          statusCounts: [{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }],
          resubmittable: [
            { $match: { verificationStatus: 'rejected', resubmissionCount: { $lt: 1 } } },
            { $count: 'count' },
          ],
          verifiedPoints: [
            { $match: { verificationStatus: 'verified' } },
            { $group: { _id: null, points: { $sum: '$pointsWeight' } } },
          ],
          byCategory: [
            { $match: { verificationStatus: 'verified' } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
          ],
        },
      },
    ]).exec();

    const statusMap = new Map<string, number>();
    agg?.statusCounts?.forEach((item: { _id: string; count: number }) => {
      statusMap.set(item._id, item.count);
    });

    const byCategory: Record<AchievementCategory, number> = {
      technical_certification: 0,
      hackathon_competition: 0,
      paper_publication: 0,
      club_leadership: 0,
      community_service: 0,
    };

    agg?.byCategory?.forEach((item: { _id: AchievementCategory; count: number }) => {
      if (item._id && item._id in byCategory) {
        byCategory[item._id] = item.count;
      }
    });

    return {
      totalClaims: agg?.totalCount?.[0]?.total || 0,
      verifiedCount: statusMap.get('verified') || 0,
      pendingCount: statusMap.get('pending') || 0,
      rejectedCount: statusMap.get('rejected') || 0,
      resubmittableCount: agg?.resubmittable?.[0]?.count || 0,
      totalVerifiedPoints: agg?.verifiedPoints?.[0]?.points || 0,
      byCategory,
    };
  }

  /**
   * Computes aggregated metrics for faculty/admin verification queues.
   */
  public static async getVerificationQueueStats(
    filter: Record<string, unknown> = {}
  ): Promise<PassportVerificationStatsDTO> {
    await this.ensureConnection();

    const [agg] = await StudentAchievementModel.aggregate([
      { $match: filter },
      {
        $facet: {
          totalCount: [{ $count: 'total' }],
          statusCounts: [{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }],
          verifiedPoints: [
            { $match: { verificationStatus: 'verified' } },
            { $group: { _id: null, points: { $sum: '$pointsWeight' } } },
          ],
        },
      },
    ]).exec();

    const statusMap = new Map<string, number>();
    agg?.statusCounts?.forEach((item: { _id: string; count: number }) => {
      statusMap.set(item._id, item.count);
    });

    return {
      total: agg?.totalCount?.[0]?.total || 0,
      pending: statusMap.get('pending') || 0,
      verified: statusMap.get('verified') || 0,
      rejected: statusMap.get('rejected') || 0,
      totalVerifiedPoints: agg?.verifiedPoints?.[0]?.points || 0,
    };
  }
}
