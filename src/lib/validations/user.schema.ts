/**
 * User and Profile Validation Schemas (Zod).
 * Enforces strict validation, role invariant checks, and mass-assignment protection.
 */

import { z } from 'zod';
import {
  emailSchema,
  usernameSchema,
  adminSubRoleSchema,
  objectIdSchema,
  studentRollNumberSchema,
  safeHttpUrlSchema,
} from './common-schemas';
import { USER_ROLES, FACULTY_DESIGNATIONS } from '@/config/constants';

/**
 * Faculty designations enum validation schema.
 */
export const facultyDesignationSchema = z.enum(FACULTY_DESIGNATIONS);

/**
 * Valid student admission types.
 */
export const admissionTypeSchema = z.enum(['regular', 'lateral_entry']);

/**
 * Valid user statuses.
 */
export const userStatusSchema = z.enum([
  'pending_verification',
  'active',
  'suspended',
  'deactivated',
  'graduated',
  'invited',
  'archived',
]);

/**
 * Student profile subdocument validation schema.
 */
export const studentProfileSchema = z.object({
  rollNumber: studentRollNumberSchema,
  enrollmentNumber: z
    .string()
    .trim()
    .max(50)
    .transform((val) => (val && val.length > 0 ? val : undefined))
    .optional(),
  batchYear: z
    .number()
    .int('Batch year must be an integer')
    .min(2020, 'Batch year cannot be earlier than 2020')
    .max(2035, 'Batch year cannot exceed 2035'),
  currentSemester: z
    .number()
    .int('Semester must be an integer')
    .min(1, 'Minimum semester is 1')
    .max(8, 'Maximum semester is 8'),
  section: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Section is required')
    .max(5, 'Section code cannot exceed 5 characters'),
  program: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Program code must have at least 2 characters')
    .max(30, 'Program code cannot exceed 30 characters')
    .optional(),
  admissionYear: z
    .number()
    .int('Admission year must be an integer')
    .min(2018, 'Admission year cannot be earlier than 2018')
    .max(2035, 'Admission year cannot exceed 2035')
    .optional(),
  academicMentorId: objectIdSchema.optional(),
  admissionType: admissionTypeSchema.default('regular'),
});

/**
 * Faculty office hours schedule schema.
 */
export const facultyOfficeHoursSchema = z.object({
  start: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format (24-hour)'),
  end: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format (24-hour)'),
  isAcceptingDMs: z.boolean().default(true),
});

/**
 * Faculty profile subdocument validation schema.
 */
export const facultyProfileSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'Employee ID must have at least 3 characters')
    .max(30, 'Employee ID cannot exceed 30 characters'),
  designation: facultyDesignationSchema.or(
    z
      .string()
      .trim()
      .min(2, 'Designation must have at least 2 characters')
      .max(100, 'Designation cannot exceed 100 characters')
  ),
  qualifications: z.array(z.string().trim()).default([]),
  cabinRoom: z.string().trim().max(50, 'Cabin location cannot exceed 50 characters').optional(),
  assignedCourses: z.array(objectIdSchema).default([]),
  officeHours: facultyOfficeHoursSchema.optional(),
  specialization: z
    .array(z.string().trim().min(1, 'Specialization item cannot be empty').max(50))
    .max(10, 'Maximum 10 specializations allowed')
    .default([]),
  sharePhoneWithStudents: z.boolean().default(false),
});

/**
 * Administrator profile subdocument validation schema.
 */
export const adminProfileSchema = z.object({
  adminStaffId: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'Admin staff ID must have at least 3 characters')
    .max(30, 'Admin staff ID cannot exceed 30 characters'),
  administrativeDomain: z
    .string()
    .trim()
    .min(2, 'Administrative domain must have at least 2 characters')
    .max(100, 'Administrative domain cannot exceed 100 characters'),
  designation: z.string().trim().max(100, 'Designation cannot exceed 100 characters').optional(),
  assignedQueueScopes: z.array(z.string().trim()).default([]),
  emergencyOverridePermitted: z.boolean().default(false),
});

/**
 * Comprehensive User Creation schema.
 */
export const createUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema.optional(),
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must have at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  role: z.enum(USER_ROLES),
  adminSubRole: adminSubRoleSchema.optional(),
  status: userStatusSchema.default('pending_verification'),
  isEmailVerified: z.boolean().default(false),
  authProviderId: z.string().trim().min(1).optional(),
  departmentId: objectIdSchema.optional(),
  provisionedBy: objectIdSchema.optional(),
  activatedAt: z.coerce.date().optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(
      /^\+?[1-9]\d{9,14}$/,
      'Invalid phone number format. Use E.164 standard (e.g. +919876543210)'
    )
    .optional(),
  avatarUrl: safeHttpUrlSchema.optional(),
  isProfileComplete: z.boolean().default(false),
  studentProfile: studentProfileSchema.optional(),
  facultyProfile: facultyProfileSchema.optional(),
  adminProfile: adminProfileSchema.optional(),
});

/**
 * Self-service User Profile Update schema.
 * Strictly whitelisted: Prevents client mass-assignment of role, status, or system identifiers.
 * Architectural Decision 2: Student section cannot be modified by students (admin/HOD only).
 * Architectural Decision 3: Faculty phone privacy toggle and specialization self-management.
 */
export const updateUserProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must have at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters')
    .optional(),
  bio: z.string().trim().max(500, 'Bio cannot exceed 500 characters').optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format')
    .optional(),
  avatarUrl: safeHttpUrlSchema.optional(),
  facultyProfile: z
    .object({
      cabinRoom: z.string().trim().max(50).optional(),
      officeHours: facultyOfficeHoursSchema.optional(),
      specialization: z
        .array(z.string().trim().min(1).max(50))
        .max(10, 'Maximum 10 specializations allowed')
        .optional(),
      sharePhoneWithStudents: z.boolean().optional(),
    })
    .optional(),
});

export const selfServiceProfileUpdateSchema = updateUserProfileSchema;

/**
 * Administrative Academic Profile Mutation Schema.
 * Whitelisted for authorized academic updates by System Administrators and HODs.
 */
export const adminAcademicUpdateSchema = z.object({
  departmentId: objectIdSchema.optional(),
  program: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Program code must have at least 2 characters')
    .max(30, 'Program code cannot exceed 30 characters')
    .optional(),
  batchYear: z
    .number()
    .int('Batch year must be an integer')
    .min(2020, 'Batch year cannot be earlier than 2020')
    .max(2035, 'Batch year cannot exceed 2035')
    .optional(),
  admissionYear: z
    .number()
    .int('Admission year must be an integer')
    .min(2018, 'Admission year cannot be earlier than 2018')
    .max(2035, 'Admission year cannot exceed 2035')
    .optional(),
  currentSemester: z
    .number()
    .int('Semester must be an integer')
    .min(1, 'Minimum semester is 1')
    .max(8, 'Maximum semester is 8')
    .optional(),
  section: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Section is required')
    .max(5, 'Section code cannot exceed 5 characters')
    .optional(),
  designation: facultyDesignationSchema
    .or(z.string().trim().min(2).max(100))
    .optional(),
});

/**
 * Department Academic Roster Query Validation Schema.
 * Validates query parameters for GET /api/v1/departments/[id]/roster.
 * Enforces parameter bounds, cohort constraints, and cursor/page pagination limits.
 */
export const departmentRosterQuerySchema = z.object({
  program: z
    .string()
    .trim()
    .transform((val) => (val && val.length > 0 ? val.toUpperCase() : undefined))
    .optional(),
  batchYear: z.coerce
    .number()
    .int('Batch year must be an integer')
    .min(2020, 'Batch year cannot be earlier than 2020')
    .max(2035, 'Batch year cannot exceed 2035')
    .optional(),
  currentSemester: z.coerce
    .number()
    .int('Current semester must be an integer')
    .min(1, 'Minimum semester is 1')
    .max(8, 'Maximum semester is 8')
    .optional(),
  section: z
    .string()
    .trim()
    .transform((val) => (val && val.length > 0 ? val.toUpperCase() : undefined))
    .optional(),
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(50),
  cursor: z
    .string()
    .trim()
    .transform((val) => (val && val.length > 0 ? val : undefined))
    .pipe(objectIdSchema.optional())
    .optional(),
});

export type DepartmentRosterQueryParams = z.infer<typeof departmentRosterQuerySchema>;

/**
 * Administrator Role & Status Mutation schema (Protected Server Action).
 * Allows authorized administrators (and HODs for departmental students) to update user attributes,
 * including student academic cohort fields (section, program, batch) and faculty credentials.
 */
export const adminUpdateUserSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  adminSubRole: adminSubRoleSchema.nullable().optional(),
  status: userStatusSchema.optional(),
  isEmailVerified: z.boolean().optional(),
  departmentId: objectIdSchema.optional(),
  isProfileComplete: z.boolean().optional(),
  provisionedBy: objectIdSchema.optional(),
  activatedAt: z.coerce.date().nullable().optional(),
  studentProfile: z
    .object({
      rollNumber: studentRollNumberSchema.optional(),
      enrollmentNumber: z
        .string()
        .trim()
        .max(50)
        .transform((val) => (val && val.length > 0 ? val : undefined))
        .optional(),
      batchYear: z.number().int().min(2020).max(2035).optional(),
      currentSemester: z.number().int().min(1).max(8).optional(),
      section: z.string().trim().toUpperCase().min(1).max(5).optional(),
      program: z.string().trim().toUpperCase().min(2).max(30).optional(),
      admissionYear: z.number().int().min(2018).max(2035).optional(),
      academicMentorId: objectIdSchema.optional(),
      admissionType: admissionTypeSchema.optional(),
    })
    .optional(),
  facultyProfile: z
    .object({
      employeeId: z.string().trim().toUpperCase().min(3).max(30).optional(),
      designation: facultyDesignationSchema
        .or(z.string().trim().min(2).max(100))
        .optional(),
      qualifications: z.array(z.string().trim()).optional(),
      cabinRoom: z.string().trim().max(50).optional(),
      assignedCourses: z.array(objectIdSchema).optional(),
      officeHours: facultyOfficeHoursSchema.optional(),
      specialization: z
        .array(z.string().trim().min(1).max(50))
        .max(10)
        .optional(),
      sharePhoneWithStudents: z.boolean().optional(),
    })
    .optional(),
  adminProfile: z
    .object({
      adminStaffId: z.string().trim().toUpperCase().min(3).max(30).optional(),
      administrativeDomain: z.string().trim().min(2).max(100).optional(),
      designation: z.string().trim().max(100).optional(),
      assignedQueueScopes: z.array(z.string().trim()).optional(),
      emergencyOverridePermitted: z.boolean().optional(),
    })
    .optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type SelfServiceProfileUpdateInput = z.infer<typeof selfServiceProfileUpdateSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminAcademicUpdateInput = z.infer<typeof adminAcademicUpdateSchema>;
