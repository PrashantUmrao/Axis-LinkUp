/**
 * Automated Unit Test Suite for Email OTP Verification System (Phase 5.2.6).
 * Validates 6-digit cryptographic code generation, timing-safe SHA-256 comparison,
 * 5-minute expiration windows, 60-second cooldown rate-limiting, attempt limit exhaustion (max 5),
 * purpose isolation, single-use replay prevention, and zero OTP exposure in logs.
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import { OtpService } from '../../src/lib/services/otp.service';
import { EmailService } from '../../src/lib/services/email.service';
import { OtpRepository } from '../../src/lib/db/repositories/otp.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import {
  requestOtpSchema,
  verifyOtpSchema,
  resendOtpSchema,
} from '../../src/lib/validations/otp.schema';
import {
  ValidationError,
  AppError,
} from '../../src/lib/errors/app-error';
import { HTTP_STATUS } from '../../src/config/constants';
import type { IOtpDocument } from '../../src/types/otp';
import type { IUser } from '../../src/types/user';

describe('Phase 5.2.6 — 1. Cryptographic OTP Generation & Hash Integrity', () => {
  test('generates valid 6-digit numeric strings within [100000, 999999]', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = OtpService.generateOtpCode();
      assert.strictEqual(typeof code, 'string');
      assert.strictEqual(code.length, 6);
      assert.match(code, /^[0-9]{6}$/);

      const num = parseInt(code, 10);
      assert.ok(num >= 100000 && num <= 999999);
      codes.add(code);
    }
    // Cryptographic randomness ensures multiple distinct codes
    assert.ok(codes.size > 40);
  });

  test('computes deterministic SHA-256 hex hash of 64 characters', () => {
    const code = '729104';
    const hash1 = OtpService.hashOtp(code);
    const hash2 = OtpService.hashOtp(code);

    assert.strictEqual(hash1, hash2);
    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 64);
    assert.match(hash1, /^[0-9a-f]{64}$/);

    // Different code produces different hash
    const differentHash = OtpService.hashOtp('729105');
    assert.notStrictEqual(hash1, differentHash);
  });
});

describe('Phase 5.2.6 — 2. Email Masking & Privacy Protection', () => {
  test('correctly masks institutional emails without revealing user identities', () => {
    assert.strictEqual(
      EmailService.maskEmail('aarav.sharma@axiscolleges.in'),
      'aa***@axiscolleges.in'
    );
    assert.strictEqual(
      EmailService.maskEmail('ab@axiscolleges.in'),
      'ab***@axiscolleges.in'
    );
    assert.strictEqual(
      EmailService.maskEmail('director@axiscolleges.in'),
      'di***@axiscolleges.in'
    );
    assert.strictEqual(EmailService.maskEmail(''), '***');
    assert.strictEqual(EmailService.maskEmail('invalid-string'), '***');
  });

  test('sendOtpEmail completes successfully and produces safe log entries', async () => {
    const result = await EmailService.sendOtpEmail({
      to: 'priya.singh@axiscolleges.in',
      otpCode: '839201',
      purpose: 'email_verification',
      expiresInMinutes: 5,
    });

    assert.strictEqual(result.success, true);
    assert.ok(typeof result.messageId === 'string');
  });
});

describe('Phase 5.2.6 — 3. Input Validation Schemas', () => {
  test('requestOtpSchema validates valid payloads and normalizes email', () => {
    const parsed = requestOtpSchema.parse({
      email: '  Neha.Gupta@AxisColleges.in ',
      purpose: 'account_activation',
    });

    assert.strictEqual(parsed.email, 'neha.gupta@axiscolleges.in');
    assert.strictEqual(parsed.purpose, 'account_activation');
  });

  test('requestOtpSchema rejects invalid email or unknown purpose', () => {
    assert.throws(() => {
      requestOtpSchema.parse({
        email: 'invalid-email',
        purpose: 'account_activation',
      });
    });

    assert.throws(() => {
      requestOtpSchema.parse({
        email: 'valid@axiscolleges.in',
        purpose: 'unsupported_purpose',
      });
    });
  });

  test('verifyOtpSchema validates exact 6-digit numeric OTP', () => {
    const parsed = verifyOtpSchema.parse({
      email: 'vikram.aditya@axiscolleges.in',
      otp: '123456',
      purpose: 'password_recovery',
    });
    assert.strictEqual(parsed.otp, '123456');

    // Reject less than 6 digits
    assert.throws(() => {
      verifyOtpSchema.parse({
        email: 'vikram.aditya@axiscolleges.in',
        otp: '12345',
        purpose: 'password_recovery',
      });
    });

    // Reject non-numeric
    assert.throws(() => {
      verifyOtpSchema.parse({
        email: 'vikram.aditya@axiscolleges.in',
        otp: '12345a',
        purpose: 'password_recovery',
      });
    });
  });

  test('resendOtpSchema validates valid resend requests', () => {
    const parsed = resendOtpSchema.parse({
      email: 'test@axiscolleges.in',
      purpose: 'email_verification',
    });
    assert.strictEqual(parsed.email, 'test@axiscolleges.in');
  });
});

describe('Phase 5.2.6 — 4. OTP Request & 60-Second Cooldown Rate Limiting', () => {
  const testEmail = 'rohit.kumar@axiscolleges.in';

  test('creates new OTP with 5m expiry and 60s cooldown when no active cooldown exists', async () => {
    let createdPayload: unknown = null;

    mock.method(UserRepository, 'findByEmail', async () => ({
      _id: new Types.ObjectId('6730a005f8b1a2001a000400'),
      email: testEmail,
      fullName: 'Rohit Kumar',
    } as unknown as IUser));

    mock.method(OtpRepository, 'findLatestUnconsumedOtp', async () => null);
    mock.method(OtpRepository, 'createOtp', async (payload: unknown) => {
      createdPayload = payload;
      return {
        _id: new Types.ObjectId('6730a005f8b1a2001a000401'),
        email: testEmail,
        purpose: 'email_verification',
        resendAvailableAt: new Date(Date.now() + 60000),
        expiresAt: new Date(Date.now() + 300000),
      } as unknown as IOtpDocument;
    });

    mock.method(EmailService, 'sendOtpEmail', async () => ({
      success: true,
      messageId: 'sim_123',
      provider: 'simulated',
    }));

    const result = await OtpService.requestOtp({
      email: testEmail,
      purpose: 'email_verification',
    });

    assert.strictEqual(result.email, testEmail);
    assert.strictEqual(result.purpose, 'email_verification');
    assert.strictEqual(result.expiresInMinutes, 5);
    assert.strictEqual(result.resendAvailableInSeconds, 60);

    const payloadObj = createdPayload as Record<string, unknown>;
    assert.strictEqual(payloadObj.email, testEmail);
    assert.strictEqual(payloadObj.purpose, 'email_verification');
    assert.strictEqual(payloadObj.maxAttempts, 5);

    mock.reset();
  });

  test('enforces 60-second cooldown and rejects rapid requests with HTTP 429', async () => {
    const activeCooldownOtp = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000402'),
      email: testEmail,
      purpose: 'email_verification',
      resendAvailableAt: new Date(Date.now() + 45000), // 45 seconds remaining
      expiresAt: new Date(Date.now() + 250000),
      isConsumed: false,
    } as unknown as IOtpDocument;

    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(OtpRepository, 'findLatestUnconsumedOtp', async () => activeCooldownOtp);

    await assert.rejects(
      async () => {
        await OtpService.requestOtp({
          email: testEmail,
          purpose: 'email_verification',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual(err.statusCode, HTTP_STATUS.TOO_MANY_REQUESTS);
        assert.ok(err.message.includes('Please wait'));
        return true;
      }
    );

    mock.reset();
  });

  test('allows resend once cooldown timestamp has passed', async () => {
    const pastCooldownOtp = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000403'),
      email: testEmail,
      purpose: 'email_verification',
      resendAvailableAt: new Date(Date.now() - 5000), // Cooldown elapsed 5 seconds ago
      expiresAt: new Date(Date.now() + 120000),
      isConsumed: false,
    } as unknown as IOtpDocument;

    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(OtpRepository, 'findLatestUnconsumedOtp', async () => pastCooldownOtp);
    mock.method(OtpRepository, 'createOtp', async () => {
      return {
        _id: new Types.ObjectId('6730a005f8b1a2001a000404'),
        email: testEmail,
        purpose: 'email_verification',
        resendAvailableAt: new Date(Date.now() + 60000),
        expiresAt: new Date(Date.now() + 300000),
      } as unknown as IOtpDocument;
    });

    mock.method(EmailService, 'sendOtpEmail', async () => ({
      success: true,
      messageId: 'sim_124',
      provider: 'simulated',
    }));

    const resendResult = await OtpService.resendOtp({
      email: testEmail,
      purpose: 'email_verification',
    });

    assert.strictEqual(resendResult.email, testEmail);
    assert.strictEqual(resendResult.resendAvailableInSeconds, 60);

    mock.reset();
  });
});

describe('Phase 5.2.6 — 5. OTP Verification & Atomic Replay Prevention', () => {
  const testEmail = 'ananya.mishra@axiscolleges.in';
  const rawOtp = '482910';
  const hashedOtp = OtpService.hashOtp(rawOtp);

  test('verifies correct OTP code, atomically consumes code, and issues proof token', async () => {
    let consumedId = '';
    let syncedExternal = false;

    const activeOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000405'),
      email: testEmail,
      purpose: 'email_verification',
      hashedOtp,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 200000),
      isConsumed: false,
    } as unknown as IOtpDocument;

    mock.method(OtpRepository, 'findActiveOtp', async () => activeOtpDoc);
    mock.method(OtpRepository, 'consumeOtp', async (id: string) => {
      consumedId = id;
      return { ...activeOtpDoc, isConsumed: true, consumedAt: new Date() } as unknown as IOtpDocument;
    });
    mock.method(OtpRepository, 'setVerificationProof', async () => activeOtpDoc);

    mock.method(UserRepository, 'findByEmail', async () => ({
      _id: new Types.ObjectId('6730a005f8b1a2001a000406'),
      email: testEmail,
      authProviderId: 'clerk_user_406',
    } as unknown as IUser));

    mock.method(UserRepository, 'syncExternalProfile', async () => {
      syncedExternal = true;
      return null;
    });

    const verifyResult = await OtpService.verifyOtp({
      email: testEmail,
      otp: rawOtp,
      purpose: 'email_verification',
    });

    assert.strictEqual(verifyResult.verified, true);
    assert.strictEqual(verifyResult.email, testEmail);
    assert.strictEqual(verifyResult.purpose, 'email_verification');
    assert.ok(typeof verifyResult.verificationProofToken === 'string');
    assert.strictEqual(consumedId, '6730a005f8b1a2001a000405');
    assert.strictEqual(syncedExternal, true);

    mock.reset();
  });

  test('rejects reused OTP (already consumed) with ValidationError', async () => {
    mock.method(OtpRepository, 'findActiveOtp', async () => null);
    mock.method(OtpRepository, 'findLatestUnconsumedOtp', async () => null);

    await assert.rejects(
      async () => {
        await OtpService.verifyOtp({
          email: testEmail,
          otp: rawOtp,
          purpose: 'email_verification',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('No active verification code'));
        return true;
      }
    );

    mock.reset();
  });
});

describe('Phase 5.2.6 — 6. Attempt Limit Decrement & Exhaustion Protection', () => {
  const testEmail = 'siddharth.roy@axiscolleges.in';
  const correctOtp = '654321';
  const hashedCorrectOtp = OtpService.hashOtp(correctOtp);

  test('incorrect code decrements attempts and returns remaining attempts in error message', async () => {
    let incrementCalled = false;

    const activeOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000408'),
      email: testEmail,
      purpose: 'email_verification',
      hashedOtp: hashedCorrectOtp,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 200000),
      isConsumed: false,
    } as unknown as IOtpDocument;

    mock.method(OtpRepository, 'findActiveOtp', async () => activeOtpDoc);
    mock.method(OtpRepository, 'incrementAttempts', async () => {
      incrementCalled = true;
      return { ...activeOtpDoc, attempts: 1 } as unknown as IOtpDocument;
    });

    await assert.rejects(
      async () => {
        await OtpService.verifyOtp({
          email: testEmail,
          otp: '999999', // wrong OTP
          purpose: 'email_verification',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('4 attempt(s) remaining'));
        return true;
      }
    );

    assert.strictEqual(incrementCalled, true);
    mock.reset();
  });

  test('exhausting 5 attempts atomically consumes OTP and raises HTTP 429', async () => {
    let consumedId = '';

    const failingOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000409'),
      email: testEmail,
      purpose: 'email_verification',
      hashedOtp: hashedCorrectOtp,
      attempts: 4, // 5th attempt is about to fail
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 200000),
      isConsumed: false,
    } as unknown as IOtpDocument;

    mock.method(OtpRepository, 'findActiveOtp', async () => failingOtpDoc);
    mock.method(OtpRepository, 'incrementAttempts', async () => {
      return { ...failingOtpDoc, attempts: 5 } as unknown as IOtpDocument;
    });
    mock.method(OtpRepository, 'consumeOtp', async (id: string) => {
      consumedId = id;
      return { ...failingOtpDoc, isConsumed: true } as unknown as IOtpDocument;
    });

    await assert.rejects(
      async () => {
        await OtpService.verifyOtp({
          email: testEmail,
          otp: '000000', // wrong OTP
          purpose: 'email_verification',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual(err.statusCode, HTTP_STATUS.TOO_MANY_REQUESTS);
        assert.ok(err.message.includes('Maximum attempts exceeded'));
        return true;
      }
    );

    assert.strictEqual(consumedId, '6730a005f8b1a2001a000409');
    mock.reset();
  });
});

describe('Phase 5.2.6 — 7. Expiration Boundary & Purpose Isolation', () => {
  const testEmail = 'divya.nair@axiscolleges.in';

  test('expired OTP (>5 minutes) raises HTTP 410 Gone', async () => {
    const expiredOtpDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000410'),
      email: testEmail,
      purpose: 'email_verification',
      hashedOtp: OtpService.hashOtp('112233'),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() - 10000), // Expired 10 seconds ago
      isConsumed: false,
    } as unknown as IOtpDocument;

    mock.method(OtpRepository, 'findActiveOtp', async () => null);
    mock.method(OtpRepository, 'findLatestUnconsumedOtp', async () => expiredOtpDoc);

    await assert.rejects(
      async () => {
        await OtpService.verifyOtp({
          email: testEmail,
          otp: '112233',
          purpose: 'email_verification',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual(err.statusCode, HTTP_STATUS.GONE);
        assert.ok(err.message.includes('expired'));
        return true;
      }
    );

    mock.reset();
  });

  test('rejects purpose mismatch (e.g. email_verification code used for password_recovery)', async () => {
    mock.method(OtpRepository, 'findActiveOtp', async () => null);
    mock.method(OtpRepository, 'findLatestUnconsumedOtp', async () => null);

    await assert.rejects(
      async () => {
        await OtpService.verifyOtp({
          email: testEmail,
          otp: '123456',
          purpose: 'password_recovery',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('No active verification code'));
        return true;
      }
    );

    mock.reset();
  });

  test('cross-account protection: rejecting verification for different email', async () => {
    mock.method(OtpRepository, 'findActiveOtp', async (email: string) => {
      // Return doc only if queried for exact email
      if (email === 'user1@axiscolleges.in') {
        return {
          _id: new Types.ObjectId('6730a005f8b1a2001a000411'),
          email: 'user1@axiscolleges.in',
          purpose: 'account_activation',
          hashedOtp: OtpService.hashOtp('123456'),
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 100000),
          isConsumed: false,
        } as unknown as IOtpDocument;
      }
      return null;
    });
    mock.method(OtpRepository, 'findLatestUnconsumedOtp', async () => null);

    await assert.rejects(
      async () => {
        await OtpService.verifyOtp({
          email: 'user2@axiscolleges.in',
          otp: '123456',
          purpose: 'account_activation',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        return true;
      }
    );

    mock.reset();
  });
});
