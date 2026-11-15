/**
 * Campus Polling & Voting Service (Phase 5.4).
 * Enforces role-based poll creation, anonymous cryptographic voting,
 * one-vote-per-identity, immutable ballots, and context-aware result masking.
 */

import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { PollRepository } from '@/lib/db/repositories/poll.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { toPollDTO, arePollResultsVisibleToCaller } from '@/lib/db/models';
import type {
  IPoll,
  PollDTO,
  CreatePollInput,
  UpdatePollInput,
  PollQueryFilters,
  IPollTargetScope,
} from '@/types/poll';
import type { CastVoteResultDTO } from '@/types/poll-vote';
import type { UserSession, IUser } from '@/types/user';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@/lib/errors/app-error';
import { isHOD, isDirector, isSysAdmin } from '@/lib/auth/rbac';
import { logger } from '@/lib/logging/logger';

export class PollService {
  /**
   * Retrieves the HMAC secret used for anonymous voter hashing.
   */
  private static getHmacSecret(): string {
    return (
      process.env.POLL_HMAC_SECRET ||
      process.env.CLERK_SECRET_KEY ||
      'axis-linkup-default-poll-hmac-salt-key-2026'
    );
  }

  /**
   * Derives a pseudonymous, irreversible voter identifier for anonymous polls.
   * HMAC-SHA256(userId + pollId, secret)
   */
  public static deriveVoterIdentifier(userId: string, pollId: string, isAnonymous: boolean): string {
    if (!isAnonymous) {
      return userId;
    }

    const secret = this.getHmacSecret();
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${userId}:${pollId}`);
    return hmac.digest('hex');
  }

  /**
   * Validates authority to create a poll.
   */
  public static validatePollAuthority(
    callerSession: UserSession,
    input: CreatePollInput | UpdatePollInput
  ): void {
    // 1. Students are strictly prohibited from creating campus polls
    if (callerSession.role === 'student') {
      throw new ForbiddenError('Students are not authorized to create campus polls.');
    }

    const scope = input.targetScope;

    // 2. System Administrator & Director have Global Institutional Scope
    if (isSysAdmin(callerSession) || isDirector(callerSession)) {
      return;
    }

    // 3. Department HOD Boundaries
    if (isHOD(callerSession)) {
      if (scope?.scopeType === 'institution_wide') {
        throw new ForbiddenError(
          'Department HOD polling is strictly restricted to their assigned department.'
        );
      }

      const callerDeptId = callerSession.departmentId?.toString();
      if (!callerDeptId) {
        throw new ForbiddenError('HOD session is missing assigned department scope.');
      }

      if (scope?.departmentIds && scope.departmentIds.length > 0) {
        const targetsForeignDept = scope.departmentIds.some((id: string) => id !== callerDeptId);
        if (targetsForeignDept) {
          throw new ForbiddenError('HOD cannot initiate polls targeting another department.');
        }
      }
      return;
    }

    // 4. Faculty Member Boundaries
    if (callerSession.role === 'faculty') {
      if (scope?.scopeType === 'institution_wide') {
        throw new ForbiddenError('Faculty members cannot create college-wide polls.');
      }

      const callerDeptId = callerSession.departmentId?.toString();
      if (scope?.departmentIds && scope.departmentIds.length > 0 && callerDeptId) {
        const targetsForeignDept = scope.departmentIds.some((id: string) => id !== callerDeptId);
        if (targetsForeignDept) {
          throw new ForbiddenError('Faculty cannot create polls for another department.');
        }
      }
      return;
    }

    // Default Deny
    throw new ForbiddenError('Insufficient permissions to create campus polls.');
  }

  /**
   * Evaluates whether a user belongs to a poll's target audience.
   */
  public static matchesPollAudience(poll: IPoll, caller: IUser | UserSession): boolean {
    const isSystemAdmin =
      caller.role === 'super_admin' &&
      ((caller as UserSession).adminSubRole === 'sys_admin' || !(caller as UserSession).adminSubRole);
    const isExecDirector =
      caller.role === 'super_admin' && (caller as UserSession).adminSubRole === 'director';

    if (isSystemAdmin || isExecDirector) {
      return true;
    }

    const scope = poll.targetScope;

    // 1. Role Filter Check
    if (scope.roles && scope.roles.length > 0) {
      if (!scope.roles.includes(caller.role)) {
        return false;
      }
    }

    // 2. Institution-wide Scope
    if (scope.scopeType === 'institution_wide') {
      return true;
    }

    // 3. Department Scope Check
    const callerDept = caller.departmentId?.toString();
    if (scope.departmentIds && scope.departmentIds.length > 0) {
      if (!callerDept) return false;
      const matchesDept = scope.departmentIds.some((id) => id.toString() === callerDept);
      if (!matchesDept) return false;
    }

    // 4. Faculty & HOD within department match
    if (caller.role === 'faculty' || caller.role === 'admin') {
      return true;
    }

    // 5. Student Cohort Specific Checks
    if (caller.role === 'student' && scope.scopeType === 'cohort') {
      const studentProfile = (caller as IUser).studentProfile;
      if (!studentProfile) return false;

      if (scope.programs && scope.programs.length > 0) {
        if (!studentProfile.program || !scope.programs.includes(studentProfile.program)) {
          return false;
        }
      }

      if (scope.batchYears && scope.batchYears.length > 0) {
        const studentBatch = studentProfile.batchYear || studentProfile.admissionYear;
        if (!studentBatch || !scope.batchYears.includes(studentBatch)) {
          return false;
        }
      }

      if (scope.sections && scope.sections.length > 0) {
        if (!studentProfile.section || !scope.sections.includes(studentProfile.section)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Creates a new campus poll.
   */
  public static async createPoll(
    callerSession: UserSession,
    input: CreatePollInput
  ): Promise<PollDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required to create polls.');
    }

    // 1. Authorization validation
    this.validatePollAuthority(callerSession, input);

    // 2. Fetch creator record
    const creatorUser = await UserRepository.findById(callerSession.userId);
    if (!creatorUser) {
      throw new NotFoundError('User', callerSession.userId);
    }

    // 3. Resolve department metadata
    let deptName: string | null = null;
    let deptCode: string | null = null;
    if (creatorUser.departmentId) {
      const dept = await DepartmentRepository.findById(creatorUser.departmentId.toString());
      if (dept) {
        deptName = dept.name;
        deptCode = dept.code;
      }
    }

    // 4. Construct Target Scope
    const targetScope: IPollTargetScope = {
      scopeType: input.targetScope.scopeType,
      departmentIds: input.targetScope.departmentIds?.map((id) => new Types.ObjectId(id)),
      roles: input.targetScope.roles,
      programs: input.targetScope.programs,
      batchYears: input.targetScope.batchYears,
      sections: input.targetScope.sections,
      courseCode: input.targetScope.courseCode,
    };

    if (
      (targetScope.scopeType === 'department' || targetScope.scopeType === 'cohort') &&
      (!targetScope.departmentIds || targetScope.departmentIds.length === 0) &&
      creatorUser.departmentId
    ) {
      targetScope.departmentIds = [creatorUser.departmentId];
    }

    // 5. Construct Options
    const options = input.options.map((opt) => ({
      _id: new Types.ObjectId(),
      text: opt.text.trim(),
      voteCount: 0,
    }));

    const isPublished = input.status === 'active';

    // 6. Persist Poll
    const poll = await PollRepository.create({
      question: input.question,
      description: input.description ?? undefined,
      type: input.type || 'single',
      maxSelections: input.type === 'single' ? 1 : input.maxSelections || 1,
      options,
      isAnonymous: input.isAnonymous !== undefined ? input.isAnonymous : true,
      resultsVisibility: input.resultsVisibility || 'after_vote',
      status: input.status || 'active',
      targetScope,
      creatorId: creatorUser._id,
      creatorSnapshot: {
        name: creatorUser.fullName,
        role: creatorUser.role,
        adminSubRole: creatorUser.adminSubRole ?? null,
        departmentName: deptName,
        departmentCode: deptCode,
      },
      totalVotes: 0,
      publishedAt: isPublished ? new Date() : undefined,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      isDeleted: false,
    });

    logger.info(`[PollService] Poll created: ${poll._id} by ${callerSession.userId} (${input.status || 'active'})`);

    return toPollDTO(poll, callerSession, false, []);
  }

  /**
   * Retrieves a poll by ID, verifies audience access, and projects context-aware results.
   */
  public static async getPollById(
    pollId: string,
    callerSession: UserSession
  ): Promise<PollDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const poll = await PollRepository.findById(pollId);
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }

    // Draft polls are only accessible by creator or SysAdmin
    if (poll.status === 'draft') {
      const isCreator = poll.creatorId.toString() === callerSession.userId;
      const isSystemAdmin = isSysAdmin(callerSession);
      if (!isCreator && !isSystemAdmin) {
        throw new NotFoundError('Poll', pollId);
      }
    }

    // Verify audience access
    const callerUser = await UserRepository.findById(callerSession.userId);
    if (!callerUser) {
      throw new NotFoundError('User', callerSession.userId);
    }

    const isAuthorized = this.matchesPollAudience(poll, callerUser);
    if (!isAuthorized) {
      throw new ForbiddenError('You do not belong to the target audience for this poll.');
    }

    // Check if caller has voted
    const voterIdentifier = this.deriveVoterIdentifier(callerSession.userId, pollId, poll.isAnonymous);
    const existingVote = await PollRepository.findVote(pollId, voterIdentifier);
    const hasVoted = Boolean(existingVote);
    const selectedOptionIds = existingVote ? existingVote.selectedOptionIds.map((id) => id.toString()) : [];

    return toPollDTO(poll, callerSession, hasVoted, selectedOptionIds);
  }

  /**
   * Submits an immutable ballot in a poll.
   * Enforces one-vote-per-identity, option validity, and atomic counter updates.
   */
  public static async castVote(
    pollId: string,
    callerSession: UserSession,
    optionIds: string[]
  ): Promise<CastVoteResultDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const poll = await PollRepository.findById(pollId);
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }

    // 1. Status Check: Must be active
    if (poll.status !== 'active') {
      throw new ValidationError(`Voting is closed for this poll (Current status: ${poll.status}).`);
    }

    // 2. Expiration Check
    if (poll.expiresAt && new Date() >= poll.expiresAt) {
      throw new ValidationError('The voting deadline for this poll has passed.');
    }

    // 3. Audience Targeting Check
    const callerUser = await UserRepository.findById(callerSession.userId);
    if (!callerUser || !this.matchesPollAudience(poll, callerUser)) {
      throw new ForbiddenError('You are not eligible to vote in this poll.');
    }

    // 4. Validate Option Selections
    const validOptionIdStrings = poll.options.map((opt) => opt._id.toString());
    const areAllOptionsValid = optionIds.every((id) => validOptionIdStrings.includes(id));
    if (!areAllOptionsValid) {
      throw new ValidationError('One or more selected options are invalid for this poll.');
    }

    if (poll.type === 'single' && optionIds.length !== 1) {
      throw new ValidationError('Single-choice polls require exactly one option selection.');
    }

    if (poll.type === 'multiple' && (optionIds.length < 1 || optionIds.length > poll.maxSelections)) {
      throw new ValidationError(
        `You may select between 1 and ${poll.maxSelections} options for this poll.`
      );
    }

    // 5. Derive Voter Identifier
    const voterIdentifier = this.deriveVoterIdentifier(callerSession.userId, pollId, poll.isAnonymous);

    // 6. Pre-flight Check for Existing Ballot
    const existingVote = await PollRepository.findVote(pollId, voterIdentifier);
    if (existingVote) {
      throw new ConflictError('You have already cast a ballot in this poll. Votes are immutable.');
    }

    // 7. Atomic Ballot Record & Counter Increment
    const { updatedPoll } = await PollRepository.recordVote(pollId, voterIdentifier, optionIds);

    logger.info(`[PollService] Vote cast on poll ${pollId} (anonymous: ${poll.isAnonymous})`);

    // 8. Result Assembly
    const areResultsVisible = arePollResultsVisibleToCaller(updatedPoll, callerSession, true);
    let updatedOptionsResult;

    if (areResultsVisible) {
      const totalCount = updatedPoll.totalVotes || 1;
      updatedOptionsResult = updatedPoll.options.map((opt) => ({
        id: opt._id.toString(),
        text: opt.text,
        voteCount: opt.voteCount || 0,
        percentage: Math.round(((opt.voteCount || 0) / totalCount) * 1000) / 10,
      }));
    }

    return {
      pollId,
      hasVoted: true,
      selectedOptionIds: optionIds,
      votedAt: new Date().toISOString(),
      updatedOptions: updatedOptionsResult,
      totalVotes: areResultsVisible ? updatedPoll.totalVotes : undefined,
    };
  }

  /**
   * Fetches personalized poll feed matching caller's audience.
   */
  public static async getPollFeed(
    callerSession: UserSession,
    filters: PollQueryFilters
  ): Promise<{ polls: PollDTO[]; nextCursor: string | null; hasMore: boolean }> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const isSystemAdmin = isSysAdmin(callerSession);
    const isExecDirector = isDirector(callerSession);

    const query: Record<string, unknown> = {};

    // Status filter
    if (filters.status) {
      if (filters.status === 'draft' && !isSystemAdmin) {
        query.creatorId = new Types.ObjectId(callerSession.userId);
        query.status = 'draft';
      } else {
        query.status = filters.status;
      }
    } else {
      query.status = { $in: ['active', 'closed'] };
    }

    // Search filter
    if (filters.search) {
      query.question = { $regex: filters.search, $options: 'i' };
    }

    // Audience targeting
    if (!isSystemAdmin && !isExecDirector) {
      const orConditions: Record<string, unknown>[] = [
        { 'targetScope.scopeType': 'institution_wide' },
      ];

      if (callerSession.departmentId) {
        orConditions.push({
          'targetScope.departmentIds': new Types.ObjectId(callerSession.departmentId),
        });
      }

      query.$and = [
        {
          $or: [
            { 'targetScope.roles': { $exists: false } },
            { 'targetScope.roles': { $size: 0 } },
            { 'targetScope.roles': callerSession.role },
          ],
        },
        { $or: orConditions },
      ];
    } else if (filters.departmentId) {
      query['targetScope.departmentIds'] = new Types.ObjectId(filters.departmentId);
    }

    const { polls: rawPolls, nextCursor, hasMore } = await PollRepository.findFeed(
      query,
      filters.limit,
      filters.cursor
    );

    // Compute user ballot status for each poll
    const userVotesMap = new Map<string, string[]>();

    for (const poll of rawPolls) {
      const voterIdentifier = this.deriveVoterIdentifier(callerSession.userId, poll._id.toString(), poll.isAnonymous);
      const vote = await PollRepository.findVote(poll._id.toString(), voterIdentifier);
      if (vote) {
        userVotesMap.set(poll._id.toString(), vote.selectedOptionIds.map((id) => id.toString()));
      }
    }

    const polls = rawPolls.map((poll) => {
      const selectedIds = userVotesMap.get(poll._id.toString()) || [];
      const hasVoted = selectedIds.length > 0;
      return toPollDTO(poll, callerSession, hasVoted, selectedIds);
    });

    return {
      polls,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Manually closes an active poll.
   */
  public static async closePoll(
    pollId: string,
    callerSession: UserSession
  ): Promise<PollDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const poll = await PollRepository.findById(pollId);
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }

    const isCreator = poll.creatorId.toString() === callerSession.userId;
    const isSystemAdmin = isSysAdmin(callerSession);
    const isExecDirector = isDirector(callerSession);
    const isDeptHOD = isHOD(callerSession);

    if (!isCreator && !isSystemAdmin && !isExecDirector && !isDeptHOD) {
      throw new ForbiddenError('You are not authorized to close this poll.');
    }

    const closed = await PollRepository.closePoll(pollId, callerSession.userId);
    if (!closed) {
      throw new NotFoundError('Poll', pollId);
    }

    logger.info(`[PollService] Poll ${pollId} closed by ${callerSession.userId}`);

    return toPollDTO(closed, callerSession, false, []);
  }

  /**
   * Archives a completed poll.
   */
  public static async archivePoll(
    pollId: string,
    callerSession: UserSession
  ): Promise<PollDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const poll = await PollRepository.findById(pollId);
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }

    const isCreator = poll.creatorId.toString() === callerSession.userId;
    const isSystemAdmin = isSysAdmin(callerSession);
    const isDeptHOD = isHOD(callerSession);

    if (!isCreator && !isSystemAdmin && !isDeptHOD) {
      throw new ForbiddenError('You are not authorized to archive this poll.');
    }

    const updated = await PollRepository.update(pollId, {
      status: 'archived',
    });

    if (!updated) {
      throw new NotFoundError('Poll', pollId);
    }

    logger.info(`[PollService] Poll ${pollId} archived by ${callerSession.userId}`);

    return toPollDTO(updated, callerSession, false, []);
  }

  /**
   * Soft deletes a poll.
   */
  public static async deletePoll(
    pollId: string,
    callerSession: UserSession
  ): Promise<boolean> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const poll = await PollRepository.findById(pollId);
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }

    const isCreator = poll.creatorId.toString() === callerSession.userId;
    const isSystemAdmin = isSysAdmin(callerSession);
    const isDeptHOD = isHOD(callerSession);

    if (!isAuthor(isCreator) && !isSystemAdmin && !isDeptHOD) {
      throw new ForbiddenError('You are not authorized to delete this poll.');
    }

    const deleted = await PollRepository.softDelete(pollId, callerSession.userId);
    logger.info(`[PollService] Poll ${pollId} soft-deleted by ${callerSession.userId}`);
    return deleted;
  }

  /**
   * Explicitly retrieves aggregate results for a poll if permitted by visibility policy.
   */
  public static async getPollResults(
    pollId: string,
    callerSession: UserSession
  ): Promise<{
    pollId: string;
    totalVotes: number;
    options: { id: string; text: string; voteCount: number; percentage: number }[];
  }> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const poll = await PollRepository.findById(pollId);
    if (!poll) {
      throw new NotFoundError('Poll', pollId);
    }

    const voterIdentifier = this.deriveVoterIdentifier(callerSession.userId, pollId, poll.isAnonymous);
    const existingVote = await PollRepository.findVote(pollId, voterIdentifier);
    const hasVoted = Boolean(existingVote);

    const isVisible = arePollResultsVisibleToCaller(poll, callerSession, hasVoted);
    if (!isVisible) {
      throw new ForbiddenError(
        'Poll results are hidden until you submit a ballot or the poll closes.'
      );
    }

    const totalVotesCount = poll.totalVotes || 0;
    const options = poll.options.map((opt) => {
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
      pollId,
      totalVotes: totalVotesCount,
      options,
    };
  }
}

function isAuthor(val: boolean): boolean {
  return val;
}
