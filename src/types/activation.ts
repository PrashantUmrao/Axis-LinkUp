/**
 * Account Activation Data Contracts & Types.
 * Supports Phase 5.2.5 First-Time Account Activation & Password Setup.
 */

import type { UserRole } from './user';

export interface ActivationValidationResponse {
  valid: boolean;
  email: string;
  fullName: string;
  username: string;
  role: UserRole;
  departmentCode?: string;
  isEmailVerified?: boolean;
}

export interface ActivationTokenResult {
  rawToken: string;
  expiresAt: Date;
  activationUrl: string;
}

export interface AccountActivationResult {
  email: string;
  username: string;
  role: UserRole;
  status: 'active';
  activatedAt: string;
}

