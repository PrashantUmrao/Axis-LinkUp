/**
 * P1 Remediation Batch 2 — Auth Anti-Enumeration, Rate Limiting, Search PII Minimization,
 * Session Revocation, Uniform Lifecycle Gates, DB Reconnect, Cycle-Safe Logger,
 * Error Sanitization, Safe HTTP(S) URLs, Regex Escaping, Admin PATCH Hardening & Dep Audit.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import mongoose, { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { PasswordRecoveryService } from '@/lib/services/password-recovery.service';
import { OtpService } from '@/lib/services/otp.service';
import { ActivationService } from '@/lib/services/activation.service';
import { IamGovernanceService } from '@/lib/services/iam-governance.service';
import { UserService } from '@/lib/services/user.service';
import { AuditService } from '@/lib/services/audit.service';
import { ChatService } from '@/lib/services/chat.service';
import { PollService } from '@/lib/services/poll.service';
import { ServiceRequestService } from '@/lib/services/service-request.service';
import { SessionService, validateSessionIntegrity } from '@/lib/auth/session';
import { requireAuth, __setTestSession } from '@/lib/auth/server';
import { evaluateAccountLifecycleGate } from '@/lib/auth/routing';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { OtpRepository } from '@/lib/db/repositories/otp.repository';
import { PollRepository } from '@/lib/db/repositories/poll.repository';
import { ServiceRequestRepository } from '@/lib/db/repositories/service-request.repository';
import UserModel from '@/lib/db/models/user.model';
import { connectToDatabase } from '@/lib/db/mongodb';
import { logger, safeJsonStringify, sanitizeLogData } from '@/lib/logging/logger';
import { handleApiError } from '@/lib/api/api-error-handler';
import { resetRateLimiter } from '@/lib/security/rate-limiter';
import { ForbiddenError, ValidationError } from '@/lib/errors/app-error';

import { attachmentInputSchema } from '@/lib/validations/assignment.schema';
import { chatAttachmentSchema } from '@/lib/validations/chat.schema';
import { complaintAttachmentSchema } from '@/lib/validations/complaint.schema';
import { noticeAttachmentSchema } from '@/lib/validations/notice.schema';
import {
  requestAttachmentInputSchema,
  serviceRequestQuerySchema,
} from '@/lib/validations/service-request.schema';
import { updateUserProfileSchema, createUserSchema } from '@/lib/validations/user.schema';

import { POST as POST_OTP_RESEND } from '@/app/api/v1/auth/otp/resend/route';
import { POST as POST_OTP_VERIFY } from '@/app/api/v1/auth/otp/verify/route';
import { GET as GET_ACT_VALIDATE } from '@/app/api/v1/auth/activation/validate/route';
import { POST as POST_ACT_COMPLETE } from '@/app/api/v1/auth/activation/complete/route';
import { POST as POST_PWD_RESET } from '@/app/api/v1/auth/password-recovery/reset/route';
import { GET as GET_USERS_SEARCH } from '@/app/api/v1/users/search/route';
import { GET as GET_CHAT_USERS } from '@/app/api/v1/chat/users/route';
import { GET as GET_CHAT_TOKEN } from '@/app/api/v1/chat/token/route';
import { PATCH as PATCH_ADMIN_USER } from '@/app/api/v1/admin/users/[id]/route';

import type { UserSession, IUser } from '@/types/user';

const SUPER_ADMIN_ID = new Types.ObjectId('67000000000000000000a001');
const OTHER_SUPER_ADMIN_ID = new Types.ObjectId('67000000000000000000a002');
const FACULTY_ID = new Types.ObjectId('67000000000000000000a003');
const STUDENT_ID = new Types.ObjectId('67000000000000000000a004');
const TARGET_USER_ID = new Types.ObjectId('67000000000000000000a005');

const superAdminSession: UserSession = {
  userId: SUPER_ADMIN_ID.toString(),
  email: 'sysadmin@axiscolleges.in',
  fullName: 'Root System Admin',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

const facultySession: UserSession = {
  userId: FACULTY_ID.toString(),
  email: 'faculty@axiscolleges.in',
  fullName: 'Dr. Faculty',
  role: 'faculty',
  status: 'active',
};

const studentSession: UserSession = {
  userId: STUDENT_ID.toString(),
  email: 'student@axiscolleges.in',
  fullName: 'Aarav Student',
  role: 'student',
  status: 'active',
};

// Snapshot originals for deterministic restoration
const origUserFindById = UserRepository.findById;
const origUserFindByEmail = UserRepository.findByEmail;
const origUserFindByIdentifier = UserRepository.findByIdentifier;
const origUserCountByRole = UserRepository.countByRole;
const origUserUpdateStatusRepo = UserRepository.updateStatus;
const origUserUpdateRoleRepo = UserRepository.updateRole;
const origUserSearchDirectory = UserRepository.searchDirectory;
const origOtpRequest = OtpService.requestOtp;
const origOtpResend = OtpService.resendOtp;
const origOtpVerify = OtpService.verifyOtp;
const origOtpCreate = OtpRepository.createOtp;
const origActValidate = ActivationService.validateInvitation;
const origActComplete = ActivationService.activateAccount;
const origPwdReset = PasswordRecoveryService.resetPassword;
const origRevokeAllSessions = SessionService.revokeAllUserSessions;
const origAblyRevoke = AblyBroker.revokeUserTokens;
const origAuditRecord = AuditService.recordEvent;
const origChatGetUserConvs = ChatService.getUserConversations;
const origPollFindFeed = PollRepository.findFeed;
const origServiceReqFind = ServiceRequestRepository.findRequests;
const origUserModelFindById = UserModel.findById;
const origMongoUri = process.env.MONGODB_URI;
const origAblyKey = process.env.ABLY_API_KEY;
const origMongooseConnect = mongoose.connect;

function restoreAll() {
  UserRepository.findById = origUserFindById;
  UserRepository.findByEmail = origUserFindByEmail;
  UserRepository.findByIdentifier = origUserFindByIdentifier;
  UserRepository.countByRole = origUserCountByRole;
  UserRepository.updateStatus = origUserUpdateStatusRepo;
  UserRepository.updateRole = origUserUpdateRoleRepo;
  UserRepository.searchDirectory = origUserSearchDirectory;
  OtpService.requestOtp = origOtpRequest;
  OtpService.resendOtp = origOtpResend;
  OtpService.verifyOtp = origOtpVerify;
  OtpRepository.createOtp = origOtpCreate;
  ActivationService.validateInvitation = origActValidate;
  ActivationService.activateAccount = origActComplete;
  PasswordRecoveryService.resetPassword = origPwdReset;
  SessionService.revokeAllUserSessions = origRevokeAllSessions;
  AblyBroker.revokeUserTokens = origAblyRevoke;
  AuditService.recordEvent = origAuditRecord;
  ChatService.getUserConversations = origChatGetUserConvs;
  PollRepository.findFeed = origPollFindFeed;
  ServiceRequestRepository.findRequests = origServiceReqFind;
  UserModel.findById = origUserModelFindById;
  mongoose.connect = origMongooseConnect;

  if (origMongoUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = origMongoUri;
  if (origAblyKey === undefined) delete process.env.ABLY_API_KEY;
  else process.env.ABLY_API_KEY = origAblyKey;

  if (global.mongooseCache) {
    global.mongooseCache.conn = null;
    global.mongooseCache.promise = null;
  }

  __setTestSession(null);
  resetRateLimiter();
}

describe('P1 Remediation Batch 2: Lifecycle, Anti-Enumeration, Reliability & Dependencies', () => {
  beforeEach(() => {
    restoreAll();
  });

  afterEach(() => {
    restoreAll();
  });

  // =========================================================================
  // 1. AUD-H11 & AUD-M05: Anti-Enumeration, 8 Rate-Limited Routes & Search PII
  // =========================================================================
  describe('AUD-H11 & AUD-M05: Auth Anti-Enumeration, Rate Limiting & Search PII', () => {
    it('PasswordRecoveryService.requestRecovery never leaks unmasked email for username lookups', async () => {
      UserRepository.findByIdentifier = async () =>
        ({
          _id: STUDENT_ID,
          email: 'secret.student@axiscolleges.in',
          username: 'secret.student',
          status: 'active',
        }) as unknown as IUser;
      OtpService.requestOtp = async () => ({
        email: 'se***@axiscolleges.in',
        purpose: 'password_recovery',
        resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
        expiresInSeconds: 300,
        resendAvailableInSeconds: 60,
        expiresInMinutes: 5,
      });

      const res = await PasswordRecoveryService.requestRecovery({ identifier: 'secret.student' });
      assert.equal(res.email, undefined, 'Raw unmasked email MUST NOT be returned');
      assert.equal(res.maskedEmail, 'se***@axiscolleges.in');
      assert.equal(res.message, PasswordRecoveryService.GENERIC_REQUEST_NOTICE);
    });

    it('OtpService.requestOtp suppresses dispatch without throwing 404/403 on unrecognized or suspended accounts', async () => {
      let otpCreated = false;
      OtpRepository.createOtp = async () => {
        otpCreated = true;
        return {} as never;
      };

      UserRepository.findByEmail = async () => null;
      const unknownRes = await OtpService.requestOtp({
        email: 'nobody@axiscolleges.in',
        purpose: 'password_recovery',
      });
      assert.equal(otpCreated, false);
      assert.equal(unknownRes.email, 'no***@axiscolleges.in');

      UserRepository.findByEmail = async () =>
        ({ _id: STUDENT_ID, email: 'suspended@axiscolleges.in', status: 'suspended' }) as unknown as IUser;
      const suspendedRes = await OtpService.requestOtp({
        email: 'suspended@axiscolleges.in',
        purpose: 'password_recovery',
      });
      assert.equal(otpCreated, false);
      assert.equal(suspendedRes.email, 'su***@axiscolleges.in');
    });

    it('ActivationService.validateInvitation returns identical ValidationError for missing vs wrong-token suspended/active accounts', async () => {
      const dummyToken = 'a'.repeat(64);

      UserRepository.findByEmail = async () => null;
      let missingErrMsg = '';
      await assert.rejects(
        () => ActivationService.validateInvitation(dummyToken, 'missing@axiscolleges.in'),
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          missingErrMsg = err.message;
          return true;
        }
      );

      UserRepository.findByEmail = async () =>
        ({
          _id: STUDENT_ID,
          email: 'suspended@axiscolleges.in',
          status: 'suspended',
          activationTokenHash: ActivationService.hashToken('b'.repeat(64)),
        }) as unknown as IUser;
      let suspendedErrMsg = '';
      await assert.rejects(
        () => ActivationService.validateInvitation(dummyToken, 'suspended@axiscolleges.in'),
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          suspendedErrMsg = err.message;
          return true;
        }
      );

      assert.equal(
        missingErrMsg,
        suspendedErrMsg,
        'Unauthenticated callers without a valid secret token must see identical error messages'
      );
    });

    it('enforces HTTP 429 + Retry-After on ALL 8 newly rate-limited endpoints', async () => {
      // Stub downstream services so rate limiter is exercised cleanly
      OtpService.resendOtp = async () => ({
        email: 'st***@axiscolleges.in',
        purpose: 'email_verification',
        resendAvailableAt: new Date().toISOString(),
        expiresInSeconds: 300,
      });
      OtpService.verifyOtp = async () => ({
        verified: true,
        email: 'student@axiscolleges.in',
        purpose: 'email_verification',
      });
      ActivationService.validateInvitation = async () => ({
        valid: true,
        email: 'student@axiscolleges.in',
        fullName: 'Student',
        username: 'student1',
        role: 'student',
        isEmailVerified: true,
      });
      ActivationService.activateAccount = async () => ({
        email: 'student@axiscolleges.in',
        username: 'student1',
        role: 'student',
        status: 'active',
        activatedAt: new Date().toISOString(),
      });
      PasswordRecoveryService.resetPassword = async () => ({
        success: true,
        email: 'student@axiscolleges.in',
        role: 'student',
        sessionsRevoked: 1,
        message: 'ok',
      });
      UserRepository.searchDirectory = async () => [];
      ChatService.getUserConversations = async () => [];
      delete process.env.MONGODB_URI;
      delete process.env.ABLY_API_KEY;
      __setTestSession(facultySession);

      const assertRateLimited = async (
        label: string,
        limit: number,
        invoke: () => Promise<Response>
      ) => {
        resetRateLimiter();
        for (let i = 0; i < limit; i++) {
          const res = await invoke();
          assert.notEqual(res.status, 429, `${label} request #${i + 1} should not be throttled`);
        }
        const blocked = await invoke();
        assert.equal(blocked.status, 429, `${label} request #${limit + 1} MUST return 429`);
        assert.ok(blocked.headers.get('Retry-After'), `${label} 429 must include Retry-After`);
      };

      const ipHeader = { 'x-forwarded-for': '203.0.113.42' };

      // 1. POST /api/v1/auth/otp/resend (5/60s)
      await assertRateLimited('otp/resend', 5, () =>
        POST_OTP_RESEND(
          new NextRequest('http://localhost:3000/api/v1/auth/otp/resend', {
            method: 'POST',
            headers: ipHeader,
            body: JSON.stringify({ email: 'student@axiscolleges.in', purpose: 'email_verification' }),
          })
        )
      );

      // 2. POST /api/v1/auth/otp/verify (10/60s)
      await assertRateLimited('otp/verify', 10, () =>
        POST_OTP_VERIFY(
          new NextRequest('http://localhost:3000/api/v1/auth/otp/verify', {
            method: 'POST',
            headers: ipHeader,
            body: JSON.stringify({
              email: 'student@axiscolleges.in',
              otp: '123456',
              purpose: 'email_verification',
            }),
          })
        )
      );

      // 3. GET /api/v1/auth/activation/validate (15/60s)
      await assertRateLimited('activation/validate', 15, () =>
        GET_ACT_VALIDATE(
          new NextRequest(
            `http://localhost:3000/api/v1/auth/activation/validate?token=${'a'.repeat(64)}&email=student@axiscolleges.in`,
            { headers: ipHeader }
          )
        )
      );

      // 4. POST /api/v1/auth/activation/complete (5/60s)
      await assertRateLimited('activation/complete', 5, () =>
        POST_ACT_COMPLETE(
          new NextRequest('http://localhost:3000/api/v1/auth/activation/complete', {
            method: 'POST',
            headers: ipHeader,
            body: JSON.stringify({
              token: 'a'.repeat(64),
              email: 'student@axiscolleges.in',
              password: 'StrongPassword1!',
              confirmPassword: 'StrongPassword1!',
            }),
          })
        )
      );

      // 5. POST /api/v1/auth/password-recovery/reset (5/60s)
      await assertRateLimited('password-recovery/reset', 5, () =>
        POST_PWD_RESET(
          new NextRequest('http://localhost:3000/api/v1/auth/password-recovery/reset', {
            method: 'POST',
            headers: ipHeader,
            body: JSON.stringify({
              email: 'student@axiscolleges.in',
              verificationProofToken: 'proof.token.sig',
              password: 'StrongPassword1!',
              confirmPassword: 'StrongPassword1!',
            }),
          })
        )
      );

      // 6. GET /api/v1/users/search (30/60s)
      await assertRateLimited('users/search', 30, () =>
        GET_USERS_SEARCH(new NextRequest('http://localhost:3000/api/v1/users/search?q=aarav'))
      );

      // 7. GET /api/v1/chat/users (30/60s)
      await assertRateLimited('chat/users', 30, () =>
        GET_CHAT_USERS(new NextRequest('http://localhost:3000/api/v1/chat/users?q=aarav'))
      );

      // 8. GET /api/v1/chat/token (20/60s)
      await assertRateLimited('chat/token', 20, () =>
        GET_CHAT_TOKEN(new NextRequest('http://localhost:3000/api/v1/chat/token'))
      );
    });

    it('AUD-M05: strips email and rollNumber PII from /api/v1/users/search and /api/v1/chat/users for student callers', async () => {
      delete process.env.MONGODB_URI;
      UserRepository.searchDirectory = async () => [
        {
          id: TARGET_USER_ID.toString(),
          fullName: 'Priya Verma',
          username: 'priya.verma',
          email: 'priya.verma@axiscolleges.in',
          role: 'student',
          adminSubRole: null,
          avatarUrl: null,
          departmentName: 'Computer Science & Engineering',
          departmentId: '67000000000000000000d001',
          rollNumber: '22BCSE042',
          designation: null,
        },
      ];

      // Student caller: email & rollNumber MUST be absent
      __setTestSession(studentSession);
      for (const routeHandler of [GET_USERS_SEARCH, GET_CHAT_USERS]) {
        const res = await routeHandler(
          new NextRequest('http://localhost:3000/api/v1/users/search?q=priya')
        );
        assert.equal(res.status, 200);
        const json = (await res.json()) as { data: Array<Record<string, unknown>> };
        assert.equal(json.data.length, 1);
        assert.equal(json.data[0]!.fullName, 'Priya Verma');
        assert.equal(json.data[0]!.username, 'priya.verma');
        assert.equal(json.data[0]!.departmentName, 'Computer Science & Engineering');
        assert.equal('email' in json.data[0]!, false, 'Student search MUST NOT expose email PII');
        assert.equal(
          'rollNumber' in json.data[0]!,
          false,
          'Student search MUST NOT expose rollNumber PII'
        );
      }

      // Faculty caller retains institutional email & rollNumber
      __setTestSession(facultySession);
      const facRes = await GET_USERS_SEARCH(
        new NextRequest('http://localhost:3000/api/v1/users/search?q=priya')
      );
      const facJson = (await facRes.json()) as { data: Array<Record<string, unknown>> };
      assert.equal(facJson.data[0]!.email, 'priya.verma@axiscolleges.in');
      assert.equal(facJson.data[0]!.rollNumber, '22BCSE042');
    });
  });

  // =========================================================================
  // 2. AUD-H12: Session Revocation, Uniform Lifecycle Enforcement & API 403
  // =========================================================================
  describe('AUD-H12: Session Revocation, Uniform Status Gates & Middleware API 403', () => {
    it('invokes non-blocking SessionService.revokeAllUserSessions on status suspension/deactivation and role changes', async () => {
      const revokedCalls: Array<{ authProviderId: string; reason?: string }> = [];
      SessionService.revokeAllUserSessions = async (authProviderId, reason) => {
        revokedCalls.push({ authProviderId, reason });
        return { revokedCount: 1, success: true };
      };
      AblyBroker.revokeUserTokens = async (userId) => ({ revoked: true, userId });
      AuditService.recordEvent = async () => ({ id: 'aud1', eventId: 'AUD-2026-100001' }) as never;

      const mockTargetUser = {
        _id: TARGET_USER_ID,
        authProviderId: 'user_clerk_target_99',
        email: 'target@axiscolleges.in',
        fullName: 'Target Member',
        role: 'student',
        adminSubRole: null,
        status: 'active',
        isProfileComplete: true,
        departmentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as IUser;

      UserRepository.findById = async () => mockTargetUser;
      UserRepository.updateStatus = async (_id, status) =>
        ({ ...mockTargetUser, status }) as unknown as IUser;
      UserRepository.updateRole = async (_id, role) =>
        ({ ...mockTargetUser, role }) as unknown as IUser;

      // 1. IamGovernanceService.changeUserStatus -> suspend
      await IamGovernanceService.changeUserStatus(superAdminSession, TARGET_USER_ID.toString(), {
        status: 'suspended',
        reason: 'Policy breach investigation underway.',
      });
      assert.ok(
        revokedCalls.some((c) => c.authProviderId === 'user_clerk_target_99'),
        'changeUserStatus(suspended) must revoke active sessions'
      );

      // 2. IamGovernanceService.changeUserRole -> role change
      revokedCalls.length = 0;
      await IamGovernanceService.changeUserRole(superAdminSession, TARGET_USER_ID.toString(), {
        role: 'faculty',
        reason: 'Appointed to faculty roster.',
      });
      assert.ok(
        revokedCalls.some((c) => c.authProviderId === 'user_clerk_target_99'),
        'changeUserRole must revoke active sessions'
      );

      // 3. Direct UserService.updateUserStatus(deactivated) & updateUserRole
      revokedCalls.length = 0;
      await UserService.updateUserStatus(TARGET_USER_ID.toString(), 'deactivated', superAdminSession);
      await UserService.updateUserRole(TARGET_USER_ID.toString(), 'admin', superAdminSession);
      assert.equal(revokedCalls.length, 2);
    });

    it('validateSessionIntegrity & requireAuth reject graduated, invited, archived, deactivated, pending_verification, and suspended', async () => {
      const blockedStatuses = [
        'suspended',
        'pending_verification',
        'invited',
        'deactivated',
        'archived',
        'graduated',
      ] as const;

      for (const status of blockedStatuses) {
        const session: UserSession = { ...studentSession, status };
        const integrity = validateSessionIntegrity(session);
        assert.equal(integrity.valid, false, `validateSessionIntegrity must reject '${status}'`);

        __setTestSession(session);
        await assert.rejects(
          () => requireAuth(),
          ForbiddenError,
          `requireAuth() must throw ForbiddenError for '${status}'`
        );
      }
    });

    it('middleware lifecycle gate returns JSON 403 for non-active /api/* requests and permits /api/auth/logout', () => {
      for (const status of [
        'suspended',
        'pending_verification',
        'invited',
        'deactivated',
        'archived',
        'graduated',
      ]) {
        const apiDecision = evaluateAccountLifecycleGate(status, '/api/v1/notices');
        assert.equal(
          apiDecision.action,
          'json_403',
          `Non-active '${status}' on /api/* MUST receive JSON 403, never 307 redirect`
        );

        const logoutDecision = evaluateAccountLifecycleGate(status, '/api/auth/logout');
        assert.equal(
          logoutDecision.action,
          'allow',
          `Non-active '${status}' MUST be permitted to call /api/auth/logout`
        );
      }

      const middlewareSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/middleware.ts'),
        'utf8'
      );
      assert.ok(
        middlewareSrc.includes("'/api/auth/logout'"),
        'middleware.ts must explicitly allow /api/auth/logout'
      );
    });
  });

  // =========================================================================
  // 3. AUD-H15: DB Reconnect, Cycle-Safe Logger & Sanitized Error Handler
  // =========================================================================
  describe('AUD-H15: DB Cache Recovery, Cycle-Safe Logger & Error Handler', () => {
    it('mongodb.ts clears stale cached.conn and cached.promise when readyState !== 1', async () => {
      const staleConn = { connection: { readyState: 0, on: () => {} } } as unknown as typeof mongoose;
      const stalePromise = Promise.resolve(staleConn);
      global.mongooseCache = {
        conn: staleConn,
        promise: stalePromise,
        disconnectListenerAttached: false,
      };

      process.env.MONGODB_URI = 'mongodb://localhost:27017/axis-test';
      let connectCalled = false;
      const freshConn = {
        connection: {
          readyState: 1,
          on: () => {},
        },
      } as unknown as typeof mongoose;

      mongoose.connect = (async () => {
        connectCalled = true;
        return freshConn;
      }) as typeof mongoose.connect;

      const result = await connectToDatabase();
      assert.equal(connectCalled, true, 'Must re-invoke mongoose.connect after stale readyState=0');
      assert.equal(result, freshConn);
    });

    it('logger.ts serializes and logs circular objects safely without throwing TypeError', () => {
      const circular: Record<string, unknown> = { name: 'node', secretToken: 'hide-me' };
      circular.self = circular;

      const jsonStr = safeJsonStringify(circular);
      assert.ok(jsonStr.includes('[Circular]'));

      const sanitized = sanitizeLogData(circular) as Record<string, unknown>;
      assert.equal(sanitized.secretToken, '[REDACTED]');
      assert.equal(sanitized.self, '[Circular]');

      // Must not throw when logged directly
      assert.doesNotThrow(() => {
        logger.info('Circular context test', { circular });
      });
    });

    it('api-error-handler.ts maps SyntaxError to HTTP 400 and sanitizes Mongoose E11000 & ValidationError internals', async () => {
      // 1. JSON SyntaxError -> 400
      const syntaxRes = handleApiError(new SyntaxError('Unexpected token } in JSON at position 12'));
      assert.equal(syntaxRes.status, 400);
      const syntaxBody = (await syntaxRes.json()) as { message: string };
      assert.equal(syntaxBody.message, 'Malformed JSON request body.');

      // 2. Mongoose E11000 -> 409 without exposing raw keyPattern field names
      const dupRes = handleApiError({
        code: 11000,
        keyPattern: { 'internalSecretIndex.authProviderId': 1 },
        keyValue: { authProviderId: 'clerk_123' },
      });
      assert.equal(dupRes.status, 409);
      const dupText = await dupRes.text();
      assert.equal(dupText.includes('internalSecretIndex'), false);
      assert.equal(dupText.includes('authProviderId'), false);

      // 3. Mongoose ValidationError -> 400 without exposing raw internal paths
      const valRes = handleApiError({
        name: 'ValidationError',
        errors: {
          'studentProfile.internalFlag': {
            path: 'studentProfile.internalFlag',
            message: 'Path `studentProfile.internalFlag` is required.',
          },
        },
      });
      assert.equal(valRes.status, 400);
      const valText = await valRes.text();
      assert.equal(valText.includes('internalFlag'), false);
    });
  });

  // =========================================================================
  // 4. AUD-M01, AUD-M02 & AUD-M04: Safe URLs, Regex Escaping & Admin PATCH
  // =========================================================================
  describe('AUD-M01 / AUD-M02 / AUD-M04: URL Protocol Guards, Regex Escaping & Admin PATCH', () => {
    it('AUD-M01: rejects javascript: and data: URIs across all 6 schemas while allowing https://', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
      ];
      const safeUrl = 'https://res.cloudinary.com/axis/raw/upload/file.pdf';

      for (const bad of dangerousUrls) {
        assert.equal(
          attachmentInputSchema.safeParse({
            name: 'a.pdf',
            url: bad,
            sizeBytes: 100,
            mimeType: 'application/pdf',
          }).success,
          false
        );
        assert.equal(
          chatAttachmentSchema.safeParse({
            url: bad,
            name: 'a.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 100,
          }).success,
          false
        );
        assert.equal(
          complaintAttachmentSchema.safeParse({ name: 'a.pdf', url: bad }).success,
          false
        );
        assert.equal(
          noticeAttachmentSchema.safeParse({
            name: 'a.pdf',
            url: bad,
            sizeBytes: 100,
            mimeType: 'application/pdf',
          }).success,
          false
        );
        assert.equal(
          requestAttachmentInputSchema.safeParse({
            name: 'a.pdf',
            url: bad,
            fileType: 'application/pdf',
            size: 100,
          }).success,
          false
        );
        assert.equal(updateUserProfileSchema.safeParse({ avatarUrl: bad }).success, false);
        assert.equal(
          createUserSchema.safeParse({
            email: 'student@axiscolleges.in',
            fullName: 'Test Student',
            role: 'student',
            avatarUrl: bad,
          }).success,
          false
        );
      }

      assert.equal(
        complaintAttachmentSchema.safeParse({ name: 'a.pdf', url: safeUrl }).success,
        true
      );
      assert.equal(updateUserProfileSchema.safeParse({ avatarUrl: safeUrl }).success, true);
    });

    it('AUD-M02: escapes regex metacharacters in PollService & ServiceRequestService and allowlists sortBy', async () => {
      const hostileSearch = '.*(a+)+$[';
      const expectedEscaped = '\\.\\*\\(a\\+\\)\\+\\$\\[';

      let pollCapturedFilter: Record<string, unknown> = {};
      PollRepository.findFeed = async (query) => {
        pollCapturedFilter = query;
        return { polls: [], nextCursor: null, hasMore: false };
      };

      await PollService.getPollFeed(superAdminSession, { search: hostileSearch, limit: 10 });
      assert.deepEqual(pollCapturedFilter.question, { $regex: expectedEscaped, $options: 'i' });

      let reqCapturedFilter: Record<string, unknown> = {};
      ServiceRequestRepository.findRequests = async (filter) => {
        reqCapturedFilter = filter;
        return { requests: [], total: 0 };
      };

      await ServiceRequestService.listStudentRequests(studentSession, {
        search: hostileSearch,
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const orClauses = reqCapturedFilter.$or as Array<Record<string, { $regex: string }>>;
      assert.equal(orClauses[0]!.ticketNumber!.$regex, expectedEscaped);

      assert.equal(serviceRequestQuerySchema.safeParse({ sortBy: 'createdAt' }).success, true);
      assert.equal(
        serviceRequestQuerySchema.safeParse({ sortBy: 'studentSnapshot.email' }).success,
        false
      );
    });

    it('AUD-M04: PATCH /api/v1/admin/users/[id] enforces strict Zod schema and blocks archiving self or active super_admin', async () => {
      __setTestSession(superAdminSession);
      delete process.env.MONGODB_URI;

      // 1. Unknown mass-assignment field (role) rejected with 400
      const massAssignRes = await PATCH_ADMIN_USER(
        new NextRequest(`http://localhost:3000/api/v1/admin/users/${TARGET_USER_ID.toString()}`, {
          method: 'PATCH',
          body: JSON.stringify({ role: 'super_admin', fullName: 'Escalated' }),
        }),
        { params: Promise.resolve({ id: TARGET_USER_ID.toString() }) }
      );
      assert.equal(massAssignRes.status, 400);

      // 2. Malformed JSON rejected with 400
      const badJsonRes = await PATCH_ADMIN_USER(
        new NextRequest(`http://localhost:3000/api/v1/admin/users/${TARGET_USER_ID.toString()}`, {
          method: 'PATCH',
          body: '{invalid-json',
        }),
        { params: Promise.resolve({ id: TARGET_USER_ID.toString() }) }
      );
      assert.equal(badJsonRes.status, 400);

      // 3. Archiving an active super_admin is rejected with 403
      UserModel.findById = (() => ({
        exec: async () => ({
          _id: OTHER_SUPER_ADMIN_ID,
          email: 'root2@axiscolleges.in',
          username: 'rootadmin2',
          fullName: 'Root Admin 2',
          role: 'super_admin',
          adminSubRole: 'sys_admin',
          status: 'active',
          save: async () => {},
        }),
      })) as unknown as typeof UserModel.findById;

      for (const nonActiveStatus of ['archived', 'suspended', 'deactivated', 'pending_verification']) {
        const res = await PATCH_ADMIN_USER(
          new NextRequest(
            `http://localhost:3000/api/v1/admin/users/${OTHER_SUPER_ADMIN_ID.toString()}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ status: nonActiveStatus }),
            }
          ),
          { params: Promise.resolve({ id: OTHER_SUPER_ADMIN_ID.toString() }) }
        );
        assert.equal(
          res.status,
          403,
          `Transitioning an active super_admin to '${nonActiveStatus}' MUST return 403`
        );
      }
    });
  });

  // =========================================================================
  // 5. AUD-H18: Production Dependencies Cleanliness
  // =========================================================================
  describe('AUD-H18: Production Dependencies Hygiene', () => {
    it('package.json dependencies no longer includes unused shadcn or cn packages', () => {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
      ) as { dependencies?: Record<string, string> };

      assert.equal(pkg.dependencies?.shadcn, undefined, 'shadcn must be removed from dependencies');
      assert.equal(pkg.dependencies?.cn, undefined, 'cn must be removed from dependencies');
    });
  });
});
