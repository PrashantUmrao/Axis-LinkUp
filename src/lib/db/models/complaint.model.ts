/**
 * Mongoose Model & Schema for Grievance Redressal / Complaints (Phase 5.5).
 * Mandated under AICTE / UGC Grievance Redressal Regulations.
 * Enforces zero-trust isolation, compound indexing, immutable audit timeline, and snapshot preservation.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type {
  IComplaint,
  ComplaintDTO,
  ComplaintResponse,
  ComplaintAttachmentDTO,
  ComplaintTimelineEventDTO,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintRecipientRole,
} from '@/types/complaints';

/**
 * Grievance attachment subdocument schema.
 */
const ComplaintAttachmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    url: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, min: 0, default: 0 },
    mimeType: { type: String, trim: true, default: 'application/octet-stream' },
    publicId: { type: String, trim: true, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * Student snapshot subdocument schema.
 * Preserves identity snapshot even if student record is later modified or graduated.
 */
const ComplaintStudentSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    rollNumber: { type: String, trim: true, default: null },
    program: { type: String, trim: true, default: null },
    batchYear: { type: Number, default: null },
    currentSemester: { type: Number, default: null },
    section: { type: String, trim: true, default: null },
    departmentName: { type: String, trim: true, default: null },
    departmentCode: { type: String, trim: true, default: null },
  },
  { _id: false }
);

/**
 * Department snapshot subdocument schema.
 */
const ComplaintDepartmentSnapshotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
  },
  { _id: false }
);

/**
 * Academic context subdocument schema.
 */
const ComplaintAcademicContextSchema = new Schema(
  {
    batchYear: { type: Number, default: null },
    semester: { type: Number, default: null },
    section: { type: String, trim: true, default: null },
    courseCode: { type: String, trim: true, default: null },
  },
  { _id: false }
);

/**
 * Statutory SLA tracking subdocument schema.
 * 48 Hours for Department HOD, 168 Hours (7 Days) for Directorate Ombudsman.
 */
const ComplaintSlaSchema = new Schema(
  {
    slaHours: { type: Number, required: true, default: 48 },
    deadline: { type: Date, required: true },
    isBreached: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * Assigned authority subdocument schema.
 */
const ComplaintAssignedToSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, trim: true, default: null },
    role: { type: String, trim: true, default: null },
    assignedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * Escalation subdocument schema.
 */
const ComplaintEscalationSchema = new Schema(
  {
    isEscalated: { type: Boolean, default: false },
    escalatedAt: { type: Date, default: null },
    escalatedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    escalatedByName: { type: String, trim: true, default: null },
    reason: { type: String, trim: true, default: null },
    previousRecipient: { type: String, trim: true, default: null },
  },
  { _id: false }
);

/**
 * Grievance dialogue response subdocument schema.
 */
const ComplaintResponseSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: { type: String, required: true, trim: true },
    authorEmail: { type: String, trim: true, default: null },
    message: {
      type: String,
      required: [true, 'Response message is required'],
      trim: true,
      minlength: [1, 'Response message cannot be empty'],
      maxlength: [5000, 'Response message cannot exceed 5000 characters'],
    },
    actionTaken: { type: String, trim: true, default: null },
    attachments: { type: [ComplaintAttachmentSchema], default: [] },
    isInternal: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    _id: true,
  }
);

/**
 * Immutable audit timeline entry subdocument schema.
 */
const ComplaintTimelineSchema = new Schema(
  {
    previousStatus: {
      type: String,
      required: true,
      enum: [
        'submitted',
        'under_review',
        'in_progress',
        'responded',
        'resolved',
        'closed',
        'escalated',
        'reopened',
        'rejected',
      ],
    },
    newStatus: {
      type: String,
      required: true,
      enum: [
        'submitted',
        'under_review',
        'in_progress',
        'responded',
        'resolved',
        'closed',
        'escalated',
        'reopened',
        'rejected',
      ],
    },
    action: { type: String, required: true, trim: true },
    changedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedByName: { type: String, required: true, trim: true },
    changedByRole: { type: String, required: true, trim: true },
    remarks: { type: String, trim: true, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * Primary Grievance Complaint Schema.
 */
const ComplaintSchema = new Schema<IComplaint>(
  {
    ticketNumber: {
      type: String,
      required: [true, 'Complaint ticket number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID reference is required'],
      index: true,
    },
    studentSnapshot: {
      type: ComplaintStudentSnapshotSchema,
      required: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department ID reference is required'],
      index: true,
    },
    departmentSnapshot: {
      type: ComplaintDepartmentSnapshotSchema,
      required: true,
    },
    academicContext: {
      type: ComplaintAcademicContextSchema,
      default: () => ({}),
    },
    recipientRole: {
      type: String,
      required: [true, 'Recipient role is required'],
      enum: ['hod', 'director'],
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    category: {
      type: String,
      required: [true, 'Grievance category is required'],
      enum: [
        'academic',
        'lab_infrastructure',
        'hostel',
        'harassment',
        'administrative',
        'fee_accounts',
        'examination',
        'other',
      ],
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      minlength: [5, 'Subject must be at least 5 characters'],
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description narrative is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [10000, 'Description cannot exceed 10000 characters'],
    },
    status: {
      type: String,
      required: true,
      enum: [
        'submitted',
        'under_review',
        'in_progress',
        'responded',
        'resolved',
        'closed',
        'escalated',
        'reopened',
        'rejected',
      ],
      default: 'submitted',
      index: true,
    },
    sla: {
      type: ComplaintSlaSchema,
      required: true,
    },
    assignedTo: {
      type: ComplaintAssignedToSchema,
      default: () => ({}),
    },
    escalation: {
      type: ComplaintEscalationSchema,
      default: () => ({ isEscalated: false }),
    },
    attachments: {
      type: [ComplaintAttachmentSchema],
      default: [],
    },
    responses: {
      type: [ComplaintResponseSchema],
      default: [],
    },
    timeline: {
      type: [ComplaintTimelineSchema],
      default: [],
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'complaints',
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexing strategy matching Phase 5.5 specifications
ComplaintSchema.index({ ticketNumber: 1 }, { unique: true });
ComplaintSchema.index({ studentId: 1, createdAt: -1 });
ComplaintSchema.index({ departmentId: 1, recipientRole: 1, status: 1, createdAt: -1 });
ComplaintSchema.index({ recipientRole: 1, status: 1, createdAt: -1 });
ComplaintSchema.index({ 'escalation.isEscalated': 1, status: 1, createdAt: -1 });
ComplaintSchema.index({ category: 1, priority: 1, status: 1 });
ComplaintSchema.index({ 'sla.deadline': 1, status: 1 });

/**
 * Transforms an internal Mongoose Complaint document into a clean, JSON-serializable DTO.
 * Provides 100% backward compatibility with ComplaintTicket for existing UI views.
 */
export function toComplaintDTO(doc: IComplaint): ComplaintDTO {
  const now = new Date();
  const deadline = doc.sla?.deadline ? new Date(doc.sla.deadline) : now;
  const slaRemainingHours = Math.max(
    0,
    Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60))
  );
  const isBreached = doc.status !== 'resolved' && doc.status !== 'closed' && now > deadline;

  const detailedAttachments: ComplaintAttachmentDTO[] = Array.isArray(doc.attachments)
    ? doc.attachments.map((a) => ({
        id: a.id ? String(a.id) : undefined,
        name: a.name,
        url: a.url,
        sizeBytes: a.sizeBytes,
        mimeType: a.mimeType,
        publicId: a.publicId || undefined,
        uploadedAt: a.uploadedAt ? new Date(a.uploadedAt).toISOString() : new Date().toISOString(),
      }))
    : [];

  const legacyAttachments: string[] = detailedAttachments.map((a) => a.name);

  const responses: ComplaintResponse[] = Array.isArray(doc.responses)
    ? doc.responses.map((r) => ({
        id: String(r._id),
        authorId: String(r.authorId),
        authorName: r.authorName,
        authorRole: r.authorRole,
        message: r.message,
        timestamp: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        actionTaken: r.actionTaken || undefined,
        attachments: Array.isArray(r.attachments)
          ? r.attachments.map((ra) => ({
              id: ra.id ? String(ra.id) : undefined,
              name: ra.name,
              url: ra.url,
              sizeBytes: ra.sizeBytes,
              mimeType: ra.mimeType,
              publicId: ra.publicId || undefined,
              uploadedAt: ra.uploadedAt
                ? new Date(ra.uploadedAt).toISOString()
                : new Date().toISOString(),
            }))
          : [],
        isInternal: r.isInternal,
      }))
    : [];

  const timeline: ComplaintTimelineEventDTO[] = Array.isArray(doc.timeline)
    ? doc.timeline.map((t) => ({
        id: String(t._id),
        previousStatus: t.previousStatus as ComplaintStatus,
        newStatus: t.newStatus as ComplaintStatus,
        action: t.action,
        changedById: String(t.changedById),
        changedByName: t.changedByName,
        changedByRole: t.changedByRole,
        remarks: t.remarks || undefined,
        timestamp: t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString(),
      }))
    : [];

  const recipientName =
    doc.recipientRole === 'hod'
      ? `Head of Department (${doc.departmentSnapshot?.name || 'Department'})`
      : 'Executive Director (Ombudsman Tribunal)';

  return {
    id: String(doc._id),
    ticketNumber: doc.ticketNumber,
    studentId: String(doc.studentId),
    studentName: doc.studentSnapshot?.fullName || 'Anonymous Student',
    studentRoll: doc.studentSnapshot?.rollNumber || '',
    studentEmail: doc.studentSnapshot?.email || '',
    department: doc.departmentSnapshot?.name || 'General Department',
    departmentId: String(doc.departmentId),
    student: {
      fullName: doc.studentSnapshot?.fullName || 'Anonymous Student',
      email: doc.studentSnapshot?.email || '',
      rollNumber: doc.studentSnapshot?.rollNumber || undefined,
      program: doc.studentSnapshot?.program || undefined,
      batchYear: doc.studentSnapshot?.batchYear || undefined,
      currentSemester: doc.studentSnapshot?.currentSemester || undefined,
      section: doc.studentSnapshot?.section || undefined,
      departmentName: doc.studentSnapshot?.departmentName || undefined,
      departmentCode: doc.studentSnapshot?.departmentCode || undefined,
    },
    departmentDetails: {
      name: doc.departmentSnapshot?.name || '',
      code: doc.departmentSnapshot?.code || '',
    },
    academicContext: doc.academicContext
      ? {
          batchYear: doc.academicContext.batchYear || undefined,
          semester: doc.academicContext.semester || undefined,
          section: doc.academicContext.section || undefined,
          courseCode: doc.academicContext.courseCode || undefined,
        }
      : undefined,
    recipientRole: doc.recipientRole as ComplaintRecipientRole,
    recipientName,
    category: doc.category as ComplaintCategory,
    priority: (doc.priority || 'medium') as ComplaintPriority,
    subject: doc.subject,
    description: doc.description,
    narrative: doc.description,
    submittedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    status: doc.status as ComplaintStatus,
    sla: {
      slaHours: doc.sla?.slaHours || 48,
      deadline: doc.sla?.deadline
        ? new Date(doc.sla.deadline).toISOString()
        : new Date().toISOString(),
      isBreached,
      slaRemainingHours,
    },
    slaRemainingHours,
    escalatedToDirector: Boolean(doc.escalation?.isEscalated),
    assignedTo: doc.assignedTo?.name
      ? {
          id: doc.assignedTo.id ? String(doc.assignedTo.id) : '',
          name: doc.assignedTo.name,
          role: doc.assignedTo.role || undefined,
          assignedAt: doc.assignedTo.assignedAt
            ? new Date(doc.assignedTo.assignedAt).toISOString()
            : undefined,
        }
      : undefined,
    escalation: doc.escalation?.isEscalated
      ? {
          isEscalated: true,
          escalatedAt: doc.escalation.escalatedAt
            ? new Date(doc.escalation.escalatedAt).toISOString()
            : undefined,
          escalatedById: doc.escalation.escalatedById
            ? String(doc.escalation.escalatedById)
            : undefined,
          escalatedByName: doc.escalation.escalatedByName || undefined,
          reason: doc.escalation.reason || undefined,
          previousRecipient: doc.escalation.previousRecipient || undefined,
        }
      : undefined,
    attachments: legacyAttachments,
    detailedAttachments,
    responses,
    timeline,
    resolvedAt: doc.resolvedAt ? new Date(doc.resolvedAt).toISOString() : undefined,
    closedAt: doc.closedAt ? new Date(doc.closedAt).toISOString() : undefined,
  };
}

export const ComplaintModel: Model<IComplaint> =
  mongoose.models.Complaint || mongoose.model<IComplaint>('Complaint', ComplaintSchema);

export default ComplaintModel;

