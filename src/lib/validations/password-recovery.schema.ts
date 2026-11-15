/**
 * Zod Validation Schemas for Password Recovery & Reset Workflows.
 * Supports Phase 5.2.7 specifications:
 * - Validates institutional email or username identifier for forgot-password requests
 * - Enforces strong password complexity for password resets
 * - Validates presence of cryptographic verification proof tokens
 */

import { z } from 'zod';
import { emailSchema } from './common-schemas';

export const strongRecoveryPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    'Password must contain at least one special character'
  );

export const passwordRecoveryRequestSchema = z.object({
  identifier: z
    .string({ message: 'Institutional email or username is required' })
    .trim()
    .min(3, 'Identifier must be at least 3 characters long')
    .max(100, 'Identifier cannot exceed 100 characters')
    .toLowerCase(),
});

export const passwordResetSchema = z
  .object({
    email: emailSchema,
    verificationProofToken: z
      .string({ message: 'Verification proof token is required' })
      .trim()
      .min(10, 'Verification proof token is invalid or malformed'),
    password: strongRecoveryPasswordSchema,
    confirmPassword: z.string({ message: 'Please confirm your new password' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type PasswordRecoveryRequestSchemaInput = z.infer<typeof passwordRecoveryRequestSchema>;
export type PasswordResetSchemaInput = z.infer<typeof passwordResetSchema>;
