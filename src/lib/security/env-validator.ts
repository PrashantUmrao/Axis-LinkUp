/**
 * Production Environment Pre-Flight Validator (Phase 6.2).
 * Verifies core boot and operational environment variables and guards against
 * common production misconfigurations (localhost URLs, Clerk test keys, malformed MongoDB URIs).
 *
 * SECURITY INVARIANT: Never echoes, logs, or returns actual environment variable values.
 */

export const CORE_REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'NEXT_PUBLIC_APP_URL',
] as const;

export const OPERATIONAL_REQUIRED_ENV_VARS = [
  'ABLY_API_KEY',
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM_ADDRESS',
] as const;

export type EnvVarStatus = 'configured' | 'missing' | 'warning';

export interface EnvValidationOptions {
  strict?: boolean;
}

export interface EnvValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: Record<string, EnvVarStatus>;
}

/**
 * Validates deployment environment variables without ever leaking secret values.
 */
export function validateProductionEnv(
  env: Record<string, string | undefined>,
  options: EnvValidationOptions = {}
): EnvValidationResult {
  const isStrict = Boolean(options.strict);
  const isProdContext = isStrict || env.NODE_ENV === 'production';

  const errors: string[] = [];
  const warnings: string[] = [];
  const summary: Record<string, EnvVarStatus> = {};

  // 1. Validate Core Boot Variables
  for (const key of CORE_REQUIRED_ENV_VARS) {
    const val = env[key]?.trim();
    if (!val) {
      summary[key] = 'missing';
      errors.push(`Missing core required environment variable: ${key}`);
    } else {
      summary[key] = 'configured';
    }
  }

  // 2. Validate Operational Feature Variables
  for (const key of OPERATIONAL_REQUIRED_ENV_VARS) {
    const val = env[key]?.trim();
    if (!val) {
      summary[key] = 'missing';
      const msg = `Missing operational environment variable for full production features: ${key}`;
      if (isStrict) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    } else {
      summary[key] = 'configured';
    }
  }

  // 3. MongoDB URI Protocol Check (always enforced when set)
  const mongoUri = env.MONGODB_URI?.trim();
  if (mongoUri && !mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    summary.MONGODB_URI = 'warning';
    errors.push(
      'Invalid MONGODB_URI format: connection string must begin with "mongodb://" or "mongodb+srv://".'
    );
  }

  // 4. Production Misconfiguration Guards (strict mode or NODE_ENV === 'production')
  if (isProdContext) {
    const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
    if (appUrl) {
      const lowerUrl = appUrl.toLowerCase();
      const isLocalhost =
        lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1') || lowerUrl.includes('0.0.0.0');
      const isHttps = lowerUrl.startsWith('https://');

      if (isLocalhost || !isHttps) {
        summary.NEXT_PUBLIC_APP_URL = 'warning';
        errors.push(
          'Production misconfiguration on NEXT_PUBLIC_APP_URL: must use a public HTTPS origin (localhost and HTTP are not permitted in production).'
        );
      }
    }

    const clerkPub = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
    if (clerkPub && clerkPub.startsWith('pk_test_')) {
      summary.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'warning';
      const msg =
        'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is using a Clerk test key prefix. Switch to Clerk Live Production keys before launch.';
      warnings.push(msg);
      if (isStrict) {
        errors.push(msg);
      }
    }

    const clerkSecret = env.CLERK_SECRET_KEY?.trim();
    if (clerkSecret && clerkSecret.startsWith('sk_test_')) {
      summary.CLERK_SECRET_KEY = 'warning';
      const msg =
        'CLERK_SECRET_KEY is using a Clerk test key prefix. Switch to Clerk Live Production keys before launch.';
      warnings.push(msg);
      if (isStrict) {
        errors.push(msg);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}
