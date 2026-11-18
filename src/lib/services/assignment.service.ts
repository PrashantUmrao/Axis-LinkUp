/**
 * Assignment Management Domain Service (Phase 5.7).
 * Conforms to Axis LinkUp Core Architecture, ADR-007, and Phase 5.7 Specification.
 *
 * Enforces:
 * 1. Strict Attribute-Based Access Control (ABAC) and Server-Side Role-Based Access Control (RBAC).
 * 2. Faculty course assignment verification (faculty can only create assignments for authorized courses).
 * 3. Cohort-targeted student visibility and peer-isolated submission storage.
 * 4. Strict server-side due date, late cutoff, and resubmission policy enforcement.
 * 5. Evaluation grading bounded by maximum marks with audit history preservation.
 * 6. Cloudinary signed upload generation with graceful mock/offline fallback.
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { AssignmentRepository } from '@/lib/db/repositories/assignment.repository';
import { SubmissionRepository } from '@/lib/db/repositories/submission.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { toAssignmentDTO } from '@/lib/db/models/assignment.model';
import { toSubmissionDTO } from '@/lib/db/models/submission.model';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { logger } from '@/lib/logging/logger';
import type { UserSession, IUser } from '@/types/user';
import type {
  IAssignment,
  ISubmission,
  AssignmentDTO,
  SubmissionDTO,
  PaginatedAssignmentsDTO,
  PaginatedSubmissionsDTO,
  IAssignmentAttachmentSubdoc,
  UserSubmissionSummaryDTO,
} from '@/types/assignment';
import type {
  CreateAssignmentInput,
  UpdateAssignmentInput,
  SubmitAssignmentInput,
  EvaluateSubmissionInput,
  AssignmentFilterInput,
  SubmissionFilterInput,
} from '@/lib/validations/assignment.schema';
import {
  AppError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
} from '@/lib/errors/app-error';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';

export const ALLOWED_UPLOAD_SCOPES = ['assignments', 'complaints', 'requests'] as const;
export type UploadScope = (typeof ALLOWED_UPLOAD_SCOPES)[number];

export const ALLOWED_UPLOAD_FORMATS =
  'pdf,doc,docx,ppt,pptx,xls,xlsx,txt,zip,rar,7z,png,jpg,jpeg,webp';
export const MAX_UPLOAD_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export class AssignmentService {
  /* ======================================================================== */
  /* Internal Session & Scope Assertions                                      */
  /* ======================================================================== */

  private static assertActiveSession(session: UserSession | null): asserts session is UserSession {
    if (!session || !session.userId) {
      throw new UnauthorizedError('Authentication session required to access coursework services.');
    }
    if (session.status === 'suspended' || session.status === 'deactivated') {
      throw new ForbiddenError('Account is inactive or suspended. Coursework access revoked.');
    }
  }

  private static async ensureDatabase(): Promise<void> {
    if (process.env.MONGODB_URI) {
      try {
        await connectToDatabase();
      } catch (err) {
        logger.warn('[AssignmentService] Database connection skipped or failed:', {
          error: String(err),
        });
      }
    }
  }

  /**
   * Asserts whether a faculty or administrative caller is authorized to create/manage
   * an assignment for the specified course and department.
   */
  public static async assertFacultyCourseAuthorization(
    callerSession: UserSession,
    departmentId: string,
    courseCode: string
  ): Promise<{ authorUser: IUser; departmentCode: string; departmentName: string }> {
    this.assertActiveSession(callerSession);
    await this.ensureDatabase();

    // 1. Students can never create or manage assignments
    if (callerSession.role === 'student') {
      throw new ForbiddenError('Students are strictly unauthorized to create or manage coursework.');
    }

    // 2. Fetch author record with facultyProfile
    const authorUser = await UserRepository.findById(callerSession.userId);
    if (!authorUser) {
      throw new NotFoundError('User', callerSession.userId);
    }

    // 3. Fetch Department details
    const department = await DepartmentRepository.findById(departmentId);
    if (!department) {
      throw new NotFoundError('Department', departmentId);
    }

    const isSystemAdmin =
      callerSession.role === 'super_admin' &&
      (callerSession.adminSubRole === 'sys_admin' || !callerSession.adminSubRole);
    const isDirector =
      callerSession.role === 'super_admin' && callerSession.adminSubRole === 'director';

    // System Admins and Executive Directors have institutional governance oversight
    if (isSystemAdmin || isDirector) {
      return {
        authorUser,
        departmentCode: department.code,
        departmentName: department.name,
      };
    }

    const callerDeptId = callerSession.departmentId?.toString();
    const targetDeptId = department._id.toString();

    // 4. Department HOD Boundaries
    const isDeptHOD =
      (callerSession.role === 'admin' || callerSession.adminSubRole === 'hod') &&
      callerDeptId === targetDeptId;

    if (isDeptHOD) {
      return {
        authorUser,
        departmentCode: department.code,
        departmentName: department.name,
      };
    }

    // 5. Faculty Member Teaching Scope Boundaries
    if (callerSession.role === 'faculty') {
      // Must belong to the department
      if (callerDeptId !== targetDeptId) {
        throw new ForbiddenError(
          'Faculty members cannot create assignments for another academic department.'
        );
      }

      // Must be authorized to teach this course
      const assigned = authorUser.facultyProfile?.assignedCourses || [];
      const normalizedTarget = courseCode.replace(/[-\s]/g, '').toUpperCase();

      const isCourseAssigned = assigned.some((c) => {
        const str = String(c).replace(/[-\s]/g, '').toUpperCase();
        return str === normalizedTarget || str === courseCode.toUpperCase();
      });

      if (!isCourseAssigned && assigned.length > 0) {
        throw new ForbiddenError(
          `You are not authorized to create assignments for course ${courseCode}. It is not in your assigned teaching roster.`
        );
      }

      return {
        authorUser,
        departmentCode: department.code,
        departmentName: department.name,
      };
    }

    throw new ForbiddenError('Insufficient permissions to manage assignments for this department.');
  }

  /* ======================================================================== */
  /* Assignment Lifecycle Management (Faculty & HOD)                          */
  /* ======================================================================== */

  /**
   * Creates a new coursework assignment in draft or published state.
   */
  public static async createAssignment(
    session: UserSession | null,
    input: CreateAssignmentInput
  ): Promise<AssignmentDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const { authorUser, departmentCode, departmentName } =
      await this.assertFacultyCourseAuthorization(
        session,
        input.departmentId,
        input.courseCode
      );

    const isPublished = input.status === 'published';
    const publishedAt = isPublished ? new Date() : undefined;
    const dueDate = new Date(input.dueDate);

    // Map attachments
    const attachments: IAssignmentAttachmentSubdoc[] = (input.attachments || []).map((a) => ({
      name: a.name,
      url: a.url,
      sizeBytes: a.sizeBytes,
      mimeType: a.mimeType,
      publicId: a.publicId || null,
      uploadedAt: new Date(),
    }));

    const assignment = await AssignmentRepository.create({
      title: input.title,
      description: input.description,
      instructions: input.instructions,
      courseCode: input.courseCode.toUpperCase(),
      courseName: input.courseName,
      departmentId: new Types.ObjectId(input.departmentId),
      academicTarget: {
        program: input.academicTarget.program,
        year: input.academicTarget.year,
        semester: input.academicTarget.semester,
        section: input.academicTarget.section,
        batchYear: input.academicTarget.batchYear,
      },
      createdBy: authorUser._id,
      creatorSnapshot: {
        fullName: authorUser.fullName,
        role: authorUser.role,
        employeeId: authorUser.facultyProfile?.employeeId,
        avatarUrl: authorUser.avatarUrl ?? undefined,
      },
      attachments,
      publishedAt,
      dueDate,
      maxMarks: input.maxMarks,
      lateSubmissionPolicy: {
        allowLate: input.lateSubmissionPolicy?.allowLate ?? false,
        lateDueDate: input.lateSubmissionPolicy?.lateDueDate
          ? new Date(input.lateSubmissionPolicy.lateDueDate)
          : null,
        penaltyPercentagePerDay: input.lateSubmissionPolicy?.penaltyPercentagePerDay || 0,
      },
      allowResubmission: input.allowResubmission,
      maxResubmissions: input.maxResubmissions,
      status: input.status,
    });

    logger.info(
      `[AssignmentService] Assignment ${assignment._id} created by ${session.userId} in status '${assignment.status}'`
    );

    return toAssignmentDTO(assignment, {
      submissionCount: 0,
      gradedCount: 0,
      departmentCode,
      departmentName,
    });
  }

  /**
   * Retrieves an assignment by ID with role-based access checking.
   */
  public static async getAssignmentById(
    session: UserSession | null,
    assignmentId: string
  ): Promise<AssignmentDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    const dept = await DepartmentRepository.findById(assignment.departmentId.toString());

    // 1. Student Access Scope
    if (session.role === 'student') {
      if (assignment.status === 'draft') {
        throw new NotFoundError('Assignment', assignmentId);
      }

      const isTargeted = await this.isStudentTargeted(session, assignment);
      if (!isTargeted) {
        throw new ForbiddenError('You are not authorized to access this assignment.');
      }

      // Check student's submission
      const userSubmission = await SubmissionRepository.findByAssignmentAndStudent(
        assignmentId,
        session.userId
      );

      let submissionSummary: UserSubmissionSummaryDTO | null = null;
      if (userSubmission) {
        submissionSummary = {
          id: userSubmission._id.toString(),
          status: userSubmission.status,
          submittedAt: new Date(userSubmission.submittedAt).toISOString(),
          isLate: userSubmission.isLate,
          version: userSubmission.version,
          isGraded: userSubmission.evaluation.isGraded,
          marksObtained:
            userSubmission.evaluation.isGraded && userSubmission.evaluation.marksObtained != null
              ? userSubmission.evaluation.marksObtained
              : undefined,
          feedback:
            userSubmission.evaluation.isGraded && userSubmission.evaluation.feedback != null
              ? userSubmission.evaluation.feedback
              : undefined,
        };
      }

      return toAssignmentDTO(assignment, {
        departmentCode: dept?.code,
        departmentName: dept?.name,
        userSubmission: submissionSummary,
      });
    }

    // 2. Faculty / Admin Access Scope
    const isAuthor = assignment.createdBy.toString() === session.userId;
    const isDeptHOD =
      (session.role === 'admin' || session.adminSubRole === 'hod') &&
      session.departmentId?.toString() === assignment.departmentId.toString();
    const isDirectorOrAdmin =
      session.role === 'super_admin' &&
      (session.adminSubRole === 'director' || session.adminSubRole === 'sys_admin' || !session.adminSubRole);

    if (!isAuthor && !isDeptHOD && !isDirectorOrAdmin) {
      // If faculty member in another department, reject
      if (session.departmentId?.toString() !== assignment.departmentId.toString()) {
        throw new ForbiddenError('Access clearance denied for assignments in another department.');
      }
    }

    const [submissionCount, gradedCount] = await Promise.all([
      AssignmentRepository.countSubmissions(assignmentId),
      AssignmentRepository.countGradedSubmissions(assignmentId),
    ]);

    return toAssignmentDTO(assignment, {
      submissionCount,
      gradedCount,
      departmentCode: dept?.code,
      departmentName: dept?.name,
    });
  }

  /**
   * Updates an assignment (Author or Department HOD).
   */
  public static async updateAssignment(
    session: UserSession | null,
    assignmentId: string,
    input: UpdateAssignmentInput
  ): Promise<AssignmentDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    this.assertAssignmentOwnerOrHOD(session, assignment);

    if (assignment.status === 'archived') {
      throw new BadRequestError('Archived assignments cannot be modified.');
    }

    // Rule: Maximum marks cannot be altered if any submission has already been graded
    if (input.maxMarks !== undefined && input.maxMarks !== assignment.maxMarks) {
      const gradedCount = await AssignmentRepository.countGradedSubmissions(assignmentId);
      if (gradedCount > 0) {
        throw new BadRequestError(
          'Maximum marks cannot be modified because submissions have already been graded.'
        );
      }
    }

    const updates: Partial<IAssignment> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.instructions !== undefined) updates.instructions = input.instructions;
    if (input.courseCode !== undefined) updates.courseCode = input.courseCode.toUpperCase();
    if (input.courseName !== undefined) updates.courseName = input.courseName;
    if (input.academicTarget !== undefined) {
      updates.academicTarget = {
        ...assignment.academicTarget,
        ...input.academicTarget,
      };
    }
    if (input.dueDate !== undefined) updates.dueDate = new Date(input.dueDate);
    if (input.maxMarks !== undefined) updates.maxMarks = input.maxMarks;
    if (input.lateSubmissionPolicy !== undefined) {
      updates.lateSubmissionPolicy = {
        allowLate: input.lateSubmissionPolicy.allowLate ?? assignment.lateSubmissionPolicy.allowLate,
        lateDueDate: input.lateSubmissionPolicy.lateDueDate
          ? new Date(input.lateSubmissionPolicy.lateDueDate)
          : assignment.lateSubmissionPolicy.lateDueDate,
        penaltyPercentagePerDay:
          input.lateSubmissionPolicy.penaltyPercentagePerDay ??
          assignment.lateSubmissionPolicy.penaltyPercentagePerDay,
      };
    }
    if (input.allowResubmission !== undefined) updates.allowResubmission = input.allowResubmission;
    if (input.maxResubmissions !== undefined) updates.maxResubmissions = input.maxResubmissions;
    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === 'published' && !assignment.publishedAt) {
        updates.publishedAt = new Date();
      }
    }
    if (input.attachments !== undefined) {
      updates.attachments = input.attachments.map((a) => ({
        name: a.name,
        url: a.url,
        sizeBytes: a.sizeBytes,
        mimeType: a.mimeType,
        publicId: a.publicId || null,
        uploadedAt: new Date(),
      }));
    }

    const updated = await AssignmentRepository.update(assignmentId, updates);
    if (!updated) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    logger.info(`[AssignmentService] Assignment ${assignmentId} updated by ${session.userId}`);

    const [submissionCount, gradedCount] = await Promise.all([
      AssignmentRepository.countSubmissions(assignmentId),
      AssignmentRepository.countGradedSubmissions(assignmentId),
    ]);

    return toAssignmentDTO(updated, { submissionCount, gradedCount });
  }

  /**
   * Publishes a draft assignment.
   */
  public static async publishAssignment(
    session: UserSession | null,
    assignmentId: string
  ): Promise<AssignmentDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    this.assertAssignmentOwnerOrHOD(session, assignment);

    if (assignment.status !== 'draft') {
      throw new BadRequestError(`Only draft assignments can be published. Current status: ${assignment.status}`);
    }

    const updated = await AssignmentRepository.update(assignmentId, {
      status: 'published',
      publishedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    logger.info(`[AssignmentService] Assignment ${assignmentId} published by ${session.userId}`);

    return toAssignmentDTO(updated, { submissionCount: 0, gradedCount: 0 });
  }

  /**
   * Closes a published assignment (stops normal submissions).
   */
  public static async closeAssignment(
    session: UserSession | null,
    assignmentId: string
  ): Promise<AssignmentDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    this.assertAssignmentOwnerOrHOD(session, assignment);

    if (assignment.status !== 'published') {
      throw new BadRequestError(`Only published assignments can be closed. Current status: ${assignment.status}`);
    }

    const updated = await AssignmentRepository.update(assignmentId, {
      status: 'closed',
    });

    if (!updated) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    logger.info(`[AssignmentService] Assignment ${assignmentId} closed by ${session.userId}`);

    const [submissionCount, gradedCount] = await Promise.all([
      AssignmentRepository.countSubmissions(assignmentId),
      AssignmentRepository.countGradedSubmissions(assignmentId),
    ]);

    return toAssignmentDTO(updated, { submissionCount, gradedCount });
  }

  /**
   * Archives an assignment.
   */
  public static async archiveAssignment(
    session: UserSession | null,
    assignmentId: string
  ): Promise<AssignmentDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    this.assertAssignmentOwnerOrHOD(session, assignment);

    const updated = await AssignmentRepository.update(assignmentId, {
      status: 'archived',
    });

    if (!updated) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    logger.info(`[AssignmentService] Assignment ${assignmentId} archived by ${session.userId}`);

    return toAssignmentDTO(updated);
  }

  /**
   * Permanently deletes an assignment (only permitted for drafts with 0 submissions).
   */
  public static async deleteAssignment(
    session: UserSession | null,
    assignmentId: string
  ): Promise<{ success: boolean; message: string }> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    this.assertAssignmentOwnerOrHOD(session, assignment);

    if (assignment.status !== 'draft') {
      throw new BadRequestError('Only draft assignments can be deleted. Use archive for published/closed coursework.');
    }

    const submissionsCount = await AssignmentRepository.countSubmissions(assignmentId);
    if (submissionsCount > 0) {
      throw new BadRequestError('Cannot delete assignment with existing student submissions.');
    }

    await AssignmentRepository.delete(assignmentId);
    logger.info(`[AssignmentService] Assignment ${assignmentId} deleted by ${session.userId}`);

    return { success: true, message: 'Draft assignment deleted successfully.' };
  }

  /**
   * Lists assignments based on role context and query filters.
   */
  public static async getAssignments(
    session: UserSession | null,
    filters: AssignmentFilterInput
  ): Promise<PaginatedAssignmentsDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const query: Record<string, unknown> = {};

    // 1. Role Scope Routing
    if (session.role === 'student') {
      // Students can only see published or closed coursework in their academic cohort
      const studentUser = await UserRepository.findById(session.userId);
      if (!studentUser || !studentUser.studentProfile) {
        return { assignments: [], hasMore: false };
      }

      query.status = filters.status
        ? { $in: [filters.status].filter((s) => s === 'published' || s === 'closed') }
        : { $in: ['published', 'closed'] };

      query.departmentId = studentUser.departmentId;
      query['academicTarget.semester'] = studentUser.studentProfile.currentSemester;

      if (studentUser.studentProfile.section) {
        query.$or = [
          { 'academicTarget.section': studentUser.studentProfile.section },
          { 'academicTarget.section': 'ALL' },
          { 'academicTarget.section': null },
          { 'academicTarget.section': { $exists: false } },
        ];
      }
    } else if (session.role === 'faculty') {
      // Faculty members see their authored assignments, or filter by their department
      const callerDeptId = session.departmentId?.toString();
      if (filters.departmentId && filters.departmentId !== callerDeptId) {
        throw new ForbiddenError('Faculty cannot view coursework of other departments.');
      }

      query.departmentId = session.departmentId;
      if (filters.status) {
        query.status = filters.status;
      }
      // If author-specific filter requested
      if (filters.courseCode) {
        query.courseCode = filters.courseCode.toUpperCase();
      }
    } else if (session.role === 'admin' || session.adminSubRole === 'hod') {
      // HOD sees their department's coursework
      query.departmentId = session.departmentId;
      if (filters.status) query.status = filters.status;
      if (filters.courseCode) query.courseCode = filters.courseCode.toUpperCase();
    } else {
      // System Admin / Director has institutional overview
      if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
      if (filters.status) query.status = filters.status;
      if (filters.courseCode) query.courseCode = filters.courseCode.toUpperCase();
    }

    if (filters.semester) query['academicTarget.semester'] = filters.semester;
    if (filters.section) query['academicTarget.section'] = filters.section.toUpperCase();

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const { assignments: rawAssignments, hasMore, nextCursor } =
      await AssignmentRepository.findAssignments(query, filters.limit, filters.cursor);

    const assignmentIds = rawAssignments.map((a) => a._id.toString());

    // Batch fetch submission counts for faculty/admin, or user submissions for students
    const countsMap =
      session.role !== 'student'
        ? await AssignmentRepository.getBatchCounts(assignmentIds)
        : new Map();

    const studentSubmissionsMap =
      session.role === 'student'
        ? await SubmissionRepository.findStudentSubmissionsForAssignments(session.userId, assignmentIds)
        : new Map();

    const assignments = rawAssignments.map((a) => {
      const id = a._id.toString();
      const counts = countsMap.get(id);
      const studentSub = studentSubmissionsMap.get(id);

      let userSubmission: UserSubmissionSummaryDTO | null = null;
      if (studentSub) {
        userSubmission = {
          id: studentSub._id.toString(),
          status: studentSub.status,
          submittedAt: new Date(studentSub.submittedAt).toISOString(),
          isLate: studentSub.isLate,
          version: studentSub.version,
          isGraded: studentSub.evaluation.isGraded,
          marksObtained:
            studentSub.evaluation.isGraded && studentSub.evaluation.marksObtained != null
              ? studentSub.evaluation.marksObtained
              : undefined,
          feedback:
            studentSub.evaluation.isGraded && studentSub.evaluation.feedback != null
              ? studentSub.evaluation.feedback
              : undefined,
        };
      }

      return toAssignmentDTO(a, {
        submissionCount: counts?.total,
        gradedCount: counts?.graded,
        userSubmission,
      });
    });

    return { assignments, hasMore, nextCursor };
  }

  /* ======================================================================== */
  /* Student Assignment Submissions                                           */
  /* ======================================================================== */

  /**
   * Dispatches a coursework submission from an authorized student.
   */
  public static async submitAssignment(
    session: UserSession | null,
    assignmentId: string,
    input: SubmitAssignmentInput
  ): Promise<SubmissionDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    if (session.role !== 'student') {
      throw new ForbiddenError('Only students can submit coursework assignments.');
    }

    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    // 1. Verify student academic eligibility
    const isTargeted = await this.isStudentTargeted(session, assignment);
    if (!isTargeted) {
      throw new ForbiddenError('You are not eligible to submit this assignment.');
    }

    // 2. Verify Assignment Status
    if (assignment.status !== 'published') {
      if (assignment.status === 'closed') {
        if (!assignment.lateSubmissionPolicy.allowLate) {
          throw new BadRequestError('This assignment is closed and late submissions are disallowed.');
        }
      } else {
        throw new BadRequestError(`Submissions cannot be accepted for an assignment in status '${assignment.status}'.`);
      }
    }

    // 3. Deadline & Late Policy Enforcement
    const now = new Date();
    const isLate = now.getTime() > new Date(assignment.dueDate).getTime();

    if (isLate) {
      if (!assignment.lateSubmissionPolicy.allowLate) {
        throw new BadRequestError('The submission deadline has passed and late submissions are disallowed.');
      }
      if (assignment.lateSubmissionPolicy.lateDueDate) {
        const lateCutoff = new Date(assignment.lateSubmissionPolicy.lateDueDate).getTime();
        if (now.getTime() > lateCutoff) {
          throw new BadRequestError('The late submission cutoff deadline has passed.');
        }
      }
    }

    // 4. Map attachments
    const attachments: IAssignmentAttachmentSubdoc[] = (input.attachments || []).map((a) => ({
      name: a.name,
      url: a.url,
      sizeBytes: a.sizeBytes,
      mimeType: a.mimeType,
      publicId: a.publicId || null,
      uploadedAt: new Date(),
    }));

    // 5. Check existing submission for resubmission rules
    const existing = await SubmissionRepository.findByAssignmentAndStudent(
      assignmentId,
      session.userId
    );

    let savedSubmission: ISubmission;

    if (existing) {
      if (!assignment.allowResubmission) {
        throw new ConflictError('Resubmissions are not permitted for this assignment.');
      }

      if (existing.evaluation.isGraded) {
        throw new BadRequestError('This assignment has already been evaluated and graded. Further submissions are locked.');
      }

      if (existing.version >= assignment.maxResubmissions) {
        throw new BadRequestError(
          `Maximum resubmission limit (${assignment.maxResubmissions}) has been reached.`
        );
      }

      // Record prior state in history
      const priorHistoryEntry = {
        version: existing.version,
        submissionText: existing.submissionText,
        attachments: existing.attachments,
        submittedAt: existing.submittedAt,
        isLate: existing.isLate,
      };

      const updated = await SubmissionRepository.recordResubmission(
        existing._id.toString(),
        {
          priorHistoryEntry,
          newVersion: existing.version + 1,
          submissionText: input.submissionText,
          attachments,
          submittedAt: now,
          isLate,
        }
      );

      if (!updated) {
        throw new NotFoundError('Submission', existing._id.toString());
      }
      savedSubmission = updated;
      logger.info(
        `[AssignmentService] Student ${session.userId} resubmitted assignment ${assignmentId} (Version ${savedSubmission.version})`
      );
    } else {
      // Create fresh submission
      const studentUser = await UserRepository.findById(session.userId);
      const studentProfile = studentUser?.studentProfile;

      savedSubmission = await SubmissionRepository.create({
        assignmentId: assignment._id,
        studentId: new Types.ObjectId(session.userId),
        studentSnapshot: {
          fullName: session.fullName || 'Collegiate Student',
          rollNumber: studentProfile?.rollNumber,
          enrollmentNumber: studentProfile?.enrollmentNumber,
          email: session.email,
          section: studentProfile?.section,
          semester: studentProfile?.currentSemester,
        },
        submissionText: input.submissionText,
        attachments,
        submittedAt: now,
        status: 'submitted',
        isLate,
        version: 1,
        history: [],
        evaluation: {
          marksObtained: undefined,
          feedback: undefined,
          evaluatedBy: undefined,
          evaluatedByName: undefined,
          evaluatedAt: undefined,
          isGraded: false,
          releasedAt: undefined,
        },
      });

      logger.info(
        `[AssignmentService] Student ${session.userId} submitted assignment ${assignmentId}`
      );
    }

    // 6. Notify Course Instructor in Real-Time
    const authorChannel = AblyBroker.getUserNotificationChannel(assignment.createdBy.toString());
    await AblyBroker.publish(authorChannel, 'assignment.submission.received', {
      assignmentId,
      submissionId: savedSubmission._id.toString(),
      studentName: session.fullName,
      submittedAt: savedSubmission.submittedAt,
      isLate: savedSubmission.isLate,
    });

    return toSubmissionDTO(savedSubmission);
  }

  /**
   * Retrieves student's own submission for an assignment.
   */
  public static async getStudentSubmission(
    session: UserSession | null,
    assignmentId: string
  ): Promise<SubmissionDTO | null> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const submission = await SubmissionRepository.findByAssignmentAndStudent(
      assignmentId,
      session.userId
    );

    if (!submission) return null;

    return toSubmissionDTO(submission);
  }

  /* ======================================================================== */
  /* Faculty Evaluation & Grading                                             */
  /* ======================================================================== */

  /**
   * Lists all submissions for an assignment (Faculty author or HOD only).
   */
  public static async getAssignmentSubmissions(
    session: UserSession | null,
    assignmentId: string,
    filters: SubmissionFilterInput
  ): Promise<PaginatedSubmissionsDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    this.assertAssignmentOwnerOrHOD(session, assignment);

    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.isLate !== undefined) query.isLate = filters.isLate;
    if (filters.isGraded !== undefined) query['evaluation.isGraded'] = filters.isGraded;

    const { submissions: rawSubmissions, hasMore, nextCursor } =
      await SubmissionRepository.findSubmissionsByAssignment(
        assignmentId,
        query,
        filters.limit,
        filters.cursor
      );

    const submissions = rawSubmissions.map((s) => toSubmissionDTO(s));

    return { submissions, hasMore, nextCursor };
  }

  /**
   * Evaluates and awards marks for a student submission.
   */
  public static async evaluateSubmission(
    session: UserSession | null,
    assignmentId: string,
    submissionId: string,
    input: EvaluateSubmissionInput
  ): Promise<SubmissionDTO> {
    this.assertActiveSession(session);
    await this.ensureDatabase();

    const assignment = await AssignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment', assignmentId);
    }

    this.assertAssignmentOwnerOrHOD(session, assignment);

    const submission = await SubmissionRepository.findById(submissionId);
    if (!submission || submission.assignmentId.toString() !== assignmentId) {
      throw new NotFoundError('Submission', submissionId);
    }

    // Marks boundary check
    if (input.marksObtained > assignment.maxMarks) {
      throw new ValidationError(
        `Awarded marks (${input.marksObtained}) cannot exceed assignment maximum marks (${assignment.maxMarks}).`
      );
    }

    const now = new Date();
    const evaluationData = {
      marksObtained: input.marksObtained,
      feedback: input.feedback?.trim() || null,
      evaluatedBy: new Types.ObjectId(session.userId),
      evaluatedByName: session.fullName || 'Course Instructor',
      evaluatedAt: now,
      isGraded: true,
      releasedAt: input.releaseGrade !== false ? now : undefined,
    };

    const updated = await SubmissionRepository.updateEvaluation(submissionId, evaluationData);
    if (!updated) {
      throw new NotFoundError('Submission', submissionId);
    }

    logger.info(
      `[AssignmentService] Submission ${submissionId} graded by ${session.userId} with marks ${input.marksObtained}/${assignment.maxMarks}`
    );

    // Notify student in real-time
    const studentChannel = AblyBroker.getUserNotificationChannel(updated.studentId.toString());
    await AblyBroker.publish(studentChannel, 'assignment.evaluated', {
      assignmentId,
      submissionId,
      marksObtained: input.marksObtained,
      maxMarks: assignment.maxMarks,
      feedback: input.feedback,
      evaluatedAt: now.toISOString(),
    });

    return toSubmissionDTO(updated);
  }

  /* ======================================================================== */
  /* Cloudinary Signed Upload Credentials & Fallback                           */
  /* ======================================================================== */

  /**
   * Generates server-signed upload parameters for direct client-to-Cloudinary uploads (AUD-H13).
   * Enforces user-scoped folder isolation (`axis-linkup/<scope>/<userId>`), `allowed_formats`,
   * and `max_file_size` inside the canonical SHA-1 signature.
   * In non-production environments without Cloudinary credentials, returns a local fallback envelope.
   * In production, fails closed with HTTP 503 if Cloudinary credentials are absent.
   */
  public static getUploadSignature(
    session: UserSession | null,
    scope: UploadScope = 'assignments'
  ): {
    timestamp: number;
    signature?: string;
    apiKey?: string;
    cloudName?: string;
    folder: string;
    allowedFormats: string;
    maxFileSize: number;
    isMock: boolean;
  } {
    this.assertActiveSession(session);

    if (!ALLOWED_UPLOAD_SCOPES.includes(scope)) {
      throw new ValidationError(
        `Invalid upload scope "${String(scope)}". Allowed scopes: ${ALLOWED_UPLOAD_SCOPES.join(', ')}.`
      );
    }

    const safeUserId = session.userId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeUserId) {
      throw new ValidationError('Unable to derive isolated storage folder for caller identity.');
    }

    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();

    const timestamp = Math.round(Date.now() / 1000);
    const folder = `axis-linkup/${scope}/${safeUserId}`;
    const allowedFormats = ALLOWED_UPLOAD_FORMATS;
    const maxFileSize = MAX_UPLOAD_FILE_SIZE_BYTES;

    if (!apiKey || !apiSecret || !cloudName) {
      if (process.env.NODE_ENV === 'production') {
        logger.error(
          '[AssignmentService] Production upload signature aborted: Cloudinary credentials missing.'
        );
        throw new AppError(
          'File storage service is not configured. Please contact the Campus System Administrator.',
          ERROR_CODES.INTERNAL_ERROR,
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      logger.debug(
        `[AssignmentService] Cloudinary unconfigured. Providing local development attachment envelope (scope=${scope}).`
      );
      return {
        timestamp,
        folder,
        allowedFormats,
        maxFileSize,
        isMock: true,
      };
    }

    // Canonical Cloudinary SHA-1 signature (alphabetically sorted signed parameters):
    // allowed_formats=...&folder=...&max_file_size=...&timestamp=...<apiSecret>
    const serializedParams = `allowed_formats=${allowedFormats}&folder=${folder}&max_file_size=${maxFileSize}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(serializedParams).digest('hex');

    return {
      timestamp,
      signature,
      apiKey,
      cloudName,
      folder,
      allowedFormats,
      maxFileSize,
      isMock: false,
    };
  }

  /* ======================================================================== */
  /* Helper Utilities                                                         */
  /* ======================================================================== */

  private static assertAssignmentOwnerOrHOD(
    session: UserSession,
    assignment: IAssignment
  ): void {
    const isAuthor = assignment.createdBy.toString() === session.userId;
    const isDeptHOD =
      (session.role === 'admin' || session.adminSubRole === 'hod') &&
      session.departmentId?.toString() === assignment.departmentId.toString();
    const isSystemAdmin =
      session.role === 'super_admin' &&
      (session.adminSubRole === 'sys_admin' || !session.adminSubRole);

    if (!isAuthor && !isDeptHOD && !isSystemAdmin) {
      throw new ForbiddenError('You are not authorized to manage or modify this assignment.');
    }
  }

  private static async isStudentTargeted(
    session: UserSession,
    assignment: IAssignment
  ): Promise<boolean> {
    const studentUser = await UserRepository.findById(session.userId);
    if (!studentUser || !studentUser.studentProfile) return false;

    const profile = studentUser.studentProfile;
    const target = assignment.academicTarget;

    // 1. Department match
    if (studentUser.departmentId?.toString() !== assignment.departmentId.toString()) {
      return false;
    }

    // 2. Semester match
    if (target.semester !== profile.currentSemester) {
      return false;
    }

    // 3. Section match
    if (target.section && target.section !== 'ALL' && profile.section) {
      if (target.section.toUpperCase() !== profile.section.toUpperCase()) {
        return false;
      }
    }

    // 4. Program match
    if (target.program && profile.program) {
      if (target.program.toUpperCase() !== profile.program.toUpperCase()) {
        return false;
      }
    }

    // 5. Batch year match
    if (target.batchYear && profile.batchYear) {
      if (target.batchYear !== profile.batchYear) {
        return false;
      }
    }

    return true;
  }
}
