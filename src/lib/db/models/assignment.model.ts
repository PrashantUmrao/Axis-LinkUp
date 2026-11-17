/**
 * Mongoose Assignment Model Definition.
 * Conforms to Axis LinkUp Collection Design and Phase 5.7 Assignment Management Architecture.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type {
  IAssignment,
  AssignmentDTO,
  IAssignmentAttachmentSubdoc,
  AssignmentAttachment,
  UserSubmissionSummaryDTO,
} from '@/types/assignment';

export const AssignmentAttachmentSchema = new Schema<IAssignmentAttachmentSubdoc>(
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

const AcademicTargetSchema = new Schema(
  {
    program: { type: String, trim: true, uppercase: true, maxlength: 50 },
    year: { type: Number, min: 1, max: 6 },
    semester: { type: Number, required: true, min: 1, max: 12 },
    section: { type: String, trim: true, uppercase: true, maxlength: 10 },
    batchYear: { type: Number, min: 2000, max: 2100 },
  },
  { _id: false }
);

const LateSubmissionPolicySchema = new Schema(
  {
    allowLate: { type: Boolean, default: false },
    lateDueDate: { type: Date, default: null },
    penaltyPercentagePerDay: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false }
);

const CreatorSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ['faculty', 'admin', 'super_admin'],
    },
    employeeId: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
  },
  { _id: false }
);

export const AssignmentSchema = new Schema<IAssignment>(
  {
    title: {
      type: String,
      required: [true, 'Assignment title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Assignment description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: [5000, 'Instructions cannot exceed 5000 characters'],
    },
    courseCode: {
      type: String,
      required: [true, 'Course code is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Course code cannot exceed 20 characters'],
      index: true,
    },
    courseName: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
      maxlength: [150, 'Course name cannot exceed 150 characters'],
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    academicTarget: {
      type: AcademicTargetSchema,
      required: [true, 'Academic target cohort specification is required'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator faculty reference is required'],
      index: true,
    },
    creatorSnapshot: {
      type: CreatorSnapshotSchema,
      required: true,
    },
    attachments: {
      type: [AssignmentAttachmentSchema],
      default: [],
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Submission due date is required'],
      index: true,
    },
    maxMarks: {
      type: Number,
      required: [true, 'Maximum marks value is required'],
      min: [1, 'Maximum marks must be at least 1'],
      max: [1000, 'Maximum marks cannot exceed 1000'],
      default: 100,
    },
    lateSubmissionPolicy: {
      type: LateSubmissionPolicySchema,
      default: () => ({ allowLate: false, lateDueDate: null, penaltyPercentagePerDay: 0 }),
    },
    allowResubmission: {
      type: Boolean,
      default: false,
    },
    maxResubmissions: {
      type: Number,
      min: 1,
      max: 10,
      default: 3,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed', 'archived'],
      default: 'draft',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'assignments',
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

// Compound indexes for high-throughput queries
AssignmentSchema.index({ departmentId: 1, status: 1, dueDate: 1 });
AssignmentSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
AssignmentSchema.index({
  departmentId: 1,
  'academicTarget.semester': 1,
  'academicTarget.section': 1,
  status: 1,
});
AssignmentSchema.index({
  title: 'text',
  description: 'text',
  courseCode: 'text',
  courseName: 'text',
});

/**
 * Converts internal IAssignment document to clean client-facing AssignmentDTO.
 */
export function toAssignmentDTO(
  doc: IAssignment,
  extras?: {
    submissionCount?: number;
    gradedCount?: number;
    departmentCode?: string;
    departmentName?: string;
    userSubmission?: UserSubmissionSummaryDTO | null;
  }
): AssignmentDTO {
  const attachments: AssignmentAttachment[] = Array.isArray(doc.attachments)
    ? doc.attachments.map((a) => ({
        id: a._id ? String(a._id) : undefined,
        name: a.name,
        url: a.url,
        sizeBytes: a.sizeBytes,
        mimeType: a.mimeType,
        publicId: a.publicId || undefined,
        uploadedAt: a.uploadedAt ? new Date(a.uploadedAt).toISOString() : new Date().toISOString(),
      }))
    : [];

  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    instructions: doc.instructions || undefined,
    courseCode: doc.courseCode,
    courseName: doc.courseName,
    departmentId: doc.departmentId.toString(),
    departmentCode: extras?.departmentCode,
    departmentName: extras?.departmentName,
    academicTarget: {
      program: doc.academicTarget.program,
      year: doc.academicTarget.year,
      semester: doc.academicTarget.semester,
      section: doc.academicTarget.section,
      batchYear: doc.academicTarget.batchYear,
    },
    createdBy: doc.createdBy.toString(),
    creatorSnapshot: {
      fullName: doc.creatorSnapshot.fullName,
      role: doc.creatorSnapshot.role,
      employeeId: doc.creatorSnapshot.employeeId,
      avatarUrl: doc.creatorSnapshot.avatarUrl,
    },
    attachments,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : undefined,
    dueDate: new Date(doc.dueDate).toISOString(),
    maxMarks: doc.maxMarks,
    lateSubmissionPolicy: {
      allowLate: doc.lateSubmissionPolicy.allowLate,
      lateDueDate: doc.lateSubmissionPolicy.lateDueDate
        ? new Date(doc.lateSubmissionPolicy.lateDueDate).toISOString()
        : null,
      penaltyPercentagePerDay: doc.lateSubmissionPolicy.penaltyPercentagePerDay || 0,
    },
    allowResubmission: doc.allowResubmission,
    maxResubmissions: doc.maxResubmissions,
    status: doc.status,
    submissionCount: extras?.submissionCount,
    gradedCount: extras?.gradedCount,
    userSubmission: extras?.userSubmission,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export const AssignmentModel: Model<IAssignment> =
  mongoose.models.Assignment || mongoose.model<IAssignment>('Assignment', AssignmentSchema);

export default AssignmentModel;
