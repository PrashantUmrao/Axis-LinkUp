/**
 * Profile Service Data Contracts, Projections & Query Types (Phase 5.3.3).
 * Enforces context-aware privacy levels, strictly separated DTO projections,
 * and robust academic roster access controls.
 */

import type { UserRole, AdminSubRole, UserStatus, IFacultyOfficeHours } from './user';

/**
 * Public / Directory Profile Projection.
 * Available to registered, authenticated platform users for general search and directory discovery.
 * Strictly strips private PII: phone numbers, enrollment numbers, employee IDs, and authentication tokens.
 */
export interface DirectoryProfileDTO {
  id: string;
  fullName: string;
  username: string | null;
  role: UserRole;
  avatarUrl: string | null;
  bio?: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  // Student cohort fields (public directory safe)
  program?: string | null;
  currentSemester?: number | null;
  section?: string | null;
  // Faculty fields (directory safe)
  designation?: string | null;
  cabinRoom?: string | null;
  officeHours?: IFacultyOfficeHours | null;
  specialization?: string[];
  // Opt-in phone number (populated ONLY when caller is an authorized student and faculty opted in)
  phoneNumber?: string | null;
}

/**
 * Academic Roster Student Projection.
 * Exposes academic cohort tracking data strictly to authorized instructors, HODs, and administrators.
 */
export interface RosterStudentDTO {
  id: string;
  fullName: string;
  username: string | null;
  role: 'student';
  departmentId: string;
  departmentName: string | null;
  departmentCode: string | null;
  program: string | null;
  rollNumber: string;
  enrollmentNumber: string | null;
  batchYear: number;
  currentSemester: number;
  section: string;
  avatarUrl: string | null;
}

/**
 * Owner Profile Projection.
 * Returned to the authenticated account owner viewing their own record.
 * Contains all personal attributes, contact preferences, and cohort data.
 */
export interface OwnerProfileDTO {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  role: UserRole;
  adminSubRole: AdminSubRole | null;
  status: UserStatus;
  isEmailVerified: boolean;
  isProfileComplete: boolean;
  phoneNumber: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  studentProfile?: {
    rollNumber: string;
    enrollmentNumber?: string;
    program?: string;
    batchYear: number;
    admissionYear?: number;
    currentSemester: number;
    section: string;
    admissionType: string;
  } | null;
  facultyProfile?: {
    employeeId: string;
    designation: string;
    qualifications: string[];
    specialization: string[];
    cabinRoom?: string;
    officeHours?: IFacultyOfficeHours;
    sharePhoneWithStudents: boolean;
  } | null;
  adminProfile?: {
    adminStaffId: string;
    administrativeDomain: string;
    designation?: string;
    assignedQueueScopes: string[];
    emergencyOverridePermitted: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Administrator Profile Projection.
 * Extends Owner Profile with institutional audit trails for authorized administrators.
 * Never exposes Clerk secret keys, hashed passwords, or OTP secrets.
 */
export interface AdminProfileDTO extends OwnerProfileDTO {
  provisionedBy: string | null;
  activatedAt: string | null;
}

/**
 * Filter and pagination options for academic roster queries.
 */
export interface RosterQueryOptions {
  program?: string;
  batchYear?: number;
  currentSemester?: number;
  section?: string;
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Paginated Academic Roster Response.
 */
export interface PaginatedRosterResponse {
  department: {
    id: string;
    name: string;
    code: string;
  };
  totalStudents: number;
  page: number;
  limit: number;
  nextCursor?: string | null;
  hasMore?: boolean;
  students: RosterStudentDTO[];
}

/**
 * Input DTO for Self-Service Profile Updates.
 */
export interface SelfServiceProfileUpdateInput {
  fullName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  bio?: string;
  facultyProfile?: {
    cabinRoom?: string;
    officeHours?: IFacultyOfficeHours;
    specialization?: string[];
    sharePhoneWithStudents?: boolean;
  };
}

/**
 * Input DTO for Administrative Academic Updates.
 */
export interface AdminAcademicUpdateInput {
  departmentId?: string;
  program?: string;
  batchYear?: number;
  admissionYear?: number;
  currentSemester?: number;
  section?: string;
  designation?: string;
}

