/**
 * Automated Unit Test Suite for Password Recovery System (Phase 5.2.7).
 * Validates forgot-password account resolution, account enumeration defense,
 * OtpService password_recovery purpose binding, HMAC-SHA256 verification proof token,
 * replay protection, strong password policy, Clerk password update, and session revocation.
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import { PasswordRecoveryService } from '../../src/lib/services/password-recovery.service';
import { OtpService } from '../../src/lib/services/otp.service';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { OtpRepository } from '../../src/lib/db/repositories/otp.repository';
import { passwordResetSchema } from '../../src/lib/validations/password-recovery.schema';
import {
  ValidationError,
  ForbiddenError,
  AppError,
} from '../../src/lib/errors/app-error';
import { HTTP_STATUS } from '../../src/config/constants';
import type { IUser } from '../../src/types/user';
import type { IOtpDocument } from '../../src/types/otp';

describe('Phase 5.2.7 — 1. Forgot-Password Request & Account Enumeration Defense', () => {
  const testStudent = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000501'),
    email: 'karan.mehta@axiscolleges.in',
    username: 'karan.mehta',
    fullName: 'Karan Mehta',
    role: 'student',
    status: 'active',
    authProviderId: 'clerk_user_501',
  } as unknown as IUser;

  test('resolves user by institutional email and dispatches recovery OTP', async () => {
    let capturedEmail = '';
    let capturedPurpose = '';

    mock.method(UserRepository, 'findByIdentifier', async () => testStudent);
    mock.method(OtpService, 'requestOtp', async (params: { email: string; purpose: string }) => {
      capturedEmail = params.email;
      capturedPurpose = params.purpose;
      return {
        email: params.email,
        purpose: params.purpose,
        resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
        expiresInSeconds: 300,
        resendAvailableInSeconds: 60,
        expiresInMinutes: 5,
      };
    });

    const result = await PasswordRecoveryService.requestRecovery({
      identifier: 'karan.mehta@axiscolleges.in',
    });

    assert.strictEqual(result.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(result.email, undefined);
    assert.strictEqual(result.maskedEmail, 'ka***@axiscolleges.in');
    assert.strictEqual(capturedEmail, 'karan.mehta@axiscolleges.in');
    assert.strictEqual(capturedPurpose, 'password_recovery');

    mock.reset();
  });

  test('resolves user by institutional username', async () => {
    let queriedIdentifier = '';

    mock.method(UserRepository, 'findByIdentifier', async (id: string) => {
      queriedIdentifier = id;
      return testStudent;
    });
    mock.method(OtpService, 'requestOtp', async () => ({
      email: testStudent.email,
      purpose: 'password_recovery',
      resendAvailableAt: new Date().toISOString(),
      expiresInSeconds: 300,
    }));

    const result = await PasswordRecoveryService.requestRecovery({
      identifier: 'karan.mehta',
    });

    assert.strictEqual(queriedIdentifier, 'karan.mehta');
    assert.strictEqual(result.email, undefined);
    assert.strictEqual(result.maskedEmail, 'ka***@axiscolleges.in');
    assert.strictEqual(result.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);

    mock.reset();
  });

  test('account enumeration protection: returns identical generic notice for non-existent user without revealing 404', async () => {
    let otpCalled = false;

    mock.method(UserRepository, 'findByIdentifier', async () => null);
    mock.method(OtpService, 'requestOtp', async () => {
      otpCalled = true;
      return {} as unknown as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const result = await PasswordRecoveryService.requestRecovery({
      identifier: 'unknown.ghost@axiscolleges.in',
    });

    assert.strictEqual(result.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(result.email, undefined);
    assert.strictEqual(result.maskedEmail, undefined);
    assert.strictEqual(otpCalled, false);

    mock.reset();
  });

  test('account enumeration defense: returns generic notice for suspended account without revealing status and suppresses OTP', async () => {
    const suspendedUser = {
      ...testStudent,
      status: 'suspended',
    } as unknown as IUser;

    let otpCalled = false;
    mock.method(UserRepository, 'findByIdentifier', async () => suspendedUser);
    mock.method(OtpService, 'requestOtp', async () => {
      otpCalled = true;
      return {} as unknown as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const result = await PasswordRecoveryService.requestRecovery({
      identifier: 'karan.mehta@axiscolleges.in',
    });

    assert.strictEqual(result.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(result.email, undefined);
    assert.strictEqual(otpCalled, false);

    mock.reset();
  });
});

describe('Phase 5.2.7 — 2. Cryptographic Verification Proof Token Validation', () => {
  const testEmail = 'sneha.patel@axiscolleges.in';

  test('generateProofToken creates verifiable HMAC token with 15-minute TTL', () => {
    const { rawToken, tokenHash } = OtpService.generateProofToken(testEmail, 'password_recovery');

    assert.strictEqual(typeof rawToken, 'string');
    assert.ok(rawToken.includes('.'));
    assert.strictEqual(typeof tokenHash, 'string');
    assert.strictEqual(tokenHash.length, 64);

    const verified = OtpService.verifyProofToken(rawToken, 'password_recovery');
    assert.strictEqual(verified.email, testEmail);
    assert.strictEqual(verified.purpose, 'password_recovery');
    assert.ok(typeof verified.nonce === 'string');
    assert.ok(verified.expiresAt > Date.now());
  });

  test('rejects tampered or forged proof tokens', () => {
    const { rawToken } = OtpService.generateProofToken(testEmail, 'password_recovery');
    const [payload, sig] = rawToken.split('.');

    // Tamper with payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ email: 'hacker@axiscolleges.in', purpose: 'password_recovery', expiresAt: Date.now() + 100000 })
    ).toString('base64url');

    assert.throws(
      () => OtpService.verifyProofToken(`${tamperedPayload}.${sig}`, 'password_recovery'),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('signature verification failed'));
        return true;
      }
    );

    // Tamper with signature
    assert.throws(
      () => OtpService.verifyProofToken(`${payload}.0123456789abcdef`, 'password_recovery'),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        return true;
      }
    );
  });

  test('rejects purpose mismatch on proof token', () => {
    const { rawToken } = OtpService.generateProofToken(testEmail, 'email_verification');

    assert.throws(
      () => OtpService.verifyProofToken(rawToken, 'password_recovery'),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('purpose mismatch'));
        return true;
      }
    );
  });
});

describe('Phase 5.2.7 — 3. Password Reset Policy & Schema Validation', () => {
  test('accepts strong recovery password meeting institutional policy', () => {
    const parsed = passwordResetSchema.parse({
      email: 'aditi.rao@axiscolleges.in',
      verificationProofToken: 'payload.signature_token_test_123',
      password: 'StrongCampus#2026',
      confirmPassword: 'StrongCampus#2026',
    });

    assert.strictEqual(parsed.email, 'aditi.rao@axiscolleges.in');
    assert.strictEqual(parsed.password, 'StrongCampus#2026');
  });

  test('rejects weak passwords violating institutional complexity rules', () => {
    // Missing number
    assert.throws(() => {
      passwordResetSchema.parse({
        email: 'test@axiscolleges.in',
        verificationProofToken: 'payload.sig',
        password: 'WeakPassword!',
        confirmPassword: 'WeakPassword!',
      });
    });

    // Missing special character
    assert.throws(() => {
      passwordResetSchema.parse({
        email: 'test@axiscolleges.in',
        verificationProofToken: 'payload.sig',
        password: 'WeakPassword123',
        confirmPassword: 'WeakPassword123',
      });
    });

    // Too short (<8 chars)
    assert.throws(() => {
      passwordResetSchema.parse({
        email: 'test@axiscolleges.in',
        verificationProofToken: 'payload.sig',
        password: 'Sh1!',
        confirmPassword: 'Sh1!',
      });
    });
  });

  test('rejects mismatched password and confirmPassword', () => {
    assert.throws(
      () => {
        passwordResetSchema.parse({
          email: 'test@axiscolleges.in',
          verificationProofToken: 'payload.sig',
          password: 'CorrectPassword#1',
          confirmPassword: 'DifferentPassword#2',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Passwords do not match'));
        return true;
      }
    );
  });
});

describe('Phase 5.2.7 — 4. Password Reset Execution, Clerk IAM & Session Revocation', () => {
  const testEmail = 'rahul.verma@axiscolleges.in';
  const testUser = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000502'),
    email: testEmail,
    username: 'rahul.verma',
    role: 'faculty',
    status: 'active',
    authProviderId: 'clerk_user_fac_502',
  } as unknown as IUser;

  test('successfully resets password, updates Clerk, revokes sessions, and consumes proof', async () => {
    const { rawToken, tokenHash } = OtpService.generateProofToken(testEmail, 'password_recovery');

    const mockOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000503'),
      email: testEmail,
      purpose: 'password_recovery',
      proofTokenHash: tokenHash,
      isProofConsumed: false,
      expiresAt: new Date(Date.now() + 300000),
    } as unknown as IOtpDocument;

    let updatedClerkUserId = '';
    let updatedClerkPassword = '';
    const revokedSessionIds: string[] = [];
    let proofConsumed = false;

    const mockClerkClient = {
      users: {
        updateUser: async (userId: string, data: { password?: string }) => {
          updatedClerkUserId = userId;
          updatedClerkPassword = data.password || '';
          return {};
        },
      },
      sessions: {
        getSessionList: async () => ({
          data: [
            { id: 'sess_1', status: 'active' },
            { id: 'sess_2', status: 'active' },
            { id: 'sess_3', status: 'ended' },
          ],
        }),
        revokeSession: async (sessionId: string) => {
          revokedSessionIds.push(sessionId);
          return {};
        },
      },
    };

    mock.method(PasswordRecoveryService, 'getClerkClient', async () => mockClerkClient);
    mock.method(OtpRepository, 'findByProofTokenHash', async () => mockOtpDoc);
    mock.method(OtpRepository, 'consumeVerificationProof', async () => {
      proofConsumed = true;
      return { ...mockOtpDoc, isProofConsumed: true } as unknown as IOtpDocument;
    });
    mock.method(UserRepository, 'findByEmail', async () => testUser);

    const result = await PasswordRecoveryService.resetPassword({
      email: testEmail,
      verificationProofToken: rawToken,
      password: 'NewCollegiate#2026',
      confirmPassword: 'NewCollegiate#2026',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.email, testEmail);
    assert.strictEqual(result.role, 'faculty');
    assert.strictEqual(result.sessionsRevoked, 2);
    assert.strictEqual(updatedClerkUserId, 'clerk_user_fac_502');
    assert.strictEqual(updatedClerkPassword, 'NewCollegiate#2026');
    assert.deepStrictEqual(revokedSessionIds, ['sess_1', 'sess_2']);
    assert.strictEqual(proofConsumed, true);

    mock.reset();
  });

  test('replay defense: rejects already consumed verification proof token', async () => {
    const { rawToken } = OtpService.generateProofToken(testEmail, 'password_recovery');

    const consumedOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000504'),
      email: testEmail,
      purpose: 'password_recovery',
      isProofConsumed: true,
      expiresAt: new Date(Date.now() + 300000),
    } as unknown as IOtpDocument;

    mock.method(OtpRepository, 'findByProofTokenHash', async () => consumedOtpDoc);

    await assert.rejects(
      async () => {
        await PasswordRecoveryService.resetPassword({
          email: testEmail,
          verificationProofToken: rawToken,
          password: 'StrongCampus#2026',
          confirmPassword: 'StrongCampus#2026',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('already been used'));
        return true;
      }
    );

    mock.reset();
  });

  test('cross-account defense: rejects proof belonging to user A when submitted for user B', async () => {
    // Generate proof for user A
    const { rawToken } = OtpService.generateProofToken('user.a@axiscolleges.in', 'password_recovery');

    await assert.rejects(
      async () => {
        await PasswordRecoveryService.resetPassword({
          email: 'user.b@axiscolleges.in',
          verificationProofToken: rawToken,
          password: 'StrongCampus#2026',
          confirmPassword: 'StrongCampus#2026',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('does not match the specified institutional account'));
        return true;
      }
    );
  });

  test('rejects password reset when account is suspended', async () => {
    const { rawToken, tokenHash } = OtpService.generateProofToken(testEmail, 'password_recovery');

    const mockOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000505'),
      email: testEmail,
      purpose: 'password_recovery',
      proofTokenHash: tokenHash,
      isProofConsumed: false,
      expiresAt: new Date(Date.now() + 300000),
    } as unknown as IOtpDocument;

    const suspendedUser = {
      ...testUser,
      status: 'suspended',
    } as unknown as IUser;

    mock.method(OtpRepository, 'findByProofTokenHash', async () => mockOtpDoc);
    mock.method(UserRepository, 'findByEmail', async () => suspendedUser);

    await assert.rejects(
      async () => {
        await PasswordRecoveryService.resetPassword({
          email: testEmail,
          verificationProofToken: rawToken,
          password: 'StrongCampus#2026',
          confirmPassword: 'StrongCampus#2026',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Suspended collegiate accounts cannot recover passwords'));
        return true;
      }
    );

    mock.reset();
  });

  test('handles Clerk failure safely and returns HTTP 502 Bad Gateway', async () => {
    const { rawToken, tokenHash } = OtpService.generateProofToken(testEmail, 'password_recovery');

    const mockOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000506'),
      email: testEmail,
      purpose: 'password_recovery',
      proofTokenHash: tokenHash,
      isProofConsumed: false,
      expiresAt: new Date(Date.now() + 300000),
    } as unknown as IOtpDocument;

    const mockFailingClerkClient = {
      users: {
        updateUser: async () => {
          throw new Error('Clerk IAM connectivity timeout');
        },
      },
    };

    mock.method(PasswordRecoveryService, 'getClerkClient', async () => mockFailingClerkClient);
    mock.method(OtpRepository, 'findByProofTokenHash', async () => mockOtpDoc);
    // P0 Batch 1 (AUD-C10): proof is now atomically consumed BEFORE Clerk mutation to close TOCTOU replay window
    mock.method(OtpRepository, 'consumeVerificationProof', async () => ({
      ...mockOtpDoc,
      isProofConsumed: true,
    }) as unknown as IOtpDocument);
    mock.method(UserRepository, 'findByEmail', async () => testUser);

    await assert.rejects(
      async () => {
        await PasswordRecoveryService.resetPassword({
          email: testEmail,
          verificationProofToken: rawToken,
          password: 'StrongCampus#2026',
          confirmPassword: 'StrongCampus#2026',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual(err.statusCode, HTTP_STATUS.BAD_GATEWAY);
        assert.ok(err.message.includes('External authentication gateway could not update password'));
        return true;
      }
    );

    mock.reset();
  });
});
