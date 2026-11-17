/**
 * Mongoose StudentAchievement Model Definition (MOD-15 / Phase 5.12).
 * Represents student co-curricular claims, proof attachments, faculty endorsements,
 * and SHA-256 verification stamps.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import {
  ACHIEVEMENT_CATEGORIES,
  VERIFICATION_STATUSES,
  type IStudentAchievement,
  type StudentAchievementDTO,
  type PublicAchievementDTO,
  type IAchievementStudentSnapshot,
  type IAchievementVerifierSnapshot,
  type IProofAttachment,
  type AchievementCategory,
  type VerificationStatus,
} from '@/types/passport';

const AchievementStudentSnapshotSchema = new Schema<IAchievementStudentSnapshot>(
  {
    fullName: { type: String, required: true, trim: true },
    enrollmentNo: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1, max: 12 },
  },
  { _id: false }
);

const AchievementVerifierSnapshotSchema = new Schema<IAchievementVerifierSnapshot>(
  {
    fullName: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const ProofAttachmentSchema = new Schema<IProofAttachment>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, required: true, trim: true },
    fileType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    publicId: { type: String, required: true, trim: true },
  },
  { _id: false }
);

export const StudentAchievementSchema = new Schema<IStudentAchievement>(
  {
    claimCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    studentSnapshot: {
      type: AchievementStudentSnapshotSchema,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [...ACHIEVEMENT_CATEGORIES],
      index: true,
    },
    pointsWeight: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 140,
    },
    issuingOrganization: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    issueDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 15,
      maxlength: 1000,
    },
    skills: {
      type: [String],
      default: [],
    },
    credentialUrl: {
      type: String,
      trim: true,
      default: null,
    },
    proofAttachment: {
      type: ProofAttachmentSchema,
      default: null,
    },
    verificationStatus: {
      type: String,
      required: true,
      enum: [...VERIFICATION_STATUSES],
      default: 'pending',
      index: true,
    },
    resubmissionCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedBySnapshot: {
      type: AchievementVerifierSnapshotSchema,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationHash: {
      type: String,
      trim: true,
      default: null,
    },
    reviewRemarks: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'student_achievements',
  }
);

// Compound Indexing Strategy
StudentAchievementSchema.index({ studentId: 1, verificationStatus: 1, createdAt: -1 });
StudentAchievementSchema.index({
  'studentSnapshot.department': 1,
  verificationStatus: 1,
  createdAt: -1,
});
StudentAchievementSchema.index({ claimCode: 1 }, { unique: true });

export const StudentAchievementModel: Model<IStudentAchievement> =
  (mongoose.models.StudentAchievement as Model<IStudentAchievement>) ||
  mongoose.model<IStudentAchievement>('StudentAchievement', StudentAchievementSchema);

/**
 * Serializes a Mongoose StudentAchievement document into an authenticated DTO.
 * Strictly guarantees verificationHash is null unless verificationStatus === 'verified'.
 */
export function toStudentAchievementDTO(
  doc: IStudentAchievement | (Record<string, unknown> & { _id: unknown })
): StudentAchievementDTO {
  const raw =
    typeof (doc as IStudentAchievement).toObject === 'function'
      ? (doc as IStudentAchievement).toObject()
      : (doc as Record<string, unknown>);

  const stuSnap = (raw.studentSnapshot || {}) as Partial<IAchievementStudentSnapshot>;
  const verSnap = raw.verifiedBySnapshot as Partial<IAchievementVerifierSnapshot> | null | undefined;
  const proof = raw.proofAttachment as Partial<IProofAttachment> | null | undefined;
  const status = (raw.verificationStatus as VerificationStatus) || 'pending';

  return {
    id: String(raw._id),
    claimCode: String(raw.claimCode || ''),
    studentId: raw.studentId ? String(raw.studentId) : '',
    studentSnapshot: {
      fullName: String(stuSnap.fullName || 'Student'),
      enrollmentNo: String(stuSnap.enrollmentNo || 'ENR-PENDING'),
      department: String(stuSnap.department || 'General Academic'),
      branch: String(stuSnap.branch || 'B.TECH'),
      section: String(stuSnap.section || 'A'),
      semester: Number(stuSnap.semester ?? 1),
    },
    category: (raw.category as AchievementCategory) || 'technical_certification',
    pointsWeight: Number(raw.pointsWeight ?? 10),
    title: String(raw.title || ''),
    issuingOrganization: String(raw.issuingOrganization || ''),
    issueDate:
      raw.issueDate instanceof Date
        ? raw.issueDate.toISOString()
        : String(raw.issueDate || new Date().toISOString()),
    description: String(raw.description || ''),
    skills: Array.isArray(raw.skills) ? raw.skills.map(String) : [],
    credentialUrl: raw.credentialUrl ? String(raw.credentialUrl) : null,
    proofAttachment:
      proof && proof.url
        ? {
            name: String(proof.name || 'proof'),
            url: String(proof.url),
            fileType: String(proof.fileType || 'application/pdf'),
            size: Number(proof.size ?? 0),
            publicId: String(proof.publicId || ''),
          }
        : null,
    verificationStatus: status,
    resubmissionCount: Number(raw.resubmissionCount ?? 0),
    verifiedBy: raw.verifiedBy ? String(raw.verifiedBy) : null,
    verifiedBySnapshot: verSnap
      ? {
          fullName: String(verSnap.fullName || 'Faculty Verifier'),
          role: String(verSnap.role || 'faculty'),
          department: verSnap.department ? String(verSnap.department) : null,
        }
      : null,
    verifiedAt:
      raw.verifiedAt instanceof Date
        ? raw.verifiedAt.toISOString()
        : raw.verifiedAt
          ? String(raw.verifiedAt)
          : null,
    verificationHash:
      status === 'verified' && raw.verificationHash ? String(raw.verificationHash) : null,
    reviewRemarks: raw.reviewRemarks ? String(raw.reviewRemarks) : null,
    createdAt:
      raw.createdAt instanceof Date
        ? raw.createdAt.toISOString()
        : String(raw.createdAt || new Date().toISOString()),
    updatedAt:
      raw.updatedAt instanceof Date
        ? raw.updatedAt.toISOString()
        : String(raw.updatedAt || new Date().toISOString()),
  };
}

/**
 * Serializes a VERIFIED achievement into a strictly privacy-safe public recruiter DTO.
 */
export function toPublicAchievementDTO(
  doc: IStudentAchievement | (Record<string, unknown> & { _id: unknown })
): PublicAchievementDTO {
  const full = toStudentAchievementDTO(doc);
  return {
    claimCode: full.claimCode,
    category: full.category,
    pointsWeight: full.pointsWeight,
    title: full.title,
    issuingOrganization: full.issuingOrganization,
    issueDate: full.issueDate,
    description: full.description,
    skills: full.skills,
    credentialUrl: full.credentialUrl,
    verifiedByName: full.verifiedBySnapshot?.fullName || 'Axis Institute Faculty',
    verifiedByRole: full.verifiedBySnapshot?.role || 'faculty',
    verifiedAt: full.verifiedAt || full.updatedAt,
    verificationHash: full.verificationHash || '',
  };
}
