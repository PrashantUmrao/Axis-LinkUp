/**
 * Notice & Bulletin Zod Validation Schemas (Phase 5.4).
 * Enforces strict input validation, category taxonomies, and scope constraints.
 */

import { z } from 'zod';
import { objectIdSchema } from './common-schemas';

export const noticePrioritySchema = z.enum(['normal', 'important', 'urgent']);

export const noticeCategorySchema = z.enum([
  'academic',
  'examination',
  'fee_accounts',
  'event_cultural',
  'placement',
  'administrative',
  'emergency',
]);

export const noticeStatusSchema = z.enum(['draft', 'published', 'archived']);

export const noticeScopeTypeSchema = z.enum([
  'institution_wide',
  'department',
  'role_specific',
  'cohort',
]);

export const noticeAttachmentSchema = z.object({
  name: z.string().trim().min(1, 'Attachment name is required').max(100),
  url: z.string().trim().url('Invalid attachment URL'),
  sizeBytes: z.number().int().positive('File size must be positive').max(25 * 1024 * 1024, 'Attachment cannot exceed 25MB'),
  mimeType: z.string().trim().min(1, 'MIME type is required'),
});

export const noticeTargetScopeSchema = z.object({
  scopeType: noticeScopeTypeSchema,
  departmentIds: z.array(objectIdSchema).optional(),
  roles: z.array(z.enum(['student', 'faculty', 'admin', 'super_admin'])).optional(),
  programs: z.array(z.string().trim().min(1).max(50)).optional(),
  batchYears: z.array(z.number().int().min(2000).max(2100)).optional(),
  semesters: z.array(z.number().int().min(1).max(12)).optional(),
  sections: z.array(z.string().trim().min(1).max(10)).optional(),
  courseCode: z.string().trim().max(20).optional(),
});

/**
 * Notice Creation Schema.
 */
export const createNoticeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Notice title must be at least 3 characters')
    .max(150, 'Notice title cannot exceed 150 characters'),
  contentMarkdown: z
    .string()
    .trim()
    .min(10, 'Notice content must be at least 10 characters')
    .max(25000, 'Notice content cannot exceed 25,000 characters'),
  summary: z.string().trim().max(300, 'Summary cannot exceed 300 characters').optional(),
  category: noticeCategorySchema,
  priority: noticePrioritySchema.default('normal'),
  status: z.enum(['draft', 'published']).default('draft'),
  targetScope: noticeTargetScopeSchema,
  attachments: z.array(noticeAttachmentSchema).max(10, 'Cannot exceed 10 attachments').optional(),
  isPinned: z.boolean().default(false),
  requiresAcknowledgment: z.boolean().default(false),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

/**
 * Notice Update Schema.
 */
export const updateNoticeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Notice title must be at least 3 characters')
    .max(150, 'Notice title cannot exceed 150 characters')
    .optional(),
  contentMarkdown: z
    .string()
    .trim()
    .min(10, 'Notice content must be at least 10 characters')
    .max(25000, 'Notice content cannot exceed 25,000 characters')
    .optional(),
  summary: z.string().trim().max(300).optional(),
  category: noticeCategorySchema.optional(),
  priority: noticePrioritySchema.optional(),
  targetScope: noticeTargetScopeSchema.optional(),
  attachments: z.array(noticeAttachmentSchema).max(10).optional(),
  isPinned: z.boolean().optional(),
  requiresAcknowledgment: z.boolean().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

/**
 * Notice Feed Query Parameters Schema.
 */
export const noticeQuerySchema = z.object({
  category: noticeCategorySchema.optional(),
  priority: noticePrioritySchema.optional(),
  status: noticeStatusSchema.optional(),
  departmentId: objectIdSchema.optional(),
  search: z.string().trim().max(100).optional(),
  cursor: objectIdSchema.optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

export type CreateNoticeSchemaType = z.infer<typeof createNoticeSchema>;
export type UpdateNoticeSchemaType = z.infer<typeof updateNoticeSchema>;
export type NoticeQuerySchemaType = z.infer<typeof noticeQuerySchema>;

