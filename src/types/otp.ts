/**
 * Email OTP Verification System Types & Contracts.
 * Supports Phase 5.2.6 secure 6-digit email OTP verification.
 */

import type { Types, Document } from 'mongoose';

export type OtpPurpose = 'email_verification' | 'account_activation' | 'password_recovery';

export interface IOtpDocument extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  email: string;
  hashedOtp: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  resendAvailableAt: Date;
  isConsumed: boolean;
  consumedAt?: Date;
  proofTokenHash?: string | null;
  isProofConsumed?: boolean;
  proofConsumedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestOtpInput {
  email: string;
  purpose: OtpPurpose;
  userId?: string;
}

export interface VerifyOtpInput {
  email: string;
  otp: string;
  purpose: OtpPurpose;
}

export interface RequestOtpResponse {
  email: string;
  purpose: OtpPurpose;
  resendAvailableAt: string;
  expiresInSeconds: number;
  resendAvailableInSeconds?: number;
  expiresInMinutes?: number;
}

export interface VerifyOtpResponse {
  verified: boolean;
  email: string;
  purpose: OtpPurpose;
  verificationProofToken?: string;
}
