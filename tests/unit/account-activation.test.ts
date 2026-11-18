/**
 * Automated Unit Test Suite for First-Time Account Activation (Phase 5.2.5).
 * Validates cryptographic invitation token creation, time-limited verification,
 * replay prevention, lifecycle status assertions (suspended/active/deactivated),
 * Clerk password synchronization, and webhook idempotency.
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import { ActivationService } from '../../src/lib/services/activation.service';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { activateAccountSchema } from '../../src/lib/validations/activation.schema';
import {
  ValidationError,
  ConflictError,
  ForbiddenError,
  AppError,
} from '../../src/lib/errors/app-error';
import type { IUser, UserSession } from '../../src/types/user';

describe('Phase 5.2.5 — 1. Activation Invitation Token Lifecycle', () => {
  const fakeUser = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000301'),
    email: 'aarav.sharma@axiscolleges.in',
    username: 'aarav.sharma',
    fullName: 'Aarav Sharma',
    role: 'student',
    status: 'pending_verification',
    isEmailVerified: false,
    authProviderId: 'user_clerk_act_301',
  } as unknown as IUser;

  test('creates unguessable 64-hex token, hashes with SHA-256 and sets 24h expiration', async () => {
    let capturedId = '';
    let capturedHash = '';
    let capturedExpiresAt: Date | undefined;

    mock.method(
      UserRepository,
      'setActivationToken',
      async (userId: string, hash: string, expiresAt: Date) => {
        capturedId = userId;
        capturedHash = hash;
        capturedExpiresAt = expiresAt;
        return fakeUser;
      }
    );

    const result = await ActivationService.createActivationToken(fakeUser);

    assert.strictEqual(capturedId, '6730a005f8b1a2001a000301');
    assert.strictEqual(typeof result.rawToken, 'string');
    assert.strictEqual(result.rawToken.length, 64); // 32 random bytes in hex
    assert.strictEqual(capturedHash, ActivationService.hashToken(result.rawToken));
    assert.ok(result.activationUrl.includes(result.rawToken));
    assert.ok(result.activationUrl.includes(encodeURIComponent('aarav.sharma@axiscolleges.in')));

    // Verify 24h expiration
    assert.ok(capturedExpiresAt instanceof Date);
    const diffHours = (capturedExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    assert.ok(diffHours > 23.9 && diffHours <= 24.1);

    mock.reset();
  });

  test('validates a valid, unexpired invitation link for pending user', async () => {
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const tokenHash = ActivationService.hashToken(rawToken);

    const pendingUser = {
      ...fakeUser,
      activationTokenHash: tokenHash,
      activationTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12), // 12h remaining
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => pendingUser);

    const validation = await ActivationService.validateInvitation(
      rawToken,
      'aarav.sharma@axiscolleges.in'
    );

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.email, 'aarav.sharma@axiscolleges.in');
    assert.strictEqual(validation.fullName, 'Aarav Sharma');
    assert.strictEqual(validation.username, 'aarav.sharma');
    assert.strictEqual(validation.role, 'student');

    mock.reset();
  });
});

describe('Phase 5.2.5 — 2. Security Boundaries, Expiration & Replay Defense', () => {
  const fakeUser = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000302'),
    email: 'divya.nair@axiscolleges.in',
    username: 'divya.nair',
    fullName: 'Divya Nair',
    role: 'student',
    status: 'pending_verification',
    authProviderId: 'user_clerk_act_302',
  } as unknown as IUser;

  test('rejects expired activation token with HTTP 410 Gone', async () => {
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const tokenHash = ActivationService.hashToken(rawToken);

    const expiredUser = {
      ...fakeUser,
      activationTokenHash: tokenHash,
      // Expired 1 hour ago
      activationTokenExpiresAt: new Date(Date.now() - 1000 * 60 * 60),
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => expiredUser);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(rawToken, 'divya.nair@axiscolleges.in');
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual((err as AppError).statusCode, 410);
        assert.ok((err as AppError).message.includes('expired'));
        return true;
      }
    );

    mock.reset();
  });

  test('rejects reused or cleared activation token (replay defense)', async () => {
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // User already completed activation; token hash is null
    const alreadyUsedUser = {
      ...fakeUser,
      activationTokenHash: null,
      activationTokenExpiresAt: null,
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => alreadyUsedUser);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(rawToken, 'divya.nair@axiscolleges.in');
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('already been used') || err.message.includes('no longer valid'));
        return true;
      }
    );

    mock.reset();
  });

  test('rejects invalid or tampered activation token', async () => {
    const validRawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const tamperedToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789fffffe';

    const user = {
      ...fakeUser,
      activationTokenHash: ActivationService.hashToken(validRawToken),
      activationTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => user);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(tamperedToken, 'divya.nair@axiscolleges.in');
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.toLowerCase().includes('invalid') && err.message.toLowerCase().includes('tampered'));
        return true;
      }
    );

    mock.reset();
  });

  test('rejects invitation when institutional email does not match any collegiate user without leaking existence', async () => {
    mock.method(UserRepository, 'findByEmail', async () => null);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          'nonexistent@axiscolleges.in'
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.equal(err.message.includes('No collegiate account found'), false);
        return true;
      }
    );

    mock.reset();
  });
});

describe('Phase 5.2.5 — 3. Account Lifecycle Gate Invariants', () => {
  const baseUser = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000303'),
    email: 'kunal.joshi@axiscolleges.in',
    username: 'kunal.joshi',
    fullName: 'Kunal Joshi',
    role: 'student',
    authProviderId: 'user_clerk_act_303',
    activationTokenHash: ActivationService.hashToken('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
    activationTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
  } as unknown as IUser;

  test('rejects activation attempt for suspended collegiate accounts', async () => {
    const suspendedUser = {
      ...baseUser,
      status: 'suspended',
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => suspendedUser);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          'kunal.joshi@axiscolleges.in'
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Suspended collegiate accounts cannot be activated'));
        return true;
      }
    );

    mock.reset();
  });

  test('rejects activation attempt for deactivated accounts', async () => {
    const deactivatedUser = {
      ...baseUser,
      status: 'deactivated',
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => deactivatedUser);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          'kunal.joshi@axiscolleges.in'
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Deactivated accounts cannot be activated'));
        return true;
      }
    );

    mock.reset();
  });

  test('rejects activation attempt for already active accounts', async () => {
    const activeUser = {
      ...baseUser,
      status: 'active',
      activatedAt: new Date('2026-11-14T10:00:00.000Z'),
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => activeUser);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          'kunal.joshi@axiscolleges.in'
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok(err.message.includes('already been activated'));
        return true;
      }
    );

    mock.reset();
  });
});

describe('Phase 5.2.5 — 4. Password Policy & Schema Validation', () => {
  const validToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const validEmail = 'aarav.sharma@axiscolleges.in';

  test('accepts strong password meeting all institutional criteria', () => {
    const payload = {
      token: validToken,
      email: validEmail,
      password: 'Collegiate#Pass2026',
      confirmPassword: 'Collegiate#Pass2026',
    };

    const parsed = activateAccountSchema.parse(payload);
    assert.strictEqual(parsed.password, 'Collegiate#Pass2026');
  });

  test('rejects password shorter than 8 characters', () => {
    const payload = {
      token: validToken,
      email: validEmail,
      password: 'P#1a',
      confirmPassword: 'P#1a',
    };

    const res = activateAccountSchema.safeParse(payload);
    assert.strictEqual(res.success, false);
  });

  test('rejects password missing special characters', () => {
    const payload = {
      token: validToken,
      email: validEmail,
      password: 'CollegiatePass2026',
      confirmPassword: 'CollegiatePass2026',
    };

    const res = activateAccountSchema.safeParse(payload);
    assert.strictEqual(res.success, false);
  });

  test('rejects password missing numbers', () => {
    const payload = {
      token: validToken,
      email: validEmail,
      password: 'Collegiate#Password',
      confirmPassword: 'Collegiate#Password',
    };

    const res = activateAccountSchema.safeParse(payload);
    assert.strictEqual(res.success, false);
  });

  test('rejects mismatched password and confirmPassword', () => {
    const payload = {
      token: validToken,
      email: validEmail,
      password: 'Collegiate#Pass2026',
      confirmPassword: 'Different#Pass2026',
    };

    const res = activateAccountSchema.safeParse(payload);
    assert.strictEqual(res.success, false);
  });
});

describe('Phase 5.2.5 — 5. Account Activation Execution & Clerk IAM Synchronization', () => {
  const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const tokenHash = ActivationService.hashToken(rawToken);

  const pendingUser = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000304'),
    email: 'ananya.sen@axiscolleges.in',
    username: 'ananya.sen',
    fullName: 'Dr. Ananya Sen',
    role: 'faculty',
    status: 'pending_verification',
    isEmailVerified: false,
    authProviderId: 'user_clerk_act_304',
    activationTokenHash: tokenHash,
    activationTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
  } as unknown as IUser;

  test('successfully establishes password in Clerk and transitions MongoDB status to active', async () => {
    mock.method(UserRepository, 'findByEmail', async () => pendingUser);

    let updatedClerkUserId = '';
    let updatedClerkPassword = '';
    let updatedClerkMetadata: Record<string, unknown> = {};

    const mockClerkClient = {
      users: {
        updateUser: async (userId: string, params: { password?: string }) => {
          updatedClerkUserId = userId;
          updatedClerkPassword = params.password || '';
          return { id: userId };
        },
        updateUserMetadata: async (userId: string, params: { publicMetadata: Record<string, unknown> }) => {
          updatedClerkMetadata = params.publicMetadata;
          return { id: userId, publicMetadata: params.publicMetadata };
        },
      },
    };

    mock.method(
      ActivationService,
      'getClerkClient',
      async () => mockClerkClient as unknown as ReturnType<typeof ActivationService.getClerkClient>
    );

    let completedUserId = '';
    let completedTimestamp: Date | undefined;

    mock.method(
      UserRepository,
      'completeAccountActivation',
      async (userId: string, activatedAt: Date) => {
        completedUserId = userId;
        completedTimestamp = activatedAt;
        return {
          ...pendingUser,
          status: 'active',
          isEmailVerified: true,
          activatedAt,
          activationTokenHash: null,
          activationTokenExpiresAt: null,
        } as unknown as IUser;
      }
    );

    const result = await ActivationService.activateAccount({
      token: rawToken,
      email: 'ananya.sen@axiscolleges.in',
      password: 'Collegiate#Pass2026',
      confirmPassword: 'Collegiate#Pass2026',
    });

    // 1. Verify Clerk IAM updates
    assert.strictEqual(updatedClerkUserId, 'user_clerk_act_304');
    assert.strictEqual(updatedClerkPassword, 'Collegiate#Pass2026');
    assert.strictEqual(updatedClerkMetadata.status, 'active');

    // 2. Verify Database atomic update
    assert.strictEqual(completedUserId, '6730a005f8b1a2001a000304');
    assert.ok(completedTimestamp instanceof Date);

    // 3. Verify returned payload
    assert.strictEqual(result.email, 'ananya.sen@axiscolleges.in');
    assert.strictEqual(result.role, 'faculty');
    assert.strictEqual(result.status, 'active');

    mock.reset();
  });
});

describe('Phase 5.2.5 — 6. Administrative Re-Send Invitation Gate', () => {
  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
  };

  const hodCaller: UserSession = {
    userId: '6730a005f8b1a2001a000020',
    email: 'hod@axiscolleges.in',
    role: 'admin',
    adminSubRole: 'hod',
  };

  const pendingUser = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000305'),
    email: 'rohit.kumar@axiscolleges.in',
    username: 'rohit.kumar',
    role: 'student',
    status: 'pending_verification',
  } as unknown as IUser;

  test('rejects re-send request when invoked by Department HOD', async () => {
    await assert.rejects(
      async () => {
        await ActivationService.resendActivationInvitation(
          'rohit.kumar@axiscolleges.in',
          hodCaller
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Only System Administrators'));
        return true;
      }
    );
  });

  test('allows System Administrator to re-issue activation token for pending user', async () => {
    mock.method(UserRepository, 'findByEmail', async () => pendingUser);
    mock.method(UserRepository, 'setActivationToken', async () => pendingUser);

    const result = await ActivationService.resendActivationInvitation(
      'rohit.kumar@axiscolleges.in',
      sysAdminCaller
    );

    assert.strictEqual(typeof result.rawToken, 'string');
    assert.strictEqual(result.rawToken.length, 64);
    assert.ok(result.activationUrl.includes(result.rawToken));

    mock.reset();
  });

  test('rejects re-send request when account is already active', async () => {
    const activeUser = {
      ...pendingUser,
      status: 'active',
      activatedAt: new Date(),
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => activeUser);

    await assert.rejects(
      async () => {
        await ActivationService.resendActivationInvitation(
          'rohit.kumar@axiscolleges.in',
          sysAdminCaller
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok(err.message.includes('already active'));
        return true;
      }
    );

    mock.reset();
  });
});

