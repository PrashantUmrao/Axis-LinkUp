/**
 * FacilityBooking Repository (Data Access Layer - DAL).
 * Manages MongoDB persistence for Space Reservations, atomic time-slot overlap checks,
 * and collision-resistant booking code generation (MOD-14 / Phase 5.9).
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { FacilityBookingModel } from '@/lib/db/models/facility-booking.model';
import type { IFacilityBooking } from '@/types/facility';

export interface BookingStatsAggregate {
  pendingBookings: number;
  approvedToday: number;
  totalBookings: number;
}

export class FacilityBookingRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Persists a new facility booking document.
   */
  public static async create(data: Partial<IFacilityBooking>): Promise<IFacilityBooking> {
    await this.ensureConnection();
    const doc = new FacilityBookingModel(data);
    return await doc.save();
  }

  /**
   * Retrieves a booking by ObjectId.
   */
  public static async findById(id: string | Types.ObjectId): Promise<IFacilityBooking | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await FacilityBookingModel.findById(id).exec();
  }

  /**
   * Retrieves a booking by unique bookingCode.
   */
  public static async findByBookingCode(bookingCode: string): Promise<IFacilityBooking | null> {
    await this.ensureConnection();
    return await FacilityBookingModel.findOne({
      bookingCode: bookingCode.trim().toUpperCase(),
    }).exec();
  }

  /**
   * Updates an existing booking by ObjectId.
   */
  public static async update(
    id: string | Types.ObjectId,
    updates: Partial<IFacilityBooking>
  ): Promise<IFacilityBooking | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await FacilityBookingModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Checks for any APPROVED booking in the target facility that overlaps [startTime, endTime).
   * Strict inequalities (< and >) ensure adjacent back-to-back slots (e.g. 10:00-11:00 and 11:00-12:00)
   * do NOT conflict.
   */
  public static async findConflictingBookings(
    facilityId: string | Types.ObjectId,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string | Types.ObjectId
  ): Promise<IFacilityBooking[]> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(facilityId))) return [];

    const query: Record<string, unknown> = {
      facilityId: new Types.ObjectId(String(facilityId)),
      status: 'approved',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };

    if (excludeBookingId && Types.ObjectId.isValid(String(excludeBookingId))) {
      query._id = { $ne: new Types.ObjectId(String(excludeBookingId)) };
    }

    return await FacilityBookingModel.find(query).sort({ startTime: 1 }).exec();
  }

  /**
   * Retrieves upcoming approved bookings for a specific facility (read-only availability timeline).
   */
  public static async findUpcomingApprovedForFacility(
    facilityId: string | Types.ObjectId,
    limit = 20
  ): Promise<IFacilityBooking[]> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(facilityId))) return [];

    return await FacilityBookingModel.find({
      facilityId: new Types.ObjectId(String(facilityId)),
      status: 'approved',
      endTime: { $gt: new Date() },
    })
      .sort({ startTime: 1 })
      .limit(Math.max(1, Math.min(50, limit)))
      .exec();
  }

  /**
   * Generates a collision-resistant institutional booking code.
   * Format: BKG-YYYY-XXXXX (e.g., BKG-2026-10001).
   */
  public static async getNextBookingCode(year?: number): Promise<string> {
    await this.ensureConnection();
    const currentYear = year || new Date().getFullYear();
    const prefix = `BKG-${currentYear}-`;

    const count = await FacilityBookingModel.countDocuments({
      bookingCode: { $regex: `^${prefix}` },
    }).exec();

    const sequence = String(10001 + count).padStart(5, '0');
    let candidate = `${prefix}${sequence}`;

    const collision = await FacilityBookingModel.exists({ bookingCode: candidate });
    if (collision) {
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      candidate = `${prefix}${randomSuffix}`;
    }

    return candidate;
  }

  /**
   * Queries paginated facility bookings matching filter criteria.
   */
  public static async findBookings(
    filter: Record<string, unknown>,
    page = 1,
    limit = 20,
    sortBy = 'startTime',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ bookings: IFacilityBooking[]; total: number }> {
    await this.ensureConnection();
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const skip = (validPage - 1) * validLimit;

    const sortDirective: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const [bookings, total] = await Promise.all([
      FacilityBookingModel.find(filter)
        .sort(sortDirective)
        .skip(skip)
        .limit(validLimit)
        .exec(),
      FacilityBookingModel.countDocuments(filter).exec(),
    ]);

    return { bookings, total };
  }

  /**
   * Computes aggregated metrics for facility bookings (pending count, approved today, total).
   */
  public static async getStats(
    filter: Record<string, unknown> = {}
  ): Promise<BookingStatsAggregate> {
    await this.ensureConnection();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [aggregateResult] = await FacilityBookingModel.aggregate([
      { $match: filter },
      {
        $facet: {
          pendingCount: [{ $match: { status: 'pending' } }, { $count: 'count' }],
          approvedTodayCount: [
            {
              $match: {
                status: 'approved',
                startTime: { $lte: endOfToday },
                endTime: { $gte: startOfToday },
              },
            },
            { $count: 'count' },
          ],
          totalCount: [{ $count: 'total' }],
        },
      },
    ]).exec();

    return {
      pendingBookings: aggregateResult?.pendingCount?.[0]?.count || 0,
      approvedToday: aggregateResult?.approvedTodayCount?.[0]?.count || 0,
      totalBookings: aggregateResult?.totalCount?.[0]?.total || 0,
    };
  }
}
