/**
 * Automated Security Audit & Vulnerability Regression Test Suite.
 * Conforms to DOC-AUTH-008 (Authentication Security & Compliance Checklist),
 * OWASP Top 10, NIST SP 800-63B, and Phase 3 Part 3.8 criteria.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertResourceOwnership,
  assertRole,
  assertPermission,
  assertDepartmentScope,
  PERMISSIONS,
} from '@/lib/auth';
import { updateUserProfileSchema } from '@/lib/validations/user.schema';
import { logger } from '@/lib/logging/logger';
import { toUserDTO } from '@/lib/db/models/user.model';
import { SESSION_CONFIG } from '@/lib/auth/session';
import { ForbiddenError } from '@/lib/errors/app-error';
import type { UserRole, UserSession, IUser } from '@/types/user';

describe('Phase 3.8 Security Audit & Vulnerability Assessment', () => {
  // 1. Privilege Escalation Defenses
  describe('1. Privilege Escalation & Parameter Tampering Defenses', () => {
    it('strips role and status fields from self-service profile updates (mass assignment prevention)', () => {
      const maliciousPayload = {
        fullName: 'Legitimate Student',
        role: 'super_admin',
        status: 'active',
        isProfileComplete: true,
      };

      const parsed = updateUserProfileSchema.parse(maliciousPayload);

      // Verify that 'role' and 'status' are completely stripped by the schema
      assert.equal((parsed as Record<string, unknown>).role, undefined);
      assert.equal((parsed as Record<string, unknown>).status, undefined);
      assert.equal(parsed.fullName, 'Legitimate Student');
    });

    it('rejects role modification attempts by non-super-administrators', () => {
      const callerSession: UserSession = {
        userId: 'admin_101',
        email: 'admin@axiscolleges.in',
        role: 'admin',
        status: 'active',
      };

      assert.throws(
        () => {
          assertPermission(callerSession, PERMISSIONS.USERS_MANAGE_ROLES);
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as ForbiddenError).message, /Insufficient permissions/);
          return true;
        }
      );
    });

    it('prohibits student callers from claiming administrative roles', () => {
      assert.throws(
        () => {
          assertRole('student', ['admin', 'super_admin']);
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          return true;
        }
      );
    });
  });

  // 2. Insecure Direct Object Reference (IDOR) Defenses
  describe('2. Insecure Direct Object Reference (IDOR) Protections', () => {
    it('blocks callers from modifying resources owned by other users', () => {
      const authenticatedUserId = 'user_student_123';
      const targetResourceOwnerId = 'user_student_456';

      assert.throws(
        () => {
          assertResourceOwnership(authenticatedUserId, targetResourceOwnerId);
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as ForbiddenError).message, /own resources/);
          return true;
        }
      );
    });

    it('permits resource access when caller ID matches resource owner ID', () => {
      const authenticatedUserId = 'user_student_123';
      assert.doesNotThrow(() => {
        assertResourceOwnership(authenticatedUserId, authenticatedUserId);
      });
    });

    it('enforces academic departmental isolation on administrative operations', () => {
      const adminDeptId = 'dept_cse_001';
      const foreignDeptId = 'dept_mechanical_002';

      assert.throws(
        () => {
          assertDepartmentScope(adminDeptId, foreignDeptId, 'admin');
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as ForbiddenError).message, /assigned department/);
          return true;
        }
      );
    });
  });

  // 3. Information Disclosure & Data Sanitization
  describe('3. Information Disclosure & Credential Redaction', () => {
    it('toUserDTO serializes user document without leaking internal __v metadata', () => {
      const mockDoc = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'test@axiscolleges.in',
        fullName: 'Test User',
        role: 'student' as UserRole,
        status: 'active',
        isProfileComplete: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        __v: 3,
      } as unknown as IUser;

      const dto = toUserDTO(mockDoc);
      assert.equal((dto as unknown as Record<string, unknown>).__v, undefined);
      assert.equal(dto.id, '507f1f77bcf86cd799439011');
      assert.equal(dto.email, 'test@axiscolleges.in');
    });

    it('logger automatically sanitizes sensitive fields (passwords, tokens, secrets)', () => {
      const capturedLogs: string[] = [];
      const originalStdout = process.stdout.write;

      process.stdout.write = (chunk: string | Uint8Array): boolean => {
        capturedLogs.push(chunk.toString());
        return true;
      };

      try {
        logger.info('Audit event test', {
          password: 'SuperSecretPassword123!',
          token: 'clerk_session_jwt_token_sample',
          authSecret: 'whsec_secret_sample',
          safeField: 'visible_data',
        });
      } finally {
        process.stdout.write = originalStdout;
      }

      const logOutput = capturedLogs.join('');
      assert.ok(logOutput.includes('[REDACTED]'), 'Expected sensitive fields to be redacted');
      assert.ok(
        !logOutput.includes('SuperSecretPassword123!'),
        'Password must not leak into log stream'
      );
      assert.ok(logOutput.includes('visible_data'), 'Non-sensitive data should remain readable');
    });
  });

  // 4. Open-Redirect Vulnerability Defense
  describe('4. Open-Redirect Vulnerability Defenses', () => {
    function sanitizeRedirect(path: string): string {
      if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
        return '/';
      }
      return path;
    }

    it('rejects protocol-relative and external domain URLs', () => {
      assert.equal(sanitizeRedirect('//evil.com/phishing'), '/');
      assert.equal(sanitizeRedirect('https://attacker.com'), '/');
      assert.equal(sanitizeRedirect('/\\attacker.com'), '/');
      assert.equal(sanitizeRedirect('javascript:alert(1)'), '/');
    });

    it('preserves valid collegiate internal application paths', () => {
      assert.equal(sanitizeRedirect('/student/dashboard'), '/student/dashboard');
      assert.equal(
        sanitizeRedirect('/faculty/assignments?tab=active'),
        '/faculty/assignments?tab=active'
      );
      assert.equal(sanitizeRedirect('/shared/profile'), '/shared/profile');
    });
  });

  // 5. Session Security Specifications
  describe('5. Session Security Standards Compliance', () => {
    it('enforces mandatory defensive cookie attributes', () => {
      assert.equal(SESSION_CONFIG.COOKIE_OPTIONS.httpOnly, true);
      assert.equal(SESSION_CONFIG.COOKIE_OPTIONS.sameSite, 'strict');
      assert.equal(SESSION_CONFIG.COOKIE_OPTIONS.path, '/');
    });

    it('enforces NIST SP 800-63B compliant access token lifespans', () => {
      // 15 minutes = 900 seconds
      assert.equal(SESSION_CONFIG.ACCESS_TOKEN_TTL_SECONDS, 900);
      // 7 days rolling refresh = 604800 seconds
      assert.equal(SESSION_CONFIG.INACTIVITY_TIMEOUT_SECONDS, 604800);
    });
  });

  // 6. Clerk Instance Diagnostic Analysis
  describe('6. Clerk Host Attribution Diagnostic Analysis', () => {
    it('correctly parses publishable key prefix and structure', () => {
      const testPk = 'pk_test_YXhpcy1saW5rdXAuY2xlcmsuYWNjb3VudHMuZGV2JA';
      assert.ok(testPk.startsWith('pk_test_'));

      const rawBase64 = testPk.replace('pk_test_', '');
      const decodedDomain = Buffer.from(rawBase64, 'base64').toString('utf-8');
      assert.equal(decodedDomain, 'axis-linkup.clerk.accounts.dev$');
    });
  });
});
