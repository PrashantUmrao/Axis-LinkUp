/**
 * Automated Security, Concurrency & Failure Resilience Test Suite (Phase 5.2.9).
 * 
 * Tests:
 * 1. Concurrent OTP verification & CAS atomic consumption.
 * 2. Concurrent password recovery requests & anti-enumeration idempotency.
 * 3. Token reuse prevention (activation tokens & recovery proof tokens).
 * 4. Clerk API failures during activation and provisioning.
 * 5. MongoDB failure during account provisioning and compensating Clerk rollback.
 * 6. Non-atomic distributed boundary: password update success followed by session revocation failure.
 * 7. Bulk import partial row failure isolation and duplicate row detection.
 * 8. Suspended and deactivated account lifecycle enforcement across all security gates.
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

// Domain Services & Repositories
import { OtpService } from '../../src/lib/services/otp.service';
import { ActivationService } from '../../src/lib/services/activation.service';
import { PasswordRecoveryService } from '../../src/lib/services/password-recovery.service';
import { ProvisioningService } from '../../src/lib/services/provisioning.service';
import { BulkProvisioningService } from '../../src/lib/services/bulk-provisioning.service';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { OtpRepository } from '../../src/lib/db/repositories/otp.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import {
  ValidationError,
  ConflictError,
  ForbiddenError,
  AppError,
} from '../../src/lib/errors/app-error';
import { HTTP_STATUS } from '../../src/config/constants';
import type { IUser, UserSession, UserDTO } from '../../src/types/user';
import type { IOtpDocument } from '../../src/types/otp';
import type { IDepartment } from '../../src/types/department';

// ============================================================================
// TEST FIXTURES
// ============================================================================
const sysAdminSession: UserSession = {
  userId: '6730a005f8b1a2001a000601',
  email: 'admin.shukla@axiscolleges.in',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
  sessionId: 'sess_sys_admin_601',
};

const cseDepartment: IDepartment = {
  _id: new Types.ObjectId('6730a005f8b1a2001a000001'),
  name: 'Computer Science and Engineering',
  code: 'CSE',
  status: 'active',
} as unknown as IDepartment;

// ============================================================================
// 1. CONCURRENT OTP VERIFICATION & CAS ATOMIC CONSUMPTION
// ============================================================================
describe('Phase 5.2.9 — 1. Concurrent OTP Verification & Atomic Race Defense', () => {
  const testEmail = 'scholar.aarav@axiscolleges.in';
  const rawOtp = '482915';
  const hashedOtp = OtpService.hashOtp(rawOtp);

  test('when two concurrent requests verify the same OTP, only one succeeds and the other is rejected', async () => {
    let isConsumedInDb = false;

    const mockOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000801'),
      email: testEmail,
      purpose: 'email_verification',
      hashedOtp,
      attempts: 0,
      maxAttempts: 5,
      isConsumed: false,
      expiresAt: new Date(Date.now() + 300000),
      createdAt: new Date(),
    } as unknown as IOtpDocument;

    // Both find the active OTP before consumption
    mock.method(OtpRepository, 'findActiveOtp', async () => {
      if (isConsumedInDb) return null;
      return { ...mockOtpDoc, isConsumed: isConsumedInDb };
    });

    // Atomic CAS consumeOtp: only succeeds on first invocation
    mock.method(OtpRepository, 'consumeOtp', async () => {
      if (isConsumedInDb) {
        return null; // Already consumed by concurrent caller
      }
      isConsumedInDb = true;
      return { ...mockOtpDoc, isConsumed: true };
    });

    mock.method(OtpRepository, 'setVerificationProof', async () => mockOtpDoc);
    mock.method(UserRepository, 'findByEmail', async () => null);

    // Dispatch concurrent requests
    const [res1, res2] = await Promise.allSettled([
      OtpService.verifyOtp({ email: testEmail, otp: rawOtp, purpose: 'email_verification' }),
      OtpService.verifyOtp({ email: testEmail, otp: rawOtp, purpose: 'email_verification' }),
    ]);

    // Exactly one must succeed and one must fail
    const succeeded = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejected = [res1, res2].filter((r) => r.status === 'rejected');

    assert.strictEqual(succeeded.length, 1, 'Exactly one concurrent verification must succeed');
    assert.strictEqual(rejected.length, 1, 'Second concurrent verification must be rejected');

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(
      rejectionReason instanceof ValidationError || rejectionReason instanceof AppError,
      'Rejection must be a validation/application error'
    );

    mock.reset();
  });
});

// ============================================================================
// 2. CONCURRENT PASSWORD RECOVERY REQUESTS & ANTI-ENUMERATION
// ============================================================================
describe('Phase 5.2.9 — 2. Concurrent Password Recovery Requests & Anti-Enumeration', () => {
  const testStudent = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000802'),
    email: 'karan.sharma@axiscolleges.in',
    username: 'karan.sharma',
    fullName: 'Karan Sharma',
    role: 'student',
    status: 'active',
    authProviderId: 'clerk_user_802',
  } as unknown as IUser;

  test('concurrent recovery requests return identical generic notice without leaking account state', async () => {
    mock.method(UserRepository, 'findByIdentifier', async (id: string) => {
      if (id.includes('nonexistent')) return null;
      return testStudent;
    });

    mock.method(OtpService, 'requestOtp', async () => ({
      email: testStudent.email,
      purpose: 'password_recovery',
      resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
      expiresInSeconds: 300,
      resendAvailableInSeconds: 60,
      expiresInMinutes: 5,
    }));

    const [res1, res2, res3] = await Promise.all([
      PasswordRecoveryService.requestRecovery({ identifier: 'karan.sharma@axiscolleges.in' }),
      PasswordRecoveryService.requestRecovery({ identifier: 'karan.sharma' }),
      PasswordRecoveryService.requestRecovery({ identifier: 'nonexistent.user@axiscolleges.in' }),
    ]);

    // All three must return identical generic notices
    assert.strictEqual(res1.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(res2.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(res3.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);

    // Non-existent user should not return an email
    assert.strictEqual(res3.email, undefined);
    assert.strictEqual(res3.maskedEmail, undefined);

    mock.reset();
  });
});

// ============================================================================
// 3. TOKEN REUSE DEFENSE (ACTIVATION & RECOVERY PROOF TOKENS)
// ============================================================================
describe('Phase 5.2.9 — 3. Token Reuse & Replay Prevention', () => {
  const testEmail = 'ananya.sen@axiscolleges.in';

  test('activation token reuse is strictly rejected once token is cleared (status: pending_verification)', async () => {
    const rawToken = 'a'.repeat(64);

    // User whose invitation was cleared or already used
    const pendingClearedUser = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000803'),
      email: testEmail,
      fullName: 'Ananya Sen',
      role: 'student',
      status: 'pending_verification',
      activationTokenHash: null, // Cleared on activation
      activationTokenExpiresAt: null,
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => pendingClearedUser);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(rawToken, testEmail);
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('already been used'));
        return true;
      }
    );

    mock.reset();
  });

  test('activation token attempt on already active account is rejected with ConflictError', async () => {
    const rawToken = 'a'.repeat(64);

    const alreadyActiveUser = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000803'),
      email: testEmail,
      fullName: 'Ananya Sen',
      role: 'student',
      status: 'active',
      activatedAt: new Date(),
      activationTokenHash: null,
      activationTokenExpiresAt: null,
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => alreadyActiveUser);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(rawToken, testEmail);
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok(err.message.includes('already been activated'));
        return true;
      }
    );

    mock.reset();
  });

  test('recovery proof token reuse is strictly rejected once isProofConsumed is true', async () => {
    const { rawToken, tokenHash } = OtpService.generateProofToken(testEmail, 'password_recovery');

    const consumedOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000804'),
      email: testEmail,
      purpose: 'password_recovery',
      proofTokenHash: tokenHash,
      isProofConsumed: true, // Already consumed
      expiresAt: new Date(Date.now() + 300000),
    } as unknown as IOtpDocument;

    mock.method(OtpRepository, 'findByProofTokenHash', async () => consumedOtpDoc);

    await assert.rejects(
      async () => {
        await PasswordRecoveryService.resetPassword({
          email: testEmail,
          verificationProofToken: rawToken,
          password: 'Campu$Password2026',
          confirmPassword: 'Campu$Password2026',
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
});

// ============================================================================
// 4. CLERK API FAILURES DURING ACTIVATION & PROVISIONING
// ============================================================================
describe('Phase 5.2.9 — 4. Clerk External Gateway Failure Handling', () => {
  test('ActivationService maps Clerk network failure to HTTP 502 Bad Gateway', async () => {
    const rawToken = 'b'.repeat(64);
    const tokenHash = ActivationService.hashToken(rawToken);

    const pendingUser = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000805'),
      email: 'rohit.gupta@axiscolleges.in',
      fullName: 'Rohit Gupta',
      role: 'student',
      status: 'pending_verification',
      authProviderId: 'clerk_user_805',
      activationTokenHash: tokenHash,
      activationTokenExpiresAt: new Date(Date.now() + 86400000),
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => pendingUser);
    mock.method(ActivationService, 'getClerkClient', async () => ({
      users: {
        updateUser: async () => {
          throw new Error('Clerk IAM Connection Timed Out (ETIMEDOUT)');
        },
      },
    }));

    await assert.rejects(
      async () => {
        await ActivationService.activateAccount({
          email: 'rohit.gupta@axiscolleges.in',
          token: rawToken,
          password: 'StrongCampus#2026',
          confirmPassword: 'StrongCampus#2026',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual(err.statusCode, HTTP_STATUS.BAD_GATEWAY);
        return true;
      }
    );

    mock.reset();
  });
});

// ============================================================================
// 5. DISTRIBUTED FAILURE: COMPENSATING CLERK ROLLBACK ON MONGODB WRITE ERROR
// ============================================================================
describe('Phase 5.2.9 — 5. Distributed Compensation: Clerk Rollback on DB Error', () => {
  test('rolls back created Clerk identity when MongoDB persistence fails during provisioning', async () => {
    let deletedClerkUserId = '';

    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => cseDepartment);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    mock.method(ProvisioningService, 'getClerkClient', async () => ({
      users: {
        createUser: async () => ({ id: 'clerk_user_orphan_to_delete' }),
        deleteUser: async (id: string) => {
          deletedClerkUserId = id;
          return { id, deleted: true };
        },
      },
    }));

    // Simulate MongoDB write failure (e.g., replica set failover or constraint violation)
    mock.method(UserRepository, 'create', async () => {
      throw new Error('MongoNetworkError: connection timed out during write operation');
    });

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(
          {
            fullName: 'Vandana Mishra',
            username: 'vandana.mishra',
            email: 'vandana.mishra@axiscolleges.in',
            role: 'student',
            departmentId: 'CSE',
            studentProfile: {
              rollNumber: '2026CSE099',
              batchYear: 2026,
              currentSemester: 1,
              section: 'A',
            },
          },
          sysAdminSession
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('MongoNetworkError'));
        return true;
      }
    );

    // Verify that compensating transaction successfully deleted the orphaned Clerk user
    assert.strictEqual(
      deletedClerkUserId,
      'clerk_user_orphan_to_delete',
      'Orphaned Clerk identity must be deleted via compensating rollback'
    );

    mock.reset();
  });
});

// ============================================================================
// 6. DISTRIBUTED NON-ATOMIC BOUNDARY: PASSWORD UPDATE SUCCESS / SESSION REVOCATION WARNING
// ============================================================================
describe('Phase 5.2.9 — 6. Distributed Non-Atomic Boundary: Password Reset vs Session Revocation', () => {
  const testEmail = 'priya.singh@axiscolleges.in';

  test('password reset completes successfully even when secondary session revocation encounters warning', async () => {
    const { rawToken, tokenHash } = OtpService.generateProofToken(testEmail, 'password_recovery');

    const mockOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000806'),
      email: testEmail,
      purpose: 'password_recovery',
      proofTokenHash: tokenHash,
      isProofConsumed: false,
      expiresAt: new Date(Date.now() + 300000),
    } as unknown as IOtpDocument;

    const testUser = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000807'),
      email: testEmail,
      username: 'priya.singh',
      role: 'faculty',
      status: 'active',
      authProviderId: 'clerk_fac_807',
    } as unknown as IUser;

    let passwordUpdated = false;
    let proofConsumed = false;

    mock.method(OtpRepository, 'findByProofTokenHash', async () => mockOtpDoc);
    mock.method(UserRepository, 'findByEmail', async () => testUser);
    mock.method(OtpRepository, 'consumeVerificationProof', async () => {
      proofConsumed = true;
      return { ...mockOtpDoc, isProofConsumed: true };
    });

    mock.method(PasswordRecoveryService, 'getClerkClient', async () => ({
      users: {
        updateUser: async () => {
          passwordUpdated = true;
          return { id: 'clerk_fac_807' };
        },
      },
      sessions: {
        getSessionList: async () => {
          // Secondary session listing fails due to transient gateway glitch
          throw new Error('Clerk Session Service temporarily unavailable (503)');
        },
        revokeSession: async () => ({ id: 'sess_1' }),
      },
    }));

    const result = await PasswordRecoveryService.resetPassword({
      email: testEmail,
      verificationProofToken: rawToken,
      password: 'CampusStrong#2026',
      confirmPassword: 'CampusStrong#2026',
    });

    // Password reset must succeed and proof must be consumed despite session revocation warning
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.sessionsRevoked, 0);
    assert.strictEqual(passwordUpdated, true, 'Clerk password must be updated');
    assert.strictEqual(proofConsumed, true, 'MongoDB proof token must be atomically consumed');

    mock.reset();
  });
});

// ============================================================================
// 7. BULK IMPORT PARTIAL ROW FAILURE ISOLATION
// ============================================================================
describe('Phase 5.2.9 — 7. Bulk Import Partial Row Failure Isolation', () => {
  test('valid rows succeed while invalid rows report precise row errors when skipInvalid is true', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [cseDepartment]);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    mock.method(ProvisioningService, 'provisionSingleAccount', async (input: unknown) => {
      const cast = input as { email: string; username: string; fullName: string };
      if (cast.username === 'duplicate.student') {
        throw new ValidationError('A user with username duplicate.student already exists.');
      }
      return {
        id: 'mock_stu_id_101',
        email: cast.email,
        username: cast.username,
        fullName: cast.fullName,
        role: 'student',
        status: 'pending_verification',
      } as unknown as UserDTO;
    });

    const csvContent = [
      'fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section',
      'Valid Student One,valid.one,valid.one@axiscolleges.in,CSE,2026CSE101,2026,1,A',
      'Duplicate Student,duplicate.student,dup.student@axiscolleges.in,CSE,2026CSE102,2026,1,A',
    ].join('\r\n');

    const result = await BulkProvisioningService.executeBulkProvision(csvContent, 'student', sysAdminSession, {
      skipInvalid: true,
    });

    assert.strictEqual(result.totalRows, 2);
    assert.strictEqual(result.successCount, 1);
    assert.strictEqual(result.failedCount, 1);
    assert.strictEqual(result.results[0]?.status, 'success');
    assert.strictEqual(result.results[1]?.status, 'failed');
    assert.ok(result.results[1]?.reason?.includes('duplicate.student already exists'));

    mock.reset();
  });
});

// ============================================================================
// 8. SUSPENDED & DEACTIVATED ACCOUNT ENFORCEMENT
// ============================================================================
describe('Phase 5.2.9 — 8. Suspended & Deactivated Account Lifecycle Enforcement', () => {
  const suspendedUser = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000809'),
    email: 'suspended.student@axiscolleges.in',
    username: 'suspended.student',
    fullName: 'Suspended Scholar',
    role: 'student',
    status: 'suspended',
    authProviderId: 'clerk_user_809',
  } as unknown as IUser;

  const deactivatedUser = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000810'),
    email: 'deactivated.faculty@axiscolleges.in',
    username: 'deactivated.faculty',
    fullName: 'Former Faculty',
    role: 'faculty',
    status: 'deactivated',
    authProviderId: 'clerk_fac_810',
  } as unknown as IUser;

  test('suspended account requesting recovery receives generic notice without OTP dispatch', async () => {
    let otpDispatched = false;

    mock.method(UserRepository, 'findByIdentifier', async () => suspendedUser);
    mock.method(OtpService, 'requestOtp', async () => {
      otpDispatched = true;
      return {
        email: suspendedUser.email,
        purpose: 'password_recovery',
        resendAvailableAt: new Date().toISOString(),
        expiresInSeconds: 300,
      };
    });

    const result = await PasswordRecoveryService.requestRecovery({
      identifier: 'suspended.student@axiscolleges.in',
    });

    assert.strictEqual(result.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(otpDispatched, false, 'OTP must not be dispatched for suspended accounts');

    mock.reset();
  });

  test('suspended account attempting activation is blocked with HTTP 403 ForbiddenError', async () => {
    const rawToken = 'c'.repeat(64);
    const tokenHash = ActivationService.hashToken(rawToken);

    const suspendedInvitation = {
      ...suspendedUser,
      activationTokenHash: tokenHash,
      activationTokenExpiresAt: new Date(Date.now() + 86400000),
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => suspendedInvitation);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(rawToken, suspendedUser.email);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Suspended collegiate accounts cannot be activated'));
        return true;
      }
    );

    mock.reset();
  });

  test('deactivated account attempting activation is blocked with HTTP 403 ForbiddenError', async () => {
    const rawToken = 'd'.repeat(64);
    const tokenHash = ActivationService.hashToken(rawToken);

    const deactivatedInvitation = {
      ...deactivatedUser,
      activationTokenHash: tokenHash,
      activationTokenExpiresAt: new Date(Date.now() + 86400000),
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => deactivatedInvitation);

    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(rawToken, deactivatedUser.email);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Deactivated accounts cannot be activated'));
        return true;
      }
    );

    mock.reset();
  });
});
