/**
 * Mongoose Model & Schema for Campus Polls (Phase 5.4).
 * Enforces bounded choices (2-10), atomic vote counters, and context-aware result masking.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type { IPoll, IPollOption, PollDTO, PollOptionDTO } from '@/types/poll';
import type { UserSession } from '@/types/user';

const PollOptionSchema = new Schema<IPollOption>({
  text: {
    type: String,
    required: [true, 'Option text is required'],
    trim: true,
    minlength: [1, 'Option text cannot be empty'],
    maxlength: [100, 'Option text cannot exceed 100 characters'],
  },
  voteCount: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const PollTargetScopeSchema = new Schema(
  {
    scopeType: {
      type: String,
      enum: ['institution_wide', 'department', 'role_specific', 'cohort'],
      default: 'institution_wide',
      required: true,
    },
    departmentIds: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    roles: [{ type: String, enum: ['student', 'faculty', 'admin', 'super_admin'] }],
    programs: [{ type: String, trim: true }],
    batchYears: [{ type: Number }],
    sections: [{ type: String, trim: true }],
    courseCode: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const PollCreatorSnapshotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true },
    adminSubRole: { type: String, default: null },
    departmentName: { type: String, default: null },
    departmentCode: { type: String, default: null },
  },
  { _id: false }
);

const PollSchema = new Schema<IPoll>(
  {
    question: {
      type: String,
      required: [true, 'Poll question is required'],
      trim: true,
      minlength: [5, 'Poll question must be at least 5 characters'],
      maxlength: [250, 'Poll question cannot exceed 250 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: null,
    },
    type: {
      type: String,
      enum: ['single', 'multiple'],
      default: 'single',
      required: true,
    },
    maxSelections: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
      required: true,
    },
    options: {
      type: [PollOptionSchema],
      required: true,
      validate: [
        (opts: IPollOption[]) => opts && opts.length >= 2 && opts.length <= 10,
        'Polls must contain between 2 and 10 options',
      ],
    },
    isAnonymous: {
      type: Boolean,
      default: true,
    },
    resultsVisibility: {
      type: String,
      enum: ['always', 'after_vote', 'after_close', 'creator_only'],
      default: 'after_vote',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'closed', 'archived'],
      default: 'active',
      index: true,
    },
    targetScope: {
      type: PollTargetScopeSchema,
      required: true,
      default: () => ({ scopeType: 'institution_wide' }),
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required'],
      index: true,
    },
    creatorSnapshot: {
      type: PollCreatorSnapshotSchema,
      required: true,
    },
    totalVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Query Indexes
PollSchema.index(
  { status: 1, isDeleted: 1, expiresAt: 1, createdAt: -1 },
  { name: 'idx_polls_feed_active' }
);

PollSchema.index(
  { 'targetScope.departmentIds': 1, status: 1, isDeleted: 1 },
  { name: 'idx_polls_dept_feed' }
);

PollSchema.index(
  { creatorId: 1, status: 1, isDeleted: 1, createdAt: -1 },
  { name: 'idx_polls_creator_desk' }
);

/**
 * Determines whether a caller is authorized to view aggregate vote counts.
 */
export function arePollResultsVisibleToCaller(
  poll: IPoll,
  callerSession: UserSession,
  hasCallerVoted: boolean
): boolean {
  const isCreator = callerSession.userId === poll.creatorId.toString();
  const isSysAdmin =
    callerSession.role === 'super_admin' &&
    (callerSession.adminSubRole === 'sys_admin' || !callerSession.adminSubRole);
  const isDirector =
    callerSession.role === 'super_admin' && callerSession.adminSubRole === 'director';

  // System Administrators, Directors, and Creators always have analytical visibility
  if (isSysAdmin || isDirector || isCreator) {
    return true;
  }

  // Policy 1: Creator Only
  if (poll.resultsVisibility === 'creator_only') {
    return false;
  }

  // Policy 2: Always Visible
  if (poll.resultsVisibility === 'always') {
    return true;
  }

  // Policy 3: After Close
  const isExpired = poll.expiresAt ? new Date() >= poll.expiresAt : false;
  const isClosed = poll.status === 'closed' || poll.status === 'archived' || isExpired;
  if (poll.resultsVisibility === 'after_close') {
    return isClosed;
  }

  // Policy 4: After Vote
  if (poll.resultsVisibility === 'after_vote') {
    return hasCallerVoted || isClosed;
  }

  return false;
}

/**
 * Serializes an IPoll document into a PollDTO with privacy-aware result masking.
 */
export function toPollDTO(
  poll: IPoll,
  callerSession: UserSession,
  hasCallerVoted = false,
  callerSelectedOptionIds: string[] = []
): PollDTO {
  const areResultsVisible = arePollResultsVisibleToCaller(poll, callerSession, hasCallerVoted);

  // Compute total votes for percentage calculation
  const totalVotesCount = poll.totalVotes || 0;

  const options: PollOptionDTO[] = poll.options.map((opt) => {
    if (!areResultsVisible) {
      return {
        id: opt._id.toString(),
        text: opt.text,
      };
    }

    const voteCount = opt.voteCount || 0;
    const percentage = totalVotesCount > 0 ? Math.round((voteCount / totalVotesCount) * 1000) / 10 : 0;

    return {
      id: opt._id.toString(),
      text: opt.text,
      voteCount,
      percentage,
    };
  });

  return {
    id: poll._id.toString(),
    question: poll.question,
    description: poll.description ?? null,
    type: poll.type,
    maxSelections: poll.maxSelections,
    options,
    isAnonymous: poll.isAnonymous,
    resultsVisibility: poll.resultsVisibility,
    status: poll.status,
    targetScope: {
      scopeType: poll.targetScope.scopeType,
      departmentIds: poll.targetScope.departmentIds?.map((id) => id.toString()),
      roles: poll.targetScope.roles,
      programs: poll.targetScope.programs,
      batchYears: poll.targetScope.batchYears,
      sections: poll.targetScope.sections,
      courseCode: poll.targetScope.courseCode,
    },
    creator: {
      id: poll.creatorId.toString(),
      name: poll.creatorSnapshot.name,
      role: poll.creatorSnapshot.role,
      adminSubRole: poll.creatorSnapshot.adminSubRole ?? null,
      departmentCode: poll.creatorSnapshot.departmentCode ?? null,
    },
    totalVotes: areResultsVisible ? totalVotesCount : undefined,
    hasVoted: hasCallerVoted,
    selectedOptionIds: hasCallerVoted ? callerSelectedOptionIds : undefined,
    areResultsVisible,
    publishedAt: poll.publishedAt ? poll.publishedAt.toISOString() : null,
    expiresAt: poll.expiresAt ? poll.expiresAt.toISOString() : null,
    closedAt: poll.closedAt ? poll.closedAt.toISOString() : null,
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
  };
}

export const PollModel: Model<IPoll> =
  mongoose.models.Poll || mongoose.model<IPoll>('Poll', PollSchema);

