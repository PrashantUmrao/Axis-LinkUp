/**
 * Master User and Profile Type Definitions.
 * Conforms to Axis LinkUp Database Architecture (DOC-DATA-005)
 * and User Identity Model (DOC-AUTH-003).
 */

import type { Types, Document } from 'mongoose';
import type { UserRole, Nullable, Optional } from './common';
import type { AdminSubRole, FacultyDesignation } from '@/config/constants';

export type { UserRole, AdminSubRole, FacultyDesignation };

/**
 * Account lifecycle statuses.
 */
export type UserStatus =
  | 'pending_verification'
  | 'active'
  | 'suspended'
  | 'deactivated'
  | 'graduated'
  | 'invited'
  | 'archived';

/**
 * Student profile subdocument structure.
 */
export interface IStudentProfile {
  rollNumber: string;
  enrollmentNumber?: string;
  program?: string;
  batchYear: number;
  admissionYear?: number;
  currentSemester: number;
  section: string;
  academicMentorId?: Types.ObjectId | string;
  admissionType: 'regular' | 'lateral_entry';
}

/**
 * Faculty office hours schedule subdocument.
 */
export interface IFacultyOfficeHours {
  start: string;
  end: string;
  isAcceptingDMs: boolean;
}

/**
 * Faculty profile subdocument structure.
 */
export interface IFacultyProfile {
  employeeId: string;
  designation: FacultyDesignation | string;
  qualifications: string[];
  specialization?: string[];
  cabinRoom?: string;
  assignedCourses: Array<Types.ObjectId | string>;
  officeHours?: IFacultyOfficeHours;
  sharePhoneWithStudents?: boolean;
}

/**
 * Administrator profile subdocument structure.
 */
export interface IAdminProfile {
  adminStaffId: string;
  designation?: string;
  administrativeDomain: string;
  assignedQueueScopes: string[];
  emergencyOverridePermitted: boolean;
}

/**
 * Core User Document interface representing the MongoDB 'users' collection.
 */
export interface IUser extends Document {
  _id: Types.ObjectId;
  authProviderId?: string;
  email: string;
  username?: Nullable<string>;
  fullName: string;
  role: UserRole;
  adminSubRole?: Nullable<AdminSubRole>;
  status: UserStatus;
  isEmailVerified?: boolean;
  isProfileComplete: boolean;
  departmentId?: Nullable<Types.ObjectId>;
  provisionedBy?: Nullable<Types.ObjectId>;
  activatedAt?: Nullable<Date>;
  activationTokenHash?: Nullable<string>;
  activationTokenExpiresAt?: Nullable<Date>;
  phoneNumber?: Nullable<string>;
  avatarUrl?: Nullable<string>;
  bio?: Nullable<string>;
  studentProfile?: Nullable<IStudentProfile>;
  facultyProfile?: Nullable<IFacultyProfile>;
  adminProfile?: Nullable<IAdminProfile>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sanitized User Data Transfer Object (safe for client responses).
 */
export interface UserDTO {
  id: string;
  email: string;
  username?: Nullable<string>;
  fullName: string;
  role: UserRole;
  adminSubRole?: Nullable<AdminSubRole>;
  status: UserStatus;
  isEmailVerified?: boolean;
  isProfileComplete: boolean;
  departmentId?: Nullable<string>;
  provisionedBy?: Nullable<string>;
  activatedAt?: Nullable<string>;
  phoneNumber?: Nullable<string>;
  avatarUrl?: Nullable<string>;
  bio?: Nullable<string>;
  studentProfile?: Nullable<IStudentProfile>;
  facultyProfile?: Nullable<IFacultyProfile>;
  adminProfile?: Nullable<IAdminProfile>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public Collegiate Directory User DTO (safe for direct messaging & user discovery).
 * Never exposes credentials, auth tokens, or private administrative fields.
 */
export interface DirectoryUserDTO {
  id: string;
  fullName: string;
  username?: Nullable<string>;
  email: string;
  role: UserRole;
  adminSubRole?: Nullable<AdminSubRole>;
  avatarUrl?: Nullable<string>;
  departmentName?: Nullable<string>;
  departmentId?: Nullable<string>;
  rollNumber?: Nullable<string>;
  designation?: Nullable<string>;
}

/**
 * Input DTO for user creation.
 */
export interface CreateUserInput {
  email: string;
  username?: string;
  fullName: string;
  role: UserRole;
  adminSubRole?: AdminSubRole;
  status?: UserStatus;
  isEmailVerified?: boolean;
  authProviderId?: string;
  departmentId?: string;
  provisionedBy?: string;
  activatedAt?: Date;
  phoneNumber?: string;
  avatarUrl?: string;
  isProfileComplete?: boolean;
  studentProfile?: IStudentProfile;
  facultyProfile?: IFacultyProfile;
  adminProfile?: IAdminProfile;
}

/**
 * Input DTO for user profile self-update (strictly whitelisted).
 */
export interface UpdateUserProfileInput {
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
 * Session user payload for authenticated server operations.
 */
export interface UserSession {
  userId: string;
  sessionId?: string;
  authProviderId?: string;
  email: string;
  username?: string;
  fullName?: string;
  avatarUrl?: Nullable<string>;
  role: UserRole;
  adminSubRole?: Nullable<AdminSubRole>;
  status?: UserStatus;
  departmentId?: Optional<string>;
}
