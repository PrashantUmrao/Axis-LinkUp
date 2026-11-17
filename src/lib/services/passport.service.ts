/**
 * Skill & Achievement Passport Domain Service (MOD-15 / Phase 5.12).
 * Manages student co-curricular claim submission, single-resubmission lifecycle,
 * faculty/admin SHA-256 cryptographic endorsement, NAAC/NIRF accreditation CSV export,
 * and privacy-preserved public recruiter portfolios.
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import { StudentAchievementRepository } from '@/lib/db/repositories/student-achievement.repository';
import { PassportShareRepository } from '@/lib/db/repositories/passport-share.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import {
  toStudentAchievementDTO,
  toPublicAchievementDTO,
} from '@/lib/db/models/student-achievement.model';
import { toPassportShareDTO } from '@/lib/db/models/passport-share.model';
import { AuditService } from '@/lib/services/audit.service';
import { NotificationService } from '@/lib/services/notification.service';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getPermissionScope, hasPermission } from '@/lib/auth/rbac';
import {
  createAchievementSchema,
  resubmitAchievementSchema,
  verifyAchievementSchema,
  updatePassportShareSchema,
  type AchievementQueryParams,
} from '@/lib/validations/passport.schema';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/app-error';
import {
  ACHIEVEMENT_CATEGORY_POINTS,
  type IAchievementStudentSnapshot,
  type PassportShareDTO,
  type PassportVerificationQueueDTO,
  type PublicPassportDTO,
  type StudentAchievementDTO,
  type StudentPassportResponseDTO,
} from '@/types/passport';
import type { UserSession } from '@/types/user';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class PassportService {
  /**
   * Computes a deterministic SHA-256 cryptographic verification stamp for endorsed claims.
   */
  public static computeVerificationHash(payload: {
    claimCode: string;
    studentId: string;
    title: string;
    issuingOrganization: string;
    issueDate: string;
    verifiedBy: string;
    verifiedAt: string;
  }): string {
    const canonical = JSON.stringify({
      claimCode: payload.claimCode,
      issueDate: payload.issueDate,
      issuingOrganization: payload.issuingOrganization,
      studentId: payload.studentId,
      title: payload.title,
      verifiedAt: payload.verifiedAt,
      verifiedBy: payload.verifiedBy,
    });

    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  private static canSubmitProof(session: UserSession): boolean {
    return hasPermission(
      session.role,
      PERMISSIONS.PASSPORT_SUBMIT_PROOF,
      { ownerId: session.userId },
      { userId: session.userId }
    );
  }

  private static canVerifyClaims(session: UserSession): boolean {
    return getPermissionScope(session.role, PERMISSIONS.PASSPORT_VERIFY_CLAIM) !== 'DENY';
  }

  /* ======================================================================== */
  /* 1. Student Passport Operations                                           */
  /* ======================================================================== */

  /**
   * Submits a new co-curricular achievement claim for faculty verification.
   * Strictly limited to students (PERMISSIONS.PASSPORT_SUBMIT_PROOF).
   */
  public static async submitAchievement(
    session: UserSession,
    rawInput: unknown
  ): Promise<StudentAchievementDTO> {
    if (!this.canSubmitProof(session)) {
      throw new ForbiddenError(
        'Access denied. Only enrolled students may submit Skill & Achievement Passport claims.'
      );
    }

    const parsed = createAchievementSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError('Invalid achievement claim payload', parsed.error.flatten());
    }
    const data = parsed.data;

    // Resolve authoritative student snapshot
    let fullName = session.fullName || 'Axis Student';
    let enrollmentNo = 'ENR-PENDING';
    let department = 'General Academic';
    let branch = 'B.TECH';
    let section = 'A';
    let semester = 1;

    try {
      const userDoc = await UserRepository.findById(session.userId);
      if (userDoc) {
        fullName = userDoc.fullName || fullName;
        enrollmentNo =
          userDoc.studentProfile?.enrollmentNumber ||
          userDoc.studentProfile?.rollNumber ||
          enrollmentNo;
        branch = userDoc.studentProfile?.program || branch;
        section = userDoc.studentProfile?.section || section;
        semester = userDoc.studentProfile?.currentSemester || semester;

        if (userDoc.departmentId) {
          const dept = await DepartmentRepository.findById(userDoc.departmentId.toString());
          if (dept) department = dept.name;
        }
      } else if (session.departmentId) {
        const dept = await DepartmentRepository.findById(session.departmentId);
        if (dept) department = dept.name;
      }
    } catch {
      // Fallback to verified session claims
    }

    const studentSnapshot: IAchievementStudentSnapshot = {
      fullName,
      enrollmentNo,
      department,
      branch,
      section,
      semester,
    };

    const claimCode = await StudentAchievementRepository.getNextClaimCode();
    const pointsWeight = ACHIEVEMENT_CATEGORY_POINTS[data.category];

    const created = await StudentAchievementRepository.create({
      claimCode,
      studentId: new Types.ObjectId(session.userId),
      studentSnapshot,
      category: data.category,
      pointsWeight,
      title: data.title,
      issuingOrganization: data.issuingOrganization,
      issueDate: data.issueDate,
      description: data.description,
      skills: data.skills,
      credentialUrl: data.credentialUrl ?? null,
      proofAttachment: data.proofAttachment ?? null,
      verificationStatus: 'pending',
      resubmissionCount: 0,
      verifiedBy: null,
      verifiedBySnapshot: null,
      verifiedAt: null,
      verificationHash: null,
      reviewRemarks: null,
    });

    return toStudentAchievementDTO(created);
  }

  /**
   * Resubmits a previously rejected achievement claim with updated proof/details.
   * Enforces Single Resubmission Rule: allowed at most ONCE (resubmissionCount < 1).
   * Verified claims are permanently locked.
   */
  public static async resubmitAchievement(
    session: UserSession,
    id: string,
    rawInput: unknown
  ): Promise<StudentAchievementDTO> {
    if (!this.canSubmitProof(session)) {
      throw new ForbiddenError('Only students may resubmit their own achievement claims.');
    }

    const existing = await StudentAchievementRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Achievement claim', id);
    }

    if (existing.studentId.toString() !== session.userId) {
      throw new ForbiddenError('You can only edit or resubmit your own achievement claims.');
    }

    if (existing.verificationStatus === 'verified') {
      throw new BadRequestError(
        'Verified achievements are cryptographically stamped and permanently locked against edits.'
      );
    }

    if (existing.verificationStatus !== 'rejected') {
      throw new BadRequestError(
        'Only rejected achievement claims may be resubmitted with updated evidence.'
      );
    }

    if (existing.resubmissionCount >= 1) {
      throw new BadRequestError(
        'Resubmission limit reached: each rejected achievement claim may only be resubmitted once.'
      );
    }

    const parsed = resubmitAchievementSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError('Invalid resubmission payload', parsed.error.flatten());
    }
    const data = parsed.data;

    const updated = await StudentAchievementRepository.updateClaim(id, {
      category: data.category,
      pointsWeight: ACHIEVEMENT_CATEGORY_POINTS[data.category],
      title: data.title,
      issuingOrganization: data.issuingOrganization,
      issueDate: data.issueDate,
      description: data.description,
      skills: data.skills,
      credentialUrl: data.credentialUrl ?? null,
      proofAttachment: data.proofAttachment ?? null,
      verificationStatus: 'pending',
      resubmissionCount: existing.resubmissionCount + 1,
      reviewRemarks: null,
      verificationHash: null,
    });

    if (!updated) {
      throw new NotFoundError('Achievement claim', id);
    }

    return toStudentAchievementDTO(updated);
  }

  /**
   * Withdraws/deletes a student's own unverified pending claim.
   * Strictly prohibits deleting verified or already-reviewed claims.
   */
  public static async deleteOwnPendingAchievement(
    session: UserSession,
    id: string
  ): Promise<{ deleted: true; id: string }> {
    if (!this.canSubmitProof(session)) {
      throw new ForbiddenError('Only students may withdraw their pending achievement claims.');
    }

    const existing = await StudentAchievementRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Achievement claim', id);
    }

    if (existing.studentId.toString() !== session.userId) {
      throw new ForbiddenError('You can only withdraw your own pending achievement claims.');
    }

    if (existing.verificationStatus === 'verified') {
      throw new BadRequestError(
        'Verified achievements are permanently sealed and cannot be deleted.'
      );
    }

    if (existing.verificationStatus !== 'pending') {
      throw new BadRequestError(
        'Only pending claims awaiting faculty review can be withdrawn.'
      );
    }

    await StudentAchievementRepository.deleteClaim(id);
    return { deleted: true, id };
  }

  /**
   * Retrieves a student's complete Skill & Achievement Passport, stats, and share settings.
   */
  public static async getStudentPassport(
    session: UserSession,
    query: Partial<AchievementQueryParams> = {}
  ): Promise<StudentPassportResponseDTO> {
    if (session.role !== 'student' && session.role !== 'super_admin') {
      throw new ForbiddenError('Only students may access their personal Skill Passport workspace.');
    }

    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
    if (query.search && query.search.trim()) {
      const term = escapeRegex(query.search.trim());
      filter.$or = [
        { claimCode: { $regex: term, $options: 'i' } },
        { title: { $regex: term, $options: 'i' } },
        { issuingOrganization: { $regex: term, $options: 'i' } },
        { skills: { $regex: term, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 25;

    const [{ achievements, total }, stats, shareDoc] = await Promise.all([
      StudentAchievementRepository.findByStudent(session.userId, filter, page, limit),
      StudentAchievementRepository.getStudentSummaryStats(session.userId),
      PassportShareRepository.upsertByStudentId(session.userId, {}),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      achievements: achievements.map(toStudentAchievementDTO),
      stats,
      share: toPassportShareDTO(shareDoc),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Retrieves a single achievement claim (strictly author or authorized verifier).
   */
  public static async getAchievementById(
    session: UserSession,
    id: string
  ): Promise<StudentAchievementDTO> {
    const claim = await StudentAchievementRepository.findById(id);
    if (!claim) {
      throw new NotFoundError('Achievement claim', id);
    }

    if (session.role === 'student') {
      if (claim.studentId.toString() !== session.userId) {
        throw new ForbiddenError('You are not authorized to inspect another student’s claim.');
      }
    } else if (session.role === 'admin' && session.departmentId) {
      const dept = await DepartmentRepository.findById(session.departmentId);
      if (dept && claim.studentSnapshot.department !== dept.name) {
        throw new ForbiddenError(
          'Departmental isolation: you cannot inspect claims outside your assigned department.'
        );
      }
    } else if (!this.canVerifyClaims(session)) {
      throw new ForbiddenError('Unauthorized access to achievement claim.');
    }

    return toStudentAchievementDTO(claim);
  }

  /**
   * Retrieves or updates a student's public recruiter portfolio share settings.
   */
  public static async getShareSettings(session: UserSession): Promise<PassportShareDTO> {
    if (!this.canSubmitProof(session)) {
      throw new ForbiddenError('Only students may manage their public passport link.');
    }
    const shareDoc = await PassportShareRepository.upsertByStudentId(session.userId, {});
    return toPassportShareDTO(shareDoc);
  }

  public static async updateShareSettings(
    session: UserSession,
    rawInput: unknown
  ): Promise<PassportShareDTO> {
    if (!this.canSubmitProof(session)) {
      throw new ForbiddenError('Only students may manage their public passport link.');
    }

    const parsed = updatePassportShareSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError('Invalid passport share settings', parsed.error.flatten());
    }

    const updated = await PassportShareRepository.upsertByStudentId(session.userId, {
      isEnabled: parsed.data.isEnabled,
      headline: parsed.data.headline,
      rotateToken: parsed.data.rotateToken,
    });

    return toPassportShareDTO(updated);
  }

  /* ======================================================================== */
  /* 2. Faculty & Admin Endorsement Pipeline                                  */
  /* ======================================================================== */

  private static async buildVerifierScopedFilter(
    session: UserSession,
    query: Partial<AchievementQueryParams> = {}
  ): Promise<Record<string, unknown>> {
    if (!this.canVerifyClaims(session)) {
      throw new ForbiddenError(
        'Access denied. Only faculty and administrators may access the passport verification queue.'
      );
    }

    const filter: Record<string, unknown> = {};

    if (session.role === 'admin' && session.departmentId) {
      const dept = await DepartmentRepository.findById(session.departmentId);
      if (dept) {
        filter['studentSnapshot.department'] = dept.name;
      }
    } else if (session.role === 'faculty' && session.departmentId) {
      const dept = await DepartmentRepository.findById(session.departmentId);
      if (dept) {
        filter['studentSnapshot.department'] = dept.name;
      }
    } else if (session.role === 'super_admin' && query.department && query.department.trim()) {
      filter['studentSnapshot.department'] = {
        $regex: escapeRegex(query.department.trim()),
        $options: 'i',
      };
    }

    if (query.category) filter.category = query.category;
    if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;

    if (query.search && query.search.trim()) {
      const term = escapeRegex(query.search.trim());
      filter.$or = [
        { claimCode: { $regex: term, $options: 'i' } },
        { title: { $regex: term, $options: 'i' } },
        { issuingOrganization: { $regex: term, $options: 'i' } },
        { 'studentSnapshot.fullName': { $regex: term, $options: 'i' } },
        { 'studentSnapshot.enrollmentNo': { $regex: term, $options: 'i' } },
      ];
    }

    return filter;
  }

  /**
   * Lists the department/role-scoped student achievement verification queue.
   */
  public static async listVerificationQueue(
    session: UserSession,
    query: Partial<AchievementQueryParams> = {}
  ): Promise<PassportVerificationQueueDTO> {
    const filter = await this.buildVerifierScopedFilter(session, query);
    const page = query.page || 1;
    const limit = query.limit || 25;

    // Stats scope excludes status filter so tab counters remain accurate
    const statsFilter = { ...filter };
    delete statsFilter.verificationStatus;

    const [{ achievements, total }, stats] = await Promise.all([
      StudentAchievementRepository.findForVerificationQueue(filter, page, limit),
      StudentAchievementRepository.getVerificationQueueStats(statsFilter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      achievements: achievements.map(toStudentAchievementDTO),
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Endorses (verify + SHA-256 stamp) or rejects a pending student achievement claim.
   */
  public static async verifyOrRejectAchievement(
    session: UserSession,
    id: string,
    rawInput: unknown
  ): Promise<StudentAchievementDTO> {
    if (!this.canVerifyClaims(session)) {
      throw new ForbiddenError(
        'Access denied. Only faculty and administrators may verify or reject passport claims.'
      );
    }

    const parsed = verifyAchievementSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError('Invalid verification decision payload', parsed.error.flatten());
    }
    const { decision, remarks } = parsed.data;

    const claim = await StudentAchievementRepository.findById(id);
    if (!claim) {
      throw new NotFoundError('Achievement claim', id);
    }

    // Departmental isolation for admin
    let verifierDeptName: string | null = null;
    if (session.departmentId) {
      try {
        const dept = await DepartmentRepository.findById(session.departmentId);
        if (dept) verifierDeptName = dept.name;
      } catch {
        // Fallback
      }
    }

    if (
      session.role === 'admin' &&
      verifierDeptName &&
      claim.studentSnapshot.department !== verifierDeptName
    ) {
      throw new ForbiddenError(
        'Departmental isolation: Administrators may only verify claims from their own department.'
      );
    }

    if (claim.verificationStatus !== 'pending') {
      throw new BadRequestError(
        `Only pending claims can be reviewed (current status: '${claim.verificationStatus}').`
      );
    }

    const verifiedAt = new Date();
    const verifiedBySnapshot = {
      fullName: session.fullName || 'Axis Faculty Verifier',
      role: session.role,
      department: verifierDeptName,
    };

    let verificationHash: string | null = null;
    if (decision === 'verify') {
      verificationHash = this.computeVerificationHash({
        claimCode: claim.claimCode,
        studentId: claim.studentId.toString(),
        title: claim.title,
        issuingOrganization: claim.issuingOrganization,
        issueDate:
          claim.issueDate instanceof Date
            ? claim.issueDate.toISOString()
            : String(claim.issueDate),
        verifiedBy: session.userId,
        verifiedAt: verifiedAt.toISOString(),
      });
    }

    const nextStatus = decision === 'verify' ? 'verified' : 'rejected';

    const updated = await StudentAchievementRepository.updateClaim(id, {
      verificationStatus: nextStatus,
      verifiedBy: new Types.ObjectId(session.userId),
      verifiedBySnapshot,
      verifiedAt,
      verificationHash,
      reviewRemarks: remarks ? remarks.trim() : null,
    });

    if (!updated) {
      throw new NotFoundError('Achievement claim', id);
    }

    const dto = toStudentAchievementDTO(updated);

    // Non-blocking Ably notification to student
    try {
      const studentChannel = AblyBroker.getUserNotificationChannel(dto.studentId);
      await AblyBroker.publish(studentChannel, 'passport.claim.reviewed', {
        claimId: dto.id,
        claimCode: dto.claimCode,
        title: dto.title,
        verificationStatus: dto.verificationStatus,
        pointsWeight: dto.pointsWeight,
        remarks: dto.reviewRemarks,
        reviewedAt: verifiedAt.toISOString(),
      });
    } catch {
      // Non-blocking
    }

    // Unified Notification Center persistent hook (non-blocking)
    await NotificationService.safeDispatchCrossModule({
      userId: dto.studentId,
      title: `Skill Passport Claim ${dto.claimCode} ${decision === 'verify' ? 'Verified' : 'Rejected'}`,
      message:
        decision === 'verify'
          ? `Your achievement "${dto.title}" was verified (+${dto.pointsWeight} points).`
          : `Your achievement "${dto.title}" was rejected. Review remarks to resubmit proof.`,
      category: 'passport',
      priority: decision === 'reject' ? 'high' : 'normal',
      linkUrl: '/student/passport',
      dedupeKey: `passport:${dto.id}:${nextStatus}`,
      metadata: { claimCode: dto.claimCode, status: nextStatus },
    });

    // Non-blocking immutable AuditLog recording (Phase 5.10 integration)
    try {
      await AuditService.recordEvent({
        actorId: session.userId,
        actorSnapshot: {
          fullName: verifiedBySnapshot.fullName,
          email: session.email,
          role: session.role,
          department: verifierDeptName,
        },
        action: decision === 'verify' ? 'PASSPORT_CLAIM_VERIFIED' : 'PASSPORT_CLAIM_REJECTED',
        module: 'SYSTEM',
        severity: 'info',
        targetEntityType: 'StudentAchievement',
        targetEntityId: dto.id,
        targetLabel: `${dto.claimCode} — ${dto.title}`,
        department: dto.studentSnapshot.department,
        oldState: { verificationStatus: 'pending' },
        newState: {
          verificationStatus: dto.verificationStatus,
          pointsWeight: dto.pointsWeight,
          verificationHash: dto.verificationHash,
        },
        reason: dto.reviewRemarks || `Achievement claim ${nextStatus} by ${verifiedBySnapshot.fullName}`,
      });
    } catch {
      // Non-blocking audit hook
    }

    return dto;
  }

  /* ======================================================================== */
  /* 3. NAAC / NIRF Accreditation CSV Export                                  */
  /* ======================================================================== */

  /**
   * Exports strictly VERIFIED student achievements as a formula-injection-safe CSV.
   * Restricted exclusively to admin (department-scoped) and super_admin (global).
   */
  public static async exportVerifiedAchievementsCsv(
    session: UserSession,
    query: Partial<AchievementQueryParams> = {}
  ): Promise<{ contentType: string; filename: string; body: string; count: number }> {
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw new ForbiddenError(
        'Access denied. NAAC/NIRF accreditation exports are restricted to Administrators and Super Administrators.'
      );
    }

    const filter = await this.buildVerifierScopedFilter(session, {
      ...query,
      verificationStatus: 'verified',
    });
    // Force verified-only unconditionally
    filter.verificationStatus = 'verified';

    const { achievements } = await StudentAchievementRepository.findForVerificationQueue(
      filter,
      1,
      1000
    );

    const dtos = achievements.map(toStudentAchievementDTO);
    const headers = [
      'claimCode',
      'studentName',
      'enrollmentNo',
      'department',
      'branch',
      'semester',
      'category',
      'pointsWeight',
      'title',
      'issuingOrganization',
      'issueDate',
      'skills',
      'verifiedBy',
      'verifiedAt',
      'verificationHash',
    ];

    const rows = dtos.map((a) =>
      [
        a.claimCode,
        a.studentSnapshot.fullName,
        a.studentSnapshot.enrollmentNo,
        a.studentSnapshot.department,
        a.studentSnapshot.branch,
        a.studentSnapshot.semester,
        a.category,
        a.pointsWeight,
        a.title,
        a.issuingOrganization,
        a.issueDate.slice(0, 10),
        a.skills.join('; '),
        a.verifiedBySnapshot?.fullName || '',
        a.verifiedAt || '',
        a.verificationHash || '',
      ]
        .map((cell) => AuditService.escapeCsvCell(cell))
        .join(',')
    );

    const dateStamp = new Date().toISOString().slice(0, 10);
    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `axis-linkup-verified-passport-naac-${dateStamp}.csv`,
      body: [headers.join(','), ...rows].join('\n'),
      count: dtos.length,
    };
  }

  /* ======================================================================== */
  /* 4. Public Recruiter Verification Portfolio                               */
  /* ======================================================================== */

  /**
   * Resolves a public recruiter portfolio by revocable shareToken.
   * Returns 404 if token does not exist or is disabled.
   * Strictly exposes ONLY verified achievements and safe public student profile fields.
   */
  public static async getPublicPassportByToken(shareToken: string): Promise<PublicPassportDTO> {
    const share = await PassportShareRepository.findByShareToken(shareToken);
    if (!share || !share.isEnabled) {
      throw new NotFoundError('Public Skill Passport', shareToken);
    }

    const [updatedShare, verifiedRes, studentDoc] = await Promise.all([
      PassportShareRepository.incrementViewCount(shareToken).catch(() => share),
      StudentAchievementRepository.findByStudent(
        share.studentId.toString(),
        { verificationStatus: 'verified' },
        1,
        200
      ),
      UserRepository.findById(share.studentId.toString()).catch(() => null),
    ]);

    const verifiedOnly = verifiedRes.achievements.filter(
      (a) => a.verificationStatus === 'verified'
    );
    const publicAchievements = verifiedOnly.map(toPublicAchievementDTO);

    // Derive safe public student header (NEVER include email, phone, or internal secrets)
    const firstSnap = verifiedOnly[0]?.studentSnapshot;
    let departmentName = firstSnap?.department || 'Axis Colleges';
    if (studentDoc?.departmentId) {
      try {
        const dept = await DepartmentRepository.findById(studentDoc.departmentId.toString());
        if (dept) departmentName = dept.name;
      } catch {
        // Fallback
      }
    }

    const totalVerifiedPoints = publicAchievements.reduce((sum, a) => sum + a.pointsWeight, 0);
    const skillSet = new Set<string>();
    publicAchievements.forEach((a) => a.skills.forEach((s) => skillSet.add(s)));

    return {
      shareToken: share.shareToken,
      headline: share.headline ?? null,
      viewCount: updatedShare?.viewCount ?? share.viewCount + 1,
      student: {
        fullName: studentDoc?.fullName || firstSnap?.fullName || 'Axis Colleges Student',
        department: departmentName,
        branch: studentDoc?.studentProfile?.program || firstSnap?.branch || 'B.TECH',
        semester: studentDoc?.studentProfile?.currentSemester || firstSnap?.semester || 1,
      },
      totalVerifiedPoints,
      verifiedCount: publicAchievements.length,
      skills: Array.from(skillSet),
      achievements: publicAchievements,
      generatedAt: new Date().toISOString(),
    };
  }
}
