/**
 * Notice & Collegiate Bulletin Service (Phase 5.4).
 * Enforces role-based publishing scopes, audience targeting, read receipts, and privacy policies.
 */

import { Types } from 'mongoose';
import { NoticeRepository } from '@/lib/db/repositories/notice.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { toNoticeDTO, toNoticeReceiptDTO } from '@/lib/db/models';
import type {
  INotice,
  NoticeDTO,
  CreateNoticeInput,
  UpdateNoticeInput,
  NoticeQueryFilters,
  INoticeTargetScope,
} from '@/types/notice';
import type { NoticeReceiptStatsDTO } from '@/types/notice-receipt';
import type { UserSession, IUser } from '@/types/user';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/app-error';
import { isHOD, isDirector, isSysAdmin } from '@/lib/auth/rbac';
import { logger } from '@/lib/logging/logger';

export class NoticeService {
  /**
   * Asserts whether a caller is authorized to create/publish a notice with the specified scope.
   */
  public static validatePublishingAuthority(
    callerSession: UserSession,
    input: CreateNoticeInput | UpdateNoticeInput
  ): void {
    // 1. Students are strictly prohibited from publishing notices
    if (callerSession.role === 'student') {
      throw new ForbiddenError('Students are not authorized to publish notices or bulletins.');
    }

    const scope = input.targetScope;
    const priority = input.priority;

    // 2. Urgent Emergency Siren Gate: Restricted to Executive Director & System Administrator
    if (priority === 'urgent') {
      if (!isSysAdmin(callerSession) && !isDirector(callerSession)) {
        throw new ForbiddenError(
          'Broadcasting urgent or emergency notices requires Executive Director or System Administrator authorization.'
        );
      }
    }

    // 3. System Administrator & Director have Global Institutional Scope
    if (isSysAdmin(callerSession) || isDirector(callerSession)) {
      return;
    }

    // 4. Department HOD Boundaries
    if (isHOD(callerSession)) {
      if (scope?.scopeType === 'institution_wide') {
        throw new ForbiddenError(
          'Department HOD publishing is strictly restricted to their assigned department.'
        );
      }

      const callerDeptId = callerSession.departmentId?.toString();
      if (!callerDeptId) {
        throw new ForbiddenError('HOD session is missing assigned department scope.');
      }

      if (scope?.departmentIds && scope.departmentIds.length > 0) {
        const targetsForeignDept = scope.departmentIds.some((id) => id !== callerDeptId);
        if (targetsForeignDept) {
          throw new ForbiddenError('HOD cannot publish notices targeting another department.');
        }
      }
      return;
    }

    // 5. Faculty Member Boundaries (Approved Policy 1)
    if (callerSession.role === 'faculty') {
      if (scope?.scopeType === 'institution_wide') {
        throw new ForbiddenError('Faculty members cannot publish college-wide official notices.');
      }

      // Department-wide publishing requires HOD authorization
      if (scope?.scopeType === 'department' && !scope.courseCode && !scope.sections?.length) {
        throw new ForbiddenError(
          'Department-wide official circulars require HOD authorization. Faculty may publish course or section-specific notices.'
        );
      }

      const callerDeptId = callerSession.departmentId?.toString();
      if (scope?.departmentIds && scope.departmentIds.length > 0 && callerDeptId) {
        const targetsForeignDept = scope.departmentIds.some((id) => id !== callerDeptId);
        if (targetsForeignDept) {
          throw new ForbiddenError('Faculty cannot publish notices for another department.');
        }
      }
      return;
    }

    // Default Deny
    throw new ForbiddenError('Insufficient permissions to publish collegiate notices.');
  }

  /**
   * Evaluates whether a user matches a notice's target audience.
   */
  public static matchesNoticeAudience(notice: INotice, caller: IUser | UserSession): boolean {
    const isSystemAdmin =
      caller.role === 'super_admin' &&
      ((caller as UserSession).adminSubRole === 'sys_admin' || !(caller as UserSession).adminSubRole);
    const isExecDirector =
      caller.role === 'super_admin' && (caller as UserSession).adminSubRole === 'director';

    // System Admins and Directors have unrestricted institutional reading oversight
    if (isSystemAdmin || isExecDirector) {
      return true;
    }

    const scope = notice.targetScope;

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

    // 4. Faculty & HOD within matched department see all cohort notices in that department
    if (caller.role === 'faculty' || caller.role === 'admin') {
      return true;
    }

    // 5. Student Cohort Specific Checks
    if (caller.role === 'student' && scope.scopeType === 'cohort') {
      const studentProfile = (caller as IUser).studentProfile;
      if (!studentProfile) return false;

      // Program check
      if (scope.programs && scope.programs.length > 0) {
        if (!studentProfile.program || !scope.programs.includes(studentProfile.program)) {
          return false;
        }
      }

      // Batch year check
      if (scope.batchYears && scope.batchYears.length > 0) {
        const studentBatch = studentProfile.batchYear || studentProfile.admissionYear;
        if (!studentBatch || !scope.batchYears.includes(studentBatch)) {
          return false;
        }
      }

      // Semester check
      if (scope.semesters && scope.semesters.length > 0) {
        if (!studentProfile.currentSemester || !scope.semesters.includes(studentProfile.currentSemester)) {
          return false;
        }
      }

      // Section check
      if (scope.sections && scope.sections.length > 0) {
        if (!studentProfile.section || !scope.sections.includes(studentProfile.section)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Creates a new collegiate notice.
   */
  public static async createNotice(
    callerSession: UserSession,
    input: CreateNoticeInput
  ): Promise<NoticeDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required to create notices.');
    }

    // 1. Authorization validation
    this.validatePublishingAuthority(callerSession, input);

    // 2. Fetch author record
    const authorUser = await UserRepository.findById(callerSession.userId);
    if (!authorUser) {
      throw new NotFoundError('User', callerSession.userId);
    }

    // 3. Resolve department metadata for snapshot
    let deptName: string | null = null;
    let deptCode: string | null = null;
    if (authorUser.departmentId) {
      const dept = await DepartmentRepository.findById(authorUser.departmentId.toString());
      if (dept) {
        deptName = dept.name;
        deptCode = dept.code;
      }
    }

    // 4. Construct Target Scope
    const targetScope: INoticeTargetScope = {
      scopeType: input.targetScope.scopeType,
      departmentIds: input.targetScope.departmentIds?.map((id) => new Types.ObjectId(id)),
      roles: input.targetScope.roles,
      programs: input.targetScope.programs,
      batchYears: input.targetScope.batchYears,
      semesters: input.targetScope.semesters,
      sections: input.targetScope.sections,
      courseCode: input.targetScope.courseCode,
    };

    // If scopeType is department and departmentIds is empty, auto-populate with author's department
    if (
      (targetScope.scopeType === 'department' || targetScope.scopeType === 'cohort') &&
      (!targetScope.departmentIds || targetScope.departmentIds.length === 0) &&
      authorUser.departmentId
    ) {
      targetScope.departmentIds = [authorUser.departmentId];
    }

    const isPublished = input.status === 'published';

    // 5. Persist Notice
    const notice = await NoticeRepository.create({
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      summary: input.summary ?? undefined,
      category: input.category,
      priority: input.priority || 'normal',
      status: input.status || 'draft',
      targetScope,
      authorId: authorUser._id,
      authorSnapshot: {
        name: authorUser.fullName,
        role: authorUser.role,
        adminSubRole: authorUser.adminSubRole ?? null,
        departmentName: deptName,
        departmentCode: deptCode,
      },
      attachments: input.attachments || [],
      isPinned: Boolean(input.isPinned),
      requiresAcknowledgment: Boolean(input.requiresAcknowledgment),
      publishedAt: isPublished ? new Date() : undefined,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      readCount: 0,
      acknowledgmentCount: 0,
      isDeleted: false,
    });

    logger.info(`[NoticeService] Notice created: ${notice._id} by ${callerSession.userId} (${input.status || 'draft'})`);

    return toNoticeDTO(notice, false, false);
  }

  /**
   * Retrieves a notice by ID, verifies audience access, and atomically records a read receipt.
   */
  public static async getNoticeById(
    noticeId: string,
    callerSession: UserSession
  ): Promise<NoticeDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const notice = await NoticeRepository.findById(noticeId);
    if (!notice) {
      throw new NotFoundError('Notice', noticeId);
    }

    // Draft notices are only accessible by their author or SysAdmin
    if (notice.status === 'draft') {
      const isAuthor = notice.authorId.toString() === callerSession.userId;
      const isSystemAdmin = isSysAdmin(callerSession);
      if (!isAuthor && !isSystemAdmin) {
        throw new NotFoundError('Notice', noticeId);
      }
    }

    // Verify audience access
    const callerUser = await UserRepository.findById(callerSession.userId);
    if (!callerUser) {
      throw new NotFoundError('User', callerSession.userId);
    }

    const isAuthorized = this.matchesNoticeAudience(notice, callerUser);
    if (!isAuthorized) {
      throw new ForbiddenError('You do not belong to the target audience for this notice.');
    }

    // Atomically record read receipt for published notices
    let hasRead = false;
    let hasAcknowledged = false;

    if (notice.status === 'published') {
      const existingReceipt = await NoticeRepository.findReceipt(noticeId, callerSession.userId);
      if (!existingReceipt) {
        await NoticeRepository.createOrUpdateReceipt(noticeId, callerSession.userId, false);
        await NoticeRepository.incrementReadCount(noticeId);
        hasRead = true;
      } else {
        hasRead = true;
        hasAcknowledged = Boolean(existingReceipt.acknowledgedAt);
      }
    }

    return toNoticeDTO(notice, hasRead, hasAcknowledged);
  }

  /**
   * Updates an existing notice (author or authorized administrator).
   */
  public static async updateNotice(
    noticeId: string,
    callerSession: UserSession,
    input: UpdateNoticeInput
  ): Promise<NoticeDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const notice = await NoticeRepository.findById(noticeId);
    if (!notice) {
      throw new NotFoundError('Notice', noticeId);
    }

    // Authorization check
    const isAuthor = notice.authorId.toString() === callerSession.userId;
    const isSystemAdmin = isSysAdmin(callerSession);
    const isDeptHOD = isHOD(callerSession) && callerSession.departmentId === notice.authorSnapshot.departmentCode;

    if (!isAuthor && !isSystemAdmin && !isDeptHOD) {
      throw new ForbiddenError('You are not authorized to edit this notice.');
    }

    if (input.targetScope || input.priority) {
      this.validatePublishingAuthority(callerSession, input);
    }

    const updates: Partial<INotice> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.contentMarkdown !== undefined) updates.contentMarkdown = input.contentMarkdown;
    if (input.summary !== undefined) updates.summary = input.summary;
    if (input.category !== undefined) updates.category = input.category;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.attachments !== undefined) updates.attachments = input.attachments;
    if (input.isPinned !== undefined) updates.isPinned = input.isPinned;
    if (input.requiresAcknowledgment !== undefined) updates.requiresAcknowledgment = input.requiresAcknowledgment;
    if (input.expiresAt !== undefined) updates.expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;

    if (input.targetScope) {
      updates.targetScope = {
        scopeType: input.targetScope.scopeType,
        departmentIds: input.targetScope.departmentIds?.map((id) => new Types.ObjectId(id)),
        roles: input.targetScope.roles,
        programs: input.targetScope.programs,
        batchYears: input.targetScope.batchYears,
        semesters: input.targetScope.semesters,
        sections: input.targetScope.sections,
        courseCode: input.targetScope.courseCode,
      };
    }

    const updated = await NoticeRepository.update(noticeId, updates);
    if (!updated) {
      throw new NotFoundError('Notice', noticeId);
    }

    logger.info(`[NoticeService] Notice ${noticeId} updated by ${callerSession.userId}`);

    return toNoticeDTO(updated, true, false);
  }

  /**
   * Publishes a draft notice.
   */
  public static async publishNotice(
    noticeId: string,
    callerSession: UserSession
  ): Promise<NoticeDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const notice = await NoticeRepository.findById(noticeId);
    if (!notice) {
      throw new NotFoundError('Notice', noticeId);
    }

    const isAuthor = notice.authorId.toString() === callerSession.userId;
    const isSystemAdmin = isSysAdmin(callerSession);
    const isDeptHOD = isHOD(callerSession) && callerSession.departmentId === notice.authorSnapshot.departmentCode;

    if (!isAuthor && !isSystemAdmin && !isDeptHOD) {
      throw new ForbiddenError('You are not authorized to publish this notice.');
    }

    const updated = await NoticeRepository.update(noticeId, {
      status: 'published',
      publishedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundError('Notice', noticeId);
    }

    logger.info(`[NoticeService] Notice ${noticeId} published by ${callerSession.userId}`);

    return toNoticeDTO(updated, false, false);
  }

  /**
   * Archives a published notice (indefinite retention, never purged).
   */
  public static async archiveNotice(
    noticeId: string,
    callerSession: UserSession
  ): Promise<NoticeDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const notice = await NoticeRepository.findById(noticeId);
    if (!notice) {
      throw new NotFoundError('Notice', noticeId);
    }

    const isAuthor = notice.authorId.toString() === callerSession.userId;
    const isSystemAdmin = isSysAdmin(callerSession);
    const isDeptHOD = isHOD(callerSession);

    if (!isAuthor && !isSystemAdmin && !isDeptHOD) {
      throw new ForbiddenError('You are not authorized to archive this notice.');
    }

    const updated = await NoticeRepository.update(noticeId, {
      status: 'archived',
    });

    if (!updated) {
      throw new NotFoundError('Notice', noticeId);
    }

    logger.info(`[NoticeService] Notice ${noticeId} archived by ${callerSession.userId}`);

    return toNoticeDTO(updated, false, false);
  }

  /**
   * Soft deletes a notice.
   */
  public static async deleteNotice(
    noticeId: string,
    callerSession: UserSession
  ): Promise<boolean> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const notice = await NoticeRepository.findById(noticeId);
    if (!notice) {
      throw new NotFoundError('Notice', noticeId);
    }

    const isAuthor = notice.authorId.toString() === callerSession.userId;
    const isSystemAdmin = isSysAdmin(callerSession);
    const isDeptHOD = isHOD(callerSession);

    if (!isAuthor && !isSystemAdmin && !isDeptHOD) {
      throw new ForbiddenError('You are not authorized to delete this notice.');
    }

    const deleted = await NoticeRepository.softDelete(noticeId, callerSession.userId);
    logger.info(`[NoticeService] Notice ${noticeId} soft-deleted by ${callerSession.userId}`);
    return deleted;
  }

  /**
   * Records statutory acknowledgment for a notice.
   */
  public static async acknowledgeNotice(
    noticeId: string,
    callerSession: UserSession
  ): Promise<NoticeDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const notice = await NoticeRepository.findById(noticeId);
    if (!notice || notice.status !== 'published') {
      throw new NotFoundError('Notice', noticeId);
    }

    if (!notice.requiresAcknowledgment) {
      throw new ValidationError('This notice does not require formal acknowledgment.');
    }

    const callerUser = await UserRepository.findById(callerSession.userId);
    if (!callerUser || !this.matchesNoticeAudience(notice, callerUser)) {
      throw new ForbiddenError('You do not belong to the target audience for this notice.');
    }

    // Check existing receipt
    const existingReceipt = await NoticeRepository.findReceipt(noticeId, callerSession.userId);
    const wasAlreadyAcknowledged = Boolean(existingReceipt?.acknowledgedAt);

    await NoticeRepository.createOrUpdateReceipt(noticeId, callerSession.userId, true);

    if (!wasAlreadyAcknowledged) {
      await NoticeRepository.incrementAcknowledgmentCount(noticeId);
    }

    logger.info(`[NoticeService] Notice ${noticeId} acknowledged by user ${callerSession.userId}`);

    return toNoticeDTO(notice, true, true);
  }

  /**
   * Fetches personalized notice feed matching caller's audience.
   */
  public static async getNoticeFeed(
    callerSession: UserSession,
    filters: NoticeQueryFilters
  ): Promise<{ notices: NoticeDTO[]; nextCursor: string | null; hasMore: boolean }> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const isSystemAdmin = isSysAdmin(callerSession);
    const isExecDirector = isDirector(callerSession);

    const query: Record<string, unknown> = {};

    // Category filter
    if (filters.category) {
      query.category = filters.category;
    }

    // Priority filter
    if (filters.priority) {
      query.priority = filters.priority;
    }

    // Status filter
    if (filters.status) {
      // Non-authors can only view published or archived
      if (filters.status === 'draft' && !isSystemAdmin) {
        query.authorId = new Types.ObjectId(callerSession.userId);
        query.status = 'draft';
      } else {
        query.status = filters.status;
      }
    } else {
      query.status = 'published';
    }

    // Full-text search filter
    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    // Audience targeting filters (if caller is not SysAdmin/Director)
    if (!isSystemAdmin && !isExecDirector) {
      const orConditions: Record<string, unknown>[] = [
        { 'targetScope.scopeType': 'institution_wide' },
      ];

      if (callerSession.departmentId) {
        orConditions.push({
          'targetScope.departmentIds': new Types.ObjectId(callerSession.departmentId),
        });
      }

      // Role targeting condition
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

    const { notices: rawNotices, nextCursor, hasMore } = await NoticeRepository.findFeed(
      query,
      filters.limit,
      filters.cursor
    );

    // Fetch user read and acknowledgment receipts in a single batch query
    const noticeIds = rawNotices.map((n) => n._id.toString());
    const receiptsMap = await NoticeRepository.findReceiptsForUser(callerSession.userId, noticeIds);

    const notices = rawNotices.map((notice) => {
      const receiptInfo = receiptsMap.get(notice._id.toString());
      return toNoticeDTO(notice, receiptInfo?.hasRead ?? false, receiptInfo?.hasAcknowledged ?? false);
    });

    return {
      notices,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Retrieves read and acknowledgment receipts for an author or administrator.
   */
  public static async getNoticeReceipts(
    noticeId: string,
    callerSession: UserSession,
    limit = 50,
    cursor?: string
  ): Promise<NoticeReceiptStatsDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required.');
    }

    const notice = await NoticeRepository.findById(noticeId);
    if (!notice) {
      throw new NotFoundError('Notice', noticeId);
    }

    const isAuthor = notice.authorId.toString() === callerSession.userId;
    const isSystemAdmin = isSysAdmin(callerSession);
    const isExecDirector = isDirector(callerSession);
    const isDeptHOD = isHOD(callerSession);

    if (!isAuthor && !isSystemAdmin && !isExecDirector && !isDeptHOD) {
      throw new ForbiddenError('You are not authorized to view receipt analytics for this notice.');
    }

    const { receipts: rawReceipts } = await NoticeRepository.findReceiptsByNotice(
      noticeId,
      limit,
      cursor
    );

    // Populate user names safely without leaking passwords or PII
    const userIds = rawReceipts.map((r) => r.userId.toString());
    const users = await UserRepository.findByIds(userIds);
    const userMap = new Map<string, { name: string; role: string }>(
      users.map((u: IUser) => [u._id.toString(), { name: u.fullName, role: u.role }])
    );

    const receipts = rawReceipts.map((r) =>
      toNoticeReceiptDTO(r, userMap.get(r.userId.toString()))
    );

    return {
      noticeId,
      totalReads: notice.readCount,
      totalAcknowledgments: notice.acknowledgmentCount,
      receipts,
    };
  }

  /**
   * Calculates caller's unread published notice count.
   */
  public static async getUnreadCount(callerSession: UserSession): Promise<number> {
    if (!callerSession?.userId) return 0;

    const audienceQuery: Record<string, unknown> = {};

    if (!isSysAdmin(callerSession) && !isDirector(callerSession)) {
      const orConditions: Record<string, unknown>[] = [
        { 'targetScope.scopeType': 'institution_wide' },
      ];

      if (callerSession.departmentId) {
        orConditions.push({
          'targetScope.departmentIds': new Types.ObjectId(callerSession.departmentId),
        });
      }

      audienceQuery.$and = [
        {
          $or: [
            { 'targetScope.roles': { $exists: false } },
            { 'targetScope.roles': { $size: 0 } },
            { 'targetScope.roles': callerSession.role },
          ],
        },
        { $or: orConditions },
      ];
    }

    return NoticeRepository.countUnreadForUser(callerSession.userId, audienceQuery);
  }
}
