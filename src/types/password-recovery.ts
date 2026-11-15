/**
 * Password Recovery System Data Contracts & Types.
 * Supports Phase 5.2.7 forgot-password and password-reset workflows.
 */

import type { UserRole } from './user';
import type { OtpPurpose } from './otp';

export interface PasswordRecoveryRequestInput {
  identifier: string;
}

export interface PasswordRecoveryRequestResult {
  message: string;
  email?: string;
  maskedEmail?: string;
  cooldownSeconds?: number;
}

export interface PasswordResetInput {
  email: string;
  verificationProofToken: string;
  password: string;
  confirmPassword: string;
}

export interface PasswordResetResult {
  success: boolean;
  email: string;
  username?: string;
  role: UserRole;
  sessionsRevoked: number;
  message: string;
}

export interface VerificationProofPayload {
  email: string;
  purpose: OtpPurpose;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

