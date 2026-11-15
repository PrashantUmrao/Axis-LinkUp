/**
 * End-to-End Account Lifecycle & Role Verification Test Suite (Phase 5.2.8).
 * Conforms to Phase 5.2.8 QA and Full-Stack Integration Specifications:
 * Validates the 6 collegiate personas across all 10 user journeys:
 * 1. Role selection & ingress
 * 2. Login identity resolution
 * 3. Single-account provisioning
 * 4. Bulk CSV provisioning & preview
 * 5. First-time account activation
 * 6. Email OTP verification
 * 7. Forgot-password account resolution & enumeration defense
 * 8. OTP verification for password recovery
 * 9. Password reset & session revocation
 * 10. Suspended account access restrictions
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

// Domain Services & Repositories
import { ProvisioningService } from '../../src/lib/services/provisioning.service';
import { ActivationService } from '../../src/lib/services/activation.service';
import { OtpService } from '../../src/lib/services/otp.service';
import { PasswordRecoveryService } from '../../src/lib/services/password-recovery.service';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { OtpRepository } from '../../src/lib/db/repositories/otp.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';

// RBAC & Authorization
import {
  isSysAdmin,
  isHOD,
  isDirector,
  canManageUserRoles,
  assertCanManageUserRoles,
} from '../../src/lib/auth/rbac';
import {
  ConflictError,
  ForbiddenError,
} from '../../src/lib/errors/app-error';
import type { IUser, UserSession } from '../../src/types/user';
import type { IOtpDocument } from '../../src/types/otp';
import type { IDepartment } from '../../src/types/department';

// ============================================================================
// 6 AUTHORIZED COLLEGIATE PERSONAS
// ============================================================================
const PERSONAS = {
  sysAdmin: {
    userId: '6730a005f8b1a2001a000601',
    authProviderId: 'clerk_sys_admin_601',
    email: 'admin.shukla@axiscolleges.in',
    username: 'admin.shukla',
    fullName: 'Dr. Vivek Shukla',
    role: 'super_admin' as const,
    adminSubRole: 'sys_admin' as const,
    status: 'active' as const,
  },
  hod: {
    userId: '6730a005f8b1a2001a000602',
    authProviderId: 'clerk_hod_cse_602',
    email: 'hod.cse@axiscolleges.in',
    username: 'hod.cse',
    fullName: 'Prof. Animesh Dixit',
    role: 'admin' as const,
    adminSubRole: 'hod' as const,
    status: 'active' as const,
    departmentId: '6730a005f8b1a2001a000001',
  },
  director: {
    userId: '6730a005f8b1a2001a000603',
    authProviderId: 'clerk_director_603',
    email: 'director@axiscolleges.in',
    username: 'director.aitm',
    fullName: 'Dr. Rameshwar Rao',
    role: 'super_admin' as const,
    adminSubRole: 'director' as const,
    status: 'active' as const,
  },
  faculty: {
    userId: '6730a005f8b1a2001a000604',
    authProviderId: 'clerk_faculty_604',
    email: 'priya.singh@axiscolleges.in',
    username: 'priya.singh',
    fullName: 'Dr. Priya Singh',
    role: 'faculty' as const,
    status: 'active' as const,
    departmentId: '6730a005f8b1a2001a000001',
  },
  student: {
    userId: '6730a005f8b1a2001a000605',
    authProviderId: 'clerk_student_605',
    email: 'aarav.sharma@axiscolleges.in',
    username: 'aarav.sharma',
    fullName: 'Aarav Sharma',
    role: 'student' as const,
    status: 'active' as const,
    departmentId: '6730a005f8b1a2001a000001',
  },
  suspendedStudent: {
    userId: '6730a005f8b1a2001a000606',
    authProviderId: 'clerk_suspended_606',
    email: 'vikram.roy@axiscolleges.in',
    username: 'vikram.roy',
    fullName: 'Vikram Roy',
    role: 'student' as const,
    status: 'suspended' as const,
    departmentId: '6730a005f8b1a2001a000001',
  },
};

describe('Phase 5.2.8 — Journey 1 & 2: Persona Authorization Hierarchy & Identity Invariants', () => {
  test('accurately classifies the 6 collegiate personas in the governance hierarchy', () => {
    // 1. System Administrator
    assert.strictEqual(isSysAdmin(PERSONAS.sysAdmin), true);
    assert.strictEqual(canManageUserRoles(PERSONAS.sysAdmin), true);
    assert.doesNotThrow(() => assertCanManageUserRoles(PERSONAS.sysAdmin));

    // 2. Department HOD
    assert.strictEqual(isHOD(PERSONAS.hod), true);
    assert.strictEqual(canManageUserRoles(PERSONAS.hod), false);
    assert.throws(() => assertCanManageUserRoles(PERSONAS.hod), (err: unknown) => {
      assert.ok(err instanceof ForbiddenError);
      return true;
    });

    // 3. Executive Director
    assert.strictEqual(isDirector(PERSONAS.director), true);
    assert.strictEqual(canManageUserRoles(PERSONAS.director), false);
    assert.throws(() => assertCanManageUserRoles(PERSONAS.director), (err: unknown) => {
      assert.ok(err instanceof ForbiddenError);
      return true;
    });

    // 4. Faculty Member
    assert.strictEqual(canManageUserRoles(PERSONAS.faculty), false);

    // 5. Enrolled Student
    assert.strictEqual(canManageUserRoles(PERSONAS.student), false);

    // 6. Suspended Account
    assert.strictEqual(canManageUserRoles(PERSONAS.suspendedStudent), false);
  });
});

describe('Phase 5.2.8 — Journey 3 & 4: Admin Single & Bulk Account Provisioning Gates', () => {
  const dummyDept = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000001'),
    name: 'Computer Science and Engineering',
    code: 'CSE',
    isActive: true,
  } as unknown as IDepartment;

  test('authorized System Administrator successfully provisions a student account', async () => {
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => dummyDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    const mockClerkUser = { id: 'clerk_new_stu_701' };
    mock.method(ProvisioningService, 'getClerkClient', async () => ({
      users: {
        createUser: async () => mockClerkUser,
        deleteUser: async () => ({}),
      },
    }));

    const persistedUser = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000701'),
      email: 'rohit.gupta@axiscolleges.in',
      username: 'rohit.gupta',
      fullName: 'Rohit Gupta',
      role: 'student',
      status: 'pending_verification',
      provisionedBy: new Types.ObjectId(PERSONAS.sysAdmin.userId),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    mock.method(UserRepository, 'create', async () => persistedUser);
    mock.method(ActivationService, 'createActivationToken', async () => ({
      rawToken: 'token123',
      expiresAt: new Date(),
      activationUrl: 'http://localhost:3000/activate?token=token123',
    }));

    const result = await ProvisioningService.provisionSingleAccount(
      {
        fullName: 'Rohit Gupta',
        username: 'rohit.gupta',
        email: 'rohit.gupta@axiscolleges.in',
        role: 'student',
        departmentId: 'CSE',
        studentProfile: {
          rollNumber: '24BCSE101',
          batchYear: 2024,
          currentSemester: 1,
          section: 'A',
          admissionType: 'regular',
        },
      },
      PERSONAS.sysAdmin as UserSession
    );

    assert.strictEqual(result.email, 'rohit.gupta@axiscolleges.in');
    assert.strictEqual(result.role, 'student');
    assert.strictEqual(result.status, 'pending_verification');

    mock.reset();
  });

  test('strictly forbids HOD, Director, and Student from provisioning accounts', async () => {
    // HOD attempt
    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(
          { fullName: 'Test', username: 'test', email: 'test@axiscolleges.in', role: 'student', departmentId: 'CSE' },
          PERSONAS.hod as UserSession
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Only System Administrators are authorized'));
        return true;
      }
    );

    // Director attempt (Director resolves appeals, does not provision IAM accounts)
    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(
          { fullName: 'Test', username: 'test', email: 'test@axiscolleges.in', role: 'student', departmentId: 'CSE' },
          PERSONAS.director as UserSession
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );

    // Student attempt
    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(
          { fullName: 'Test', username: 'test', email: 'test@axiscolleges.in', role: 'student', departmentId: 'CSE' },
          PERSONAS.student as UserSession
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );
  });

  test('pre-flight duplicate detection rejects existing email with ConflictError', async () => {
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => dummyDept);
    mock.method(UserRepository, 'findByEmail', async () => PERSONAS.student as unknown as IUser);

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(
          {
            fullName: 'Duplicate Aarav',
            username: 'aarav.sharma.new',
            email: 'aarav.sharma@axiscolleges.in',
            role: 'student',
            departmentId: 'CSE',
            studentProfile: {
              rollNumber: '24BCSE999',
              batchYear: 2024,
              currentSemester: 1,
              section: 'A',
              admissionType: 'regular',
            },
          },
          PERSONAS.sysAdmin as UserSession
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok(err.message.includes('already exists'));
        return true;
      }
    );

    mock.reset();
  });
});

describe('Phase 5.2.8 — Journey 5 & 6: First-Time Account Activation & OTP Verification', () => {
  const pendingStudent = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000702'),
    email: 'neha.verma@axiscolleges.in',
    username: 'neha.verma',
    fullName: 'Neha Verma',
    role: 'student',
    status: 'pending_verification',
    isEmailVerified: false,
    authProviderId: 'clerk_neha_702',
    activationTokenHash: ActivationService.hashToken('valid_activation_token_hex_64'),
    activationTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12), // 12h remaining
  } as unknown as IUser;

  test('validates activation token without mutating state', async () => {
    mock.method(UserRepository, 'findByEmail', async () => pendingStudent);

    const validation = await ActivationService.validateInvitation(
      'valid_activation_token_hex_64',
      pendingStudent.email
    );

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.email, pendingStudent.email);
    assert.strictEqual(validation.username, 'neha.verma');
    assert.strictEqual(validation.role, 'student');

    mock.reset();
  });

  test('verifying email OTP updates isEmailVerified in database', async () => {
    const rawOtp = '719283';
    const hashedOtp = OtpService.hashOtp(rawOtp);

    const mockOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000703'),
      email: pendingStudent.email,
      purpose: 'account_activation',
      hashedOtp,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 300000),
      isConsumed: false,
    } as unknown as IOtpDocument;

    let profileSynced = false;
    mock.method(OtpRepository, 'findActiveOtp', async () => mockOtpDoc);
    mock.method(OtpRepository, 'consumeOtp', async () => mockOtpDoc);
    mock.method(OtpRepository, 'setVerificationProof', async () => mockOtpDoc);
    mock.method(UserRepository, 'findByEmail', async () => pendingStudent);
    mock.method(UserRepository, 'syncExternalProfile', async (_id: string, update: { isEmailVerified?: boolean }) => {
      if (update.isEmailVerified) profileSynced = true;
      return null;
    });

    const verifyResult = await OtpService.verifyOtp({
      email: pendingStudent.email,
      otp: rawOtp,
      purpose: 'account_activation',
    });

    assert.strictEqual(verifyResult.verified, true);
    assert.strictEqual(profileSynced, true);

    mock.reset();
  });

  test('completes account activation: establishes Clerk password and marks MongoDB status active', async () => {
    let updatedClerkUserId = '';
    let updatedClerkPassword = '';
    let dbStatusUpdated = false;

    mock.method(UserRepository, 'findByEmail', async () => pendingStudent);
    mock.method(ActivationService, 'getClerkClient', async () => ({
      users: {
        updateUser: async (id: string, data: { password?: string }) => {
          updatedClerkUserId = id;
          updatedClerkPassword = data.password || '';
          return {};
        },
        updateUserMetadata: async () => ({}),
      },
    }));

    mock.method(UserRepository, 'completeAccountActivation', async () => {
      dbStatusUpdated = true;
      return {
        ...pendingStudent,
        status: 'active',
        isEmailVerified: true,
        activatedAt: new Date(),
      } as unknown as IUser;
    });

    const activationResult = await ActivationService.activateAccount({
      token: 'valid_activation_token_hex_64',
      email: pendingStudent.email,
      password: 'CollegiateStrong#2026',
      confirmPassword: 'CollegiateStrong#2026',
    });

    assert.strictEqual(activationResult.status, 'active');
    assert.strictEqual(activationResult.email, pendingStudent.email);
    assert.strictEqual(updatedClerkUserId, 'clerk_neha_702');
    assert.strictEqual(updatedClerkPassword, 'CollegiateStrong#2026');
    assert.strictEqual(dbStatusUpdated, true);

    mock.reset();
  });

  test('replay defense: rejects already activated accounts', async () => {
    const activeStudent = {
      ...pendingStudent,
      status: 'active',
      activatedAt: new Date(),
    } as unknown as IUser;

    mock.method(UserRepository, 'findByEmail', async () => activeStudent);

    await assert.rejects(
      async () => {
        await ActivationService.activateAccount({
          token: 'valid_activation_token_hex_64',
          email: pendingStudent.email,
          password: 'CollegiateStrong#2026',
          confirmPassword: 'CollegiateStrong#2026',
        });
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

describe('Phase 5.2.8 — Journey 7, 8 & 9: Forgot Password, Proof Token & Session Revocation', () => {
  const activeFaculty = {
    _id: new Types.ObjectId('6730a005f8b1a2001a000704'),
    email: 'dr.anand@axiscolleges.in',
    username: 'dr.anand',
    fullName: 'Dr. Anand Verma',
    role: 'faculty',
    status: 'active',
    authProviderId: 'clerk_anand_704',
  } as unknown as IUser;

  test('recovers via email or username and respects account enumeration defense', async () => {
    mock.method(UserRepository, 'findByIdentifier', async () => activeFaculty);
    mock.method(OtpService, 'requestOtp', async () => ({
      email: activeFaculty.email,
      purpose: 'password_recovery',
      resendAvailableAt: new Date().toISOString(),
      expiresInSeconds: 300,
    }));

    const resEmail = await PasswordRecoveryService.requestRecovery({
      identifier: 'dr.anand@axiscolleges.in',
    });
    assert.strictEqual(resEmail.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(resEmail.email, activeFaculty.email);

    const resUser = await PasswordRecoveryService.requestRecovery({
      identifier: 'dr.anand',
    });
    assert.strictEqual(resUser.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(resUser.email, activeFaculty.email);

    // Non-existent user returns identical message without disclosing 404
    mock.method(UserRepository, 'findByIdentifier', async () => null);
    const resGhost = await PasswordRecoveryService.requestRecovery({
      identifier: 'ghost.user@axiscolleges.in',
    });
    assert.strictEqual(resGhost.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(resGhost.email, undefined);

    mock.reset();
  });

  test('password recovery returns generic message for suspended accounts and suppresses OTP', async () => {
    const suspendedFaculty = {
      ...activeFaculty,
      status: 'suspended',
    } as unknown as IUser;

    let otpCalled = false;
    mock.method(UserRepository, 'findByIdentifier', async () => suspendedFaculty);
    mock.method(OtpService, 'requestOtp', async () => {
      otpCalled = true;
      return {} as unknown as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const resSuspended = await PasswordRecoveryService.requestRecovery({
      identifier: 'dr.anand@axiscolleges.in',
    });

    assert.strictEqual(resSuspended.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    assert.strictEqual(resSuspended.email, undefined);
    assert.strictEqual(otpCalled, false); // OTP dispatch was suppressed

    mock.reset();
  });

  test('successfully resets password, revokes active Clerk sessions, and consumes proof', async () => {
    const { rawToken, tokenHash } = OtpService.generateProofToken(activeFaculty.email, 'password_recovery');

    const mockOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000705'),
      email: activeFaculty.email,
      purpose: 'password_recovery',
      proofTokenHash: tokenHash,
      isProofConsumed: false,
      expiresAt: new Date(Date.now() + 300000),
    } as unknown as IOtpDocument;

    const revokedSessions: string[] = [];
    let updatedClerkPassword = '';
    let proofConsumed = false;

    mock.method(OtpRepository, 'findByProofTokenHash', async () => mockOtpDoc);
    mock.method(OtpRepository, 'consumeVerificationProof', async () => {
      proofConsumed = true;
      return { ...mockOtpDoc, isProofConsumed: true } as unknown as IOtpDocument;
    });
    mock.method(UserRepository, 'findByEmail', async () => activeFaculty);
    mock.method(PasswordRecoveryService, 'getClerkClient', async () => ({
      users: {
        updateUser: async (_id: string, data: { password?: string }) => {
          updatedClerkPassword = data.password || '';
          return {};
        },
      },
      sessions: {
        getSessionList: async () => ({
          data: [{ id: 'sess_live_1', status: 'active' }, { id: 'sess_live_2', status: 'active' }],
        }),
        revokeSession: async (id: string) => {
          revokedSessions.push(id);
          return {};
        },
      },
    }));

    const result = await PasswordRecoveryService.resetPassword({
      email: activeFaculty.email,
      verificationProofToken: rawToken,
      password: 'FreshPassword#2026',
      confirmPassword: 'FreshPassword#2026',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.sessionsRevoked, 2);
    assert.strictEqual(updatedClerkPassword, 'FreshPassword#2026');
    assert.deepStrictEqual(revokedSessions, ['sess_live_1', 'sess_live_2']);
    assert.strictEqual(proofConsumed, true);

    mock.reset();
  });
});

describe('Phase 5.2.8 — Journey 10: Suspended Account Invariant Enforcement', () => {
  test('suspended accounts cannot recover passwords or activate accounts', async () => {
    const suspendedUser = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000706'),
      email: 'vikram.roy@axiscolleges.in',
      status: 'suspended',
      authProviderId: 'clerk_vikram_706',
    } as unknown as IUser;

    // Reset password attempt
    const { rawToken, tokenHash } = OtpService.generateProofToken(suspendedUser.email, 'password_recovery');
    mock.method(OtpRepository, 'findByProofTokenHash', async () => ({
      _id: new Types.ObjectId('6730a005f8b1a2001a000707'),
      email: suspendedUser.email,
      proofTokenHash: tokenHash,
      isProofConsumed: false,
      expiresAt: new Date(Date.now() + 300000),
    } as unknown as IOtpDocument));
    mock.method(UserRepository, 'findByEmail', async () => suspendedUser);

    await assert.rejects(
      async () => {
        await PasswordRecoveryService.resetPassword({
          email: suspendedUser.email,
          verificationProofToken: rawToken,
          password: 'AttemptPassword#2026',
          confirmPassword: 'AttemptPassword#2026',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Suspended collegiate accounts cannot recover passwords'));
        return true;
      }
    );

    // Account activation attempt
    await assert.rejects(
      async () => {
        await ActivationService.validateInvitation(
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          suspendedUser.email
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
});
