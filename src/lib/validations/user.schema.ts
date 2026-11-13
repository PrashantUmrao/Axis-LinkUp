/**
 * User and Profile Validation Schemas (Zod).
 * Enforces strict validation, role invariant checks, and mass-assignment protection.
 */

import { z } from 'zod';
import { emailSchema, objectIdSchema, studentRollNumberSchema } from './common-schemas';
import { USER_ROLES } from '@/config/constants';

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
  enrollmentNumber: z.string().trim().max(50).optional(),
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
  designation: z
    .string()
    .trim()
    .min(2, 'Designation must have at least 2 characters')
    .max(100, 'Designation cannot exceed 100 characters'),
  qualifications: z.array(z.string().trim()).default([]),
  cabinRoom: z.string().trim().max(50, 'Cabin location cannot exceed 50 characters').optional(),
  assignedCourses: z.array(objectIdSchema).default([]),
  officeHours: facultyOfficeHoursSchema.optional(),
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
  assignedQueueScopes: z.array(z.string().trim()).default([]),
  emergencyOverridePermitted: z.boolean().default(false),
});

/**
 * Comprehensive User Creation schema.
 */
export const createUserSchema = z.object({
  email: emailSchema,
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must have at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  role: z.enum(USER_ROLES),
  status: userStatusSchema.default('pending_verification'),
  authProviderId: z.string().trim().min(1).optional(),
  departmentId: objectIdSchema.optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(
      /^\+?[1-9]\d{9,14}$/,
      'Invalid phone number format. Use E.164 standard (e.g. +919876543210)'
    )
    .optional(),
  avatarUrl: z.string().trim().url('Invalid avatar URL').optional(),
  isProfileComplete: z.boolean().default(false),
  studentProfile: studentProfileSchema.optional(),
  facultyProfile: facultyProfileSchema.optional(),
  adminProfile: adminProfileSchema.optional(),
});

/**
 * Self-service User Profile Update schema.
 * Strictly whitelisted: Prevents client mass-assignment of role, status, or system identifiers.
 */
export const updateUserProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must have at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters')
    .optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format')
    .optional(),
  avatarUrl: z.string().trim().url('Invalid avatar URL').optional(),
  studentProfile: z
    .object({
      section: z.string().trim().toUpperCase().max(5).optional(),
    })
    .optional(),
  facultyProfile: z
    .object({
      cabinRoom: z.string().trim().max(50).optional(),
      officeHours: facultyOfficeHoursSchema.optional(),
    })
    .optional(),
});

/**
 * Administrator Role & Status Mutation schema (Protected Server Action).
 */
export const adminUpdateUserSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  status: userStatusSchema.optional(),
  departmentId: objectIdSchema.optional(),
  isProfileComplete: z.boolean().optional(),
});
