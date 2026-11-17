/**
 * ServiceRequest Service (Business Logic Layer - BLL).
 * Implements business logic, validation, RBAC, departmental isolation, and state transitions
 * for Student Request Tracker & Administrative Service Queues (MOD-13 / Phase 5.8).
 */

import { Types } from 'mongoose';
import { ServiceRequestRepository } from '@/lib/db/repositories/service-request.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { toServiceRequestDTO } from '@/lib/db/models/service-request.model';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { NotificationService } from '@/lib/services/notification.service';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors/app-error';
import type { UserSession } from '@/types/user';
import type {
  IServiceRequest,
  IStudentSnapshot,
  ServiceRequestDTO,
  ServiceRequestStatsDTO,
  PaginatedServiceRequestsDTO,
  ServiceRequestStatus,
  ServiceRequestDetails,
} from '@/types/service-request';
import type {
  CreateServiceRequestInput,
  ReviewServiceRequestInput,
  ServiceRequestQueryParams,
} from '@/lib/validations/service-request.schema';

/**
 * Permitted service request lifecycle transitions.
 */
export const VALID_REQUEST_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  submitted: ['under_review', 'action_required', 'approved', 'rejected'],
  under_review: ['action_required', 'approved', 'rejected', 'fulfilled'],
  action_required: ['under_review', 'approved', 'rejected'],
  approved: ['fulfilled', 'rejected'],
  rejected: [], // Terminal state
  fulfilled: [], // Terminal state
};

export class ServiceRequestService {
  /**
   * Submits a standardized administrative service request for an enrolled student.
   * Enforces single active request per category invariant and takes an immutable student snapshot.
   */
  public static async submitRequest(
    session: UserSession,
    input: CreateServiceRequestInput
  ): Promise<ServiceRequestDTO> {
    if (session.role !== 'student' && session.role !== 'super_admin') {
      throw new ForbiddenError('Only enrolled collegiate students may submit service requests.');
    }

    // Anti-Spam: Prevent duplicate concurrent requests in the same category
    const activeCount = await ServiceRequestRepository.countActiveByCategory(
      session.userId,
      input.category
    );
    if (activeCount > 0) {
      throw new BadRequestError(
        'You already have an active service request in this category. Please wait until your existing application is resolved or fulfilled.'
      );
    }

    // Resolve authoritative student user record
    const studentUser = await UserRepository.findById(session.userId);
    if (!studentUser) {
      throw new NotFoundError('Student user profile could not be verified.');
    }

    // Resolve student's department context
    let deptName = 'General Academic';
    if (studentUser.departmentId) {
      const department = await DepartmentRepository.findById(studentUser.departmentId.toString());
      if (department) {
        deptName = department.name;
      }
    }

    const studentSnapshot: IStudentSnapshot = {
      fullName: studentUser.fullName || session.fullName || 'Student Complainant',
      enrollmentNo:
        studentUser.studentProfile?.enrollmentNumber ||
        studentUser.studentProfile?.rollNumber ||
        'ENR-PENDING',
      department: deptName,
      branch: studentUser.studentProfile?.program || deptName,
      section: studentUser.studentProfile?.section || 'A',
      semester: studentUser.studentProfile?.currentSemester || 1,
      email: studentUser.email || session.email,
    };

    const ticketNumber = await ServiceRequestRepository.getNextTicketNumber();

    const created = await ServiceRequestRepository.create({
      ticketNumber,
      studentId: new Types.ObjectId(session.userId),
      studentSnapshot,
      category: input.category,
      subject: input.subject,
      priority: input.priority || 'standard',
      details: input.details as ServiceRequestDetails,
      attachments: input.attachments || [],
      status: 'submitted',
      reviewHistory: [
        {
          action: 'submitted',
          actorId: new Types.ObjectId(session.userId),
          actorRole: 'student',
          actorName: studentSnapshot.fullName,
          remarks: 'Service requisition submitted by student.',
          timestamp: new Date(),
        },
      ],
    });

    return toServiceRequestDTO(created);
  }

  /**
   * Retrieves paginated service requests submitted by the logged-in student.
   */
  public static async listStudentRequests(
    session: UserSession,
    query: ServiceRequestQueryParams
  ): Promise<PaginatedServiceRequestsDTO> {
    const filter: Record<string, unknown> = {
      studentId: new Types.ObjectId(session.userId),
    };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { ticketNumber: { $regex: term, $options: 'i' } },
        { subject: { $regex: term, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    const { requests, total } = await ServiceRequestRepository.findRequests(
      filter,
      page,
      limit,
      query.sortBy || 'createdAt',
      query.sortOrder || 'desc'
    );

    const totalPages = Math.ceil(total / limit) || 1;
    const hasMore = page < totalPages;

    return {
      requests: requests.map(toServiceRequestDTO),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    };
  }

  /**
   * Retrieves administrative queue requests scoped by department or elevated role.
   */
  public static async listAdminQueue(
    session: UserSession,
    query: ServiceRequestQueryParams
  ): Promise<PaginatedServiceRequestsDTO> {
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw new ForbiddenError('Only administrative personnel may access the service queue.');
    }

    const filter: Record<string, unknown> = {};

    // Department isolation: Scoped administrators only see requests from their department
    if (session.role === 'admin' && session.departmentId) {
      const dept = await DepartmentRepository.findById(session.departmentId);
      if (dept) {
        filter['studentSnapshot.department'] = dept.name;
      }
    } else if (session.role === 'super_admin' && query.department) {
      filter['studentSnapshot.department'] = query.department;
    }

    if (query.status) {
      filter.status = query.status;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.priority) {
      filter.priority = query.priority;
    }
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      filter.$or = [
        { ticketNumber: { $regex: term, $options: 'i' } },
        { subject: { $regex: term, $options: 'i' } },
        { 'studentSnapshot.fullName': { $regex: term, $options: 'i' } },
        { 'studentSnapshot.enrollmentNo': { $regex: term, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    const { requests, total } = await ServiceRequestRepository.findRequests(
      filter,
      page,
      limit,
      query.sortBy || 'createdAt',
      query.sortOrder || 'desc'
    );

    const totalPages = Math.ceil(total / limit) || 1;
    const hasMore = page < totalPages;

    return {
      requests: requests.map(toServiceRequestDTO),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    };
  }

  /**
   * Retrieves a single service request with strict access authorization.
   */
  public static async getRequestById(
    session: UserSession,
    id: string
  ): Promise<ServiceRequestDTO> {
    const request = await ServiceRequestRepository.findById(id);
    if (!request) {
      throw new NotFoundError('Service request', id);
    }

    // Access authorization check
    if (session.role === 'student') {
      if (request.studentId.toString() !== session.userId) {
        throw new ForbiddenError('You are not authorized to access this service request.');
      }
    } else if (session.role === 'admin') {
      if (session.departmentId) {
        const dept = await DepartmentRepository.findById(session.departmentId);
        if (dept && request.studentSnapshot.department !== dept.name) {
          throw new ForbiddenError('Departmental isolation: You cannot access requests from other departments.');
        }
      }
    } else if (session.role !== 'super_admin') {
      throw new ForbiddenError('Unauthorized access to service request.');
    }

    return toServiceRequestDTO(request);
  }

  /**
   * Processes an administrative action (under_review, action_required, approved, rejected, fulfilled).
   * Validates state transitions, appends to immutable review history, and notifies student via Ably.
   */
  public static async processRequestAction(
    session: UserSession,
    id: string,
    input: ReviewServiceRequestInput
  ): Promise<ServiceRequestDTO> {
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw new ForbiddenError('Only administrative personnel can review service requests.');
    }

    const request = await ServiceRequestRepository.findById(id);
    if (!request) {
      throw new NotFoundError('Service request', id);
    }

    // Department isolation check for admin
    if (session.role === 'admin' && session.departmentId) {
      const dept = await DepartmentRepository.findById(session.departmentId);
      if (dept && request.studentSnapshot.department !== dept.name) {
        throw new ForbiddenError('Departmental isolation: You cannot process requests from other departments.');
      }
    }

    // Transition validation
    const allowedTransitions = VALID_REQUEST_TRANSITIONS[request.status];
    if (!allowedTransitions.includes(input.action)) {
      throw new BadRequestError(
        `Invalid status transition: cannot change status from '${request.status}' to '${input.action}'.`
      );
    }

    // Additional validation for rejection and action required
    if ((input.action === 'rejected' || input.action === 'action_required') && (!input.remarks || input.remarks.trim().length < 10)) {
      throw new BadRequestError('Descriptive remarks of at least 10 characters are required for this action.');
    }

    const extraUpdates: Partial<IServiceRequest> = {
      assignedAdminId: new Types.ObjectId(session.userId),
    };

    if (input.action === 'rejected') {
      extraUpdates.rejectionReason = input.remarks || 'Application rejected by administration.';
    }

    if (input.action === 'fulfilled' && input.fulfillmentDocument) {
      extraUpdates.fulfillmentDocument = {
        name: input.fulfillmentDocument.name,
        url: input.fulfillmentDocument.url,
        referenceId: input.fulfillmentDocument.referenceId,
        issuedAt: new Date(),
      };
    }

    const updated = await ServiceRequestRepository.recordAction(
      id,
      input.action,
      session.userId,
      session.role,
      session.fullName || 'Administrator',
      input.remarks || undefined,
      extraUpdates
    );

    if (!updated) {
      throw new NotFoundError('Service request', id);
    }

    // Real-time notification dispatch via Ably
    try {
      const studentChannel = AblyBroker.getUserNotificationChannel(updated.studentId.toString());
      await AblyBroker.publish(studentChannel, 'request.status.updated', {
        ticketNumber: updated.ticketNumber,
        requestId: updated._id.toString(),
        category: updated.category,
        previousStatus: request.status,
        newStatus: input.action,
        remarks: input.remarks || null,
        fulfillmentDocument: extraUpdates.fulfillmentDocument || null,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Non-blocking realtime publishing
    }

    // Unified Notification Center persistent hook (non-blocking)
    await NotificationService.safeDispatchCrossModule({
      userId: updated.studentId.toString(),
      title: `Service Request ${updated.ticketNumber} Updated`,
      message: `Your requisition "${updated.subject}" status changed to ${input.action.replace('_', ' ')}.`,
      category: 'service_request',
      priority: input.action === 'action_required' || input.action === 'rejected' ? 'high' : 'normal',
      linkUrl: '/student/requests',
      dedupeKey: `req:${updated._id.toString()}:${input.action}`,
      metadata: { ticketNumber: updated.ticketNumber, status: input.action },
    });

    return toServiceRequestDTO(updated);
  }

  /**
   * Retrieves status metric breakdown for student dashboard or administrative queue.
   */
  public static async getRequestStats(
    session: UserSession
  ): Promise<ServiceRequestStatsDTO> {
    const filter: Record<string, unknown> = {};

    if (session.role === 'student') {
      filter.studentId = new Types.ObjectId(session.userId);
    } else if (session.role === 'admin' && session.departmentId) {
      const dept = await DepartmentRepository.findById(session.departmentId);
      if (dept) {
        filter['studentSnapshot.department'] = dept.name;
      }
    }

    return await ServiceRequestRepository.getStats(filter);
  }
}
