/**
 * Single-Account Provisioning Request Validation Schema (Zod).
 * Enforces strict input validation, institutional formatting,
 * and role-invariant rules for System Administrator user provisioning.
 * Supports Student and Faculty account provisioning, plus Administrative Provisioning.
 */

import { z } from 'zod';
import { emailSchema, usernameSchema, adminSubRoleSchema } from './common-schemas';
import { studentProfileSchema, facultyProfileSchema, adminProfileSchema } from './user.schema';

/**
 * Single-account provisioning schema for Student and Faculty rosters.
 */
export const provisionUserSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must contain at least 2 characters')
      .max(100, 'Full name cannot exceed 100 characters'),
    username: usernameSchema,
    email: emailSchema,
    password: z
      .string()
      .trim()
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters')
      .optional()
      .or(z.literal(''))
      .transform((val) => (val ? val : undefined)),
    role: z.enum(['student', 'faculty'], {
      message: "Account role must be either 'student' or 'faculty'",
    }),
    departmentId: z
      .string()
      .trim()
      .min(1, 'Department identifier or code is required'),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format')
      .optional(),
    studentProfile: studentProfileSchema.optional(),
    facultyProfile: facultyProfileSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'student' && !data.studentProfile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentProfile'],
        message:
          'Student profile details (including roll number) are required for student accounts',
      });
    }
    if (data.role === 'faculty' && !data.facultyProfile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['facultyProfile'],
        message:
          'Faculty profile details (including employee ID and designation) are required for faculty accounts',
      });
    }
  });

export type ProvisionUserInput = z.infer<typeof provisionUserSchema>;

/**
 * Dedicated provisioning schema for Authorized Administrative Accounts (HOD, Director, SysAdmin).
 */
export const provisionAdminSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must contain at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters'),
  username: usernameSchema,
  email: emailSchema,
  password: z
    .string()
    .trim()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val ? val : undefined)),
  role: z.enum(['admin', 'super_admin']),
  adminSubRole: adminSubRoleSchema,
  departmentId: z.string().trim().min(1).optional(),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format')
    .optional(),
  adminProfile: adminProfileSchema.optional(),
});

export type ProvisionAdminInput = z.infer<typeof provisionAdminSchema>;
