import { z } from 'zod';

/**
 * Server-side environment variable schema.
 * Enforces strict typing, required variables for active modules,
 * and safe defaults for the full collegiate platform.
 */
const serverEnvSchema = z.object({
  // Core Application Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Primary Database (MongoDB Atlas) - Active Required
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required and cannot be empty')
    .refine((uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'), {
      message: 'MONGODB_URI must begin with "mongodb://" or "mongodb+srv://"',
    }),

  // Authentication & Identity (Clerk) - Server Secrets (Optional until Auth Integration)
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // File Storage & CDN (Cloudinary) - Server Secrets (Optional until Storage Integration)
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Real-Time Broker (Ably) - Server Secrets (Optional until Real-time Integration)
  ABLY_API_KEY: z.string().optional(),

  // Transactional Email (Resend) - Server Secrets (Optional until Email Integration)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().default('Axis LinkUp <notifications@axiscolleges.in>'),
});

/**
 * Client-exposed environment variable schema (NEXT_PUBLIC_*).
 * Safe to expose to the browser bundle.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Axis LinkUp'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/'),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
});

/**
 * Validates and parses environment variables.
 * Fails fast with clear diagnostic messages on misconfiguration.
 */
function parseEnvironment() {
  const isServer = typeof window === 'undefined';

  const clientResult = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  });

  if (!clientResult.success) {
    const errors = clientResult.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`[Config Error] Invalid client environment configuration:\n${errors}`);
  }

  if (!isServer) {
    // In client-side bundle, return only safe client variables
    return {
      client: clientResult.data,
      server: null,
    };
  }

  const serverResult = serverEnvSchema.safeParse(process.env);

  if (!serverResult.success) {
    const errors = serverResult.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`[Config Error] Invalid server environment configuration:\n${errors}`);
  }

  return {
    client: clientResult.data,
    server: serverResult.data,
  };
}

const parsed = parseEnvironment();

/**
 * Server-only environment variables.
 * Throws an error if accessed from a browser context.
 */
export const serverEnv = new Proxy((parsed.server ?? {}) as z.infer<typeof serverEnvSchema>, {
  get(target, prop: string) {
    if (typeof window !== 'undefined') {
      throw new Error(
        `[Security Violation] Attempted to access server-only environment variable "${prop}" from the client browser.`
      );
    }
    return target[prop as keyof typeof target];
  },
});

/**
 * Safe, client-accessible environment variables.
 */
export const clientEnv = parsed.client;

/**
 * Unified server-side export for clean imports.
 */
export const env = {
  ...clientEnv,
  ...(parsed.server ?? {}),
};

export default env;
