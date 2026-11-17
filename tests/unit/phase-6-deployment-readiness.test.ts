/**
 * Phase 6.2 — Production Deployment Readiness, Env Validator & CI/CD Verification Suite.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CORE_REQUIRED_ENV_VARS,
  OPERATIONAL_REQUIRED_ENV_VARS,
  validateProductionEnv,
} from '@/lib/security/env-validator';

const VALID_PROD_ENV: Record<string, string> = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_APP_URL: 'https://linkup.axiscolleges.in',
  MONGODB_URI: 'mongodb+srv://prod_user:super_secret_db_pwd@cluster0.mongodb.net/axis_linkup',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_valid_prod_key_value',
  CLERK_SECRET_KEY: 'sk_live_super_secret_clerk_value',
  CLERK_WEBHOOK_SECRET: 'whsec_super_secret_webhook_value',
  ABLY_API_KEY: 'ablyKeyId:super_secret_ably_value',
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'axis-colleges-prod',
  CLOUDINARY_API_KEY: '123456789012345',
  CLOUDINARY_API_SECRET: 'super_secret_cloudinary_value',
  RESEND_API_KEY: 're_super_secret_resend_value',
  EMAIL_FROM_ADDRESS: 'Axis LinkUp <notifications@axiscolleges.in>',
};

describe('Phase 6.2 — Production Deployment Readiness & CI/CD', () => {
  describe('1. Production Environment Pre-Flight Validator', () => {
    it('passes strict validation when all core and operational production variables are valid', () => {
      const result = validateProductionEnv(VALID_PROD_ENV, { strict: true });
      assert.equal(result.ok, true);
      assert.equal(result.errors.length, 0);
      assert.equal(result.warnings.length, 0);

      for (const key of [...CORE_REQUIRED_ENV_VARS, ...OPERATIONAL_REQUIRED_ENV_VARS]) {
        assert.equal(result.summary[key], 'configured', `${key} should be configured`);
      }
    });

    it('fails when required core environment variables are missing', () => {
      const incomplete = { ...VALID_PROD_ENV };
      delete incomplete.MONGODB_URI;
      delete incomplete.CLERK_SECRET_KEY;

      const result = validateProductionEnv(incomplete, { strict: false });
      assert.equal(result.ok, false);
      assert.equal(result.summary.MONGODB_URI, 'missing');
      assert.equal(result.summary.CLERK_SECRET_KEY, 'missing');
      assert.ok(result.errors.some((e) => e.includes('MONGODB_URI')));
      assert.ok(result.errors.some((e) => e.includes('CLERK_SECRET_KEY')));
    });

    it('flags Clerk test keys and localhost/HTTP APP_URL in strict production mode', () => {
      const misconfigured: Record<string, string> = {
        ...VALID_PROD_ENV,
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fake_test_key_should_not_leak',
        CLERK_SECRET_KEY: 'sk_test_fake_secret_key_should_not_leak',
      };

      const result = validateProductionEnv(misconfigured, { strict: true });
      assert.equal(result.ok, false);
      assert.equal(result.summary.NEXT_PUBLIC_APP_URL, 'warning');
      assert.equal(result.summary.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'warning');
      assert.equal(result.summary.CLERK_SECRET_KEY, 'warning');
      assert.ok(result.errors.some((e) => e.includes('NEXT_PUBLIC_APP_URL')));
      assert.ok(result.warnings.some((w) => w.includes('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')));
      assert.ok(result.warnings.some((w) => w.includes('CLERK_SECRET_KEY')));

      // Strictly never echoes actual secret values
      const serialized = JSON.stringify(result);
      assert.ok(!serialized.includes('pk_test_fake_test_key_should_not_leak'));
      assert.ok(!serialized.includes('sk_test_fake_secret_key_should_not_leak'));
      assert.ok(!serialized.includes('super_secret_db_pwd'));
      assert.ok(!serialized.includes('super_secret_ably_value'));
    });

    it('validates MONGODB_URI protocol prefix without leaking credentials', () => {
      const invalidMongo: Record<string, string> = {
        ...VALID_PROD_ENV,
        MONGODB_URI: 'postgres://user:secret_pwd_do_not_leak@db.internal:5432/app',
      };

      const result = validateProductionEnv(invalidMongo, { strict: true });
      assert.equal(result.ok, false);
      assert.equal(result.summary.MONGODB_URI, 'warning');
      assert.ok(result.errors.some((e) => e.includes('MONGODB_URI')));
      assert.ok(!JSON.stringify(result).includes('secret_pwd_do_not_leak'));
    });
  });

  describe('2. Vercel & GitHub Actions CI/CD Configuration Integrity', () => {
    const repoRoot = process.cwd();

    it('verifies vercel.json is valid JSON configured for Next.js in Mumbai (bom1)', () => {
      const vercelPath = path.join(repoRoot, 'vercel.json');
      assert.ok(fs.existsSync(vercelPath), 'vercel.json must exist at repository root');

      const parsed = JSON.parse(fs.readFileSync(vercelPath, 'utf-8')) as {
        framework?: string;
        regions?: string[];
        functions?: Record<string, { maxDuration?: number }>;
        headers?: unknown;
      };

      assert.equal(parsed.framework, 'nextjs');
      assert.ok(Array.isArray(parsed.regions) && parsed.regions.includes('bom1'));
      assert.equal(parsed.functions?.['src/app/api/**/*.ts']?.maxDuration, 30);
      assert.equal(
        parsed.headers,
        undefined,
        'vercel.json must not duplicate next.config.ts security headers'
      );
    });

    it('verifies .github/workflows/ci.yml runs typecheck, lint, test, and build gates', () => {
      const ciPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml');
      assert.ok(fs.existsSync(ciPath), '.github/workflows/ci.yml must exist');

      const content = fs.readFileSync(ciPath, 'utf-8');
      assert.ok(content.includes('npm ci'));
      assert.ok(content.includes('npm run typecheck'));
      assert.ok(content.includes('npm run lint'));
      assert.ok(content.includes('npm run test:all'));
      assert.ok(content.includes('npm run build'));
    });
  });
});
