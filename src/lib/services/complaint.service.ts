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
   * Single-source-of-truth role classification predicates for Grievance RBAC (AUD-C02 / AUD-C03).
   */
  private static isDirectorUser(session: UserSession): boolean {
    return session.adminSubRole === 'director';
  }

  private static isSystemAdminUser(session: UserSession): boolean {
    return (
      session.adminSubRole === 'sys_admin' ||
      (session.role === 'super_admin' && session.adminSubRole !== 'director')
    );
  }

  private static isDepartmentHodUser(session: UserSession): boolean {
    return (
      session.adminSubRole === 'hod' ||
      (session.role === 'admin' &&
        session.adminSubRole !== 'director' &&
        session.adminSubRole !== 'sys_admin')
    );
  }

  private static isRegularFacultyUser(session: UserSession): boolean {
    return session.role === 'faculty' && session.adminSubRole !== 'hod';
  }

  /**
   * Resolves a Department HOD's authoritative departmentId, failing closed if unassigned.
   */
  private static async resolveHodDepartmentId(session: UserSession): Promise<string> {
    if (session.departmentId) {
      return session.departmentId;
    }
    const userDoc = await UserRepository.findById(session.userId);
    if (!userDoc?.departmentId) {
      throw new ForbiddenError('HOD is not assigned to any academic department.');
    }
    return userDoc.departmentId.toString();
  }

  /**
   * Centralized strict DTO projection enforcing:
   * - AUD-H01: Students NEVER receive confidential isInternal: true tribunal notes.
   * - AUD-C03: System Administrators receive metadata-only records with all confidential
   *   grievance fields redacted (subject, narrative, description, responses, attachments,
   *   escalation reason, and timeline remarks).
   */
  private static projectComplaintForSession(
    session: UserSession,
    complaint: IComplaint
  ): ComplaintDTO {
    const dto = toComplaintDTO(complaint);

    if (session.role === 'student') {
      dto.responses = dto.responses.filter((r) => !r.isInternal);
      dto.timeline = dto.timeline.filter((t) => t.action !== 'INTERNAL_TRIBUNAL_NOTE');
      return dto;
    }

    if (this.isSystemAdminUser(session)) {
      dto.subject = '[REDACTED — TRIBUNAL CONFIDENTIAL]';
      dto.narrative = '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]';
      dto.description = '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]';
      dto.responses = [];
      dto.attachments = [];
      dto.detailedAttachments = [];
      if (dto.escalation?.reason) {
        dto.escalation = {
          ...dto.escalation,
          reason: '[REDACTED — TRIBUNAL CONFIDENTIAL]',
        };
      }
      dto.timeline = dto.timeline.map((t) => ({
        ...t,
        remarks: '[REDACTED]',
      }));
    }

    return dto;
  }

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

    return this.projectComplaintForSession(session, complaintDoc);
  }

  /**
   * Retrieves a paginated list of complaints based on caller persona.
   * Strictly enforces Departmental Isolation (HOD), Assigned-Only Scope (Faculty),
   * Personal Scope (Student), Ombudsman Scope (Director), and Metadata-Only Scope (SysAdmin).
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
    } else if (this.isRegularFacultyUser(session)) {
      // Regular non-HOD faculty see ONLY complaints explicitly assigned to them as inquiry officer
      result = await ComplaintRepository.findAssignedComplaints(session.userId, params);
    } else if (this.isDepartmentHodUser(session)) {
      // HOD scope: strictly departmental complaints addressed to HOD (fail closed if unassigned)
      const deptId = await this.resolveHodDepartmentId(session);
      result = await ComplaintRepository.findDepartmentComplaints(deptId, params);
    } else if (this.isDirectorUser(session)) {
      // Directorate ombudsman: directly addressed + escalated
      result = await ComplaintRepository.findDirectorComplaints(params);
    } else if (this.isSystemAdminUser(session)) {
      // System Administrator oversight: global metadata-only list (all confidential fields redacted below)
      result = await ComplaintRepository.findAllComplaints(params);
    } else {
      throw new ForbiddenError('Your role is not authorized to access grievance console.');
    }

    const totalPages = Math.ceil(result.total / params.limit) || 1;
    const complaints = result.complaints.map((c) => this.projectComplaintForSession(session, c));

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

    const hodDeptId = this.isDepartmentHodUser(session)
      ? await this.resolveHodDepartmentId(session)
      : undefined;

    this.assertCanAccessComplaint(session, complaint, hodDeptId);

    return this.projectComplaintForSession(session, complaint);
  }

  /**
   * Appends a dialogue response or follow-up to the grievance thread.
   */
  static async addResponse(
    session: UserSession,
    complaintId: string,
    input: AddComplaintResponseInput
  ): Promise<ComplaintDTO> {
    // AUD-C03: System Administrators cannot post responses on statutory grievances
    if (this.isSystemAdminUser(session)) {
      throw new ForbiddenError(
        'System Administrators cannot post responses on statutory grievances.'
      );
    }

    const complaint = await ComplaintRepository.findById(complaintId);
    if (!complaint) {
      throw new NotFoundError('Grievance complaint record not found.');
    }

    const hodDeptId = this.isDepartmentHodUser(session)
      ? await this.resolveHodDepartmentId(session)
      : undefined;

    this.assertCanAccessComplaint(session, complaint, hodDeptId);

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

    // AUD-H01: Students can NEVER mark their own responses as internal tribunal notes
    const isInternalNote = isStudent ? false : (input.isInternal ?? false);
    const responseData = {
      authorId: new Types.ObjectId(session.userId),
      authorName: session.fullName || 'Official Responder',
      authorRole: session.role,
      authorEmail: session.email,
      message: input.message.trim(),
      actionTaken: input.actionTaken?.trim() || undefined,
      attachments,
      isInternal: isInternalNote,
      createdAt: now,
    };

    // Determine status mutation: if authority issues a public response to submitted/under_review, move to in_progress
    let newStatus: ComplaintStatus | undefined = undefined;
    if (
      !isStudent &&
      !isInternalNote &&
      (complaint.status === 'submitted' || complaint.status === 'under_review')
    ) {
      newStatus = 'in_progress';
    }

    const timelineEvent = {
      previousStatus: complaint.status,
      newStatus: newStatus || complaint.status,
      action: isStudent
        ? 'STUDENT_FOLLOWUP_ADDED'
        : isInternalNote
          ? 'INTERNAL_TRIBUNAL_NOTE'
          : 'AUTHORITY_RESPONSE_ISSUED',
      changedById: new Types.ObjectId(session.userId),
      changedByName: session.fullName || 'Collegiate Member',
      changedByRole: session.role,
      remarks: isInternalNote
        ? 'Confidential internal tribunal note recorded.'
        : input.actionTaken || (isStudent ? 'Follow-up submitted' : 'Response issued to student'),
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

    return this.projectComplaintForSession(session, updated);
  }

  /**
   * Performs a controlled status transition with mandatory remarks and audit recording.
   */
  static async updateStatus(
    session: UserSession,
    complaintId: string,
    input: UpdateComplaintStatusInput
  ): Promise<ComplaintDTO> {
    // AUD-C03: System Administrators cannot adjudicate or alter statutory grievance status
    if (this.isSystemAdminUser(session)) {
      throw new ForbiddenError(
        'System Administrators cannot adjudicate or alter statutory grievance status.'
      );
    }

    // AUD-C02: Regular non-HOD faculty cannot alter complaint status
    if (this.isRegularFacultyUser(session)) {
      throw new ForbiddenError(
        'Only appointed Department HODs or Directors can alter complaint status.'
      );
    }

    const complaint = await ComplaintRepository.findById(complaintId);
    if (!complaint) {
      throw new NotFoundError('Grievance complaint record not found.');
    }

    const hodDeptId = this.isDepartmentHodUser(session)
      ? await this.resolveHodDepartmentId(session)
      : undefined;

    this.assertCanAccessComplaint(session, complaint, hodDeptId);

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

    return this.projectComplaintForSession(session, updated);
  }

  /**
   * Escalates a department-level complaint to the Directorate Ombudsman.
   */
  static async escalateComplaint(
    session: UserSession,
    complaintId: string,
    input: EscalateComplaintInput
  ): Promise<ComplaintDTO> {
    // AUD-C02 / AUD-C03: System Administrators and regular faculty cannot escalate grievances
    if (this.isSystemAdminUser(session)) {
      throw new ForbiddenError('System Administrators cannot escalate statutory grievances.');
    }
    if (this.isRegularFacultyUser(session)) {
      throw new ForbiddenError(
        'Regular faculty members are not authorized to escalate grievance petitions.'
      );
    }

    const complaint = await ComplaintRepository.findById(complaintId);
    if (!complaint) {
      throw new NotFoundError('Grievance complaint record not found.');
    }

    const hodDeptId = this.isDepartmentHodUser(session)
      ? await this.resolveHodDepartmentId(session)
      : undefined;

    this.assertCanAccessComplaint(session, complaint, hodDeptId);

    // Only same-department HOD (on HOD-addressed complaints) or student owner after SLA breach can escalate
    const isDeptHod =
      this.isDepartmentHodUser(session) &&
      hodDeptId !== undefined &&
      complaint.departmentId.toString() === hodDeptId &&
      complaint.recipientRole === 'hod';

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

    // Enforce statutory SLA breach prerequisite for student self-escalation
    if (isStudentOwner) {
      const deadlineMs = complaint.sla?.deadline
        ? new Date(complaint.sla.deadline).getTime()
        : null;
      const isSlaBreached =
        complaint.sla?.isBreached === true ||
        (deadlineMs !== null && !Number.isNaN(deadlineMs) && deadlineMs < Date.now());

      if (!isSlaBreached) {
        throw new ForbiddenError(
          'Student self-escalation is permitted only after the statutory SLA deadline has been breached.'
        );
      }
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

    return this.projectComplaintForSession(session, updated);
  }

  /**
   * Assigns an inquiry officer or faculty mentor to investigate the grievance.
   */
  static async assignComplaint(
    session: UserSession,
    complaintId: string,
    input: AssignComplaintInput
  ): Promise<ComplaintDTO> {
    // AUD-C02 / AUD-C03: Explicitly block System Administrators and regular faculty
    if (this.isSystemAdminUser(session) || this.isRegularFacultyUser(session)) {
      throw new ForbiddenError('Only HODs or Directorate leadership may assign inquiry officers.');
    }

    const complaint = await ComplaintRepository.findById(complaintId);
    if (!complaint) {
      throw new NotFoundError('Grievance complaint record not found.');
    }

    const isDirector = this.isDirectorUser(session);
    let isDeptHod = false;

    if (this.isDepartmentHodUser(session)) {
      const hodDeptId = await this.resolveHodDepartmentId(session);
      if (complaint.departmentId.toString() !== hodDeptId) {
        throw new ForbiddenError(
          'Departmental clearance violation. You cannot assign grievances from other academic departments.'
        );
      }
      if (complaint.recipientRole !== 'hod') {
        throw new ForbiddenError(
          'Access clearance denied. Complaints addressed directly to the Executive Director cannot be assigned by a Department HOD.'
        );
      }
      isDeptHod = true;
    }

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

    return this.projectComplaintForSession(session, updated);
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

    // AUD-C02: Regular non-HOD faculty are NOT grievance administrators
    if (this.isRegularFacultyUser(session)) {
      throw new ForbiddenError(
        'Regular faculty members are not authorized to access departmental grievance metrics.'
      );
    }

    if (this.isDepartmentHodUser(session)) {
      const deptId = await this.resolveHodDepartmentId(session);
      return await ComplaintRepository.getStats({
        departmentId: new Types.ObjectId(deptId),
        recipientRole: 'hod',
      });
    }

    if (this.isDirectorUser(session)) {
      return await ComplaintRepository.getStats({
        $or: [{ recipientRole: 'director' }, { 'escalation.isEscalated': true }],
      });
    }

    if (this.isSystemAdminUser(session)) {
      return await ComplaintRepository.getStats({});
    }

    throw new ForbiddenError('Unauthorized to access grievance metrics.');
  }

  /**
   * Asserts whether an authenticated UserSession possesses clearance to access a specific complaint.
   * Zero-Trust evaluation: Deny-by-default.
   */
  private static assertCanAccessComplaint(
    session: UserSession,
    complaint: IComplaint,
    resolvedHodDeptId?: string
  ): void {
    // 1. Student ownership
    if (session.role === 'student') {
      if (complaint.studentId.toString() !== session.userId) {
        throw new ForbiddenError('Access clearance denied. You may only view your own grievances.');
      }
      return;
    }

    // 2. Assigned inquiry officer match (applies to regular faculty and assigned officers)
    const isAssignedInvestigator = Boolean(
      complaint.assignedTo?.id && complaint.assignedTo.id.toString() === session.userId
    );

    // 3. Regular non-HOD faculty: strictly assigned inquiry officer ONLY (AUD-C02)
    if (this.isRegularFacultyUser(session)) {
      if (isAssignedInvestigator) {
        return;
      }
      throw new ForbiddenError(
        'Access clearance denied. Regular faculty may only access grievances explicitly assigned to them as inquiry officer.'
      );
    }

    // 4. Department HOD scope: own department AND recipientRole === 'hod' (or explicitly assigned)
    if (this.isDepartmentHodUser(session)) {
      if (isAssignedInvestigator) {
        return;
      }

      const deptId = resolvedHodDeptId ?? session.departmentId;
      if (!deptId || complaint.departmentId.toString() !== deptId) {
        throw new ForbiddenError(
          'Departmental clearance violation. You cannot access grievances from other academic departments.'
        );
      }

      if (complaint.recipientRole !== 'hod') {
        throw new ForbiddenError(
          'Access clearance denied. Complaints addressed directly to the Executive Director are restricted to the Directorate Ombudsman.'
        );
      }

      return;
    }

    // 5. Executive Director Ombudsman scope
    if (this.isDirectorUser(session)) {
      return;
    }

    // 6. System Administrator read-only metadata oversight (mutations rejected separately in callers)
    if (this.isSystemAdminUser(session)) {
      return;
    }

    throw new ForbiddenError('Your collegiate credentials do not have clearance for this grievance.');
  }
}
