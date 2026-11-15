/**
 * Account Activation Request Validation Schemas (Zod).
 * Enforces token integrity, collegiate email verification, and strong password constraints.
 */

import { z } from 'zod';
import { emailSchema } from './common-schemas';

export const validateActivationQuerySchema = z.object({
  token: z
    .string({ message: 'Activation token is required' })
    .trim()
    .min(16, 'Activation token is invalid or malformed'),
  email: emailSchema,
});

export const activateAccountSchema = z
  .object({
    token: z
      .string({ message: 'Activation token is required' })
      .trim()
      .min(16, 'Activation token is invalid or malformed'),
    email: emailSchema,
    password: z
      .string({ message: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        'Password must contain at least one special character'
      ),
    confirmPassword: z.string({ message: 'Please confirm your password' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const resendActivationSchema = z.object({
  email: emailSchema,
});

export type ValidateActivationQueryInput = z.infer<typeof validateActivationQuerySchema>;
export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;
export type ResendActivationInput = z.infer<typeof resendActivationSchema>;

