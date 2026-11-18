/**
 * P0 Remediation Batch 1 — Security Regression Suite.
 * Verifies fixes for:
 * - AUD-C04: Fail-closed getCurrentSession() / resolveProvisionedSession() + __setTestSession prod guard
 * - AUD-C05: Removal of hardcoded personal Gmail / admin01 / SA-ADMIN01 bootstrap + Svix 200 ignored response
 * - AUD-C10 (OTP TTL): 15-minute TTL extension on proof issuance, atomic pre-Clerk proof consumption, prod HMAC guard
 * - AUD-C09 (OtpInput): Single-shot autoSendOnMount ref sentinel & timer cleanup
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { Webhook } from 'svix';

import {
  __setTestSession,
  requireAuth,
  resolveProvisionedSession,
} from '@/lib/auth/server';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { OtpRepository } from '@/lib/db/repositories/otp.repository';
import { OtpService } from '@/lib/services/otp.service';
import { PasswordRecoveryService } from '@/lib/services/password-recovery.service';
import { POST as clerkWebhookPost } from '@/app/api/webhooks/clerk/route';
import { OtpInput } from '@/components/auth/otp-input';
import { UnauthorizedError, ValidationError, AppError } from '@/lib/errors/app-error';
import type { IOtpDocument } from '@/types/otp';
import type { IUser } from '@/types/user';

describe('P0 Batch 1 — Auth Fail-Closed, Bootstrap Removal & OTP Remediation', () => {
  const origUserRepo = { ...UserRepository };
  const origOtpRepo = { ...OtpRepository };
  const origGetClerkClient = PasswordRecoveryService.getClerkClient;
  const origEnv = { ...process.env };

  afterEach(() => {
    Object.assign(UserRepository, origUserRepo);
    Object.assign(OtpRepository, origOtpRepo);
    PasswordRecoveryService.getClerkClient = origGetClerkClient;

    // Restore NODE_ENV first before clearing test session override
    if (origEnv.NODE_ENV === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    } else {
      (process.env as Record<string, string | undefined>).NODE_ENV = origEnv.NODE_ENV;
    }

    for (const key of ['CLERK_WEBHOOK_SECRET', 'CLERK_SECRET_KEY', 'OTP_HMAC_SECRET', 'MONGODB_URI']) {
      if (origEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = origEnv[key];
      }
    }

    __setTestSession(undefined);
  });

  describe('1. AUD-C04 — Fail-Closed Session Resolution & Production Test-Hook Guard', () => {
    it('returns null (never synthetic student) when Clerk user has no MongoDB record', async () => {
      UserRepository.findByAuthProviderId = async () => null;

      const resolved = await resolveProvisionedSession('clerk_unprovisioned_999', 'sess_001');
      assert.strictEqual(resolved, null);

      // Verify requireAuth throws UnauthorizedError (401) when session is null
      __setTestSession(null);
      await assert.rejects(
        () => requireAuth(),
        (err: unknown) => err instanceof UnauthorizedError && err.statusCode === 401
      );
    });

    it('returns authoritative MongoDB UserSession for pre-provisioned active users', async () => {
      const userId = new Types.ObjectId();
      const deptId = new Types.ObjectId();

      UserRepository.findByAuthProviderId = async () =>
        ({
          _id: userId,
          authProviderId: 'clerk_provisioned_101',
          email: 'faculty.cse@axiscolleges.in',
          username: 'prof.cse',
          fullName: 'Prof. Ankit Sharma',
          role: 'faculty',
          status: 'active',
          departmentId: deptId,
        }) as unknown as IUser;

      const session = await resolveProvisionedSession('clerk_provisioned_101', 'sess_101');
      assert.ok(session);
      assert.strictEqual(session.userId, userId.toString());
      assert.strictEqual(session.role, 'faculty');
      assert.strictEqual(session.departmentId, deptId.toString());
      assert.strictEqual(session.email, 'faculty.cse@axiscolleges.in');
    });

    it('blocks __setTestSession unconditionally when NODE_ENV === production', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      assert.throws(
        () =>
          __setTestSession({
            userId: 'fake',
            email: 'fake@axiscolleges.in',
            role: 'super_admin',
            status: 'active',
          }),
        /strictly prohibited in production/
      );
    });
  });

  describe('2. AUD-C05 — Hardcoded Super-Admin Bootstrap Removed & Closed-Registration Webhook', () => {
    it('contains zero hardcoded personal emails, admin01, or SA-ADMIN01 bootstrap logic in auth routes', () => {
      const verifyRoleSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/app/auth/verify-role/page.tsx'),
        'utf-8'
      );
      const webhookSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/app/api/webhooks/clerk/route.ts'),
        'utf-8'
      );

      for (const content of [verifyRoleSrc, webhookSrc]) {
        assert.ok(!/prashantumrao/i.test(content), 'Personal email must not exist in auth routes');
        assert.ok(!content.includes('SA-ADMIN01'), 'Hardcoded SA-ADMIN01 must be removed');
        assert.ok(!content.includes("'admin01'"), 'Hardcoded admin01 fallback must be removed');
      }
      assert.ok(verifyRoleSrc.includes("redirect('/unauthorized?error=not_provisioned')"));
    });

    it('ignores unprovisioned user.created webhook (even with super_admin metadata) with HTTP 200 and creates zero DB records', async () => {
      delete process.env.MONGODB_URI;
      const secret = `whsec_${Buffer.from('axis-linkup-test-webhook-secret-32b').toString('base64')}`;
      process.env.CLERK_WEBHOOK_SECRET = secret;

      let createCalled = false;
      UserRepository.findByAuthProviderId = async () => null;
      UserRepository.findByEmail = async () => null;
      UserRepository.findByUsername = async () => null;
      UserRepository.create = async () => {
        createCalled = true;
        throw new Error('UserRepository.create must NEVER be called for unprovisioned webhook users');
      };

      const payload = JSON.stringify({
        type: 'user.created',
        data: {
          id: 'user_unprovisioned_sa_attempt',
          email_addresses: [
            { email_address: 'rogue@example.com', verification: { status: 'verified' } },
          ],
          first_name: 'Rogue',
          last_name: 'User',
          username: 'admin01',
          public_metadata: { role: 'super_admin', status: 'active' },
        },
      });

      const wh = new Webhook(secret);
      const msgId = 'msg_test_unprovisioned_01';
      const ts = new Date();
      const signature = wh.sign(msgId, ts, payload);

      const req = new NextRequest('http://localhost:3000/api/webhooks/clerk', {
        method: 'POST',
        headers: {
          'svix-id': msgId,
          'svix-timestamp': String(Math.floor(ts.getTime() / 1000)),
          'svix-signature': signature,
        },
        body: payload,
      });

      const res = await clerkWebhookPost(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.received, true);
      assert.strictEqual(json.data.ignored, true);
      assert.strictEqual(json.data.reason, 'closed_registration_unprovisioned');
      assert.strictEqual(createCalled, false);
    });

    it('links authProviderId cleanly when Clerk webhook matches an already-provisioned MongoDB user', async () => {
      delete process.env.MONGODB_URI;
      const secret = `whsec_${Buffer.from('axis-linkup-test-webhook-secret-32b').toString('base64')}`;
      process.env.CLERK_WEBHOOK_SECRET = secret;

      let linkedEmail = '';
      let linkedId = '';
      const provisionedUser = {
        _id: new Types.ObjectId(),
        email: 'student.provisioned@axiscolleges.in',
        fullName: 'Provisioned Student',
        role: 'student',
        status: 'pending_verification',
      } as unknown as IUser;

      UserRepository.findByAuthProviderId = async () => null;
      UserRepository.findByEmail = async () => provisionedUser;
      UserRepository.linkAuthProviderId = async (email, clerkId) => {
        linkedEmail = email;
        linkedId = clerkId;
        return provisionedUser;
      };
      UserRepository.syncExternalProfile = async () => provisionedUser;

      const payload = JSON.stringify({
        type: 'user.created',
        data: {
          id: 'user_clerk_linked_555',
          email_addresses: [
            {
              email_address: 'student.provisioned@axiscolleges.in',
              verification: { status: 'verified' },
            },
          ],
          first_name: 'Provisioned',
          last_name: 'Student',
        },
      });

      const wh = new Webhook(secret);
      const msgId = 'msg_test_provisioned_02';
      const ts = new Date();
      const signature = wh.sign(msgId, ts, payload);

      const req = new NextRequest('http://localhost:3000/api/webhooks/clerk', {
        method: 'POST',
        headers: {
          'svix-id': msgId,
          'svix-timestamp': String(Math.floor(ts.getTime() / 1000)),
          'svix-signature': signature,
        },
        body: payload,
      });

      const res = await clerkWebhookPost(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(linkedEmail, 'student.provisioned@axiscolleges.in');
      assert.strictEqual(linkedId, 'user_clerk_linked_555');
    });
  });

  describe('3. AUD-C10 — OTP TTL Proof Extension, Atomic Replay Defense & Prod HMAC Guard', () => {
    it('extends expiresAt by 15 minutes when persisting verification proof token', async () => {
      const email = 'recovery.ttl@axiscolleges.in';
      const otpCode = '482910';
      const hashedOtp = OtpService.hashOtp(otpCode);
      const otpId = new Types.ObjectId();
      const initialExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 mins remaining on 5-min OTP

      let persistedProofExpiresAt: Date | undefined;

      const mockOtp = {
        _id: otpId,
        email,
        hashedOtp,
        purpose: 'password_recovery',
        expiresAt: initialExpiry,
        attempts: 0,
        maxAttempts: 5,
        isConsumed: false,
      } as unknown as IOtpDocument;

      OtpRepository.findActiveOtp = async () => mockOtp;
      OtpRepository.consumeOtp = async () => ({ ...mockOtp, isConsumed: true }) as unknown as IOtpDocument;
      OtpRepository.setVerificationProof = async (_id, _hash, proofExpiresAt) => {
        persistedProofExpiresAt = proofExpiresAt;
        return {
          ...mockOtp,
          proofTokenHash: _hash,
          expiresAt: proofExpiresAt || initialExpiry,
        } as unknown as IOtpDocument;
      };

      const beforeCall = Date.now();
      const res = await OtpService.verifyOtp({
        email,
        otp: otpCode,
        purpose: 'password_recovery',
      });

      assert.strictEqual(res.verified, true);
      assert.ok(persistedProofExpiresAt instanceof Date, 'proofExpiresAt must be passed to setVerificationProof');
      const diffMs = persistedProofExpiresAt.getTime() - beforeCall;
      assert.ok(
        diffMs >= 14 * 60 * 1000 && diffMs <= 16 * 60 * 1000,
        `Expected ~15-minute TTL extension, got ${Math.round(diffMs / 1000)}s`
      );
    });

    it('prevents concurrent password-reset replay by consuming proof BEFORE invoking Clerk updateUser', async () => {
      const email = 'concurrent.reset@axiscolleges.in';
      const { rawToken, tokenHash, expiresAt } = OtpService.generateProofToken(
        email,
        'password_recovery'
      );

      let isConsumed = false;
      let clerkUpdateCalls = 0;

      const mockOtpDoc = {
        _id: new Types.ObjectId(),
        email,
        purpose: 'password_recovery',
        proofTokenHash: tokenHash,
        isProofConsumed: false,
        expiresAt,
      } as unknown as IOtpDocument;

      const mockUser = {
        _id: new Types.ObjectId(),
        email,
        role: 'student',
        status: 'active',
        authProviderId: 'clerk_concurrent_user',
      } as unknown as IUser;

      OtpRepository.findByProofTokenHash = async () =>
        ({ ...mockOtpDoc, isProofConsumed: isConsumed }) as unknown as IOtpDocument;
      OtpRepository.consumeVerificationProof = async () => {
        // Atomic compare-and-set simulation
        if (isConsumed) return null;
        isConsumed = true;
        return { ...mockOtpDoc, isProofConsumed: true } as unknown as IOtpDocument;
      };
      UserRepository.findByEmail = async () => mockUser;
      PasswordRecoveryService.getClerkClient = async () =>
        ({
          users: {
            updateUser: async () => {
              clerkUpdateCalls += 1;
              await new Promise((r) => setTimeout(r, 20));
              return {};
            },
          },
          sessions: {
            getSessionList: async () => ({ data: [] }),
            revokeSession: async () => ({}),
          },
        }) as unknown as ReturnType<typeof PasswordRecoveryService.getClerkClient>;

      const payload = {
        email,
        verificationProofToken: rawToken,
        password: 'NewStrongPassword#2026',
        confirmPassword: 'NewStrongPassword#2026',
      };

      const [first, second] = await Promise.allSettled([
        PasswordRecoveryService.resetPassword(payload),
        PasswordRecoveryService.resetPassword(payload),
      ]);

      const fulfilled = [first, second].filter((r) => r.status === 'fulfilled');
      const rejected = [first, second].filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent reset must succeed');
      assert.strictEqual(rejected.length, 1, 'Second concurrent reset must be rejected');
      assert.ok(
        rejected[0]?.status === 'rejected' && rejected[0].reason instanceof ValidationError
      );
      assert.strictEqual(clerkUpdateCalls, 1, 'Clerk updateUser must be called exactly once');
    });

    it('refuses hardcoded HMAC secret fallback in production when env secrets are absent', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.OTP_HMAC_SECRET;
      delete process.env.CLERK_SECRET_KEY;

      assert.throws(
        () => OtpService.generateProofToken('prod.user@axiscolleges.in', 'password_recovery'),
        (err: unknown) => err instanceof AppError && err.statusCode === 500
      );
    });
  });

  describe('4. AUD-C09 — OtpInput Single-Shot autoSendOnMount & Timer Cleanup', () => {
    it('enforces single-shot autoSendOnMount ref sentinel without cooldown/isSending loop dependencies', () => {
      const otpInputSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/components/auth/otp-input.tsx'),
        'utf-8'
      );

      assert.ok(otpInputSrc.includes('hasAutoSentRef'));
      assert.ok(otpInputSrc.includes('focusTimeoutRef'));
      assert.ok(otpInputSrc.includes('verifyTimeoutRef'));
      assert.ok(otpInputSrc.includes('clearTimeout(focusTimeoutRef.current)'));
      assert.ok(otpInputSrc.includes('clearTimeout(verifyTimeoutRef.current)'));
      assert.ok(
        !otpInputSrc.includes('[email, purpose, isSending, cooldown]'),
        'isSending and cooldown must not be in handleRequestOtp dependency array'
      );

      const html = renderToStaticMarkup(
        React.createElement(OtpInput, {
          email: 'student@axiscolleges.in',
          purpose: 'account_activation',
          onVerified: () => {},
          autoSendOnMount: true,
        })
      );
      assert.ok(html.includes('Verify Email Code'));
      assert.ok(html.includes('student@axiscolleges.in'));
    });
  });
});
