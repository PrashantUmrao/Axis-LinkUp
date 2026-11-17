/**
 * Mongoose Assignment Submission Model Definition.
 * Conforms to Axis LinkUp Collection Design and Phase 5.7 Student Assignment Submissions Architecture.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type {
  ISubmission,
  SubmissionDTO,
  ISubmissionHistorySubdoc,
  ISubmissionEvaluationSubdoc,
  AssignmentAttachment,
  SubmissionHistoryEntry,
} from '@/types/assignment';
import { AssignmentAttachmentSchema } from './assignment.model';

const StudentSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    rollNumber: { type: String, trim: true },
    enrollmentNumber: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    section: { type: String, trim: true, uppercase: true },
    semester: { type: Number, min: 1, max: 12 },
  },
  { _id: false }
);

const SubmissionHistorySchema = new Schema<ISubmissionHistorySubdoc>(
  {
    version: { type: Number, required: true },
    submissionText: { type: String, trim: true, maxlength: 10000 },
    attachments: { type: [AssignmentAttachmentSchema], default: [] },
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
  },
  { _id: false }
);

const SubmissionEvaluationSchema = new Schema<ISubmissionEvaluationSubdoc>(
  {
    marksObtained: { type: Number, min: 0, default: null },
    feedback: { type: String, trim: true, maxlength: 2000, default: null },
    evaluatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    evaluatedByName: { type: String, trim: true, default: null },
    evaluatedAt: { type: Date, default: null },
    isGraded: { type: Boolean, default: false },
    releasedAt: { type: Date, default: null },
  },
  { _id: false }
);

export const SubmissionSchema = new Schema<ISubmission>(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assignment',
      required: [true, 'Assignment reference is required'],
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
      index: true,
    },
    studentSnapshot: {
      type: StudentSnapshotSchema,
      required: true,
    },
    submissionText: {
      type: String,
      trim: true,
      maxlength: [10000, 'Submission text cannot exceed 10000 characters'],
    },
    attachments: {
      type: [AssignmentAttachmentSchema],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ['submitted', 'resubmitted', 'graded', 'returned'],
      default: 'submitted',
      index: true,
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    history: {
      type: [SubmissionHistorySchema],
      default: [],
    },
    evaluation: {
      type: SubmissionEvaluationSchema,
      default: () => ({
        marksObtained: null,
        feedback: null,
        evaluatedBy: null,
        evaluatedByName: null,
        evaluatedAt: null,
        isGraded: false,
        releasedAt: null,
      }),
    },
  },
  {
    timestamps: true,
    collection: 'submissions',
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

// Compound Unique Index: Single active submission per student per assignment
SubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
SubmissionSchema.index({ assignmentId: 1, status: 1 });
SubmissionSchema.index({ assignmentId: 1, 'evaluation.isGraded': 1 });
SubmissionSchema.index({ studentId: 1, createdAt: -1 });

/**
 * Converts internal ISubmission document to clean client-facing SubmissionDTO.
 */
export function toSubmissionDTO(doc: ISubmission): SubmissionDTO {
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

  const history: SubmissionHistoryEntry[] = Array.isArray(doc.history)
    ? doc.history.map((h) => ({
        version: h.version,
        submissionText: h.submissionText,
        attachments: Array.isArray(h.attachments)
          ? h.attachments.map((ha) => ({
              id: ha._id ? String(ha._id) : undefined,
              name: ha.name,
              url: ha.url,
              sizeBytes: ha.sizeBytes,
              mimeType: ha.mimeType,
              publicId: ha.publicId || undefined,
              uploadedAt: ha.uploadedAt
                ? new Date(ha.uploadedAt).toISOString()
                : new Date().toISOString(),
            }))
          : [],
        submittedAt: new Date(h.submittedAt).toISOString(),
        isLate: h.isLate,
      }))
    : [];

  return {
    id: doc._id.toString(),
    assignmentId: doc.assignmentId.toString(),
    studentId: doc.studentId.toString(),
    studentSnapshot: {
      fullName: doc.studentSnapshot.fullName,
      rollNumber: doc.studentSnapshot.rollNumber,
      enrollmentNumber: doc.studentSnapshot.enrollmentNumber,
      email: doc.studentSnapshot.email,
      section: doc.studentSnapshot.section,
      semester: doc.studentSnapshot.semester,
    },
    submissionText: doc.submissionText,
    attachments,
    submittedAt: new Date(doc.submittedAt).toISOString(),
    status: doc.status,
    isLate: doc.isLate,
    version: doc.version,
    history,
    evaluation: doc.evaluation
      ? {
          marksObtained: doc.evaluation.marksObtained ?? undefined,
          feedback: doc.evaluation.feedback ?? undefined,
          evaluatedBy: doc.evaluation.evaluatedBy ? doc.evaluation.evaluatedBy.toString() : undefined,
          evaluatedByName: doc.evaluation.evaluatedByName ?? undefined,
          evaluatedAt: doc.evaluation.evaluatedAt
            ? new Date(doc.evaluation.evaluatedAt).toISOString()
            : undefined,
          isGraded: Boolean(doc.evaluation.isGraded),
          releasedAt: doc.evaluation.releasedAt
            ? new Date(doc.evaluation.releasedAt).toISOString()
            : undefined,
        }
      : undefined,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export const SubmissionModel: Model<ISubmission> =
  mongoose.models.Submission || mongoose.model<ISubmission>('Submission', SubmissionSchema);

export default SubmissionModel;
