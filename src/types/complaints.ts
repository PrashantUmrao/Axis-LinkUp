/**
 * Complaints & Statutory Grievance Redressal Types (Phase 5.5).
 * Mandated under AICTE / UGC Grievance Redressal Regulations.
 * Defines domain entities, database document interfaces, and DTO contracts.
 */

import type { Document, Types } from 'mongoose';
import type { UserRole } from './user';

/**
 * AICTE / UGC statutory grievance categories.
 */
export type ComplaintCategory =
  | 'academic'
  | 'lab_infrastructure'
  | 'hostel'
  | 'harassment'
  | 'administrative'
  | 'fee_accounts'
  | 'examination'
  | 'other';

/**
 * Grievance triage priority ratings.
 */
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Controlled statutory grievance lifecycle status values.
 * Lifecycle: SUBMITTED -> UNDER_REVIEW -> IN_PROGRESS -> RESOLVED -> CLOSED.
 * Also supports ESCALATED, REOPENED, and REJECTED.
 */
export type ComplaintStatus =
  | 'submitted'
  | 'under_review'
  | 'in_progress'
  | 'responded'
  | 'resolved'
  | 'closed'
  | 'escalated'
  | 'reopened'
  | 'rejected';

/**
 * Target recipient level for the grievance.
 */
export type ComplaintRecipientRole = 'hod' | 'director';

/**
 * Grievance attachment interface.
 */
export interface IComplaintAttachment {
  id?: string;
  name: string;
  url: string;
  sizeBytes?: number;
  mimeType?: string;
  publicId?: string;
  uploadedAt?: Date;
}

export interface ComplaintAttachmentDTO {
  id?: string;
  name: string;
  url: string;
  sizeBytes?: number;
  mimeType?: string;
  publicId?: string;
  uploadedAt: string;
}

/**
 * Individual response entry in grievance dialogue thread.
 */
export interface IComplaintResponse {
  _id?: Types.ObjectId;
  authorId: Types.ObjectId;
  authorName: string;
  authorRole: string;
  authorEmail?: string;
  message: string;
  actionTaken?: string;
  attachments?: IComplaintAttachment[];
  isInternal?: boolean;
  createdAt: Date;
}

export interface ComplaintResponse {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole | 'director' | string;
  message: string;
  timestamp: string;
  actionTaken?: string;
  attachments?: ComplaintAttachmentDTO[];
  isInternal?: boolean;
}

/**
 * Immutable audit trail event for complaint transitions.
 */
export interface IComplaintTimelineEvent {
  _id?: Types.ObjectId;
  previousStatus: ComplaintStatus;
  newStatus: ComplaintStatus;
  action: string;
  changedById: Types.ObjectId;
  changedByName: string;
  changedByRole: string;
  remarks?: string;
  timestamp: Date;
}

export interface ComplaintTimelineEventDTO {
  id: string;
  previousStatus: ComplaintStatus;
  newStatus: ComplaintStatus;
  action: string;
  changedById: string;
  changedByName: string;
  changedByRole: string;
  remarks?: string;
  timestamp: string;
}

/**
 * Mongoose Document interface for Complaints collection.
 */
export interface IComplaint extends Document {
  _id: Types.ObjectId;
  ticketNumber: string;
  studentId: Types.ObjectId;
  studentSnapshot: {
    fullName: string;
    email: string;
    rollNumber?: string;
    program?: string;
    batchYear?: number;
    currentSemester?: number;
    section?: string;
    departmentName?: string;
    departmentCode?: string;
  };
  departmentId: Types.ObjectId;
  departmentSnapshot: {
    name: string;
    code: string;
  };
  academicContext?: {
    batchYear?: number;
    semester?: number;
    section?: string;
    courseCode?: string;
  };
  recipientRole: ComplaintRecipientRole;
  recipientId?: Types.ObjectId | null;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  subject: string;
  description: string;
  status: ComplaintStatus;
  sla: {
    slaHours: number;
    deadline: Date;
    isBreached: boolean;
  };
  assignedTo?: {
    id?: Types.ObjectId | null;
    name?: string | null;
    role?: string | null;
    assignedAt?: Date | null;
  };
  escalation?: {
    isEscalated: boolean;
    escalatedAt?: Date | null;
    escalatedById?: Types.ObjectId | null;
    escalatedByName?: string | null;
    reason?: string | null;
    previousRecipient?: string | null;
  };
  attachments: IComplaintAttachment[];
  responses: IComplaintResponse[];
  timeline: IComplaintTimelineEvent[];
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Backward-compatible complaint ticket interface matching existing UI components.
 */
export interface ComplaintTicket {
  id: string;
  ticketNumber: string;
  studentId: string;
  studentName: string;
  studentRoll: string;
  studentEmail: string;
  department: string;
  recipientRole: ComplaintRecipientRole;
  recipientName: string;
  category: ComplaintCategory;
  subject: string;
  narrative: string;
  submittedAt: string;
  updatedAt: string;
  status: ComplaintStatus;
  slaRemainingHours: number;
  escalatedToDirector?: boolean;
  attachments?: string[];
  responses: ComplaintResponse[];
}

/**
 * Full domain DTO for API serialization and frontend state.
 */
export interface ComplaintDTO extends ComplaintTicket {
  priority: ComplaintPriority;
  description: string;
  departmentId: string;
  student: {
    fullName: string;
    email: string;
    rollNumber?: string;
    program?: string;
    batchYear?: number;
    currentSemester?: number;
    section?: string;
    departmentName?: string;
    departmentCode?: string;
  };
  departmentDetails: {
    name: string;
    code: string;
  };
  academicContext?: {
    batchYear?: number;
    semester?: number;
    section?: string;
    courseCode?: string;
  };
  sla: {
    slaHours: number;
    deadline: string;
    isBreached: boolean;
    slaRemainingHours: number;
  };
  assignedTo?: {
    id: string;
    name: string;
    role?: string;
    assignedAt?: string;
  };
  escalation?: {
    isEscalated: boolean;
    escalatedAt?: string;
    escalatedById?: string;
    escalatedByName?: string;
    reason?: string;
    previousRecipient?: string;
  };
  detailedAttachments: ComplaintAttachmentDTO[];
  timeline: ComplaintTimelineEventDTO[];
  resolvedAt?: string;
  closedAt?: string;
}

/**
 * Statistical aggregation DTO for grievance oversight dashboards.
 */
export interface ComplaintStatsDTO {
  total: number;
  submitted: number;
  underReview: number;
  inProgress: number;
  resolved: number;
  closed: number;
  escalated: number;
  rejected: number;
  slaBreached: number;
  byCategory: Record<ComplaintCategory, number>;
  byPriority: Record<ComplaintPriority, number>;
}
