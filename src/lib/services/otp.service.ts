/**
 * Email OTP Verification Domain Service.
 * Manages 6-digit cryptographically secure code generation, SHA-256 storage,
 * 5-minute expiration windows, 60-second cooldown rate-limiting, and attempt exhaustion protection.
 */

import crypto from 'node:crypto';
import { OtpRepository } from '@/lib/db/repositories/otp.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { EmailService } from './email.service';
import {
  ValidationError,
  AppError,
} from '@/lib/errors/app-error';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';
import { logger } from '@/lib/logging/logger';
import {
  requestOtpSchema,
  verifyOtpSchema,
  type RequestOtpSchemaInput,
  type VerifyOtpSchemaInput,
} from '@/lib/validations/otp.schema';
import type {
  RequestOtpResponse,
  VerifyOtpResponse,
  OtpPurpose,
} from '@/types/otp';

export class OtpService {
  /**
   * OTP expiration TTL: 5 minutes (300 seconds).
   */
  public static OTP_EXPIRATION_MS = 5 * 60 * 1000;

  /**
   * Verification proof token expiration TTL: 15 minutes (900 seconds).
   */
  public static PROOF_EXPIRATION_MS = 15 * 60 * 1000;

  /**
   * Resolves the HMAC secret used to sign verification proof tokens.
   * Fail-closed in production: refuses hardcoded fallbacks when NODE_ENV === 'production'.
   */
  private static getProofHmacSecret(): string {
    const configuredSecret = process.env.OTP_HMAC_SECRET || process.env.CLERK_SECRET_KEY;
    if (configuredSecret && configuredSecret.trim().length > 0) {
      return configuredSecret.trim();
    }

    if (process.env.NODE_ENV === 'production') {
      throw new AppError(
        'Server configuration error: OTP_HMAC_SECRET or CLERK_SECRET_KEY must be configured in production.',
        ERROR_CODES.INTERNAL_ERROR,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    return 'axis-linkup-dev-otp-secret';
  }

  /**
   * Cooldown window between resend requests: 60 seconds.
   */
  public static RESEND_COOLDOWN_MS = 60 * 1000;

  /**
   * Maximum failed verification attempts before the OTP is invalidated.
   */
  public static MAX_ATTEMPTS = 5;

  /**
   * Generates a cryptographically secure 6-digit numeric OTP code.
   * e.g. "492015"
   */
  public static generateOtpCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Computes SHA-256 hash of the 6-digit OTP code for secure persistence.
   */
  public static hashOtp(otpCode: string): string {
    return crypto.createHash('sha256').update(otpCode).digest('hex');
  }

  /**
   * Requests a fresh OTP code for email verification, account activation, or password recovery.
   * Enforces 60-second resend cooldown and invalidates previous active OTPs.
   */
  public static async requestOtp(input: RequestOtpSchemaInput): Promise<RequestOtpResponse> {
    const validated = requestOtpSchema.parse(input);
    const normalizedEmail = validated.email.toLowerCase().trim();

    // 1. Contextual User Lifecycle Checks (AUD-H11 Anti-Enumeration Defense)
    // Suppress OTP dispatch silently for non-existent or restricted accounts instead of
    // throwing 404/403 status-leaking errors on public OTP request endpoints.
    const existingUser = await UserRepository.findByEmail(normalizedEmail);
    const nowInit = Date.now();
    const genericResendAvailableAt = new Date(nowInit + this.RESEND_COOLDOWN_MS);
    const genericSuppressedResponse: RequestOtpResponse = {
      email: EmailService.maskEmail(normalizedEmail),
      purpose: validated.purpose as OtpPurpose,
      resendAvailableAt: genericResendAvailableAt.toISOString(),
      expiresInSeconds: Math.floor(this.OTP_EXPIRATION_MS / 1000),
      resendAvailableInSeconds: Math.floor(this.RESEND_COOLDOWN_MS / 1000),
      expiresInMinutes: Math.floor(this.OTP_EXPIRATION_MS / 60000),
    };

    if (validated.purpose === 'password_recovery') {
      if (
        !existingUser ||
        existingUser.status === 'suspended' ||
        existingUser.status === 'deactivated' ||
        existingUser.status === 'archived' ||
        existingUser.status === 'graduated'
      ) {
        logger.info(
          `[OtpService] Suppressed password_recovery OTP for unrecognized or restricted account (${EmailService.maskEmail(normalizedEmail)})`
        );
        return genericSuppressedResponse;
      }
    } else if (
      validated.purpose === 'account_activation' ||
      validated.purpose === 'email_verification'
    ) {
      if (
        existingUser &&
        (existingUser.status === 'suspended' ||
          existingUser.status === 'deactivated' ||
          existingUser.status === 'archived')
      ) {
        logger.info(
          `[OtpService] Suppressed ${validated.purpose} OTP for restricted account (${EmailService.maskEmail(normalizedEmail)})`
        );
        return genericSuppressedResponse;
      }
    }

    // 2. Cooldown & Rate Limiting Enforcement
    const latestOtp = await OtpRepository.findLatestUnconsumedOtp(
      normalizedEmail,
      validated.purpose as OtpPurpose
    );

    if (latestOtp && new Date() < latestOtp.resendAvailableAt) {
      const waitSeconds = Math.ceil(
        (latestOtp.resendAvailableAt.getTime() - Date.now()) / 1000
      );
      throw new AppError(
        `Please wait ${waitSeconds} second(s) before requesting another verification code.`,
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        HTTP_STATUS.TOO_MANY_REQUESTS
      );
    }

    // 3. Generate Cryptographic 6-Digit Code & Hashes
    const otpCode = this.generateOtpCode();
    const hashedOtp = this.hashOtp(otpCode);
    const now = Date.now();
    const expiresAt = new Date(now + this.OTP_EXPIRATION_MS);
    const resendAvailableAt = new Date(now + this.RESEND_COOLDOWN_MS);

    // 4. Persist in Database (automatically invalidating previous active OTPs)
    await OtpRepository.createOtp({
      email: normalizedEmail,
      hashedOtp,
      purpose: validated.purpose as OtpPurpose,
      expiresAt,
      resendAvailableAt,
      userId: existingUser?._id.toString(),
      maxAttempts: this.MAX_ATTEMPTS,
    });

    // 5. Dispatch via Email Service
    await EmailService.sendOtpEmail({
      to: normalizedEmail,
      otpCode,
      purpose: validated.purpose as OtpPurpose,
      expiresInMinutes: 5,
      recipientName: existingUser?.fullName,
    });

    logger.info(
      `[OtpService] Successfully issued ${validated.purpose} OTP to ${EmailService.maskEmail(normalizedEmail)}`
    );

    return {
      email: normalizedEmail,
      purpose: validated.purpose as OtpPurpose,
      resendAvailableAt: resendAvailableAt.toISOString(),
      expiresInSeconds: Math.floor(this.OTP_EXPIRATION_MS / 1000),
      resendAvailableInSeconds: Math.floor(this.RESEND_COOLDOWN_MS / 1000),
      expiresInMinutes: Math.floor(this.OTP_EXPIRATION_MS / 60000),
    };
  }

  /**
   * Verifies a 6-digit candidate OTP code using timing-safe hash comparison.
   * Decrements remaining attempts and invalidates the code on match or exhaustion.
   */
  public static async verifyOtp(input: VerifyOtpSchemaInput): Promise<VerifyOtpResponse> {
    const validated = verifyOtpSchema.parse(input);
    const normalizedEmail = validated.email.toLowerCase().trim();

    // 1. Retrieve Active OTP Document
    const activeOtp = await OtpRepository.findActiveOtp(
      normalizedEmail,
      validated.purpose as OtpPurpose
    );

    if (!activeOtp) {
      // Differentiate between expired OTP and nonexistent OTP
      const latestUnconsumed = await OtpRepository.findLatestUnconsumedOtp(
        normalizedEmail,
        validated.purpose as OtpPurpose
      );

      if (latestUnconsumed && new Date() > latestUnconsumed.expiresAt) {
        throw new AppError(
          'Verification code has expired. Please request a new code.',
          ERROR_CODES.VALIDATION_ERROR,
          HTTP_STATUS.GONE
        );
      }

      throw new ValidationError(
        'No active verification code found for this request. Please request a new code.'
      );
    }

    // 2. Check Attempt Counter Boundary
    if (activeOtp.attempts >= activeOtp.maxAttempts) {
      await OtpRepository.consumeOtp(activeOtp._id.toString());
      throw new AppError(
        'Maximum verification attempts exceeded. Code has been invalidated. Please request a new code.',
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        HTTP_STATUS.TOO_MANY_REQUESTS
      );
    }

    // 3. Timing-Safe Hash Comparison
    const candidateHash = this.hashOtp(validated.otp);
    const candidateBuffer = Buffer.from(candidateHash, 'hex');
    const storedBuffer = Buffer.from(activeOtp.hashedOtp, 'hex');

    let isMatch = false;
    if (candidateBuffer.length === storedBuffer.length) {
      isMatch = crypto.timingSafeEqual(candidateBuffer, storedBuffer);
    }

    if (!isMatch) {
      const updatedOtp = await OtpRepository.incrementAttempts(activeOtp._id.toString());
      const newAttempts = updatedOtp ? updatedOtp.attempts : activeOtp.attempts + 1;
      const remaining = activeOtp.maxAttempts - newAttempts;

      if (remaining <= 0) {
        await OtpRepository.consumeOtp(activeOtp._id.toString());
        throw new AppError(
          'Invalid verification code. Maximum attempts exceeded. Code has been invalidated.',
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          HTTP_STATUS.TOO_MANY_REQUESTS
        );
      }

      throw new ValidationError(
        `Invalid verification code. ${remaining} attempt(s) remaining.`
      );
    }

    // 4. Code Matched: Atomically Consume OTP to prevent replay and concurrent race conditions
    const consumedRecord = await OtpRepository.consumeOtp(activeOtp._id.toString());
    if (!consumedRecord) {
      throw new ValidationError(
        'Verification code has already been consumed or processed. Please request a new code.'
      );
    }

    // 5. Update Collegiate User Verification State if Applicable
    if (
      validated.purpose === 'email_verification' ||
      validated.purpose === 'account_activation'
    ) {
      const user = await UserRepository.findByEmail(normalizedEmail);
      if (user) {
        await UserRepository.syncExternalProfile(user.authProviderId || '', {
          email: normalizedEmail,
          isEmailVerified: true,
        });
      }
    }

    // 6. Generate Single-Use Cryptographic Proof Token (used to authorize password reset)
    const { rawToken, tokenHash, expiresAt: proofExpiresAt } = this.generateProofToken(
      normalizedEmail,
      validated.purpose as OtpPurpose
    );

    try {
      await OtpRepository.setVerificationProof(
        activeOtp._id.toString(),
        tokenHash,
        proofExpiresAt
      );
    } catch (proofErr) {
      logger.warn(
        `[OtpService] Could not persist proof token hash to OTP doc: ${proofErr}`
      );
    }

    logger.info(
      `[OtpService] Successfully verified ${validated.purpose} code for ${EmailService.maskEmail(normalizedEmail)}`
    );

    return {
      verified: true,
      email: normalizedEmail,
      purpose: validated.purpose as OtpPurpose,
      verificationProofToken: rawToken,
    };
  }

  /**
   * Generates a signed, self-contained, time-limited verification proof token.
   * Bound to user email, purpose, 15-minute expiration, and random cryptographic nonce.
   */
  public static generateProofToken(
    email: string,
    purpose: OtpPurpose
  ): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const proofSecret = this.getProofHmacSecret();
    const now = Date.now();
    const expiresAtMs = now + this.PROOF_EXPIRATION_MS;
    const payload = {
      email: email.toLowerCase().trim(),
      purpose,
      issuedAt: now,
      expiresAt: expiresAtMs, // 15 minutes TTL
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', proofSecret)
      .update(payloadStr)
      .digest('hex');
    const rawToken = `${payloadStr}.${signature}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash, expiresAt: new Date(expiresAtMs) };
  }

  /**
   * Cryptographically verifies an HMAC verification proof token.
   * Checks structure, timing-safe HMAC signature, expiration, and purpose binding.
   */
  public static verifyProofToken(
    rawToken: string,
    expectedPurpose: OtpPurpose = 'password_recovery'
  ): { email: string; purpose: OtpPurpose; issuedAt: number; expiresAt: number; nonce: string } {
    if (!rawToken || typeof rawToken !== 'string' || !rawToken.includes('.')) {
      throw new ValidationError('Invalid or malformed verification proof token.');
    }

    const [payloadStr, candidateSignature] = rawToken.split('.');
    if (!payloadStr || !candidateSignature) {
      throw new ValidationError('Malformed verification proof token structure.');
    }

    const proofSecret = this.getProofHmacSecret();
    const expectedSignature = crypto
      .createHmac('sha256', proofSecret)
      .update(payloadStr)
      .digest('hex');

    const candidateBuf = Buffer.from(candidateSignature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');

    if (
      candidateBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      throw new ValidationError('Cryptographic signature verification failed for proof token.');
    }

    let payload: {
      email: string;
      purpose: OtpPurpose;
      issuedAt: number;
      expiresAt: number;
      nonce: string;
    };
    try {
      payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    } catch {
      throw new ValidationError('Failed to decode verification proof token payload.');
    }

    if (Date.now() > payload.expiresAt) {
      throw new AppError(
        'Verification proof token has expired. Please verify your email code again.',
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.GONE
      );
    }

    if (payload.purpose !== expectedPurpose) {
      throw new ValidationError(
        `Proof token purpose mismatch. Expected "${expectedPurpose}", received "${payload.purpose}".`
      );
    }

    return payload;
  }

  /**
   * Resends an OTP code, enforcing cooldown boundaries.
   */
  public static async resendOtp(input: RequestOtpSchemaInput): Promise<RequestOtpResponse> {
    return this.requestOtp(input);
  }
}

export default OtpService;
