/**
 * Notice & Collegiate Bulletin Type Definitions (Phase 5.4).
 * Conforms to DOC-AUTH-005, MOD-07, and Approved Institutional Policies.
 */

import type { Types } from 'mongoose';
import type { UserRole } from './user';

export type NoticePriority = 'normal' | 'important' | 'urgent';

export type NoticeCategory =
  | 'academic'
  | 'examination'
  | 'fee_accounts'
  | 'event_cultural'
  | 'placement'
  | 'administrative'
  | 'emergency';

export type NoticeStatus = 'draft' | 'published' | 'archived';

export type NoticeScopeType = 'institution_wide' | 'department' | 'role_specific' | 'cohort';

export interface INoticeAttachment {
  name: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export interface INoticeTargetScope {
  scopeType: NoticeScopeType;
  departmentIds?: Types.ObjectId[];
  roles?: UserRole[];
  programs?: string[];
  batchYears?: number[];
  semesters?: number[];
  sections?: string[];
  courseCode?: string;
}

export interface INoticeAuthorSnapshot {
  name: string;
  role: UserRole;
  adminSubRole?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
}

/**
 * Notice Mongoose Document Interface.
 */
export interface INotice {
  _id: Types.ObjectId;
  title: string;
  contentMarkdown: string;
  summary?: string;
  category: NoticeCategory;
  priority: NoticePriority;
  status: NoticeStatus;
  targetScope: INoticeTargetScope;
  authorId: Types.ObjectId;
  authorSnapshot: INoticeAuthorSnapshot;
  attachments: INoticeAttachment[];
  isPinned: boolean;
  requiresAcknowledgment: boolean;
  publishedAt?: Date;
  expiresAt?: Date;
  readCount: number;
  acknowledgmentCount: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notice Data Transfer Object (DTO) for client delivery.
 */
export interface NoticeDTO {
  id: string;
  title: string;
  contentMarkdown: string;
  summary: string | null;
  category: NoticeCategory;
  priority: NoticePriority;
  status: NoticeStatus;
  targetScope: {
    scopeType: NoticeScopeType;
    departmentIds?: string[];
    roles?: UserRole[];
    programs?: string[];
    batchYears?: number[];
    semesters?: number[];
    sections?: string[];
    courseCode?: string;
  };
  author: {
    id: string;
    name: string;
    role: UserRole;
    adminSubRole: string | null;
    departmentCode: string | null;
  };
  attachments: INoticeAttachment[];
  isPinned: boolean;
  requiresAcknowledgment: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  readCount: number;
  acknowledgmentCount: number;
  hasRead?: boolean;
  hasAcknowledged?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input DTO for Notice Creation.
 */
export interface CreateNoticeInput {
  title: string;
  contentMarkdown: string;
  summary?: string;
  category: NoticeCategory;
  priority?: NoticePriority;
  status?: 'draft' | 'published';
  targetScope: {
    scopeType: NoticeScopeType;
    departmentIds?: string[];
    roles?: UserRole[];
    programs?: string[];
    batchYears?: number[];
    semesters?: number[];
    sections?: string[];
    courseCode?: string;
  };
  attachments?: INoticeAttachment[];
  isPinned?: boolean;
  requiresAcknowledgment?: boolean;
  expiresAt?: string | null;
}

/**
 * Input DTO for Notice Update.
 */
export interface UpdateNoticeInput {
  title?: string;
  contentMarkdown?: string;
  summary?: string;
  category?: NoticeCategory;
  priority?: NoticePriority;
  targetScope?: {
    scopeType: NoticeScopeType;
    departmentIds?: string[];
    roles?: UserRole[];
    programs?: string[];
    batchYears?: number[];
    semesters?: number[];
    sections?: string[];
    courseCode?: string;
  };
  attachments?: INoticeAttachment[];
  isPinned?: boolean;
  requiresAcknowledgment?: boolean;
  expiresAt?: string | null;
}

/**
 * Filters for Querying Notice Feeds.
 */
export interface NoticeQueryFilters {
  category?: NoticeCategory;
  priority?: NoticePriority;
  status?: NoticeStatus;
  departmentId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

