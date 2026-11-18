/**
 * Account Activation Domain Service.
 * Orchestrates time-limited cryptographic activation tokens, password establishment,
 * Clerk IAM synchronization, and atomic state transition from 'pending_verification' to 'active'.
 */

import crypto from 'node:crypto';
import { clerkClient } from '@clerk/nextjs/server';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  AppError,
} from '@/lib/errors/app-error';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';
import { logger } from '@/lib/logging/logger';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import {
  activateAccountSchema,
  validateActivationQuerySchema,
  type ActivateAccountInput,
} from '@/lib/validations/activation.schema';
import type { IUser, UserSession } from '@/types/user';
import type {
  ActivationTokenResult,
  ActivationValidationResponse,
  AccountActivationResult,
} from '@/types/activation';

export class ActivationService {
  /**
   * Activation token time-to-live: 24 hours.
   */
  public static ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

  /**
   * Clerk Client Resolver (overridable for unit test mock injection).
   */
  public static async getClerkClient() {
    return clerkClient();
  }

  /**
   * Cryptographically hashes a raw token using SHA-256.
   */
  public static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Issues a secure, unguessable, time-limited cryptographic activation token for a user.
   * Stores only the SHA-256 hash in the database to prevent token exposure.
   */
  public static async createActivationToken(user: IUser): Promise<ActivationTokenResult> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.ACTIVATION_TOKEN_TTL_MS);

    await UserRepository.setActivationToken(user._id.toString(), tokenHash, expiresAt);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const activationUrl = `${baseUrl}/activate?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    logger.info(`[ActivationService] Generated activation token for user ${user._id} (${user.email})`);

    return {
      rawToken,
      expiresAt,
      activationUrl,
    };
  }

  /**
   * Validates an activation invitation link without establishing a password or modifying state.
   */
  public static async validateInvitation(
    rawToken: string,
    email: string
  ): Promise<ActivationValidationResponse> {
    const validated = validateActivationQuerySchema.parse({ token: rawToken, email });
    const normalizedEmail = validated.email.toLowerCase().trim();

    const user = await UserRepository.findByEmail(normalizedEmail);
    const providedHash = this.hashToken(validated.token);

    // 1. Anti-Enumeration & Timing-Safe Token Proof Verification FIRST (AUD-H11)
    // Never reveal account existence or lifecycle status to callers who do not hold the valid secret token.
    const storedHash = user?.activationTokenHash || '';
    const hasMatchingToken =
      Boolean(user) &&
      storedHash.length === providedHash.length &&
      storedHash.length > 0 &&
      crypto.timingSafeEqual(Buffer.from(providedHash, 'utf8'), Buffer.from(storedHash, 'utf8'));

    if (!user || !hasMatchingToken) {
      throw new ValidationError(
        'This activation invitation is invalid, tampered, has already been used, or is no longer valid.'
      );
    }

    // 2. Account Lifecycle Boundary Assertions (evaluated ONLY after cryptographic token proof passes)
    if (user.status === 'suspended') {
      throw new ForbiddenError(
        'Suspended collegiate accounts cannot be activated without authorized administrative intervention.'
      );
    }

    if (user.status === 'deactivated') {
      throw new ForbiddenError('Deactivated accounts cannot be activated.');
    }

    if (user.status === 'archived' || user.status === 'graduated') {
      throw new ForbiddenError('Archived or graduated accounts cannot be activated.');
    }

    if (user.status === 'active' || user.activatedAt) {
      throw new ConflictError(
        'This collegiate account has already been activated. Please proceed to sign in.'
      );
    }

    // 3. Token Expiration Assertion (HTTP 410 Gone)
    if (user.activationTokenExpiresAt && new Date() > user.activationTokenExpiresAt) {
      throw new AppError(
        'This activation invitation has expired. Please contact your system administrator to request a new invitation.',
        ERROR_CODES.VALIDATION_ERROR,
        HTTP_STATUS.GONE
      );
    }

    return {
      valid: true,
      email: user.email,
      fullName: user.fullName,
      username: user.username || '',
      role: user.role,
      isEmailVerified: !!user.isEmailVerified,
    };
  }

  /**
   * Completes the account activation workflow:
   * Sets the user's password in Clerk, marks Clerk publicMetadata status to 'active',
   * marks MongoDB user record status to 'active', and clears the activation token.
   */
  public static async activateAccount(
    input: ActivateAccountInput
  ): Promise<AccountActivationResult> {
    const validated = activateAccountSchema.parse(input);
    const normalizedEmail = validated.email.toLowerCase().trim();

    // 1. Perform full invitation validation
    await this.validateInvitation(validated.token, normalizedEmail);

    const user = await UserRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundError('Collegiate account not found.');
    }

    const authProviderId = user.authProviderId;
    if (!authProviderId) {
      throw new AppError(
        'Account is missing linked external authentication provider identifier.',
        ERROR_CODES.INTERNAL_ERROR,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    // 2. Update Password and Identity Metadata in Clerk IAM
    const client = await this.getClerkClient();
    try {
      await client.users.updateUser(authProviderId, {
        password: validated.password,
      });

      await client.users.updateUserMetadata(authProviderId, {
        publicMetadata: {
          role: user.role,
          adminSubRole: user.adminSubRole || undefined,
          status: 'active',
          isProvisioned: true,
        },
      });

      logger.info(
        `[ActivationService] Updated Clerk password and metadata for user: ${authProviderId} (${user.email})`
      );
    } catch (clerkErr: unknown) {
      const errMsg = clerkErr instanceof Error ? clerkErr.message : String(clerkErr);
      logger.error(
        `[ActivationService] Failed to update Clerk password for user ${authProviderId} | error=${errMsg}`
      );
      throw new AppError(
        'External authentication gateway could not establish password. Please verify password complexity.',
        ERROR_CODES.INTERNAL_ERROR,
        HTTP_STATUS.BAD_GATEWAY
      );
    }

    // 3. Atomically Complete Database State Transition
    const activatedAt = new Date();
    const updatedUser = await UserRepository.completeAccountActivation(
      user._id.toString(),
      activatedAt
    );

    if (!updatedUser) {
      // Check if a concurrent request already finalized the activation
      const existingUser = await UserRepository.findById(user._id.toString());
      if (existingUser && existingUser.status === 'active') {
        logger.info(
          `[ActivationService] Account was already activated concurrently for user ${user._id} (${user.email})`
        );
        return {
          email: existingUser.email,
          username: existingUser.username || '',
          role: existingUser.role,
          status: 'active',
          activatedAt: (existingUser.activatedAt || activatedAt).toISOString(),
        };
      }

      throw new AppError(
        'Failed to finalize account activation in collegiate database.',
        ERROR_CODES.DATABASE_ERROR,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    logger.info(
      `[ActivationService] Account activated successfully for user ${updatedUser._id} (${updatedUser.email})`
    );

    return {
      email: updatedUser.email,
      username: updatedUser.username || '',
      role: updatedUser.role,
      status: 'active',
      activatedAt: activatedAt.toISOString(),
    };
  }

  /**
   * Allows an authorized System Administrator to re-issue an activation link
   * for an unactivated student or faculty account.
   */
  public static async resendActivationInvitation(
    email: string,
    callerSession: UserSession
  ): Promise<ActivationTokenResult> {
    assertCanManageUserRoles(
      callerSession,
      'Only System Administrators are authorized to re-issue account activation invitations.'
    );

    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundError(`No collegiate account found with email "${normalizedEmail}".`);
    }

    if (user.status === 'active' || user.activatedAt) {
      throw new ConflictError(
        `Cannot re-issue activation invitation: account "${normalizedEmail}" is already active.`
      );
    }

    if (user.status === 'suspended') {
      throw new ForbiddenError(
        `Cannot re-issue activation invitation: account "${normalizedEmail}" is suspended.`
      );
    }

    return this.createActivationToken(user);
  }
}

export default ActivationService;

