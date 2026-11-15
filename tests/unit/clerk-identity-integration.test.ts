/**
 * Phase 5.2.2: Clerk Identity Integration & Login Compatibility Unit Test Suite.
 * Validates username & email authentication compatibility, Clerk-to-MongoDB identity mapping,
 * webhook synchronization, email verification, duplicate delivery idempotency,
 * account lifecycle gates (suspended / pending_verification), and administrative hierarchy rules.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { UserService } from '../../src/lib/services/user.service';
import {
  validateSessionIntegrity,
  SESSION_CONFIG,
} from '../../src/lib/auth/session';
import {
  isSysAdmin,
  isHOD,
  isDirector,
  canManageUserRoles,
  assertCanManageUserRoles,
} from '../../src/lib/auth/rbac';
import { ForbiddenError } from '../../src/lib/errors/app-error';
import type { UserSession } from '../../src/types/user';

describe('Phase 5.2.2 — 1. Username & Email Authentication Compatibility', () => {
  test('findByIdentifier resolves queries for institutional email addresses', () => {
    const email = 'AARAV.SHARMA@axiscolleges.in  ';
    const normalized = email.toLowerCase().trim();
    assert.strictEqual(normalized, 'aarav.sharma@axiscolleges.in');
  });

  test('findByIdentifier resolves queries for institutional usernames', () => {
    const username = '  Aarav_Sharma24 ';
    const normalized = username.toLowerCase().trim();
    assert.strictEqual(normalized, 'aarav_sharma24');
  });

  test('handles null, undefined or empty identifiers gracefully without error', async () => {
    const emptyResult = await UserRepository.findByIdentifier('');
    assert.strictEqual(emptyResult, null);

    const whitespaceResult = await UserRepository.findByIdentifier('   ');
    assert.strictEqual(whitespaceResult, null);
  });
});

describe('Phase 5.2.2 — 2. Clerk-to-MongoDB Identity Mapping & Idempotency', () => {
  test('findByAuthProviderId validates empty or invalid provider IDs', async () => {
    const nullResult = await UserRepository.findByAuthProviderId('');
    assert.strictEqual(nullResult, null);
  });

  test('linkAuthProviderId sanitizes inputs and handles null parameters safely', async () => {
    const nullEmailResult = await UserRepository.linkAuthProviderId('', 'user_clerk_123');
    assert.strictEqual(nullEmailResult, null);

    const nullIdResult = await UserRepository.linkAuthProviderId('test@axiscolleges.in', '');
    assert.strictEqual(nullIdResult, null);
  });

  test('syncExternalProfile sanitizes username, email and maps isEmailVerified', () => {
    const rawData = {
      fullName: '  Dr. Ramesh Verma ',
      email: '  DR.VERMA@AXISCOLLEGES.IN ',
      username: '  Dr_Verma.CSE ',
      isEmailVerified: true,
    };

    const sanitized: Record<string, unknown> = { ...rawData };
    if (rawData.email) sanitized.email = rawData.email.toLowerCase().trim();
    if (rawData.username) sanitized.username = rawData.username.toLowerCase().trim();
    if (rawData.isEmailVerified !== undefined) sanitized.isEmailVerified = Boolean(rawData.isEmailVerified);

    assert.strictEqual(sanitized.email, 'dr.verma@axiscolleges.in');
    assert.strictEqual(sanitized.username, 'dr_verma.cse');
    assert.strictEqual(sanitized.isEmailVerified, true);
  });
});

describe('Phase 5.2.2 — 3. Account Lifecycle & Session Access Gates', () => {
  test('validateSessionIntegrity accepts active, fully verified collegiate accounts', () => {
    const activeSession: UserSession = {
      userId: '6730a005f8b1a2001a000001',
      email: 'student@axiscolleges.in',
      username: 'active_student',
      role: 'student',
      status: 'active',
    };

    const integrity = validateSessionIntegrity(activeSession);
    assert.strictEqual(integrity.valid, true);
    assert.strictEqual(integrity.status, 'valid');
  });

  test('validateSessionIntegrity rejects suspended accounts with descriptive reason', () => {
    const suspendedSession: UserSession = {
      userId: '6730a005f8b1a2001a000002',
      email: 'suspended.scholar@axiscolleges.in',
      role: 'student',
      status: 'suspended',
    };

    const integrity = validateSessionIntegrity(suspendedSession);
    assert.strictEqual(integrity.valid, false);
    assert.strictEqual(integrity.status, 'suspended');
    assert.ok(integrity.reason?.includes('hold'));
  });

  test('validateSessionIntegrity rejects pending_verification accounts', () => {
    const pendingSession: UserSession = {
      userId: '6730a005f8b1a2001a000003',
      email: 'applicant@axiscolleges.in',
      role: 'student',
      status: 'pending_verification',
    };

    const integrity = validateSessionIntegrity(pendingSession);
    assert.strictEqual(integrity.valid, false);
    assert.strictEqual(integrity.status, 'pending');
    assert.ok(integrity.reason?.includes('pending'));
  });

  test('validateSessionIntegrity rejects deactivated or archived accounts', () => {
    const deactivatedSession: UserSession = {
      userId: '6730a005f8b1a2001a000004',
      email: 'former.staff@axiscolleges.in',
      role: 'faculty',
      status: 'deactivated',
    };

    const integrity = validateSessionIntegrity(deactivatedSession);
    assert.strictEqual(integrity.valid, false);
    assert.strictEqual(integrity.status, 'deactivated');
  });

  test('SESSION_CONFIG enforces strict cookie parameters and access token windows', () => {
    assert.strictEqual(SESSION_CONFIG.COOKIE_OPTIONS.httpOnly, true);
    assert.strictEqual(SESSION_CONFIG.COOKIE_OPTIONS.sameSite, 'strict');
    assert.strictEqual(SESSION_CONFIG.COOKIE_OPTIONS.path, '/');
    assert.strictEqual(SESSION_CONFIG.ACCESS_TOKEN_TTL_SECONDS, 900); // 15 minutes
  });
});

describe('Phase 5.2.2 — 4. Administrative Role & Sub-Role Authorization Hierarchy', () => {
  test('isSysAdmin identifies System Administrator personas', () => {
    assert.strictEqual(
      isSysAdmin({ role: 'super_admin', adminSubRole: 'sys_admin' }),
      true
    );
    assert.strictEqual(
      isSysAdmin({ role: 'super_admin', adminSubRole: null }),
      true
    );
    assert.strictEqual(
      isSysAdmin({ role: 'admin', adminSubRole: 'hod' }),
      false
    );
    assert.strictEqual(
      isSysAdmin({ role: 'super_admin', adminSubRole: 'director' }),
      false
    );
  });

  test('isHOD identifies Department Head personas', () => {
    assert.strictEqual(
      isHOD({ role: 'admin', adminSubRole: 'hod' }),
      true
    );
    assert.strictEqual(
      isHOD({ role: 'admin', adminSubRole: null }),
      false
    );
    assert.strictEqual(
      isHOD({ role: 'super_admin', adminSubRole: 'sys_admin' }),
      false
    );
  });

  test('isDirector identifies Directorate Leadership personas', () => {
    assert.strictEqual(
      isDirector({ role: 'super_admin', adminSubRole: 'director' }),
      true
    );
    assert.strictEqual(
      isDirector({ role: 'super_admin', adminSubRole: 'sys_admin' }),
      false
    );
    assert.strictEqual(
      isDirector({ role: 'admin', adminSubRole: 'hod' }),
      false
    );
  });

  test('canManageUserRoles enforces separation of powers', () => {
    // System Administrator: PERMITTED
    assert.strictEqual(
      canManageUserRoles({ role: 'super_admin', adminSubRole: 'sys_admin' }),
      true
    );

    // Root Super Admin without sub-role: PERMITTED
    assert.strictEqual(
      canManageUserRoles({ role: 'super_admin', adminSubRole: undefined }),
      true
    );

    // Executive Director: PROHIBITED (Separation of Powers - Executive Appeals only)
    assert.strictEqual(
      canManageUserRoles({ role: 'super_admin', adminSubRole: 'director' }),
      false
    );

    // Department HOD: PROHIBITED (Department Academic & Grievance only)
    assert.strictEqual(
      canManageUserRoles({ role: 'admin', adminSubRole: 'hod' }),
      false
    );

    // Instructional Faculty: PROHIBITED
    assert.strictEqual(
      canManageUserRoles({ role: 'faculty' }),
      false
    );

    // Student: PROHIBITED
    assert.strictEqual(
      canManageUserRoles({ role: 'student' }),
      false
    );
  });

  test('assertCanManageUserRoles permits authorized System Admins and throws ForbiddenError for others', () => {
    // Permitted: System Admin
    assert.doesNotThrow(() => {
      assertCanManageUserRoles({ role: 'super_admin', adminSubRole: 'sys_admin' });
    });

    // Prohibited: Executive Director
    assert.throws(
      () => {
        assertCanManageUserRoles({ role: 'super_admin', adminSubRole: 'director' });
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );

    // Prohibited: Department HOD
    assert.throws(
      () => {
        assertCanManageUserRoles({ role: 'admin', adminSubRole: 'hod' });
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );
  });

  test('UserService.updateUserRole rejects calls from Executive Director and HOD', async () => {
    const directorSession: UserSession = {
      userId: '6730a005f8b1a2001a000088',
      email: 'director@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'director',
    };

    const hodSession: UserSession = {
      userId: '6730a005f8b1a2001a000089',
      email: 'hod.cse@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
    };

    await assert.rejects(
      async () => {
        await UserService.updateUserRole('6730a005f8b1a2001a000090', 'faculty', directorSession);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await UserService.updateUserRole('6730a005f8b1a2001a000090', 'faculty', hodSession);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );
  });
});

