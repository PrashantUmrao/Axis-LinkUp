/**
 * ServiceRequest Repository (Data Access Layer - DAL).
 * Manages MongoDB persistence for Student Requests & Administrative Service Queues (MOD-13 / Phase 5.8).
 * Enforces atomic state transitions, ticket sequencing, and query filtering.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { ServiceRequestModel } from '@/lib/db/models/service-request.model';
import type {
  IServiceRequest,
  ServiceRequestStatus,
  ServiceRequestCategory,
  ServiceRequestStatsDTO,
  IReviewHistorySubdoc,
} from '@/types/service-request';

export class ServiceRequestRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Persists a new service request document.
   */
  public static async create(data: Partial<IServiceRequest>): Promise<IServiceRequest> {
    await this.ensureConnection();
    const doc = new ServiceRequestModel(data);
    return await doc.save();
  }

  /**
   * Retrieves a service request by ObjectId.
   */
  public static async findById(id: string | Types.ObjectId): Promise<IServiceRequest | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await ServiceRequestModel.findById(id).exec();
  }

  /**
   * Retrieves a service request by unique ticket number.
   */
  public static async findByTicketNumber(ticketNumber: string): Promise<IServiceRequest | null> {
    await this.ensureConnection();
    return await ServiceRequestModel.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
    }).exec();
  }

  /**
   * Counts active requests by category for a student to prevent duplicate concurrent submissions.
   * Active statuses: 'submitted', 'under_review', 'action_required'.
   */
  public static async countActiveByCategory(
    studentId: string | Types.ObjectId,
    category: ServiceRequestCategory | string
  ): Promise<number> {
    await this.ensureConnection();
    return await ServiceRequestModel.countDocuments({
      studentId: new Types.ObjectId(String(studentId)),
      category: category as ServiceRequestCategory,
      status: { $in: ['submitted', 'under_review', 'action_required'] },
    }).exec();
  }

  /**
   * Updates an existing service request by ObjectId.
   */
  public static async update(
    id: string | Types.ObjectId,
    updates: Partial<IServiceRequest>
  ): Promise<IServiceRequest | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;
    return await ServiceRequestModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Atomically records an administrative action, updates status, and appends to review history.
   */
  public static async recordAction(
    id: string | Types.ObjectId,
    action: ServiceRequestStatus,
    actorId: Types.ObjectId | string,
    actorRole: string,
    actorName?: string,
    remarks?: string,
    extraUpdates: Partial<IServiceRequest> = {}
  ): Promise<IServiceRequest | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(id))) return null;

    const reviewEntry: IReviewHistorySubdoc = {
      action,
      actorId: new Types.ObjectId(String(actorId)),
      actorRole,
      actorName,
      remarks,
      timestamp: new Date(),
    };

    const updateOps: Record<string, unknown> = {
      $set: {
        status: action,
        ...extraUpdates,
      },
      $push: {
        reviewHistory: reviewEntry,
      },
    };

    return await ServiceRequestModel.findByIdAndUpdate(id, updateOps, {
      new: true,
      runValidators: true,
    }).exec();
  }

  /**
   * Queries paginated service requests matching filter criteria.
   */
  public static async findRequests(
    filter: Record<string, unknown>,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ requests: IServiceRequest[]; total: number }> {
    await this.ensureConnection();
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const skip = (validPage - 1) * validLimit;

    const sortDirective: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    const [requests, total] = await Promise.all([
      ServiceRequestModel.find(filter)
        .sort(sortDirective)
        .skip(skip)
        .limit(validLimit)
        .exec(),
      ServiceRequestModel.countDocuments(filter).exec(),
    ]);

    return { requests, total };
  }

  /**
   * Computes aggregated metrics for service request queues and dashboards.
   */
  public static async getStats(
    filter: Record<string, unknown> = {}
  ): Promise<ServiceRequestStatsDTO> {
    await this.ensureConnection();
    const [aggregateResult] = await ServiceRequestModel.aggregate([
      { $match: filter },
      {
        $facet: {
          statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          totalCount: [{ $count: 'total' }],
        },
      },
    ]).exec();

    const total = aggregateResult?.totalCount?.[0]?.total || 0;
    const statusMap = new Map<string, number>();
    aggregateResult?.statusCounts?.forEach((item: { _id: string; count: number }) => {
      statusMap.set(item._id, item.count);
    });

    return {
      total,
      submitted: statusMap.get('submitted') || 0,
      underReview: statusMap.get('under_review') || 0,
      actionRequired: statusMap.get('action_required') || 0,
      approved: statusMap.get('approved') || 0,
      rejected: statusMap.get('rejected') || 0,
      fulfilled: statusMap.get('fulfilled') || 0,
    };
  }

  /**
   * Generates a collision-resistant institutional service request ticket number.
   * Format: REQ-YYYY-XXXXX (e.g. REQ-2026-00001).
   */
  public static async getNextTicketNumber(year?: number): Promise<string> {
    await this.ensureConnection();
    const currentYear = year || new Date().getFullYear();
    const prefix = `REQ-${currentYear}-`;

    const count = await ServiceRequestModel.countDocuments({
      ticketNumber: { $regex: `^${prefix}` },
    }).exec();

    const sequence = String(count + 1).padStart(5, '0');
    let candidate = `${prefix}${sequence}`;

    const collision = await ServiceRequestModel.exists({ ticketNumber: candidate });
    if (collision) {
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      candidate = `${prefix}${randomSuffix}`;
    }

    return candidate;
  }
}
