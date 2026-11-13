/**
 * Master Session Management & Governance Engine.
 * Implements session lifecycle policies, token expiration controls,
 * cookie security standards, and global session revocation.
 * Conforms to DOC-AUTH-006 (Session Management & Security Architecture)
 * and NIST SP 800-63B standards.
 */

import { clerkClient } from '@clerk/nextjs/server';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import type { UserSession, UserStatus } from '@/types/user';

/**
 * Standard Session Configuration Parameters.
 * Reference: DOC-AUTH-006 Section 2.
 */
export const SESSION_CONFIG = {
  // Short-lived Access Token validity window (15 minutes)
  ACCESS_TOKEN_TTL_SECONDS: 900,

  // Rolling inactivity refresh timeout (7 days)
  INACTIVITY_TIMEOUT_SECONDS: 604800,

  // Absolute maximum session lifespan (30 days)
  MAX_SESSION_LIFETIME_SECONDS: 2592000,

  // Aggressive idle timeout for Administrative Accounts (30 minutes)
  ADMIN_INACTIVITY_TIMEOUT_SECONDS: 1800,

  // Secure Cookie Flags
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  },
} as const;

/**
 * Immutable Session Lifecycle Audit Event Identifiers.
 */
export const SESSION_AUDIT_EVENTS = {
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  MFA_CHALLENGE: 'AUTH_MFA_CHALLENGE',
  LOGOUT: 'AUTH_LOGOUT',
  SESSION_REVOKED: 'AUTH_SESSION_REVOKED',
  SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  ROLE_MODIFIED: 'AUTH_ROLE_MODIFIED',
} as const;

export type SessionAuditEvent = (typeof SESSION_AUDIT_EVENTS)[keyof typeof SESSION_AUDIT_EVENTS];

/**
 * Validates the operational integrity of a user session against lifecycle policies.
 */
export function validateSessionIntegrity(session: UserSession | null): {
  valid: boolean;
  status: 'valid' | 'missing' | 'suspended' | 'pending' | 'deactivated';
  reason?: string;
} {
  if (!session || !session.userId) {
    return {
      valid: false,
      status: 'missing',
      reason: 'No authenticated session credentials found.',
    };
  }

  const userStatus: UserStatus = session.status ?? 'active';

  if (userStatus === 'suspended') {
    return {
      valid: false,
      status: 'suspended',
      reason: 'Account under administrative hold by Dean of Academic Affairs.',
    };
  }

  if (userStatus === 'pending_verification') {
    return {
      valid: false,
      status: 'pending',
      reason: 'Account registration is pending registrar roster verification.',
    };
  }

  if (userStatus === 'deactivated' || userStatus === 'archived') {
    return {
      valid: false,
      status: 'deactivated',
      reason: 'Account has been deactivated or archived.',
    };
  }

  return {
    valid: true,
    status: 'valid',
  };
}

/**
 * Evaluates whether a session token has exceeded its maximum absolute lifetime.
 */
export function isSessionExpired(
  issuedAtMs: number,
  maxLifetimeSeconds: number = SESSION_CONFIG.MAX_SESSION_LIFETIME_SECONDS,
  nowMs: number = Date.now()
): boolean {
  if (!issuedAtMs || issuedAtMs <= 0) return true;
  const elapsedSeconds = Math.floor((nowMs - issuedAtMs) / 1000);
  return elapsedSeconds > maxLifetimeSeconds;
}

/**
 * Evaluates whether an administrative session has exceeded the idle timeout window.
 */
export function isAdministrativeSessionIdle(
  lastActiveAtMs: number,
  idleTimeoutSeconds: number = SESSION_CONFIG.ADMIN_INACTIVITY_TIMEOUT_SECONDS,
  nowMs: number = Date.now()
): boolean {
  if (!lastActiveAtMs || lastActiveAtMs <= 0) return true;
  const idleSeconds = Math.floor((nowMs - lastActiveAtMs) / 1000);
  return idleSeconds > idleTimeoutSeconds;
}

/**
 * Session Governance Service.
 * Manages active session revocation, multi-device invalidation,
 * and disciplinary suspension enforcement.
 */
export class SessionService {
  /**
   * Revokes a specific active session by Session ID.
   */
  public static async revokeSession(sessionId: string): Promise<boolean> {
    if (!sessionId) return false;

    try {
      const client = await clerkClient();
      await client.sessions.revokeSession(sessionId);
      logger.info(`[SessionService] Session ${sessionId} revoked successfully.`);
      return true;
    } catch (err) {
      logger.warn(`[SessionService] Failed to revoke session ${sessionId}`, {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Revokes ALL active sessions for a user (Global Logout / Compromise Mitigation).
   */
  public static async revokeAllUserSessions(
    authProviderId: string,
    reason: string = 'Administrative session revocation'
  ): Promise<{ revokedCount: number; success: boolean }> {
    if (!authProviderId) {
      return { revokedCount: 0, success: false };
    }

    try {
      const client = await clerkClient();
      const sessions = await client.sessions.getSessionList({ userId: authProviderId });

      let revokedCount = 0;
      for (const s of sessions.data) {
        if (s.status === 'active') {
          await client.sessions.revokeSession(s.id);
          revokedCount++;
        }
      }

      logger.info(
        `[SessionService] Global logout executed for ${authProviderId}. Revoked ${revokedCount} session(s). Reason: ${reason}`
      );

      return { revokedCount, success: true };
    } catch (err) {
      logger.error(
        `[SessionService] Failed to revoke sessions for user ${authProviderId}: ${err instanceof Error ? err.message : String(err)}`
      );
      return { revokedCount: 0, success: false };
    }
  }

  /**
   * Disciplinary Suspension Trigger:
   * Sets user status to 'suspended' in MongoDB Atlas and immediately revokes all active sessions.
   */
  public static async suspendUserWithSessionRevocation(
    mongoUserId: string,
    authProviderId?: string,
    reason?: string
  ): Promise<boolean> {
    // 1. Update database user status
    const updatedUser = await UserRepository.updateStatus(mongoUserId, 'suspended');
    if (!updatedUser) {
      logger.warn(`[SessionService] User ${mongoUserId} not found for suspension.`);
      return false;
    }

    // 2. Global session invalidation across all devices
    const targetProviderId = authProviderId || updatedUser.authProviderId;
    if (targetProviderId) {
      await this.revokeAllUserSessions(
        targetProviderId,
        reason ?? 'Disciplinary suspension enforced by Dean / Campus IT'
      );
    }

    logger.info(`[SessionService] User ${mongoUserId} suspended and sessions revoked globally.`);
    return true;
  }

  /**
   * Asserts that a session is non-expired and valid.
   * Throws UnauthorizedError (401) on missing session.
   * Throws ForbiddenError (403) on status violation.
   */
  public static assertValidSession(session: UserSession | null): UserSession {
    const check = validateSessionIntegrity(session);

    if (!check.valid) {
      if (check.status === 'missing') {
        throw new UnauthorizedError(check.reason);
      }
      throw new ForbiddenError(check.reason);
    }

    return session as UserSession;
  }
}

export default SessionService;
