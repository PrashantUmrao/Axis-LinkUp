import { z } from 'zod';

/**
 * Server-side environment variable schema validation.
 * Validates critical runtime configuration without leaking secrets.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required and cannot be empty')
    .refine((uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'), {
      message: 'MONGODB_URI must begin with "mongodb://" or "mongodb+srv://"',
    }),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Safely parses and validates process.env variables.
 * Throws a clean error if validation fails.
 */
export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Environment validation error: ${errorMessages}`);
  }

  return result.data;
}
