/**
 * Campus Polling & Democratic Decision-Making Types (Phase 5.4).
 * Conforms to DOC-AUTH-005, MOD-09, and Approved Institutional Policies.
 */

import type { Types } from 'mongoose';
import type { UserRole } from './user';

export type PollType = 'single' | 'multiple';

export type PollStatus = 'draft' | 'active' | 'closed' | 'archived';

export type PollResultsVisibility = 'always' | 'after_vote' | 'after_close' | 'creator_only';

export type PollScopeType = 'institution_wide' | 'department' | 'role_specific' | 'cohort';

export interface IPollOption {
  _id: Types.ObjectId;
  text: string;
  voteCount: number;
}

export interface IPollTargetScope {
  scopeType: PollScopeType;
  departmentIds?: Types.ObjectId[];
  roles?: UserRole[];
  programs?: string[];
  batchYears?: number[];
  sections?: string[];
  courseCode?: string;
}

export interface IPollCreatorSnapshot {
  name: string;
  role: UserRole;
  adminSubRole?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
}

/**
 * Poll Mongoose Document Interface.
 */
export interface IPoll {
  _id: Types.ObjectId;
  question: string;
  description?: string;
  type: PollType;
  maxSelections: number;
  options: IPollOption[];
  isAnonymous: boolean;
  resultsVisibility: PollResultsVisibility;
  status: PollStatus;
  targetScope: IPollTargetScope;
  creatorId: Types.ObjectId;
  creatorSnapshot: IPollCreatorSnapshot;
  totalVotes: number;
  publishedAt?: Date;
  expiresAt?: Date;
  closedAt?: Date;
  closedById?: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client-facing Option Projection with computed percentage.
 */
export interface PollOptionDTO {
  id: string;
  text: string;
  voteCount?: number; // Omitted if caller not authorized to view results yet
  percentage?: number; // Computed if results are visible
}

/**
 * Poll Data Transfer Object (DTO) for client delivery.
 */
export interface PollDTO {
  id: string;
  question: string;
  description: string | null;
  type: PollType;
  maxSelections: number;
  options: PollOptionDTO[];
  isAnonymous: boolean;
  resultsVisibility: PollResultsVisibility;
  status: PollStatus;
  targetScope: {
    scopeType: PollScopeType;
    departmentIds?: string[];
    roles?: UserRole[];
    programs?: string[];
    batchYears?: number[];
    sections?: string[];
    courseCode?: string;
  };
  creator: {
    id: string;
    name: string;
    role: UserRole;
    adminSubRole: string | null;
    departmentCode: string | null;
  };
  totalVotes?: number;
  hasVoted?: boolean;
  selectedOptionIds?: string[];
  areResultsVisible: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input DTO for Poll Creation.
 */
export interface CreatePollInput {
  question: string;
  description?: string;
  type?: PollType;
  maxSelections?: number;
  options: { text: string }[];
  isAnonymous?: boolean;
  resultsVisibility?: PollResultsVisibility;
  status?: 'draft' | 'active';
  targetScope: {
    scopeType: PollScopeType;
    departmentIds?: string[];
    roles?: UserRole[];
    programs?: string[];
    batchYears?: number[];
    sections?: string[];
    courseCode?: string;
  };
  expiresAt?: string | null;
}

/**
 * Input DTO for Poll Update (Draft state only).
 */
export interface UpdatePollInput {
  question?: string;
  description?: string;
  type?: PollType;
  maxSelections?: number;
  options?: { text: string }[];
  isAnonymous?: boolean;
  resultsVisibility?: PollResultsVisibility;
  targetScope?: {
    scopeType: PollScopeType;
    departmentIds?: string[];
    roles?: UserRole[];
    programs?: string[];
    batchYears?: number[];
    sections?: string[];
    courseCode?: string;
  };
  expiresAt?: string | null;
}

/**
 * Query filters for Poll Feeds.
 */
export interface PollQueryFilters {
  status?: PollStatus;
  departmentId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

