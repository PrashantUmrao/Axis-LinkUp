/**
 * Domain Type Definitions for Skill & Achievement Passport & Faculty Endorsement Pipeline
 * (MOD-15 / Phase 5.12).
 */

import type { Document, Types } from 'mongoose';

export const ACHIEVEMENT_CATEGORIES = [
  'technical_certification',
  'hackathon_competition',
  'paper_publication',
  'club_leadership',
  'community_service',
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * Deterministic institutional credit points by achievement category.
 */
export const ACHIEVEMENT_CATEGORY_POINTS: Record<AchievementCategory, number> = {
  paper_publication: 30,
  hackathon_competition: 25,
  technical_certification: 20,
  club_leadership: 15,
  community_service: 10,
};

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  technical_certification: 'Technical Certification',
  hackathon_competition: 'Hackathon & Competition',
  paper_publication: 'Paper Publication',
  club_leadership: 'Club Leadership',
  community_service: 'Community Service',
};

/**
 * Embedded immutable student snapshot captured at submission time.
 */
export interface IAchievementStudentSnapshot {
  fullName: string;
  enrollmentNo: string;
  department: string;
  branch: string;
  section: string;
  semester: number;
}

/**
 * Embedded verifier snapshot captured upon endorsement/rejection.
 */
export interface IAchievementVerifierSnapshot {
  fullName: string;
  role: string;
  department?: string | null;
}

/**
 * Supporting proof attachment metadata (Cloudinary signed upload or dev-mock).
 */
export interface IProofAttachment {
  name: string;
  url: string;
  fileType: string;
  size: number;
  publicId: string;
}

/**
 * Mongoose Document interface for a Student Achievement Claim.
 */
export interface IStudentAchievement extends Document {
  _id: Types.ObjectId;
  claimCode: string;
  studentId: Types.ObjectId;
  studentSnapshot: IAchievementStudentSnapshot;
  category: AchievementCategory;
  pointsWeight: number;
  title: string;
  issuingOrganization: string;
  issueDate: Date;
  description: string;
  skills: string[];
  credentialUrl?: string | null;
  proofAttachment?: IProofAttachment | null;
  verificationStatus: VerificationStatus;
  resubmissionCount: number;
  verifiedBy?: Types.ObjectId | null;
  verifiedBySnapshot?: IAchievementVerifierSnapshot | null;
  verifiedAt?: Date | null;
  verificationHash?: string | null;
  reviewRemarks?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Full authenticated Student Achievement DTO.
 */
export interface StudentAchievementDTO {
  id: string;
  claimCode: string;
  studentId: string;
  studentSnapshot: IAchievementStudentSnapshot;
  category: AchievementCategory;
  pointsWeight: number;
  title: string;
  issuingOrganization: string;
  issueDate: string;
  description: string;
  skills: string[];
  credentialUrl: string | null;
  proofAttachment: IProofAttachment | null;
  verificationStatus: VerificationStatus;
  resubmissionCount: number;
  verifiedBy: string | null;
  verifiedBySnapshot: IAchievementVerifierSnapshot | null;
  verifiedAt: string | null;
  verificationHash: string | null;
  reviewRemarks: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Privacy-safe Public Recruiter Achievement DTO (ONLY verified achievements).
 * Never exposes internal user IDs, private contact info, or review remarks.
 */
export interface PublicAchievementDTO {
  claimCode: string;
  category: AchievementCategory;
  pointsWeight: number;
  title: string;
  issuingOrganization: string;
  issueDate: string;
  description: string;
  skills: string[];
  credentialUrl: string | null;
  verifiedByName: string;
  verifiedByRole: string;
  verifiedAt: string;
  verificationHash: string;
}

/**
 * Mongoose Document interface for a Student's revocable Public Passport Share config.
 */
export interface IPassportShare extends Document {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  shareToken: string;
  isEnabled: boolean;
  headline?: string | null;
  viewCount: number;
  lastRotatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client-safe Passport Share configuration DTO.
 */
export interface PassportShareDTO {
  id: string;
  studentId: string;
  shareToken: string;
  isEnabled: boolean;
  headline: string | null;
  viewCount: number;
  lastRotatedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Student Passport summary metrics.
 */
export interface StudentPassportStatsDTO {
  totalClaims: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  resubmittableCount: number;
  totalVerifiedPoints: number;
  byCategory: Record<AchievementCategory, number>;
}

/**
 * Student Passport composite response.
 */
export interface StudentPassportResponseDTO {
  achievements: StudentAchievementDTO[];
  stats: StudentPassportStatsDTO;
  share: PassportShareDTO;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Faculty / Admin Verification Queue statistics.
 */
export interface PassportVerificationStatsDTO {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  totalVerifiedPoints: number;
}

/**
 * Faculty / Admin Verification Queue composite response.
 */
export interface PassportVerificationQueueDTO {
  achievements: StudentAchievementDTO[];
  stats: PassportVerificationStatsDTO;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Public Recruiter Portfolio DTO (strictly privacy-preserved, verified-only).
 */
export interface PublicPassportDTO {
  shareToken: string;
  headline: string | null;
  viewCount: number;
  student: {
    fullName: string;
    department: string;
    branch: string;
    semester: number;
  };
  totalVerifiedPoints: number;
  verifiedCount: number;
  skills: string[];
  achievements: PublicAchievementDTO[];
  generatedAt: string;
}
