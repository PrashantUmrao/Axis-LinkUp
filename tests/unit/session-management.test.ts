/**
 * Automated Tests for Axis LinkUp Session Management & Governance Engine.
 * Conforms to DOC-AUTH-006 (Session Management & Security Architecture)
 * and Phase 3 Part 3.7 criteria.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_CONFIG,
  SESSION_AUDIT_EVENTS,
  validateSessionIntegrity,
  isSessionExpired,
  isAdministrativeSessionIdle,
  SessionService,
} from '@/lib/auth/session';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors/app-error';
import type { UserSession } from '@/types/user';

describe('Session Management & Lifecycle Governance Engine', () => {
  const activeStudentSession: UserSession = {
    userId: 'stu_mongo_id_001',
    sessionId: 'sess_clerk_active_123',
    authProviderId: 'user_clerk_001',
    email: 'student@axiscolleges.in',
    role: 'student',
    status: 'active',
  };

  const suspendedFacultySession: UserSession = {
    userId: 'fac_mongo_id_002',
    sessionId: 'sess_clerk_susp_456',
    authProviderId: 'user_clerk_002',
    email: 'faculty@axiscolleges.in',
    role: 'faculty',
    status: 'suspended',
  };

  // 1. Session Creation & Validation
  describe('1. Valid Session Verification', () => {
    it('successfully validates an active authenticated user session', () => {
      const result = validateSessionIntegrity(activeStudentSession);
      assert.equal(result.valid, true);
      assert.equal(result.status, 'valid');
      assert.equal(result.reason, undefined);
    });

    it('assertValidSession returns the session unchanged when valid', () => {
      const verified = SessionService.assertValidSession(activeStudentSession);
      assert.equal(verified.userId, activeStudentSession.userId);
      assert.equal(verified.sessionId, activeStudentSession.sessionId);
    });
  });

  // 2. Expired Session Handling
  describe('2. Session Expiration Policies', () => {
    it('considers a recently issued session valid', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      assert.equal(isSessionExpired(fiveMinutesAgo), false);
    });

    it('considers a session older than 30 days expired', () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      assert.equal(isSessionExpired(thirtyOneDaysAgo), true);
    });

    it('considers invalid or zero timestamps expired by default', () => {
      assert.equal(isSessionExpired(0), true);
      assert.equal(isSessionExpired(-1000), true);
    });
  });

  // 3. Administrative Idle Inactivity Timeout
  describe('3. Administrative Inactivity Timeout (30 min)', () => {
    it('permits an admin active within the last 10 minutes', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      assert.equal(isAdministrativeSessionIdle(tenMinutesAgo), false);
    });

    it('flags an admin session idle after 31 minutes of inactivity', () => {
      const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
      assert.equal(isAdministrativeSessionIdle(thirtyOneMinutesAgo), true);
    });

    it('flags invalid timestamps as idle', () => {
      assert.equal(isAdministrativeSessionIdle(0), true);
    });
  });

  // 4. Invalid & Missing Session Handling
  describe('4. Missing & Invalid Session Rejections', () => {
    it('detects null or undefined session credentials', () => {
      const nullCheck = validateSessionIntegrity(null);
      assert.equal(nullCheck.valid, false);
      assert.equal(nullCheck.status, 'missing');

      const undefinedCheck = validateSessionIntegrity(undefined as unknown as UserSession);
      assert.equal(undefinedCheck.valid, false);
      assert.equal(undefinedCheck.status, 'missing');
    });

    it('throws UnauthorizedError (401) on missing session', () => {
      assert.throws(
        () => SessionService.assertValidSession(null),
        (err: unknown) => {
          assert.ok(err instanceof UnauthorizedError);
          assert.equal((err as UnauthorizedError).statusCode, 401);
          return true;
        }
      );
    });
  });

  // 5. Account Lifecycle Status Restrictions
  describe('5. Account Lifecycle Enforcement', () => {
    it('rejects suspended accounts with ForbiddenError (403)', () => {
      const check = validateSessionIntegrity(suspendedFacultySession);
      assert.equal(check.valid, false);
      assert.equal(check.status, 'suspended');
      assert.match(check.reason ?? '', /administrative hold/i);

      assert.throws(
        () => SessionService.assertValidSession(suspendedFacultySession),
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.equal((err as ForbiddenError).statusCode, 403);
          assert.match((err as ForbiddenError).message, /administrative hold/i);
          return true;
        }
      );
    });

    it('rejects pending verification accounts with ForbiddenError (403)', () => {
      const pendingSession: UserSession = {
        userId: 'stu_pend_999',
        email: 'applicant@axiscolleges.in',
        role: 'student',
        status: 'pending_verification',
      };

      const check = validateSessionIntegrity(pendingSession);
      assert.equal(check.valid, false);
      assert.equal(check.status, 'pending');

      assert.throws(
        () => SessionService.assertValidSession(pendingSession),
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.equal((err as ForbiddenError).statusCode, 403);
          assert.match((err as ForbiddenError).message, /roster verification/i);
          return true;
        }
      );
    });

    it('rejects deactivated or archived accounts with ForbiddenError (403)', () => {
      const deactivatedSession: UserSession = {
        userId: 'stu_deact_888',
        email: 'former@axiscolleges.in',
        role: 'student',
        status: 'deactivated',
      };

      const check = validateSessionIntegrity(deactivatedSession);
      assert.equal(check.valid, false);
      assert.equal(check.status, 'deactivated');

      assert.throws(
        () => SessionService.assertValidSession(deactivatedSession),
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.equal((err as ForbiddenError).statusCode, 403);
          return true;
        }
      );
    });
  });

  // 6. Cookie & Token Security Specifications
  describe('6. Security Standard Configurations', () => {
    it('enforces HttpOnly, SameSite=Strict, and standard path for cookies', () => {
      assert.equal(SESSION_CONFIG.COOKIE_OPTIONS.httpOnly, true);
      assert.equal(SESSION_CONFIG.COOKIE_OPTIONS.sameSite, 'strict');
      assert.equal(SESSION_CONFIG.COOKIE_OPTIONS.path, '/');
    });

    it('enforces 15-minute access token lifespan and 7-day inactivity window', () => {
      assert.equal(SESSION_CONFIG.ACCESS_TOKEN_TTL_SECONDS, 900);
      assert.equal(SESSION_CONFIG.INACTIVITY_TIMEOUT_SECONDS, 604800);
      assert.equal(SESSION_CONFIG.MAX_SESSION_LIFETIME_SECONDS, 2592000);
    });
  });

  // 7. Session Invalidation & Revocation Methods
  describe('7. Session Revocation Fail-Safes', () => {
    it('handles empty sessionId revocation gracefully without throwing', async () => {
      const result = await SessionService.revokeSession('');
      assert.equal(result, false);
    });

    it('handles empty authProviderId global revocation gracefully', async () => {
      const result = await SessionService.revokeAllUserSessions('');
      assert.equal(result.success, false);
      assert.equal(result.revokedCount, 0);
    });
  });

  // 8. Audit Event Identifiers
  describe('8. Session Audit Event Coverage', () => {
    it('defines canonical audit events for compliance', () => {
      assert.equal(SESSION_AUDIT_EVENTS.LOGIN_SUCCESS, 'AUTH_LOGIN_SUCCESS');
      assert.equal(SESSION_AUDIT_EVENTS.LOGOUT, 'AUTH_LOGOUT');
      assert.equal(SESSION_AUDIT_EVENTS.SESSION_REVOKED, 'AUTH_SESSION_REVOKED');
      assert.equal(SESSION_AUDIT_EVENTS.SESSION_EXPIRED, 'AUTH_SESSION_EXPIRED');
    });
  });
});
