/**
 * Profile Service (Domain Business Logic Layer) — Phase 5.3.3.
 * 
 * Enforces:
 * 1. Context-aware DTO projections (DirectoryProfileDTO, RosterStudentDTO, OwnerProfileDTO, AdminProfileDTO).
 * 2. Strict role-based & department-scoped server-side authorization.
 * 3. Faculty phone privacy rules (owner, sys-admin, same-dept HOD, or opt-in student only).
 * 4. Safe department population without circular references or leaking internal metadata.
 * 5. Academic cohort integrity and active department-program compatibility.
 * 6. Audit logging for sensitive administrative mutations.
 */

import { Types } from 'mongoose';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import {
  selfServiceProfileUpdateSchema,
  adminAcademicUpdateSchema,
} from '@/lib/validations/user.schema';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  AppError,
} from '@/lib/errors/app-error';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { logger } from '@/lib/logging/logger';
import type { IUser, UserSession } from '@/types/user';
import type {
  DirectoryProfileDTO,
  RosterStudentDTO,
  OwnerProfileDTO,
  AdminProfileDTO,
  RosterQueryOptions,
  PaginatedRosterResponse,
} from '@/types/profile';

export class ProfileService {
  /**
   * Safely resolves department metadata (name and code) without exposing Mongoose internals.
   * Gracefully falls back if department reference is missing, deleted, or unpopulated.
   */
  public static async resolveDepartmentMeta(
    departmentId: string | Types.ObjectId | null | undefined
  ): Promise<{ id: string | null; name: string | null; code: string | null }> {
    if (!departmentId) {
      return { id: null, name: null, code: null };
    }

    try {
      const deptIdStr = departmentId.toString();
      const dept = await DepartmentRepository.findById(deptIdStr);
      if (!dept) {
        return { id: deptIdStr, name: null, code: null };
      }
      return {
        id: dept._id.toString(),
        name: dept.name,
        code: dept.code,
      };
    } catch {
      return { id: departmentId.toString(), name: null, code: null };
    }
  }

  /**
   * Evaluates whether a caller is authorized to view a faculty member's personal phone number.
   * 
   * Strict Institutional Invariants:
   * 1. Faculty member viewing their own profile: ALLOW.
   * 2. System Administrator: ALLOW (administrative authority).
   * 3. HOD: ALLOW ONLY within their assigned department scope.
   * 4. Authenticated Student: ALLOW ONLY IF target faculty explicitly set sharePhoneWithStudents === true
   *    AND student belongs to the target faculty's academic department.
   * 5. All other callers (Director, peer faculty, cross-department students, unauthenticated, external): DENY (masked to null).
   * 
   * Legacy records missing sharePhoneWithStudents strictly evaluate to false.
   */
  public static canViewFacultyPhone(
    targetFaculty: IUser,
    callerSession: UserSession
  ): boolean {
    const targetUserId = targetFaculty._id.toString();

    // 1. Direct Owner Access
    if (callerSession.userId === targetUserId) {
      return true;
    }

    // 2. System Administrator Access
    if (callerSession.role === 'super_admin' || callerSession.adminSubRole === 'sys_admin') {
      return true;
    }

    // 3. Department HOD Scope Check
    if (callerSession.adminSubRole === 'hod') {
      const callerDept = callerSession.departmentId?.toString();
      const targetDept = targetFaculty.departmentId?.toString();
      if (callerDept && targetDept && callerDept === targetDept) {
        return true;
      }
      return false; // HOD outside their department cannot view peer faculty phone
    }

    // 4. Authenticated Student Opt-In Access with Institutional Relationship Verification
    if (callerSession.role === 'student') {
      const shareOptIn = Boolean(targetFaculty.facultyProfile?.sharePhoneWithStudents);
      if (!shareOptIn) return false;

      const studentDept = callerSession.departmentId?.toString();
      const facultyDept = targetFaculty.departmentId?.toString();

      // Verify institutional academic relationship: student must belong to the same department
      return Boolean(studentDept && facultyDept && studentDept === facultyDept);
    }

    // Default: Deny by default
    return false;
  }

  /**
   * Projects a User document into a Public / Directory DTO.
   * Strictly strips personal phone, enrollment number, employee ID, and internal security metadata.
   */
  public static toDirectoryProfileDTO(
    user: IUser,
    deptMeta: { id: string | null; name: string | null; code: string | null },
    includeFacultyPhone = false
  ): DirectoryProfileDTO {
    let program: string | null = null;
    let currentSemester: number | null = null;
    let section: string | null = null;

    if (user.studentProfile) {
      program = user.studentProfile.program ?? null;
      currentSemester = user.studentProfile.currentSemester ?? null;
      section = user.studentProfile.section ?? null;
    }

    let designation: string | null = null;
    let cabinRoom: string | null = null;
    let officeHours = null;
    let specialization: string[] = [];
    let phoneNumber: string | null = null;

    if (user.facultyProfile) {
      designation = user.facultyProfile.designation ?? null;
      cabinRoom = user.facultyProfile.cabinRoom ?? null;
      specialization = user.facultyProfile.specialization ? [...user.facultyProfile.specialization] : [];
      if (user.facultyProfile.officeHours) {
        officeHours = {
          start: user.facultyProfile.officeHours.start,
          end: user.facultyProfile.officeHours.end,
          isAcceptingDMs: user.facultyProfile.officeHours.isAcceptingDMs,
        };
      }
      if (includeFacultyPhone && user.phoneNumber) {
        phoneNumber = user.phoneNumber;
      }
    } else if (user.adminProfile) {
      designation = user.adminProfile.designation ?? null;
    }

    return {
      id: user._id.toString(),
      fullName: user.fullName,
      username: user.username ?? null,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      departmentId: deptMeta.id,
      departmentName: deptMeta.name,
      departmentCode: deptMeta.code,
      program,
      currentSemester,
      section,
      designation,
      cabinRoom,
      officeHours,
      specialization,
      phoneNumber,
    };
  }

  /**
   * Projects a student user document into an Academic Roster Student DTO.
   */
  public static toRosterStudentDTO(
    user: IUser,
    deptMeta: { id: string | null; name: string | null; code: string | null }
  ): RosterStudentDTO {
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      username: user.username ?? null,
      role: 'student',
      departmentId: deptMeta.id ?? '',
      departmentName: deptMeta.name,
      departmentCode: deptMeta.code,
      program: user.studentProfile?.program ?? null,
      rollNumber: user.studentProfile?.rollNumber ?? '',
      enrollmentNumber: user.studentProfile?.enrollmentNumber ?? null,
      batchYear: user.studentProfile?.batchYear ?? 0,
      currentSemester: user.studentProfile?.currentSemester ?? 1,
      section: user.studentProfile?.section ?? '',
      avatarUrl: user.avatarUrl ?? null,
    };
  }

  /**
   * Projects a user document into an Owner Profile DTO for self-service inspection.
   */
  public static toOwnerProfileDTO(
    user: IUser,
    deptMeta: { id: string | null; name: string | null; code: string | null }
  ): OwnerProfileDTO {
    return {
      id: user._id.toString(),
      email: user.email,
      username: user.username ?? null,
      fullName: user.fullName,
      role: user.role,
      adminSubRole: user.adminSubRole ?? null,
      status: user.status,
      isEmailVerified: Boolean(user.isEmailVerified),
      isProfileComplete: user.isProfileComplete,
      phoneNumber: user.phoneNumber ?? null,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      departmentId: deptMeta.id,
      departmentName: deptMeta.name,
      departmentCode: deptMeta.code,
      studentProfile: user.studentProfile
        ? {
            rollNumber: user.studentProfile.rollNumber,
            enrollmentNumber: user.studentProfile.enrollmentNumber || undefined,
            program: user.studentProfile.program || undefined,
            batchYear: user.studentProfile.batchYear,
            admissionYear: user.studentProfile.admissionYear ?? user.studentProfile.batchYear,
            currentSemester: user.studentProfile.currentSemester,
            section: user.studentProfile.section,
            admissionType: user.studentProfile.admissionType,
          }
        : null,
      facultyProfile: user.facultyProfile
        ? {
            employeeId: user.facultyProfile.employeeId,
            designation: user.facultyProfile.designation,
            qualifications: user.facultyProfile.qualifications ? [...user.facultyProfile.qualifications] : [],
            specialization: user.facultyProfile.specialization ? [...user.facultyProfile.specialization] : [],
            cabinRoom: user.facultyProfile.cabinRoom || undefined,
            officeHours: user.facultyProfile.officeHours
              ? {
                  start: user.facultyProfile.officeHours.start,
                  end: user.facultyProfile.officeHours.end,
                  isAcceptingDMs: user.facultyProfile.officeHours.isAcceptingDMs,
                }
              : undefined,
            sharePhoneWithStudents: Boolean(user.facultyProfile.sharePhoneWithStudents),
          }
        : null,
      adminProfile: user.adminProfile
        ? {
            adminStaffId: user.adminProfile.adminStaffId,
            administrativeDomain: user.adminProfile.administrativeDomain,
            designation: user.adminProfile.designation || undefined,
            assignedQueueScopes: user.adminProfile.assignedQueueScopes
              ? [...user.adminProfile.assignedQueueScopes]
              : [],
            emergencyOverridePermitted: Boolean(user.adminProfile.emergencyOverridePermitted),
          }
        : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * Projects a user document into an Administrator Profile DTO with audit links.
   */
  public static toAdminProfileDTO(
    user: IUser,
    deptMeta: { id: string | null; name: string | null; code: string | null }
  ): AdminProfileDTO {
    const ownerDto = this.toOwnerProfileDTO(user, deptMeta);
    return {
      ...ownerDto,
      provisionedBy: user.provisionedBy ? user.provisionedBy.toString() : null,
      activatedAt: user.activatedAt ? user.activatedAt.toISOString() : null,
    };
  }

  /**
   * Retrieves the authenticated caller's own full profile.
   */
  public static async getOwnProfile(callerSession: UserSession): Promise<OwnerProfileDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required to retrieve profile.');
    }

    const user = await UserRepository.findById(callerSession.userId);
    if (!user) {
      throw new NotFoundError('User', callerSession.userId);
    }

    const deptMeta = await this.resolveDepartmentMeta(user.departmentId);
    return this.toOwnerProfileDTO(user, deptMeta);
  }

  /**
   * Retrieves another collegiate user's profile with context-aware privacy projection.
   * 
   * Authorization & Privacy Enforcement:
   * - Caller viewing own profile: full OwnerProfileDTO.
   * - System Administrator: full AdminProfileDTO with audit metadata.
   * - Director: DirectoryProfileDTO with institutional oversight context.
   * - HOD (same department): full departmental access (faculty phone or student academic cohort).
   * - HOD (cross-department): restricted DirectoryProfileDTO (no phone, no employee ID).
   * - Student viewing Faculty: DirectoryProfileDTO, with phone included ONLY if sharePhoneWithStudents === true.
   * - Student viewing Student: DirectoryProfileDTO (no phone, no rollNumber, no enrollmentNumber).
   * - Faculty viewing Faculty: DirectoryProfileDTO (no phone).
   * - Faculty viewing Student (same department): DirectoryProfileDTO with cohort details.
   */
  public static async getProfileById(
    targetUserId: string,
    callerSession: UserSession
  ): Promise<DirectoryProfileDTO | OwnerProfileDTO | AdminProfileDTO> {
    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError('Invalid target user identifier.');
    }

    const targetUser = await UserRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('User', targetUserId);
    }

    const deptMeta = await this.resolveDepartmentMeta(targetUser.departmentId);

    // 1. Caller viewing own profile
    if (callerSession.userId === targetUserId) {
      return this.toOwnerProfileDTO(targetUser, deptMeta);
    }

    // 2. System Administrator viewing any profile
    if (callerSession.role === 'super_admin' || callerSession.adminSubRole === 'sys_admin') {
      return this.toAdminProfileDTO(targetUser, deptMeta);
    }

    // 3. Department HOD
    if (callerSession.adminSubRole === 'hod') {
      const callerDept = callerSession.departmentId?.toString();
      const targetDept = targetUser.departmentId?.toString();

      if (callerDept && targetDept && callerDept === targetDept) {
        // HOD within their department can view full departmental records
        return this.toOwnerProfileDTO(targetUser, deptMeta);
      }

      // Cross-department access: return restricted Directory DTO
      return this.toDirectoryProfileDTO(targetUser, deptMeta, false);
    }

    // 4. Student viewing Faculty
    if (callerSession.role === 'student' && targetUser.role === 'faculty') {
      const canViewPhone = this.canViewFacultyPhone(targetUser, callerSession);
      return this.toDirectoryProfileDTO(targetUser, deptMeta, canViewPhone);
    }

    // 5. Default: Public / Directory Profile Projection
    return this.toDirectoryProfileDTO(targetUser, deptMeta, false);
  }

  /**
   * Retrieves an academic roster for a department.
   * 
   * Strict Access Control:
   * - Students: CANNOT access academic rosters (HTTP 403 Forbidden).
   * - Faculty: Can access roster ONLY within their assigned department.
   * - HOD: Can access roster ONLY within their authorized department.
   * - Director: Can access rosters across departments (institutional oversight).
   * - System Administrator: Can access rosters across departments.
   */
  public static async getDepartmentRoster(
    departmentId: string,
    callerSession: UserSession,
    options?: RosterQueryOptions
  ): Promise<PaginatedRosterResponse> {
    if (!departmentId || !Types.ObjectId.isValid(departmentId)) {
      throw new ValidationError('Valid department identifier is required.');
    }

    // 1. Role Authorization Gates
    if (callerSession.role === 'student') {
      throw new ForbiddenError('Students are not authorized to access department academic rosters.');
    }

    const isSystemAdmin =
      callerSession.role === 'super_admin' || callerSession.adminSubRole === 'sys_admin';
    const isDirector = callerSession.adminSubRole === 'director';

    if (!isSystemAdmin && !isDirector) {
      // Faculty & HOD must be department-scoped
      const callerDept = callerSession.departmentId?.toString();
      if (!callerDept || callerDept !== departmentId) {
        if (callerSession.adminSubRole === 'hod') {
          throw new ForbiddenError('HODs are only authorized to access rosters within their own department.');
        }
        throw new ForbiddenError('Faculty members can only access academic rosters within their assigned department.');
      }
    }

    // 2. Department Existence Check
    const department = await DepartmentRepository.findById(departmentId);
    if (!department) {
      throw new NotFoundError('Department', departmentId);
    }

    // 3. Query Roster Data via Repository
    const { students, totalCount, nextCursor, hasMore } = await UserRepository.findDepartmentRoster(
      departmentId,
      options
    );

    const deptMeta = {
      id: department._id.toString(),
      name: department.name,
      code: department.code,
    };

    const rosterStudents = students.map((s) => this.toRosterStudentDTO(s, deptMeta));

    return {
      department: {
        id: deptMeta.id,
        name: deptMeta.name,
        code: deptMeta.code,
      },
      totalStudents: totalCount,
      page: Math.max(1, options?.page || 1),
      limit: Math.min(100, Math.max(1, options?.limit || 50)),
      nextCursor: nextCursor ?? null,
      hasMore: Boolean(hasMore),
      students: rosterStudents,
    };
  }

  /**
   * Updates permitted self-service profile fields for the authenticated caller.
   * Whitelisted fields: fullName, bio, avatarUrl, phoneNumber, facultyProfile (cabinRoom, officeHours, specialization, sharePhoneWithStudents).
   * Prevents mass assignment: role, status, departmentId, program, section, rollNumber, employeeId are strictly immutable.
   */
  public static async updateOwnProfile(
    callerSession: UserSession,
    rawInput: unknown
  ): Promise<OwnerProfileDTO> {
    if (!callerSession?.userId) {
      throw new ForbiddenError('Authentication required to update profile.');
    }

    // 1. Strict Whitelist Validation via Zod
    const validatedInput = selfServiceProfileUpdateSchema.parse(rawInput);

    // 2. Ensure user exists
    const existingUser = await UserRepository.findById(callerSession.userId);
    if (!existingUser) {
      throw new NotFoundError('User', callerSession.userId);
    }

    // 3. Role-specific constraint checks
    // If student, strip any facultyProfile fields if passed
    if (existingUser.role !== 'faculty' && validatedInput.facultyProfile) {
      delete validatedInput.facultyProfile;
    }

    // 4. Update via Repository
    const updated = await UserRepository.updateProfile(callerSession.userId, validatedInput);
    if (!updated) {
      throw new AppError('Failed to persist profile update.', ERROR_CODES.INTERNAL_ERROR, 500);
    }

    logger.info(`[ProfileService] Self-service profile updated for user: ${callerSession.userId}`);

    const deptMeta = await this.resolveDepartmentMeta(updated.departmentId);
    return this.toOwnerProfileDTO(updated, deptMeta);
  }

  /**
   * Updates administrative academic fields (Protected Administrative Gate).
   * 
   * Authorization Rules:
   * - System Administrator: Can update student or faculty academic fields across all departments.
   * - HOD: Can update student cohort fields (section, program, batch, semester) ONLY for students in HOD's department.
   *   HOD CANNOT update faculty, administrators, or transfer students to another department.
   * - Other Roles (Student, Faculty, Director): Strictly rejected (HTTP 403 Forbidden).
   * 
   * Academic Data Integrity Rules:
   * - Program must belong to the student's department and be active.
   * - Inactive programs (e.g. BCA, MCA pending resolution, M.Tech CSE unconfirmed) are rejected.
   * - ASH cannot be assigned student programs.
   */
  public static async updateAcademicProfile(
    targetUserId: string,
    rawInput: unknown,
    callerSession: UserSession
  ): Promise<OwnerProfileDTO> {
    if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      throw new ValidationError('Invalid target user identifier.');
    }

    // 1. Role Authorization Gates
    const isSystemAdmin =
      callerSession.role === 'super_admin' || callerSession.adminSubRole === 'sys_admin';
    const isHOD = callerSession.adminSubRole === 'hod';

    if (!isSystemAdmin && !isHOD) {
      throw new ForbiddenError('Only System Administrators and Department HODs are authorized to update academic profiles.');
    }

    // 2. Validate Input
    const validated = adminAcademicUpdateSchema.parse(rawInput);

    // 3. Resolve Target User
    const targetUser = await UserRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('User', targetUserId);
    }

    // 4. HOD Scope Boundaries
    if (isHOD) {
      if (targetUser.role !== 'student') {
        throw new ForbiddenError('HODs are only authorized to update student academic cohort fields.');
      }

      const callerDept = callerSession.departmentId?.toString();
      const targetDept = targetUser.departmentId?.toString();

      if (!callerDept || !targetDept || callerDept !== targetDept) {
        throw new ForbiddenError('HODs cannot modify academic fields for students belonging to another department.');
      }

      if (validated.departmentId && validated.departmentId !== callerDept) {
        throw new ForbiddenError('HODs cannot transfer students across departments.');
      }

      if (validated.designation) {
        throw new ForbiddenError('HODs cannot mutate employee designations.');
      }
    }

    // 5. Academic Program Compatibility & Active Status Verification
    const activeDeptId = validated.departmentId || targetUser.departmentId?.toString();

    if (validated.program) {
      if (!activeDeptId) {
        throw new ValidationError('A department must be assigned before setting an academic program.');
      }

      const deptDoc = await DepartmentRepository.findById(activeDeptId);
      if (!deptDoc || !deptDoc.isActive) {
        throw new ValidationError('The specified department is invalid, inactive, or not found.');
      }

      // Check if ASH is specified as program owner
      if (deptDoc.code.toUpperCase() === 'ASH') {
        throw new ValidationError('Applied Sciences & Humanities (ASH) is a foundational service department and does not independently enroll degree students.');
      }

      // Verify program is active and approved for this department
      const programCheck = await DepartmentRepository.isProgramApprovedForDepartment(
        deptDoc.code,
        validated.program
      );

      if (!programCheck.valid) {
        throw new ValidationError(
          programCheck.reason ||
            `Program "${validated.program}" is not active or approved for Department "${deptDoc.code}".`
        );
      }
    }

    // 6. Persist Mutation via Repository
    const updated = await UserRepository.updateAcademicProfile(targetUserId, validated);
    if (!updated) {
      throw new AppError('Failed to persist academic profile changes.', ERROR_CODES.INTERNAL_ERROR, 500);
    }

    logger.info(
      `[ProfileService] Academic profile updated for user ${targetUserId} by ${callerSession.userId} (${callerSession.role})`
    );

    const deptMeta = await this.resolveDepartmentMeta(updated.departmentId);
    return this.toOwnerProfileDTO(updated, deptMeta);
  }
}

export default ProfileService;
