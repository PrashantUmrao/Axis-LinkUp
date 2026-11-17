/**
 * Facility Repository (Data Access Layer - DAL).
 * Manages MongoDB persistence for Campus Facilities & Laboratories (MOD-14 / Phase 5.9).
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { FacilityModel } from '@/lib/db/models/facility.model';
import type { IFacility } from '@/types/facility';

export interface SpaceStatsAggregate {
  totalSpaces: number;
  availableSpaces: number;
  maintenanceSpaces: number;
  inactiveSpaces: number;
}

export class FacilityRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Persists a new campus facility document.
   */
  public static async create(data: Partial<IFacility>): Promise<IFacility> {
    await this.ensureConnection();
    const doc = new FacilityModel(data);
    return await doc.save();
  }

  /**
   * Retrieves a facility by ObjectId.
   */
  public static async findById(id: string | Types.ObjectId): Promise<IFacility | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await FacilityModel.findById(id).exec();
  }

  /**
   * Retrieves a facility by unique uppercase code.
   */
  public static async findByCode(code: string): Promise<IFacility | null> {
    await this.ensureConnection();
    return await FacilityModel.findOne({
      code: code.trim().toUpperCase(),
    }).exec();
  }

  /**
   * Updates an existing facility document by ObjectId.
   */
  public static async update(
    id: string | Types.ObjectId,
    updates: Partial<IFacility>
  ): Promise<IFacility | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await FacilityModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Queries paginated facilities matching filter criteria.
   */
  public static async findFacilities(
    filter: Record<string, unknown>,
    page = 1,
    limit = 20
  ): Promise<{ facilities: IFacility[]; total: number }> {
    await this.ensureConnection();
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const skip = (validPage - 1) * validLimit;

    const [facilities, total] = await Promise.all([
      FacilityModel.find(filter)
        .sort({ building: 1, floor: 1, code: 1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      FacilityModel.countDocuments(filter).exec(),
    ]);

    return { facilities, total };
  }

  /**
   * Computes aggregated space counts broken down by availability status.
   */
  public static async getSpaceStats(
    filter: Record<string, unknown> = {}
  ): Promise<SpaceStatsAggregate> {
    await this.ensureConnection();
    const [aggregateResult] = await FacilityModel.aggregate([
      { $match: filter },
      {
        $facet: {
          statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          totalCount: [{ $count: 'total' }],
        },
      },
    ]).exec();

    const totalSpaces = aggregateResult?.totalCount?.[0]?.total || 0;
    const statusMap = new Map<string, number>();
    aggregateResult?.statusCounts?.forEach((item: { _id: string; count: number }) => {
      statusMap.set(item._id, item.count);
    });

    return {
      totalSpaces,
      availableSpaces: statusMap.get('available') || 0,
      maintenanceSpaces: statusMap.get('maintenance') || 0,
      inactiveSpaces: statusMap.get('inactive') || 0,
    };
  }
}
