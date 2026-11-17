/**
 * Phase 6.1 — Security Hardening, Headers, Rate Limiting, Health Probe & Navigation Cleanup Tests.
 * Verifies DOC-REQ-001 NFR-SEC-01 through NFR-SEC-06 compliance.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import nextConfig, { SECURITY_HEADERS } from '../../next.config';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
  getClientIp,
  resetRateLimiter,
} from '@/lib/security/rate-limiter';
import { isUiPreviewAllowed } from '@/lib/security/dev-route-guard';
import { GET as getHealthRoute } from '@/app/api/health/route';
import { GET as getPublicPassportRoute } from '@/app/api/v1/passport/public/[shareToken]/route';
import { POST as broadcastRoute } from '@/app/api/v1/notifications/broadcast/route';
import { PassportService } from '@/lib/services/passport.service';
import { NotificationService } from '@/lib/services/notification.service';
import { __setTestSession } from '@/lib/auth/server';
import { MASTER_NAVIGATION_ITEMS, getNavigationForRole } from '@/config/navigation';
import type { UserRole, UserSession } from '@/types/user';

describe('Phase 6.1 — Security Hardening & Production Readiness', () => {
  const origEnv = { ...process.env };
  const origGetPublicPassport = PassportService.getPublicPassportByToken;
  const origBroadcastAlert = NotificationService.broadcastAlert;

  beforeEach(() => {
    resetRateLimiter();
    __setTestSession(undefined);
  });

  afterEach(() => {
    resetRateLimiter();
    __setTestSession(undefined);
    PassportService.getPublicPassportByToken = origGetPublicPassport;
    NotificationService.broadcastAlert = origBroadcastAlert;
    // Restore modified env vars
    for (const key of [
      'MONGODB_URI',
      'CLERK_SECRET_KEY',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'ABLY_API_KEY',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'RESEND_API_KEY',
      'SMTP_HOST',
    ]) {
      if (origEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = origEnv[key];
      }
    }
  });

  describe('1. Next.js Security Headers & Image Hardening (next.config.ts)', () => {
    it('configures all 6 enterprise HTTP security headers across all routes', async () => {
      assert.equal(nextConfig.poweredByHeader, false);
      assert.equal(nextConfig.reactStrictMode, true);
      assert.ok(typeof nextConfig.headers === 'function');

      const headerGroups = await nextConfig.headers!();
      const globalGroup = headerGroups.find((g) => g.source === '/(.*)');
      assert.ok(globalGroup, 'Global /(.*) header rule must exist');

      const headerMap = new Map(globalGroup.headers.map((h) => [h.key, h.value]));
      assert.equal(headerMap.get('X-Content-Type-Options'), 'nosniff');
      assert.equal(headerMap.get('X-Frame-Options'), 'DENY');
      assert.equal(headerMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
      assert.equal(
        headerMap.get('Permissions-Policy'),
        'camera=(), microphone=(), geolocation=()'
      );
      assert.equal(
        headerMap.get('Strict-Transport-Security'),
        'max-age=63072000; includeSubDomains; preload'
      );
      assert.equal(headerMap.get('X-DNS-Prefetch-Control'), 'on');
      assert.equal(SECURITY_HEADERS.length, 6);
    });

    it('whitelists official Cloudinary and Clerk remote image origins', () => {
      const patterns = nextConfig.images?.remotePatterns ?? [];
      const hostnames = patterns.map((p) => ('hostname' in p ? p.hostname : ''));
      assert.ok(hostnames.includes('res.cloudinary.com'));
      assert.ok(hostnames.includes('img.clerk.com'));
      assert.ok(hostnames.includes('images.clerk.dev'));
    });
  });

  describe('2. Sliding-Window Rate Limiter Utility (NFR-SEC-06)', () => {
    it('permits requests up to maxRequests, blocks overflow with 429 headers, isolates keys, and recovers after window', async () => {
      const t0 = 1_700_000_000_000;

      // Allow 3 requests
      const r1 = checkRateLimit('test:key-a', { maxRequests: 3, windowMs: 60_000 }, t0);
      const r2 = checkRateLimit('test:key-a', { maxRequests: 3, windowMs: 60_000 }, t0 + 100);
      const r3 = checkRateLimit('test:key-a', { maxRequests: 3, windowMs: 60_000 }, t0 + 200);
      assert.equal(r1.allowed, true);
      assert.equal(r1.remaining, 2);
      assert.equal(r2.allowed, true);
      assert.equal(r3.allowed, true);
      assert.equal(r3.remaining, 0);

      // 4th request blocked
      const r4 = checkRateLimit('test:key-a', { maxRequests: 3, windowMs: 60_000 }, t0 + 300);
      assert.equal(r4.allowed, false);
      assert.equal(r4.remaining, 0);
      assert.ok(r4.retryAfterSeconds > 0);

      // Standardized 429 response
      const res = createRateLimitErrorResponse(r4);
      assert.equal(res.status, 429);
      assert.equal(res.headers.get('X-RateLimit-Limit'), '3');
      assert.equal(res.headers.get('X-RateLimit-Remaining'), '0');
      assert.ok(Number(res.headers.get('Retry-After')) > 0);
      assert.ok(Number(res.headers.get('X-RateLimit-Reset')) > 0);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'RATE_LIMIT_EXCEEDED');

      // Separate key remains unaffected
      const otherKey = checkRateLimit('test:key-b', { maxRequests: 3, windowMs: 60_000 }, t0 + 300);
      assert.equal(otherKey.allowed, true);

      // Recovers once window passes
      const afterWindow = checkRateLimit(
        'test:key-a',
        { maxRequests: 3, windowMs: 60_000 },
        t0 + 60_001
      );
      assert.equal(afterWindow.allowed, true);
    });

    it('extracts client IP safely from x-forwarded-for or x-real-ip', () => {
      const req1 = new Request('http://localhost:3000/api/health', {
        headers: { 'x-forwarded-for': '203.0.113.45, 10.0.0.1' },
      });
      assert.equal(getClientIp(req1), '203.0.113.45');

      const req2 = new Request('http://localhost:3000/api/health', {
        headers: { 'x-real-ip': '198.51.100.22' },
      });
      assert.equal(getClientIp(req2), '198.51.100.22');

      const req3 = new Request('http://localhost:3000/api/health');
      assert.equal(getClientIp(req3), 'unknown');
    });
  });

  describe('3. Rate-Limited Route Handler Enforcement', () => {
    it('returns HTTP 429 after exceeding 10 requests/min on POST /api/v1/notifications/broadcast', async () => {
      const superAdmin: UserSession = {
        userId: new Types.ObjectId().toString(),
        authProviderId: 'clerk_rate_sa',
        email: 'sa@axiscolleges.in',
        fullName: 'Super Admin',
        role: 'super_admin',
        status: 'active',
      };
      __setTestSession(superAdmin);

      NotificationService.broadcastAlert = async () => ({
        recipientCount: 1,
        dispatchedCount: 1,
        skippedCount: 0,
        targetScope: 'all_users',
      });

      for (let i = 0; i < 10; i++) {
        const res = await broadcastRoute(
          new NextRequest('http://localhost:3000/api/v1/notifications/broadcast', {
            method: 'POST',
            body: JSON.stringify({
              title: `Alert ${i}`,
              message: 'Valid broadcast message body.',
              targetScope: 'all_users',
            }),
          })
        );
        assert.equal(res.status, 201, `Request ${i + 1} should succeed`);
      }

      // 11th request within the same minute must return 429 Too Many Requests
      const throttled = await broadcastRoute(
        new NextRequest('http://localhost:3000/api/v1/notifications/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Overflow Alert',
            message: 'Should be throttled by rate limiter.',
            targetScope: 'all_users',
          }),
        })
      );
      assert.equal(throttled.status, 429);
      assert.ok(throttled.headers.get('Retry-After'));
    });

    it('returns HTTP 429 after exceeding 60 requests/min on GET /api/v1/passport/public/[shareToken]', async () => {
      PassportService.getPublicPassportByToken = async () => ({
        shareToken: 'valid-token',
        headline: 'CS Student',
        viewCount: 1,
        student: {
          fullName: 'Aarav',
          department: 'CSE',
          branch: 'B.Tech',
          semester: 6,
        },
        totalVerifiedPoints: 25,
        verifiedCount: 1,
        skills: ['TypeScript'],
        achievements: [],
        generatedAt: new Date().toISOString(),
      });

      for (let i = 0; i < 60; i++) {
        const res = await getPublicPassportRoute(
          new NextRequest('http://localhost:3000/api/v1/passport/public/valid-token', {
            headers: { 'x-forwarded-for': '203.0.113.99' },
          }),
          { params: Promise.resolve({ shareToken: 'valid-token' }) }
        );
        assert.equal(res.status, 200);
      }

      const throttled = await getPublicPassportRoute(
        new NextRequest('http://localhost:3000/api/v1/passport/public/valid-token', {
          headers: { 'x-forwarded-for': '203.0.113.99' },
        }),
        { params: Promise.resolve({ shareToken: 'valid-token' }) }
      );
      assert.equal(throttled.status, 429);
      assert.equal(throttled.headers.get('X-RateLimit-Limit'), '60');
    });
  });

  describe('4. Master Readiness Health Endpoint (GET /api/health)', () => {
    it('returns 200 with Cache-Control: no-store, structured service statuses, and zero leaked secrets', async () => {
      delete process.env.MONGODB_URI;
      process.env.CLERK_SECRET_KEY = 'sk_test_super_secret_clerk_value';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_publishable_value';
      process.env.ABLY_API_KEY = 'keyId:super_secret_ably_value';
      process.env.CLOUDINARY_API_KEY = 'cloud_key_123';
      process.env.CLOUDINARY_API_SECRET = 'cloud_secret_never_leak';
      process.env.RESEND_API_KEY = 're_secret_never_leak';

      const res = await getHealthRoute();
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('Cache-Control'), 'no-store, max-age=0');

      const rawText = await res.text();
      const json = JSON.parse(rawText);

      assert.equal(json.status, 'degraded'); // DB unconfigured in unit env
      assert.equal(typeof json.timestamp, 'string');
      assert.equal(typeof json.uptimeSeconds, 'number');
      assert.equal(json.services.database, 'unconfigured');
      assert.equal(json.services.auth.provider, 'clerk');
      assert.equal(json.services.auth.configured, true);
      assert.equal(json.services.realtime.provider, 'ably');
      assert.equal(json.services.realtime.configured, true);
      assert.equal(json.services.storage.provider, 'cloudinary');
      assert.equal(json.services.storage.configured, true);
      assert.equal(json.services.email.configured, true);

      // Zero secret leakage
      assert.ok(!rawText.includes('sk_test_super_secret_clerk_value'));
      assert.ok(!rawText.includes('super_secret_ably_value'));
      assert.ok(!rawText.includes('cloud_secret_never_leak'));
      assert.ok(!rawText.includes('re_secret_never_leak'));
    });
  });

  describe('5. Navigation Cleanup & /ui-preview Production Gate', () => {
    it('confirms zero disabled items and zero /calendar links across all 4 roles', () => {
      const roles: UserRole[] = ['student', 'faculty', 'admin', 'super_admin'];
      for (const role of roles) {
        const nav = getNavigationForRole(role);
        const allItems = [...nav.primary, ...nav.modules, ...nav.account];
        for (const item of allItems) {
          assert.notEqual(item.disabled, true, `Disabled item found for ${role}: ${item.id}`);
          assert.notEqual(item.badge, 'Phase 5', `Stale Phase 5 badge found: ${item.id}`);
          assert.ok(
            !item.href.includes('/calendar'),
            `Excluded calendar route found in navigation: ${item.href}`
          );
        }
      }
      assert.equal(
        MASTER_NAVIGATION_ITEMS.some((i) => i.id === 'student-calendar'),
        false
      );
    });

    it('blocks /ui-preview in production and allows it in development and test', () => {
      assert.equal(isUiPreviewAllowed('production'), false);
      assert.equal(isUiPreviewAllowed('development'), true);
      assert.equal(isUiPreviewAllowed('test'), true);
    });
  });
});
