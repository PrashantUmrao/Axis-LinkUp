/**
 * Zod Validation Schemas for Skill & Achievement Passport (MOD-15 / Phase 5.12).
 * Enforces safe http/https URLs, non-future issue dates, mandatory proof evidence,
 * and rejection remark policies.
 */

import { z } from 'zod';
import { ACHIEVEMENT_CATEGORIES, VERIFICATION_STATUSES } from '@/types/passport';

export const MAX_PASSPORT_PROOF_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const achievementCategoryEnum = z.enum(ACHIEVEMENT_CATEGORIES);
export const verificationStatusEnum = z.enum(VERIFICATION_STATUSES);

const safeHttpUrlSchema = z
  .string()
  .trim()
  .max(500, 'Credential URL cannot exceed 500 characters')
  .refine(
    (val) => {
      if (!val) return true;
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'Credential URL must be a valid http:// or https:// link' }
  );

export const proofAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z
    .string()
    .trim()
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch {
          return false;
        }
      },
      { message: 'Proof attachment URL must be a valid http:// or https:// link' }
    ),
  fileType: z.string().trim().min(1).max(120),
  size: z
    .number()
    .int()
    .min(0)
    .max(MAX_PASSPORT_PROOF_SIZE_BYTES, 'Proof attachment cannot exceed 25 MB'),
  publicId: z.string().trim().max(255).default('local'),
});

const achievementBaseObject = z.object({
  category: achievementCategoryEnum,
  title: z
    .string()
    .trim()
    .min(5, 'Achievement title must be at least 5 characters')
    .max(140, 'Achievement title cannot exceed 140 characters'),
  issuingOrganization: z
    .string()
    .trim()
    .min(2, 'Issuing organization must be at least 2 characters')
    .max(120, 'Issuing organization cannot exceed 120 characters'),
  issueDate: z.coerce.date(),
  description: z
    .string()
    .trim()
    .min(15, 'Description must be at least 15 characters')
    .max(1000, 'Description cannot exceed 1000 characters'),
  skills: z
    .array(z.string().trim().min(1).max(40))
    .max(10, 'Maximum 10 skill tags allowed')
    .optional()
    .default([]),
  credentialUrl: safeHttpUrlSchema
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  proofAttachment: proofAttachmentSchema.optional().nullable(),
});

function validateAchievementRules(
  data: z.infer<typeof achievementBaseObject>,
  ctx: z.RefinementCtx
): void {
  if (Number.isNaN(data.issueDate.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid issue date',
      path: ['issueDate'],
    });
  } else if (data.issueDate.getTime() > Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Achievement issue date cannot be in the future',
      path: ['issueDate'],
    });
  }

  const hasUrl = Boolean(data.credentialUrl && data.credentialUrl.trim().length > 0);
  const hasAttachment = Boolean(data.proofAttachment && data.proofAttachment.url);
  if (!hasUrl && !hasAttachment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one proof source (credential URL or uploaded proof attachment) is required',
      path: ['credentialUrl'],
    });
  }
}

export const createAchievementSchema = achievementBaseObject.superRefine(validateAchievementRules);
export type CreateAchievementInput = z.infer<typeof createAchievementSchema>;

export const resubmitAchievementSchema = achievementBaseObject.superRefine(validateAchievementRules);
export type ResubmitAchievementInput = z.infer<typeof resubmitAchievementSchema>;

/**
 * Schema for faculty/admin verification or rejection decision.
 */
export const verifyAchievementSchema = z
  .object({
    decision: z.enum(['verify', 'reject']),
    remarks: z
      .string()
      .trim()
      .max(500, 'Remarks cannot exceed 500 characters')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'reject' && (!data.remarks || data.remarks.trim().length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Rejecting a claim requires descriptive remarks of at least 10 characters',
        path: ['remarks'],
      });
    }
  });

export type VerifyAchievementInput = z.infer<typeof verifyAchievementSchema>;

/**
 * Schema for updating public recruiter portfolio share settings.
 */
export const updatePassportShareSchema = z.object({
  isEnabled: z.boolean(),
  headline: z
    .string()
    .trim()
    .max(160, 'Headline cannot exceed 160 characters')
    .optional()
    .nullable()
    .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
  rotateToken: z.boolean().optional().default(false),
});

export type UpdatePassportShareInput = z.infer<typeof updatePassportShareSchema>;

/**
 * Query parameters for listing student achievements or faculty/admin verification queues.
 */
export const achievementQuerySchema = z.object({
  category: achievementCategoryEnum.optional(),
  verificationStatus: verificationStatusEnum.optional(),
  department: z.string().trim().max(120).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type AchievementQueryParams = z.infer<typeof achievementQuerySchema>;
