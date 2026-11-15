/**
 * Complaint Repository (Data Access Layer - DAL).
 * Encapsulates Mongoose database interactions for the 'complaints' collection.
 * Enforces atomic updates, immutable audit appending, and query filtering.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import ComplaintModel from '@/lib/db/models/complaint.model';
import type {
  IComplaint,
  IComplaintResponse,
  IComplaintTimelineEvent,
  ComplaintStatus,
  ComplaintRecipientRole,
  ComplaintStatsDTO,
  ComplaintCategory,
  ComplaintPriority,
} from '@/types/complaints';
import type { ComplaintQueryParams } from '@/lib/validations/complaint.schema';

export class ComplaintRepository {
  /**
   * Persists a new grievance complaint document.
   */
  static async create(data: Partial<IComplaint>): Promise<IComplaint> {
    await connectToDatabase();
    const complaint = new ComplaintModel(data);
    return await complaint.save();
  }

  /**
   * Retrieves a complaint by MongoDB ObjectId.
   */
  static async findById(id: string | Types.ObjectId): Promise<IComplaint | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(String(id))) {
      return null;
    }
    return await ComplaintModel.findById(id).exec();
  }

  /**
   * Retrieves a complaint by unique ticket number.
   */
  static async findByTicketNumber(ticketNumber: string): Promise<IComplaint | null> {
    await connectToDatabase();
    return await ComplaintModel.findOne({
      ticketNumber: ticketNumber.trim().toUpperCase(),
    }).exec();
  }

  /**
   * Generates a collision-resistant institutional ticket number.
   * Format: CMP-2026-XXXX or CMP-DIR-2026-XXXX.
   */
  static async generateTicketNumber(recipientRole: ComplaintRecipientRole): Promise<string> {
    await connectToDatabase();
    const year = new Date().getFullYear();
    const prefix = recipientRole === 'director' ? `CMP-DIR-${year}-` : `CMP-${year}-`;

    const count = await ComplaintModel.countDocuments({
      ticketNumber: { $regex: `^${prefix}` },
    });

    const sequence = String(count + 1).padStart(4, '0');
    let candidate = `${prefix}${sequence}`;

    // Collision check
    const collision = await ComplaintModel.exists({ ticketNumber: candidate });
    if (collision) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      candidate = `${prefix}${randomSuffix}`;
    }

    return candidate;
  }

  /**
   * Retrieves complaints submitted by a specific student.
   */
  static async findStudentComplaints(
    studentId: string | Types.ObjectId,
    params: Partial<ComplaintQueryParams> = {}
  ): Promise<{ complaints: IComplaint[]; total: number }> {
    const filter: Record<string, unknown> = {
      studentId: new Types.ObjectId(String(studentId)),
    };

    return this.queryWithFilters(filter, params);
  }

  /**
   * Retrieves complaints scoped to a specific department and addressed to HOD.
   */
  static async findDepartmentComplaints(
    departmentId: string | Types.ObjectId,
    params: Partial<ComplaintQueryParams> = {}
  ): Promise<{ complaints: IComplaint[]; total: number }> {
    const filter: Record<string, unknown> = {
      departmentId: new Types.ObjectId(String(departmentId)),
      recipientRole: 'hod',
    };

    return this.queryWithFilters(filter, params);
  }

  /**
   * Retrieves complaints addressed to the Director or escalated from departments.
   */
  static async findDirectorComplaints(
    params: Partial<ComplaintQueryParams> = {}
  ): Promise<{ complaints: IComplaint[]; total: number }> {
    const filter: Record<string, unknown> = {
      $or: [{ recipientRole: 'director' }, { 'escalation.isEscalated': true }],
    };

    return this.queryWithFilters(filter, params);
  }

  /**
   * System Administrator / Global oversight query.
   */
  static async findAllComplaints(
    params: Partial<ComplaintQueryParams> = {}
  ): Promise<{ complaints: IComplaint[]; total: number }> {
    return this.queryWithFilters({}, params);
  }

  /**
   * Appends an authorized response to the complaint thread.
   * Atomically appends response and audit timeline event, and optionally updates status.
   */
  static async addResponse(
    complaintId: string | Types.ObjectId,
    responseData: Partial<IComplaintResponse>,
    auditEvent?: Partial<IComplaintTimelineEvent>,
    newStatus?: ComplaintStatus
  ): Promise<IComplaint | null> {
    await connectToDatabase();
    const updateOps: Record<string, unknown> = {
      $push: {
        responses: responseData,
        ...(auditEvent ? { timeline: auditEvent } : {}),
      },
    };

    if (newStatus) {
      updateOps.$set = { status: newStatus };
    }

    return await ComplaintModel.findByIdAndUpdate(complaintId, updateOps, {
      new: true,
      runValidators: true,
    }).exec();
  }

  /**
   * Performs an atomic status mutation and appends an immutable audit timeline event.
   */
  static async updateStatus(
    complaintId: string | Types.ObjectId,
    newStatus: ComplaintStatus,
    auditEvent: Partial<IComplaintTimelineEvent>,
    extraFields: Record<string, unknown> = {}
  ): Promise<IComplaint | null> {
    await connectToDatabase();
    const setFields: Record<string, unknown> = {
      status: newStatus,
      ...extraFields,
    };

    if (newStatus === 'resolved') {
      setFields.resolvedAt = new Date();
    } else if (newStatus === 'closed') {
      setFields.closedAt = new Date();
    } else if (newStatus === 'reopened') {
      setFields.resolvedAt = null;
      setFields.closedAt = null;
    }

    return await ComplaintModel.findByIdAndUpdate(
      complaintId,
      {
        $set: setFields,
        $push: { timeline: auditEvent },
      },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Escalates a department-level complaint to the Directorate Ombudsman.
   */
  static async escalate(
    complaintId: string | Types.ObjectId,
    escalationData: {
      reason: string;
      escalatedById: Types.ObjectId;
      escalatedByName: string;
    },
    auditEvent: Partial<IComplaintTimelineEvent>
  ): Promise<IComplaint | null> {
    await connectToDatabase();
    const now = new Date();
    const newDeadline = new Date(now.getTime() + 168 * 60 * 60 * 1000); // 7 days (168 hours)

    return await ComplaintModel.findByIdAndUpdate(
      complaintId,
      {
        $set: {
          recipientRole: 'director',
          status: 'escalated',
          'escalation.isEscalated': true,
          'escalation.escalatedAt': now,
          'escalation.escalatedById': escalationData.escalatedById,
          'escalation.escalatedByName': escalationData.escalatedByName,
          'escalation.reason': escalationData.reason,
          'escalation.previousRecipient': 'hod',
          'sla.slaHours': 168,
          'sla.deadline': newDeadline,
          'sla.isBreached': false,
        },
        $push: { timeline: auditEvent },
      },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Assigns an investigation officer / faculty mentor to the complaint.
   */
  static async assign(
    complaintId: string | Types.ObjectId,
    assignmentData: {
      assignedToId: Types.ObjectId;
      assignedToName: string;
      assignedToRole?: string;
    },
    auditEvent: Partial<IComplaintTimelineEvent>
  ): Promise<IComplaint | null> {
    await connectToDatabase();
    return await ComplaintModel.findByIdAndUpdate(
      complaintId,
      {
        $set: {
          'assignedTo.id': assignmentData.assignedToId,
          'assignedTo.name': assignmentData.assignedToName,
          'assignedTo.role': assignmentData.assignedToRole || 'Inquiry Officer',
          'assignedTo.assignedAt': new Date(),
        },
        $push: { timeline: auditEvent },
      },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Computes aggregated grievance statistics for oversight dashboard cards.
   */
  static async getStats(baseFilter: Record<string, unknown> = {}): Promise<ComplaintStatsDTO> {
    await connectToDatabase();
    const now = new Date();

    const [aggregateResult] = await ComplaintModel.aggregate([
      { $match: baseFilter },
      {
        $facet: {
          statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          categoryCounts: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
          priorityCounts: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
          slaBreaches: [
            {
              $match: {
                status: { $nin: ['resolved', 'closed', 'rejected'] },
                'sla.deadline': { $lt: now },
              },
            },
            { $count: 'breachedCount' },
          ],
          totalCount: [{ $count: 'total' }],
        },
      },
    ]).exec();

    const total = aggregateResult?.totalCount?.[0]?.total || 0;
    const slaBreached = aggregateResult?.slaBreaches?.[0]?.breachedCount || 0;

    const statusMap = new Map<string, number>();
    aggregateResult?.statusCounts?.forEach((item: { _id: string; count: number }) => {
      statusMap.set(item._id, item.count);
    });

    const categoryCounts: Record<ComplaintCategory, number> = {
      academic: 0,
      lab_infrastructure: 0,
      hostel: 0,
      harassment: 0,
      administrative: 0,
      fee_accounts: 0,
      examination: 0,
      other: 0,
    };
    aggregateResult?.categoryCounts?.forEach(
      (item: { _id: ComplaintCategory; count: number }) => {
        if (categoryCounts[item._id] !== undefined) {
          categoryCounts[item._id] = item.count;
        }
      }
    );

    const priorityCounts: Record<ComplaintPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    aggregateResult?.priorityCounts?.forEach(
      (item: { _id: ComplaintPriority; count: number }) => {
        if (priorityCounts[item._id] !== undefined) {
          priorityCounts[item._id] = item.count;
        }
      }
    );

    return {
      total,
      submitted: statusMap.get('submitted') || 0,
      underReview: statusMap.get('under_review') || 0,
      inProgress: (statusMap.get('in_progress') || 0) + (statusMap.get('responded') || 0),
      resolved: statusMap.get('resolved') || 0,
      closed: statusMap.get('closed') || 0,
      escalated: statusMap.get('escalated') || 0,
      rejected: statusMap.get('rejected') || 0,
      slaBreached,
      byCategory: categoryCounts,
      byPriority: priorityCounts,
    };
  }

  /**
   * Internal helper executing filtered and paginated queries.
   */
  private static async queryWithFilters(
    baseFilter: Record<string, unknown>,
    params: Partial<ComplaintQueryParams>
  ): Promise<{ complaints: IComplaint[]; total: number }> {
    await connectToDatabase();
    const filter: Record<string, unknown> = { ...baseFilter };

    if (params.status) {
      filter.status = params.status;
    }
    if (params.category) {
      filter.category = params.category;
    }
    if (params.priority) {
      filter.priority = params.priority;
    }
    if (params.recipientRole) {
      filter.recipientRole = params.recipientRole;
    }
    if (params.departmentId && Types.ObjectId.isValid(params.departmentId)) {
      filter.departmentId = new Types.ObjectId(params.departmentId);
    }
    if (typeof params.isEscalated === 'boolean') {
      filter['escalation.isEscalated'] = params.isEscalated;
    }
    if (params.isBreached === true) {
      filter.status = { $nin: ['resolved', 'closed', 'rejected'] };
      filter['sla.deadline'] = { $lt: new Date() };
    }

    if (params.search) {
      const searchRegex = new RegExp(params.search.trim(), 'i');
      filter.$or = [
        { ticketNumber: searchRegex },
        { subject: searchRegex },
        { 'studentSnapshot.fullName': searchRegex },
        { 'studentSnapshot.rollNumber': searchRegex },
      ];
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const sortField = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortOrder } as const;

    const [complaints, total] = await Promise.all([
      ComplaintModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      ComplaintModel.countDocuments(filter).exec(),
    ]);

    return { complaints, total };
  }
}
