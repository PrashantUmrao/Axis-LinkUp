/**
 * Common, cross-cutting Zod validation schemas.
 * Standardizes common request parameters across Route Handlers and Server Actions.
 */

import { z } from 'zod';
import { PAGINATION } from '@/config/constants';

/**
 * Validates a 24-character hexadecimal MongoDB ObjectId.
 */
export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId format');

/**
 * Validates route parameters containing an :id segment.
 */
export const idParamSchema = z.object({
  id: objectIdSchema,
});

export type IdParam = z.infer<typeof idParamSchema>;

/**
 * Validates standard offset pagination and sorting query parameters.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION.MIN_PAGE_SIZE, `Limit must be at least ${PAGINATION.MIN_PAGE_SIZE}`)
    .max(PAGINATION.MAX_PAGE_SIZE, `Limit cannot exceed ${PAGINATION.MAX_PAGE_SIZE}`)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
  sortBy: z.string().trim().max(50).default(PAGINATION.DEFAULT_SORT_BY),
  sortOrder: z.enum(['asc', 'desc']).default(PAGINATION.DEFAULT_SORT_ORDER),
});

export type PaginationQueryParams = z.infer<typeof paginationQuerySchema>;

/**
 * Validates high-velocity cursor pagination query parameters (feeds and chat).
 */
export const cursorPaginationQuerySchema = z.object({
  cursor: objectIdSchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_CURSOR_LIMIT)
    .default(PAGINATION.DEFAULT_CURSOR_LIMIT),
});

export type CursorPaginationQueryParams = z.infer<typeof cursorPaginationQuerySchema>;

/**
 * Validates a search query term.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().max(100, 'Search query cannot exceed 100 characters').optional(),
});

export type SearchQueryParams = z.infer<typeof searchQuerySchema>;

/**
 * Validates that a URL is syntactically valid AND strictly uses http: or https: protocol,
 * rejecting XSS/injection schemes like javascript:, data:, vbscript:, or file: (AUD-M01).
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const safeHttpUrlSchema = z
  .string()
  .trim()
  .url('Invalid URL format')
  .refine(isSafeHttpUrl, {
    message: 'Only http:// and https:// URLs are permitted',
  });

/**
 * Validates standard email addresses (normalized to lowercase).
 */
export const emailSchema = z.string().trim().email('Invalid email address format').toLowerCase();

/**
 * Validates institutional usernames (normalized to lowercase).
 * Rules:
 * - Trims whitespace
 * - Normalizes to lowercase
 * - Length: 3 to 30 characters
 * - Characters: lowercase letters, numbers, underscores, hyphens, and periods
 * - Must begin and end with an alphanumeric character
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username cannot exceed 30 characters')
  .regex(
    /^[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]$/,
    'Username must begin and end with an alphanumeric character and may only contain lowercase letters, numbers, hyphens, underscores, and periods'
  );

/**
 * Validates institutional administrative sub-roles.
 */
export const adminSubRoleSchema = z.enum(['sys_admin', 'hod', 'director']);

/**
 * Validates Axis Institute student roll number format (e.g., "22BCSE101", "23BECE045").
 */
export const studentRollNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9-]{6,20}$/,
    'Student roll number must be between 6 and 20 alphanumeric characters'
  );

/**
 * Validates an optional date range with chronological integrity.
 */
export const dateRangeSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate.getTime() >= data.startDate.getTime();
      }
      return true;
    },
    {
      message: 'End date must be greater than or equal to start date',
      path: ['endDate'],
    }
  );

export type DateRangeParams = z.infer<typeof dateRangeSchema>;
