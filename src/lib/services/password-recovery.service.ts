/**
 * Password Recovery & Reset Domain Service.
 * Supports Phase 5.2.7 specifications:
 * - Anonymous entry with robust account enumeration defense
 * - OtpService integration with purpose='password_recovery'
 * - Cryptographic verification proof validation (HMAC-SHA256, expiration, user binding, replay protection)
 * - Permanent password update via Clerk backend SDK
 * - Automated revocation of active Clerk sessions
 * - Lifecycle gate invariants (suspended/deactivated accounts rejected)
 */

import crypto from 'node:crypto';
import { clerkClient } from '@clerk/nextjs/server';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { OtpRepository } from '@/lib/db/repositories/otp.repository';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  AppError,
} from '@/lib/errors/app-error';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';
import { logger } from '@/lib/logging/logger';
import {
  passwordRecoveryRequestSchema,
  passwordResetSchema,
  type PasswordRecoveryRequestSchemaInput,
  type PasswordResetSchemaInput,
} from '@/lib/validations/password-recovery.schema';
import type {
  PasswordRecoveryRequestResult,
  PasswordResetResult,
} from '@/types/password-recovery';

export class PasswordRecoveryService {
  /**
   * Generic status message for account enumeration defense.
   */
  public static GENERIC_REQUEST_NOTICE =
    'If an account matching that identifier exists, a verification code has been dispatched to its registered institutional email.';

  /**
   * Clerk Client Resolver (overridable for unit test mock injection).
   */
  public static async getClerkClient() {
    return clerkClient();
  }

  /**
   * Initiates the password recovery workflow.
   * Resolves institutional account by email or username.
   * Provides account enumeration protection by always returning a generic success notice.
   */
  public static async requestRecovery(
    input: PasswordRecoveryRequestSchemaInput
  ): Promise<PasswordRecoveryRequestResult> {
    const validated = passwordRecoveryRequestSchema.parse(input);
    const identifier = validated.identifier.toLowerCase().trim();

    // 1. Resolve collegiate account by either email or username
    const user = await UserRepository.findByIdentifier(identifier);

    // 2. Account Enumeration Defense:
    // If no user is found, return the generic success message without leaking account existence.
    if (!user) {
      logger.info(
        `[PasswordRecoveryService] Recovery requested for unrecognized identifier.`
      );
      return {
        message: this.GENERIC_REQUEST_NOTICE,
        cooldownSeconds: 60,
      };
    }

    // 3. Account Lifecycle Boundary Assertions:
    // For non-active accounts, suppress OTP dispatch while returning an identical generic notice
    // to prevent account status enumeration (AUD-H11).
    if (
      user.status === 'suspended' ||
      user.status === 'deactivated' ||
      user.status === 'archived' ||
      user.status === 'graduated'
    ) {
      logger.warn(
        `[PasswordRecoveryService] Recovery requested for ${user.status} account (${EmailService.maskEmail(user.email)}). Suppressing OTP dispatch.`
      );
      return {
        message: this.GENERIC_REQUEST_NOTICE,
        cooldownSeconds: 60,
      };
    }

    // 4. Request 6-digit OTP code using existing OtpService infrastructure
    const otpResult = await OtpService.requestOtp({
      email: user.email,
      purpose: 'password_recovery',
    });

    logger.info(
      `[PasswordRecoveryService] Dispatched password_recovery code for user ${user._id} (${EmailService.maskEmail(user.email)})`
    );

    // AUD-H11: NEVER return raw unmasked email in public recovery response
    return {
      message: this.GENERIC_REQUEST_NOTICE,
      maskedEmail: EmailService.maskEmail(user.email),
      cooldownSeconds: otpResult.resendAvailableInSeconds || 60,
    };
  }

  /**
   * Completes the password recovery workflow:
   * - Cryptographically verifies the verification proof token
   * - Enforces database-level replay defense against reused proof tokens
   * - Updates permanent password via Clerk backend SDK
   * - Revokes existing active Clerk sessions
   * - Atomically consumes the verification proof
   */
  public static async resetPassword(
    input: PasswordResetSchemaInput
  ): Promise<PasswordResetResult> {
    const validated = passwordResetSchema.parse(input);
    const normalizedEmail = validated.email.toLowerCase().trim();

    // 1. Cryptographically Verify Proof Token (Signature, Expiry, Purpose)
    const proofPayload = OtpService.verifyProofToken(
      validated.verificationProofToken,
      'password_recovery'
    );

    // 2. Cross-Account Verification Assertion
    if (proofPayload.email.toLowerCase() !== normalizedEmail) {
      throw new ValidationError(
        'Verification proof token does not match the specified institutional account.'
      );
    }

    // 3. Database Replay Defense (Stateful Proof Consumption)
    const proofTokenHash = crypto
      .createHash('sha256')
      .update(validated.verificationProofToken)
      .digest('hex');

    const otpDoc = await OtpRepository.findByProofTokenHash(proofTokenHash);
    if (!otpDoc) {
      throw new ValidationError(
        'Invalid or unrecognized verification proof. Please complete email verification again.'
      );
    }

    if (otpDoc.isProofConsumed) {
      throw new ValidationError(
        'This verification proof has already been used. Please request a new recovery code.'
      );
    }

    if (new Date() > otpDoc.expiresAt) {
      throw new AppError(
        'Verification proof has expired. Please verify your email code again.',
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.GONE
      );
    }

    // 4. Resolve Target Collegiate User & Lifecycle Invariants
    const user = await UserRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundError(
        `No collegiate account found with institutional email "${normalizedEmail}".`
      );
    }

    if (user.status === 'suspended') {
      throw new ForbiddenError(
        'Suspended collegiate accounts cannot recover passwords without administrative clearance.'
      );
    }

    if (user.status === 'deactivated' || user.status === 'archived' || user.status === 'graduated') {
      throw new ForbiddenError(
        'Deactivated collegiate accounts cannot recover passwords.'
      );
    }

    const authProviderId = user.authProviderId;
    if (!authProviderId) {
      throw new AppError(
        'Account is missing linked external authentication provider identifier.',
        ERROR_CODES.INTERNAL_ERROR,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    // 5. Atomically Claim & Consume the Verification Proof BEFORE executing Clerk mutation
    // Eliminates TOCTOU replay window under concurrent reset requests (AUD-C10 / AUD-M08).
    const consumedProof = await OtpRepository.consumeVerificationProof(otpDoc._id.toString());
    if (!consumedProof) {
      throw new ValidationError(
        'This verification proof has already been used or has expired. Please request a new recovery code.'
      );
    }

    // 6. Update Permanent Password in Clerk IAM
    const client = await this.getClerkClient();
    try {
      await client.users.updateUser(authProviderId, {
        password: validated.password,
      });

      logger.info(
        `[PasswordRecoveryService] Updated Clerk password for user ${authProviderId} (${EmailService.maskEmail(user.email)})`
      );
    } catch (clerkErr: unknown) {
      const errMsg = clerkErr instanceof Error ? clerkErr.message : String(clerkErr);
      logger.error(
        `[PasswordRecoveryService] Failed to update Clerk password for user ${authProviderId}: ${errMsg}`
      );
      throw new AppError(
        'External authentication gateway could not update password. Please verify password complexity.',
        ERROR_CODES.INTERNAL_ERROR,
        HTTP_STATUS.BAD_GATEWAY
      );
    }

    // 7. Revoke All Existing Active Clerk Sessions
    let sessionsRevoked = 0;
    try {
      const sessionList = await client.sessions.getSessionList({
        userId: authProviderId,
      });
      const sessions = Array.isArray(sessionList)
        ? sessionList
        : (sessionList as { data?: unknown[] })?.data || [];

      for (const s of sessions as Array<{ id: string; status?: string }>) {
        if (!s.status || s.status === 'active') {
          await client.sessions.revokeSession(s.id);
          sessionsRevoked++;
        }
      }

      logger.info(
        `[PasswordRecoveryService] Revoked ${sessionsRevoked} active session(s) for user ${authProviderId}`
      );
    } catch (sessionErr: unknown) {
      const errMsg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
      logger.warn(
        `[PasswordRecoveryService] Active session revocation encountered warning for user ${authProviderId}: ${errMsg}`
      );
    }

    logger.info(
      `[PasswordRecoveryService] Password recovery completed successfully for user ${user._id} (${EmailService.maskEmail(normalizedEmail)})`
    );

    return {
      success: true,
      email: user.email,
      username: user.username || undefined,
      role: user.role,
      sessionsRevoked,
      message:
        'Your password has been reset successfully. Please sign in with your new credentials.',
    };
  }
}

export default PasswordRecoveryService;
