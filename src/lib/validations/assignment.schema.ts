/**
 * Zod Validation Schemas for Assignment Management.
 * Conforms to Phase 5.7 Assignment Management Architecture.
 */

import { z } from 'zod';
import { objectIdSchema, safeHttpUrlSchema } from './common-schemas';

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const;

export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const attachmentInputSchema = z.object({
  name: z.string().trim().min(1, 'Attachment name is required').max(150),
  url: safeHttpUrlSchema,
  sizeBytes: z
    .number()
    .int()
    .min(0)
    .max(MAX_ATTACHMENT_SIZE_BYTES, 'Attachment size cannot exceed 25MB'),
  mimeType: z
    .string()
    .trim()
    .refine(
      (mime) =>
        ALLOWED_ATTACHMENT_MIME_TYPES.includes(mime as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]) ||
        mime.startsWith('image/') ||
        mime === 'application/octet-stream',
      { message: 'Unsupported file type. Permitted types: PDF, Word, PowerPoint, Excel, Text, Archive, Images.' }
    ),
  publicId: z.string().trim().max(200).optional().nullable(),
});

export const academicTargetInputSchema = z.object({
  program: z.string().trim().toUpperCase().max(50).optional(),
  year: z.coerce.number().int().min(1).max(6).optional(),
  semester: z.coerce.number().int().min(1).max(12),
  section: z.string().trim().toUpperCase().max(10).optional(),
  batchYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const lateSubmissionPolicyInputSchema = z.object({
  allowLate: z.boolean().default(false),
  lateDueDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .or(z.string().optional().nullable()),
  penaltyPercentagePerDay: z.coerce.number().min(0).max(100).default(0),
});

export const createAssignmentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(200, 'Title cannot exceed 200 characters'),
    description: z
      .string()
      .trim()
      .min(3, 'Description must be at least 3 characters')
      .max(5000, 'Description cannot exceed 5000 characters'),
    instructions: z.string().trim().max(5000).optional(),
    courseCode: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, 'Course code is required')
      .max(20, 'Course code cannot exceed 20 characters'),
    courseName: z
      .string()
      .trim()
      .min(2, 'Course name is required')
      .max(150, 'Course name cannot exceed 150 characters'),
    departmentId: objectIdSchema,
    academicTarget: academicTargetInputSchema,
    dueDate: z.string().datetime({ offset: true }).or(z.string().min(10)),
    maxMarks: z.coerce.number().int().min(1, 'Max marks must be at least 1').max(1000).default(100),
    lateSubmissionPolicy: lateSubmissionPolicyInputSchema.optional().default({
      allowLate: false,
      lateDueDate: null,
      penaltyPercentagePerDay: 0,
    }),
    allowResubmission: z.boolean().default(false),
    maxResubmissions: z.coerce.number().int().min(1).max(10).default(3),
    attachments: z.array(attachmentInputSchema).default([]),
    status: z.enum(['draft', 'published']).default('draft'),
  })
  .refine(
    (data) => {
      const due = new Date(data.dueDate);
      if (isNaN(due.getTime())) return false;
      if (data.lateSubmissionPolicy?.allowLate && data.lateSubmissionPolicy.lateDueDate) {
        const lateDue = new Date(data.lateSubmissionPolicy.lateDueDate);
        if (isNaN(lateDue.getTime())) return false;
        return lateDue >= due;
      }
      return true;
    },
    {
      message: 'Late submission cutoff date must be on or after the primary due date',
      path: ['lateSubmissionPolicy', 'lateDueDate'],
    }
  );

export const updateAssignmentSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(3).max(5000).optional(),
  instructions: z.string().trim().max(5000).optional(),
  courseCode: z.string().trim().toUpperCase().min(2).max(20).optional(),
  courseName: z.string().trim().min(2).max(150).optional(),
  academicTarget: academicTargetInputSchema.optional(),
  dueDate: z.string().datetime({ offset: true }).or(z.string().min(10)).optional(),
  maxMarks: z.coerce.number().int().min(1).max(1000).optional(),
  lateSubmissionPolicy: lateSubmissionPolicyInputSchema.optional(),
  allowResubmission: z.boolean().optional(),
  maxResubmissions: z.coerce.number().int().min(1).max(10).optional(),
  attachments: z.array(attachmentInputSchema).optional(),
  status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
});

export const submitAssignmentSchema = z
  .object({
    submissionText: z.string().trim().max(10000).optional(),
    attachments: z.array(attachmentInputSchema).default([]),
  })
  .refine(
    (data) => {
      const hasText = Boolean(data.submissionText && data.submissionText.trim().length > 0);
      const hasAttachments = Boolean(data.attachments && data.attachments.length > 0);
      return hasText || hasAttachments;
    },
    {
      message: 'Submission must include either textual response or at least one file attachment',
    }
  );

export const evaluateSubmissionSchema = z.object({
  marksObtained: z
    .coerce
    .number()
    .min(0, 'Marks obtained cannot be negative'),
  feedback: z.string().trim().max(2000, 'Feedback cannot exceed 2000 characters').optional().nullable(),
  releaseGrade: z.boolean().default(true),
});

export const assignmentFilterSchema = z.object({
  status: z.enum(['draft', 'published', 'closed', 'archived']).optional(),
  departmentId: objectIdSchema.optional(),
  courseCode: z.string().trim().toUpperCase().optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  section: z.string().trim().toUpperCase().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: objectIdSchema.optional(),
});

export const submissionFilterSchema = z.object({
  status: z.enum(['submitted', 'resubmitted', 'graded', 'returned']).optional(),
  isLate: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  isGraded: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: objectIdSchema.optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export type EvaluateSubmissionInput = z.infer<typeof evaluateSubmissionSchema>;
export type AssignmentFilterInput = z.infer<typeof assignmentFilterSchema>;
export type SubmissionFilterInput = z.infer<typeof submissionFilterSchema>;
