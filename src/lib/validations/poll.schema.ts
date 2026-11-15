/**
 * Poll & Voting Zod Validation Schemas (Phase 5.4).
 * Enforces 2-10 options, option uniqueness, maxSelections consistency, and ballot integrity.
 */

import { z } from 'zod';
import { objectIdSchema } from './common-schemas';

export const pollTypeSchema = z.enum(['single', 'multiple']);

export const pollStatusSchema = z.enum(['draft', 'active', 'closed', 'archived']);

export const pollResultsVisibilitySchema = z.enum([
  'always',
  'after_vote',
  'after_close',
  'creator_only',
]);

export const pollScopeTypeSchema = z.enum([
  'institution_wide',
  'department',
  'role_specific',
  'cohort',
]);

export const pollOptionInputSchema = z.object({
  text: z.string().trim().min(1, 'Option text cannot be empty').max(100, 'Option text cannot exceed 100 characters'),
});

export const pollTargetScopeSchema = z.object({
  scopeType: pollScopeTypeSchema,
  departmentIds: z.array(objectIdSchema).optional(),
  roles: z.array(z.enum(['student', 'faculty', 'admin', 'super_admin'])).optional(),
  programs: z.array(z.string().trim().min(1).max(50)).optional(),
  batchYears: z.array(z.number().int().min(2000).max(2100)).optional(),
  sections: z.array(z.string().trim().min(1).max(10)).optional(),
  courseCode: z.string().trim().max(20).optional(),
});

/**
 * Poll Creation Schema.
 * Enforces 2 to 10 choices, unique option labels, and maxSelections consistency.
 */
export const createPollSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(5, 'Poll question must be at least 5 characters')
      .max(250, 'Poll question cannot exceed 250 characters'),
    description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional(),
    type: pollTypeSchema.default('single'),
    maxSelections: z.number().int().min(1).max(10).default(1),
    options: z
      .array(pollOptionInputSchema)
      .min(2, 'A poll must have at least 2 options')
      .max(10, 'A poll cannot have more than 10 options')
      .refine(
        (items) => {
          const texts = items.map((i) => i.text.toLowerCase());
          return new Set(texts).size === texts.length;
        },
        { message: 'Option labels must be distinct' }
      ),
    isAnonymous: z.boolean().default(true),
    resultsVisibility: pollResultsVisibilitySchema.default('after_vote'),
    status: z.enum(['draft', 'active']).default('active'),
    targetScope: pollTargetScopeSchema,
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'single' && data.maxSelections !== 1) {
        return false;
      }
      if (data.type === 'multiple' && data.maxSelections > data.options.length) {
        return false;
      }
      return true;
    },
    {
      message: 'maxSelections must equal 1 for single-choice polls, and cannot exceed the number of options',
      path: ['maxSelections'],
    }
  );

/**
 * Poll Update Schema (Draft state only).
 */
export const updatePollSchema = z.object({
  question: z.string().trim().min(5).max(250).optional(),
  description: z.string().trim().max(1000).optional(),
  type: pollTypeSchema.optional(),
  maxSelections: z.number().int().min(1).max(10).optional(),
  options: z
    .array(pollOptionInputSchema)
    .min(2)
    .max(10)
    .refine(
      (items) => {
        const texts = items.map((i) => i.text.toLowerCase());
        return new Set(texts).size === texts.length;
      },
      { message: 'Option labels must be distinct' }
    )
    .optional(),
  isAnonymous: z.boolean().optional(),
  resultsVisibility: pollResultsVisibilitySchema.optional(),
  targetScope: pollTargetScopeSchema.optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

/**
 * Ballot Casting Schema.
 */
export const castVoteSchema = z.object({
  selectedOptionIds: z
    .array(objectIdSchema)
    .min(1, 'You must select at least one option')
    .max(10, 'Cannot exceed 10 option selections')
    .refine(
      (ids) => new Set(ids).size === ids.length,
      { message: 'Duplicate option selections are not permitted' }
    ),
});

/**
 * Poll Feed Query Parameters Schema.
 */
export const pollQuerySchema = z.object({
  status: pollStatusSchema.optional(),
  departmentId: objectIdSchema.optional(),
  search: z.string().trim().max(100).optional(),
  cursor: objectIdSchema.optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

export type CreatePollSchemaType = z.infer<typeof createPollSchema>;
export type UpdatePollSchemaType = z.infer<typeof updatePollSchema>;
export type CastVoteSchemaType = z.infer<typeof castVoteSchema>;
export type PollQuerySchemaType = z.infer<typeof pollQuerySchema>;

