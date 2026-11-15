/**
 * One-Time Passcode (OTP) Request & Verification Schemas (Zod).
 * Enforces strict 6-digit numeric validation, institutional email formats, and purpose invariants.
 */

import { z } from 'zod';
import { emailSchema } from './common-schemas';
import { OTP_PURPOSES } from '@/lib/db/models/otp.model';

export const requestOtpSchema = z.object({
  email: emailSchema,
  purpose: z.enum(OTP_PURPOSES as [string, ...string[]], {
    message: "Invalid OTP purpose. Must be 'email_verification', 'account_activation', or 'password_recovery'",
  }),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: z
    .string({ message: 'Verification code is required' })
    .trim()
    .regex(/^\d{6}$/, 'Verification code must be exactly 6 numeric digits'),
  purpose: z.enum(OTP_PURPOSES as [string, ...string[]], {
    message: "Invalid OTP purpose. Must be 'email_verification', 'account_activation', or 'password_recovery'",
  }),
});

export const resendOtpSchema = requestOtpSchema;

export type RequestOtpSchemaInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpSchemaInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpSchemaInput = z.infer<typeof resendOtpSchema>;

