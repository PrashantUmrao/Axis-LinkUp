/**
 * Master Student Request Tracker & Administrative Service Queue Types (MOD-13 / Phase 5.8).
 * Defines domain entities, database document interfaces, and DTO contracts.
 */

import type { Document, Types } from 'mongoose';

export type ServiceRequestCategory =
  | 'bonafide'
  | 'leave'
  | 'id_replacement'
  | 'lab_access'
  | 'general_inquiry';

export type ServiceRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'action_required'
  | 'approved'
  | 'rejected'
  | 'fulfilled';

export type ServiceRequestPriority = 'standard' | 'urgent';

export type BonafidePurpose =
  | 'scholarship'
  | 'visa_passport'
  | 'education_loan'
  | 'internship'
  | 'other';

export interface BonafideDetails {
  purpose: BonafidePurpose;
  customPurpose?: string;
}

export interface LeaveDetails {
  startDate: string | Date;
  endDate: string | Date;
  reason: string;
  emergencyContact: string;
}

export interface IdReplacementDetails {
  reason: 'lost' | 'damaged' | 'stolen';
  policeReportRef?: string;
}

export interface LabAccessDetails {
  labName: string;
  facultySupervisor: string;
  durationHours: number;
  requiredDates: string;
}

export interface GeneralInquiryDetails {
  queryDetails: string;
}

export type ServiceRequestDetails =
  | BonafideDetails
  | LeaveDetails
  | IdReplacementDetails
  | LabAccessDetails
  | GeneralInquiryDetails;

export interface IRequestAttachment {
  name: string;
  url: string;
  fileType: string;
  size: number;
  publicId?: string | null;
}

export interface IStudentSnapshot {
  fullName: string;
  enrollmentNo: string;
  department: string;
  branch: string;
  section: string;
  semester: number;
  email: string;
}

export interface IReviewHistorySubdoc {
  action: ServiceRequestStatus;
  actorId: Types.ObjectId;
  actorRole: string;
  actorName?: string;
  remarks?: string;
  timestamp: Date;
}

export interface IFulfillmentDocumentSubdoc {
  name: string;
  url: string;
  issuedAt: Date;
  referenceId?: string;
}

/* ========================================================================== */
/* MongoDB Document Interface                                                 */
/* ========================================================================== */

export interface IServiceRequest extends Document {
  _id: Types.ObjectId;
  ticketNumber: string;
  studentId: Types.ObjectId;
  studentSnapshot: IStudentSnapshot;
  category: ServiceRequestCategory;
  subject: string;
  details: ServiceRequestDetails;
  attachments: IRequestAttachment[];
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  assignedAdminId?: Types.ObjectId | null;
  reviewHistory: IReviewHistorySubdoc[];
  fulfillmentDocument?: IFulfillmentDocumentSubdoc | null;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/* ========================================================================== */
/* Client-Facing DTOs                                                         */
/* ========================================================================== */

export interface ReviewHistoryDTO {
  action: ServiceRequestStatus;
  actorId: string;
  actorRole: string;
  actorName?: string;
  remarks?: string;
  timestamp: string;
}

export interface FulfillmentDocumentDTO {
  name: string;
  url: string;
  issuedAt: string;
  referenceId?: string;
}

export interface ServiceRequestDTO {
  id: string;
  ticketNumber: string;
  studentId: string;
  studentSnapshot: IStudentSnapshot;
  category: ServiceRequestCategory;
  subject: string;
  details: ServiceRequestDetails;
  attachments: IRequestAttachment[];
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  assignedAdminId?: string | null;
  reviewHistory: ReviewHistoryDTO[];
  fulfillmentDocument?: FulfillmentDocumentDTO | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequestStatsDTO {
  total: number;
  submitted: number;
  underReview: number;
  actionRequired: number;
  approved: number;
  rejected: number;
  fulfilled: number;
}

export interface PaginatedServiceRequestsDTO {
  requests: ServiceRequestDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

