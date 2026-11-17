/**
 * Master Assignment & Submission Type Definitions.
 * Conforms to Axis LinkUp Phase 5.7 Assignment Management Architecture.
 */

import type { Types, Document } from 'mongoose';
import type { UserRole } from './user';

export type AssignmentStatus = 'draft' | 'published' | 'closed' | 'archived';
export type SubmissionStatus = 'submitted' | 'resubmitted' | 'graded' | 'returned';

export interface AssignmentAttachment {
  id?: string;
  name: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  publicId?: string | null;
  uploadedAt: string;
}

export interface IAssignmentAttachmentSubdoc {
  _id?: Types.ObjectId;
  name: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  publicId?: string | null;
  uploadedAt: Date;
}

export interface IAcademicTarget {
  program?: string;
  year?: number;
  semester: number;
  section?: string;
  batchYear?: number;
}

export interface LateSubmissionPolicy {
  allowLate: boolean;
  lateDueDate?: string | null;
  penaltyPercentagePerDay?: number | null;
}

export interface ILateSubmissionPolicySubdoc {
  allowLate: boolean;
  lateDueDate?: Date | null;
  penaltyPercentagePerDay?: number | null;
}

export interface CreatorSnapshot {
  fullName: string;
  role: UserRole;
  employeeId?: string;
  avatarUrl?: string;
}

export interface StudentSnapshot {
  fullName: string;
  rollNumber?: string;
  enrollmentNumber?: string;
  email: string;
  section?: string;
  semester?: number;
}

export interface SubmissionHistoryEntry {
  version: number;
  submissionText?: string;
  attachments: AssignmentAttachment[];
  submittedAt: string;
  isLate: boolean;
}

export interface ISubmissionHistorySubdoc {
  version: number;
  submissionText?: string;
  attachments: IAssignmentAttachmentSubdoc[];
  submittedAt: Date;
  isLate: boolean;
}

export interface SubmissionEvaluation {
  marksObtained?: number;
  feedback?: string;
  evaluatedBy?: string;
  evaluatedByName?: string;
  evaluatedAt?: string;
  isGraded: boolean;
  releasedAt?: string;
}

export interface ISubmissionEvaluationSubdoc {
  marksObtained?: number | null;
  feedback?: string | null;
  evaluatedBy?: Types.ObjectId | null;
  evaluatedByName?: string | null;
  evaluatedAt?: Date | null;
  isGraded: boolean;
  releasedAt?: Date | null;
}

/* ========================================================================== */
/* MongoDB Document Interfaces                                                */
/* ========================================================================== */

export interface IAssignment extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  instructions?: string;
  courseCode: string;
  courseName: string;
  departmentId: Types.ObjectId;
  academicTarget: IAcademicTarget;
  createdBy: Types.ObjectId;
  creatorSnapshot: CreatorSnapshot;
  attachments: IAssignmentAttachmentSubdoc[];
  publishedAt?: Date;
  dueDate: Date;
  maxMarks: number;
  lateSubmissionPolicy: ILateSubmissionPolicySubdoc;
  allowResubmission: boolean;
  maxResubmissions: number;
  status: AssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubmission extends Document {
  _id: Types.ObjectId;
  assignmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  studentSnapshot: StudentSnapshot;
  submissionText?: string;
  attachments: IAssignmentAttachmentSubdoc[];
  submittedAt: Date;
  status: SubmissionStatus;
  isLate: boolean;
  version: number;
  history: ISubmissionHistorySubdoc[];
  evaluation: ISubmissionEvaluationSubdoc;
  createdAt: Date;
  updatedAt: Date;
}

/* ========================================================================== */
/* Client-Facing DTOs                                                         */
/* ========================================================================== */

export interface UserSubmissionSummaryDTO {
  id: string;
  status: SubmissionStatus;
  submittedAt: string;
  isLate: boolean;
  version: number;
  isGraded: boolean;
  marksObtained?: number;
  feedback?: string;
}

export interface AssignmentDTO {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  courseCode: string;
  courseName: string;
  departmentId: string;
  departmentCode?: string;
  departmentName?: string;
  academicTarget: IAcademicTarget;
  createdBy: string;
  creatorSnapshot: CreatorSnapshot;
  attachments: AssignmentAttachment[];
  publishedAt?: string;
  dueDate: string;
  maxMarks: number;
  lateSubmissionPolicy: LateSubmissionPolicy;
  allowResubmission: boolean;
  maxResubmissions: number;
  status: AssignmentStatus;
  submissionCount?: number;
  gradedCount?: number;
  userSubmission?: UserSubmissionSummaryDTO | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionDTO {
  id: string;
  assignmentId: string;
  studentId: string;
  studentSnapshot: StudentSnapshot;
  submissionText?: string;
  attachments: AssignmentAttachment[];
  submittedAt: string;
  status: SubmissionStatus;
  isLate: boolean;
  version: number;
  history: SubmissionHistoryEntry[];
  evaluation?: SubmissionEvaluation;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAssignmentsDTO {
  assignments: AssignmentDTO[];
  hasMore: boolean;
  nextCursor?: string;
  totalCount?: number;
}

export interface PaginatedSubmissionsDTO {
  submissions: SubmissionDTO[];
  hasMore: boolean;
  nextCursor?: string;
  totalCount?: number;
}
