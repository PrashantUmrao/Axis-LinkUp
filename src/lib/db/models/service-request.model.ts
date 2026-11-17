/**
 * Mongoose ServiceRequest Model Definition (MOD-13 / Phase 5.8).
 * Manages paperless administrative requests, approval chains, and digital fulfillments.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type {
  IServiceRequest,
  ServiceRequestDTO,
  IRequestAttachment,
  IReviewHistorySubdoc,
  IFulfillmentDocumentSubdoc,
  ReviewHistoryDTO,
  FulfillmentDocumentDTO,
} from '@/types/service-request';

const RequestAttachmentSchema = new Schema<IRequestAttachment>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, required: true, trim: true },
    fileType: { type: String, trim: true, default: 'application/octet-stream' },
    size: { type: Number, min: 0, default: 0 },
    publicId: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const StudentSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    enrollmentNo: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1, max: 12 },
    email: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false }
);

const ReviewHistorySchema = new Schema<IReviewHistorySubdoc>(
  {
    action: {
      type: String,
      required: true,
      enum: ['submitted', 'under_review', 'action_required', 'approved', 'rejected', 'fulfilled'],
    },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true, trim: true },
    actorName: { type: String, trim: true },
    remarks: { type: String, trim: true, maxlength: 2000 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const FulfillmentDocumentSchema = new Schema<IFulfillmentDocumentSubdoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, required: true, trim: true },
    issuedAt: { type: Date, default: Date.now },
    referenceId: { type: String, trim: true },
  },
  { _id: false }
);

export const ServiceRequestSchema = new Schema<IServiceRequest>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    studentSnapshot: {
      type: StudentSnapshotSchema,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['bonafide', 'leave', 'id_replacement', 'lab_access', 'general_inquiry'],
      index: true,
    },
    subject: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 120,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      required: true,
    },
    attachments: {
      type: [RequestAttachmentSchema],
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ['submitted', 'under_review', 'action_required', 'approved', 'rejected', 'fulfilled'],
      default: 'submitted',
      index: true,
    },
    priority: {
      type: String,
      required: true,
      enum: ['standard', 'urgent'],
      default: 'standard',
    },
    assignedAdminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewHistory: {
      type: [ReviewHistorySchema],
      default: [],
    },
    fulfillmentDocument: {
      type: FulfillmentDocumentSchema,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'service_requests',
  }
);

// Indexes
ServiceRequestSchema.index({ studentId: 1, createdAt: -1 });
ServiceRequestSchema.index({ 'studentSnapshot.department': 1, status: 1, createdAt: -1 });
ServiceRequestSchema.index({ studentId: 1, category: 1, status: 1 });

/**
 * Transforms an IServiceRequest MongoDB document into a client-safe ServiceRequestDTO.
 */
export function toServiceRequestDTO(doc: IServiceRequest): ServiceRequestDTO {
  const reviewHistory: ReviewHistoryDTO[] = Array.isArray(doc.reviewHistory)
    ? doc.reviewHistory.map((h) => ({
        action: h.action,
        actorId: h.actorId.toString(),
        actorRole: h.actorRole,
        actorName: h.actorName,
        remarks: h.remarks,
        timestamp: h.timestamp ? new Date(h.timestamp).toISOString() : new Date().toISOString(),
      }))
    : [];

  let fulfillmentDocument: FulfillmentDocumentDTO | null = null;
  if (doc.fulfillmentDocument && doc.fulfillmentDocument.url) {
    fulfillmentDocument = {
      name: doc.fulfillmentDocument.name,
      url: doc.fulfillmentDocument.url,
      issuedAt: doc.fulfillmentDocument.issuedAt
        ? new Date(doc.fulfillmentDocument.issuedAt).toISOString()
        : new Date().toISOString(),
      referenceId: doc.fulfillmentDocument.referenceId,
    };
  }

  const attachments: IRequestAttachment[] = Array.isArray(doc.attachments)
    ? doc.attachments.map((a) => ({
        name: a.name,
        url: a.url,
        fileType: a.fileType,
        size: a.size,
        publicId: a.publicId || null,
      }))
    : [];

  return {
    id: doc._id.toString(),
    ticketNumber: doc.ticketNumber,
    studentId: doc.studentId.toString(),
    studentSnapshot: {
      fullName: doc.studentSnapshot.fullName,
      enrollmentNo: doc.studentSnapshot.enrollmentNo,
      department: doc.studentSnapshot.department,
      branch: doc.studentSnapshot.branch,
      section: doc.studentSnapshot.section,
      semester: doc.studentSnapshot.semester,
      email: doc.studentSnapshot.email,
    },
    category: doc.category,
    subject: doc.subject,
    details: doc.details,
    attachments,
    status: doc.status,
    priority: doc.priority,
    assignedAdminId: doc.assignedAdminId ? doc.assignedAdminId.toString() : null,
    reviewHistory,
    fulfillmentDocument,
    rejectionReason: doc.rejectionReason || null,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export const ServiceRequestModel: Model<IServiceRequest> =
  mongoose.models.ServiceRequest ||
  mongoose.model<IServiceRequest>('ServiceRequest', ServiceRequestSchema);

