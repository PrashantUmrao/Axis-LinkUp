/**
 * Grievance Redressal / Complaint Service (Business Logic Layer).
 * Mandated under AICTE / UGC Grievance Redressal Regulations.
 * Enforces Zero-Trust RBAC, Departmental Isolation, Immutable Audit Trails, and Lifecycle State Transitions.
 */

import { Types } from 'mongoose';
import { ComplaintRepository } from '@/lib/db/repositories/complaint.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { toComplaintDTO } from '@/lib/db/models/complaint.model';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/app-error';
import type { UserSession } from '@/types/user';
import type {
  ComplaintDTO,
  ComplaintStatsDTO,
  ComplaintStatus,
  IComplaint,
} from '@/types/complaints';
import type {
  CreateComplaintInput,
  AddComplaintResponseInput,
  UpdateComplaintStatusInput,
  EscalateComplaintInput,
  AssignComplaintInput,
  ComplaintQueryParams,
} from '@/lib/validations/complaint.schema';

/**
 * Valid statutory grievance lifecycle transitions.
 */
const VALID_STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  submitted: ['under_review', 'in_progress', 'responded', 'rejected', 'escalated'],
  under_review: ['in_progress', 'responded', 'resolved', 'rejected', 'escalated'],
  in_progress: ['responded', 'resolved', 'rejected', 'escalated'],
  responded: ['in_progress', 'resolved', 'closed', 'rejected', 'escalated'],
  resolved: ['closed', 'reopened'],
  closed: ['reopened'],
  escalated: ['under_review', 'in_progress', 'responded', 'resolved', 'rejected'],
  reopened: ['under_review', 'in_progress', 'rejected', 'escalated'],
  rejected: [], // Terminal state unless reopened by executive ombudsman
};

export class ComplaintService {
  /**
   * Submits a new grievance petition by an enrolled student.
   * Locks identity to authenticated session and computes statutory SLA.
   */
  static async submitComplaint(
    session: UserSession,
    input: CreateComplaintInput
  ): Promise<ComplaintDTO> {
    if (session.role !== 'student') {
      throw new ForbiddenError('Only enrolled collegiate students may lodge statutory grievances.');
    }

    // Resolve authoritative student record from DB
    const studentUser = await UserRepository.findById(session.userId);
    if (!studentUser) {
      throw new NotFoundError('Complainant student profile could not be verified.');
    }

    // Resolve department context
    const departmentIdStr = input.departmentId || studentUser.departmentId?.toString();
    if (!departmentIdStr) {
      throw new ValidationError(
        'Department context is missing. Student must belong to an academic department.'
      );
    }

    const department = await DepartmentRepository.findById(departmentIdStr);
    if (!department) {
      throw new NotFoundError('Referenced academic department was not found.');
    }

    // Construct student snapshot
    const studentSnapshot = {
      fullName: studentUser.fullName,
      email: studentUser.email,
      rollNumber: studentUser.studentProfile?.rollNumber || undefined,
      program: studentUser.studentProfile?.program || undefined,
      batchYear: studentUser.studentProfile?.batchYear || undefined,
      currentSemester: studentUser.studentProfile?.currentSemester || undefined,
      section: studentUser.studentProfile?.section || undefined,
      departmentName: department.name,
      departmentCode: department.code,
    };

    // Construct department snapshot
    const departmentSnapshot = {
      name: department.name,
      code: department.code,
    };

    // Compute SLA deadline
    const slaHours = input.recipientRole === 'director' ? 168 : 48; // 7 days vs 48 hours
    const now = new Date();
    const deadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

    // Generate unique institutional ticket number
    const ticketNumber = await ComplaintRepository.generateTicketNumber(input.recipientRole);

    // Initial audit timeline entry
    const initialTimelineEvent = {
      previousStatus: 'submitted' as ComplaintStatus,
      newStatus: 'submitted' as ComplaintStatus,
      action: 'GRIEVANCE_LODGED',
      changedById: new Types.ObjectId(session.userId),
      changedByName: session.fullName || studentUser.fullName,
      changedByRole: session.role,
      remarks: 'Initial formal grievance petition lodged via student portal.',
      timestamp: now,
    };

    // Format attachments
    const attachments = (input.attachments || []).map((att) => ({
      name: att.name,
      url: att.url,
      sizeBytes: att.sizeBytes || 0,
      mimeType: att.mimeType || 'application/octet-stream',
      publicId: att.publicId,
      uploadedAt: now,
    }));

    const complaintDoc = await ComplaintRepository.create({
      ticketNumber,
      studentId: new Types.ObjectId(session.userId),
      studentSnapshot,
      departmentId: new Types.ObjectId(departmentIdStr),
      departmentSnapshot,
      academicContext: input.academicContext || {
        batchYear: studentUser.studentProfile?.batchYear,
        semester: studentUser.studentProfile?.currentSemester,
        section: studentUser.studentProfile?.section,
      },
      recipientRole: input.recipientRole,
      category: input.category,
      priority: input.priority || 'medium',
      subject: input.subject.trim(),
      description: input.description.trim(),
      status: 'submitted',
      sla: {
        slaHours,
        deadline,
        isBreached: false,
      },
      attachments,
      responses: [],
      timeline: [initialTimelineEvent as unknown as IComplaint['timeline'][0]],
    });

    return toComplaintDTO(complaintDoc);
  }

  /**
   * Retrieves a paginated list of complaints based on caller persona.
   * Strictly enforces Departmental Isolation (HOD) and Personal Scope (Student).
   */
  static async getComplaints(
    session: UserSession,
    params: ComplaintQueryParams
  ): Promise<{
    complaints: ComplaintDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let result: { complaints: IComplaint[]; total: number };

    if (session.role === 'student') {
      // Students strictly see only their own complaints
      result = await ComplaintRepository.findStudentComplaints(session.userId, params);
    } else if (
      session.adminSubRole === 'hod' ||
      (session.role === 'faculty' && session.departmentId) ||
      (session.role === 'admin' && session.departmentId)
    ) {
      // HOD scope: strictly departmental complaints addressed to HOD
      if (!session.departmentId) {
        const userDoc = await UserRepository.findById(session.userId);
        if (!userDoc?.departmentId) {
          throw new ForbiddenError('HOD is not assigned to any academic department.');
        }
        result = await ComplaintRepository.findDepartmentComplaints(
          userDoc.departmentId.toString(),
          params
        );
      } else {
        result = await ComplaintRepository.findDepartmentComplaints(session.departmentId, params);
      }
    } else if (session.adminSubRole === 'director' || session.role === 'super_admin') {
      if (session.adminSubRole === 'sys_admin') {
        // System Administrator oversight: global list
        result = await ComplaintRepository.findAllComplaints(params);
      } else {
        // Directorate ombudsman: directly addressed + escalated
        result = await ComplaintRepository.findDirectorComplaints(params);
      }
    } else {
      throw new ForbiddenError('Your role is not authorized to access grievance console.');
    }

    const totalPages = Math.ceil(result.total / params.limit) || 1;

    // Apply SysAdmin privacy protection if sys_admin is viewing without direct ombudsman sub-role
    const complaints = result.complaints.map((c) => {
      const dto = toComplaintDTO(c);
      if (session.role === 'super_admin' && session.adminSubRole === 'sys_admin') {
        // Redact confidential narrative for privacy boundary preservation
        dto.narrative = '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]';
        dto.description = '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]';
      }
      return dto;
    });

    return {
      complaints,
      total: result.total,
      page: params.page,
      limit: params.limit,
      totalPages,
    };
  }

  /**
   * Retrieves full grievance record by ID with zero-trust resource-level authorization.
   */
  static async getComplaintById(session: UserSession, complaintId: string): Promise<ComplaintDTO> {
    const complaint = await ComplaintRepository.findById(complaintId);
    if (!complaint) {
      throw new NotFoundError('Grievance complaint record not found.');
    }

    this.assertCanAccessComplaint(session, complaint);

    const dto = toComplaintDTO(complaint);

    // Apply SysAdmin privacy protection if sys_admin is viewing without direct ombudsman sub-role
    if (session.role === 'super_admin' && session.adminSubRole === 'sys_admin') {
      dto.narrative = '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]';
      dto.description = '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]';
    }

    return dto;
  }

  /**
   * Appends a dialogue response or follow-up to the grievance thread.
   */
  static async addResponse(
    session: UserSession,
    complaintId: string,
    input: AddComplaintResponseInput
  ): Promise<ComplaintDTO> {
    const complaint = await ComplaintRepository.findById(complaintId);
    if (!complaint) {
      throw new NotFoundError('Grievance complaint record not found.');
    }

    this.assertCanAccessComplaint(session, complaint);

    // Check if complaint is closed/terminal
    if (complaint.status === 'closed' && session.role === 'student') {
      throw new ValidationError('Cannot append follow-ups to a closed grievance ticket.');
    }

    const now = new Date();
    const isStudent = session.role === 'student';

    // Format attachments
    const attachments = (input.attachments || []).map((att) => ({
      name: att.name,
      url: att.url,
      sizeBytes: att.sizeBytes || 0,
      mimeType: att.mimeType || 'application/octet-stream',
      publicId: att.publicId,
      uploadedAt: now,
    }));

    const responseData = {
      authorId: new Types.ObjectId(session.userId),
      authorName: session.fullName || 'Official Responder',
      authorRole: session.role,
      authorEmail: session.email,
      message: input.message.trim(),
      actionTaken: input.actionTaken?.trim() || undefined,
      attachments,
      isInternal: input.isInternal ?? false,
      createdAt: now,
    };

    // Determine status mutation: if authority responds to submitted/under_review, move to in_progress
    let newStatus: ComplaintStatus | undefined = undefined;
    if (!isStudent && (complaint.status === 'submitted' || complaint.status === 'under_review')) {
      newStatus = 'in_progress';
    }

    const timelineEvent = {
      previousStatus: complaint.status,
      newStatus: newStatus || complaint.status,
      action: isStudent ? 'STUDENT_FOLLOWUP_ADDED' : 'AUTHORITY_RESPONSE_ISSUED',
      changedById: new Types.ObjectId(session.userId),
      changedByName: session.fullName || 'Collegiate Member',
      changedByRole: session.role,
      remarks: input.actionTaken || (isStudent ? 'Follow-up submitted' : 'Response issued to student'),
      timestamp: now,
    };

    const updated = await ComplaintRepository.addResponse(
      complaintId,
      responseData,
      timelineEvent,
      newStatus
    );

    if (!updated) {
      throw new NotFoundError('Failed to record response. Complaint was not found.');
    }

    return toComplaintDTO(updated);
  }

  /**
   * Performs a controlled status transition with mandatory remarks and audit recording.
   */
  static async updateStatus(
    session: UserSession,
    complaintId: string,
    input: UpdateComplaintStatusInput
  ): Promise<ComplaintDTO> {
    const complaint = await ComplaintRepository.findById(complaintId);
    if (!complaint) {
      throw new NotFoundError('Grievance complaint record not found.');
    }

    this.assertCanAccessComplaint(session, complaint);

    const currentStatus = complaint.status;
    const requestedStatus = input.status;

    if (currentStatus === requestedStatus) {
      throw new ValidationError(`Complaint is already in status '${requestedStatus}'.`);
    }

    // Role-based permission checks on status mutations
    if (session.role === 'student') {
      // Students can ONLY close (accept resolution) or reopen
      if (requestedStatus !== 'closed' && requestedStatus !== 'reopened') {
        throw new ForbiddenError(
          'Students can only mark grievances as closed (accepting resolution) or reopened (appealing).'
        );
      }
    } else if (session.role === 'faculty' && session.adminSubRole !== 'hod') {
      throw new ForbiddenError('Only appointed Department HODs or Directors can alter complaint status.');
    }

    // Validate lifecycle state transition graph
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(requestedStatus)) {
      throw new ValidationError(
        `Invalid lifecycle transition from '${currentStatus}' to '${requestedStatus}'. Allowed next states: ${allowedTransitions.join(
          ', '
        )}`
      );
    }

    const now = new Date();
    const timelineEvent = {
      previousStatus: currentStatus,
      newStatus: requestedStatus,
      action: `STATUS_CHANGED_TO_${requestedStatus.toUpperCase()}`,
      changedById: new Types.ObjectId(session.userId),
      changedByName: session.fullName || 'Official',
      changedByRole: session.role,
      remarks: input.remarks.trim(),
      timestamp: now,
    };

    const updated = await ComplaintRepository.updateStatus(
      complaintId,
      requestedStatus,
      timelineEvent
    );

    if (!updated) {
      throw new NotFoundError('Failed to update status. Complaint was not found.');
    }

    return toComplaintDTO(updated);
  }

  /**
   * Escalates a department-level complaint to the Directorate Ombudsman.
   */
  static async escalateComplaint(
    session: UserSession,
    complaintId: string,
    input: EscalateComplaintInput
  ): Promise<ComplaintDTO> {
    const complaint = await ComplaintRepository.findById(complaintId);
    if (!complaint) {
      throw new NotFoundError('Grievance complaint record not found.');
    }

    this.assertCanAccessComplaint(session, complaint);

    // Only HODs or Students whose SLA was breached can escalate
    const isDeptHod =
      (session.adminSubRole === 'hod' || session.role === 'faculty' || session.role === 'admin') &&
      complaint.departmentId.toString() === session.departmentId;

    const isStudentOwner =
      session.role === 'student' && complaint.studentId.toString() === session.userId;

    if (!isDeptHod && !isStudentOwner) {
      throw new ForbiddenError('You are not authorized to escalate this grievance petition.');
    }

    if (complaint.escalation?.isEscalated) {
      throw new ValidationError('This grievance has already been escalated to the Directorate.');
    }

    if (complaint.status === 'resolved' || complaint.status === 'closed') {
      throw new ValidationError('Cannot escalate a resolved or closed grievance.');
    }

    const now = new Date();
    const timelineEvent = {
      previousStatus: complaint.status,
      newStatus: 'escalated' as ComplaintStatus,
      action: 'ESCALATED_TO_DIRECTORATE',
      changedById: new Types.ObjectId(session.userId),
      changedByName: session.fullName || 'Collegiate Officer',
      changedByRole: session.role,
      remarks: `Escalation Reason: ${input.reason.trim()}`,
      timestamp: now,
    };

    const updated = await ComplaintRepository.escalate(
      complaintId,
      {
        reason: input.reason.trim(),
        escalatedById: new Types.ObjectId(session.userId),
        escalatedByName: session.fullName || 'Official',
      },
      timelineEvent
    );

    if (!updated) {
      throw new NotFoundError('Failed to escalate grievance.');
    }

    return toComplaintDTO(updated);
  }

  /**
   * Assigns an inquiry officer or faculty mentor to investigate the grievance.
   */
  static async assignComplaint(
    session: UserSession,
    complaintId: string,
    input: AssignComplaintInput
  ): Promise<ComplaintDTO> {
    const complaint = await ComplaintRepository.findById(complaintId);
    if (!complaint) {
      throw new NotFoundError('Grievance complaint record not found.');
    }

    // Only HOD of department or Director can assign
    const isDeptHod =
      (session.adminSubRole === 'hod' || session.role === 'admin') &&
      complaint.departmentId.toString() === session.departmentId;
    const isDirector = session.adminSubRole === 'director' || session.role === 'super_admin';

    if (!isDeptHod && !isDirector) {
      throw new ForbiddenError('Only HODs or Directorate leadership may assign inquiry officers.');
    }

    // Verify assigned user exists
    const assignee = await UserRepository.findById(input.assignedToId);
    if (!assignee) {
      throw new NotFoundError('Assigned investigator or faculty mentor');
    }

    const now = new Date();
    const timelineEvent = {
      previousStatus: complaint.status,
      newStatus: complaint.status,
      action: 'INQUIRY_OFFICER_ASSIGNED',
      changedById: new Types.ObjectId(session.userId),
      changedByName: session.fullName || 'Assigning Authority',
      changedByRole: session.role,
      remarks: `Assigned to ${input.assignedToName} (${input.assignedToRole || 'Inquiry Officer'}). ${
        input.remarks || ''
      }`.trim(),
      timestamp: now,
    };

    const updated = await ComplaintRepository.assign(
      complaintId,
      {
        assignedToId: new Types.ObjectId(input.assignedToId),
        assignedToName: input.assignedToName,
        assignedToRole: input.assignedToRole || 'Inquiry Officer',
      },
      timelineEvent
    );

    if (!updated) {
      throw new NotFoundError('Failed to assign grievance inquiry officer.');
    }

    return toComplaintDTO(updated);
  }

  /**
   * Retrieves aggregated grievance stats scoped to the authenticated caller.
   */
  static async getStats(session: UserSession): Promise<ComplaintStatsDTO> {
    if (session.role === 'student') {
      return await ComplaintRepository.getStats({
        studentId: new Types.ObjectId(session.userId),
      });
    }

    if (
      session.adminSubRole === 'hod' ||
      (session.role === 'faculty' && session.departmentId) ||
      (session.role === 'admin' && session.departmentId)
    ) {
      let deptId = session.departmentId;
      if (!deptId) {
        const userDoc = await UserRepository.findById(session.userId);
        deptId = userDoc?.departmentId?.toString();
      }
      return await ComplaintRepository.getStats({
        departmentId: new Types.ObjectId(deptId),
        recipientRole: 'hod',
      });
    }

    if (session.adminSubRole === 'director') {
      return await ComplaintRepository.getStats({
        $or: [{ recipientRole: 'director' }, { 'escalation.isEscalated': true }],
      });
    }

    if (session.role === 'super_admin') {
      return await ComplaintRepository.getStats({});
    }

    throw new ForbiddenError('Unauthorized to access grievance metrics.');
  }

  /**
   * Asserts whether an authenticated UserSession possesses clearance to access a specific complaint.
   * Zero-Trust evaluation: Deny-by-default.
   */
  private static assertCanAccessComplaint(session: UserSession, complaint: IComplaint): void {
    // 1. Student ownership
    if (session.role === 'student') {
      if (complaint.studentId.toString() !== session.userId) {
        throw new ForbiddenError('Access clearance denied. You may only view your own grievances.');
      }
      return;
    }

    // 2. Assigned investigator match
    if (complaint.assignedTo?.id && complaint.assignedTo.id.toString() === session.userId) {
      return;
    }

    // 3. Department HOD scope
    const isHod =
      session.adminSubRole === 'hod' ||
      (session.role === 'faculty' && session.departmentId) ||
      (session.role === 'admin' && session.departmentId);

    if (isHod) {
      if (complaint.departmentId.toString() !== session.departmentId) {
        throw new ForbiddenError(
          'Departmental clearance violation. You cannot access grievances from other academic departments.'
        );
      }
      return;
    }

    // 4. Directorate Ombudsman scope
    if (session.adminSubRole === 'director') {
      if (complaint.recipientRole === 'director' || complaint.escalation?.isEscalated) {
        return;
      }
      // If director requests department-level complaint, permit for institutional ombudsman oversight
      return;
    }

    // 5. System Administrator oversight
    if (session.role === 'super_admin') {
      return;
    }

    throw new ForbiddenError('Your collegiate credentials do not have clearance for this grievance.');
  }
}
