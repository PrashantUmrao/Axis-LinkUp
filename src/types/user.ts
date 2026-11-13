/**
 * Master User and Profile Type Definitions.
 * Conforms to Axis LinkUp Database Architecture (DOC-DATA-005)
 * and User Identity Model (DOC-AUTH-003).
 */

import type { Types, Document } from 'mongoose';
import type { UserRole, Nullable, Optional } from './common';

export type { UserRole };

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
  batchYear: number;
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
  designation: string;
  qualifications: string[];
  cabinRoom?: string;
  assignedCourses: Array<Types.ObjectId | string>;
  officeHours?: IFacultyOfficeHours;
}

/**
 * Administrator profile subdocument structure.
 */
export interface IAdminProfile {
  adminStaffId: string;
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
  fullName: string;
  role: UserRole;
  status: UserStatus;
  isProfileComplete: boolean;
  departmentId?: Nullable<Types.ObjectId>;
  phoneNumber?: Nullable<string>;
  avatarUrl?: Nullable<string>;
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
  fullName: string;
  role: UserRole;
  status: UserStatus;
  isProfileComplete: boolean;
  departmentId?: Nullable<string>;
  phoneNumber?: Nullable<string>;
  avatarUrl?: Nullable<string>;
  studentProfile?: Nullable<IStudentProfile>;
  facultyProfile?: Nullable<IFacultyProfile>;
  adminProfile?: Nullable<IAdminProfile>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input DTO for user creation.
 */
export interface CreateUserInput {
  email: string;
  fullName: string;
  role: UserRole;
  status?: UserStatus;
  authProviderId?: string;
  departmentId?: string;
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
  studentProfile?: {
    section?: string;
  };
  facultyProfile?: {
    cabinRoom?: string;
    officeHours?: IFacultyOfficeHours;
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
  fullName?: string;
  avatarUrl?: Nullable<string>;
  role: UserRole;
  status?: UserStatus;
  departmentId?: Optional<string>;
}
