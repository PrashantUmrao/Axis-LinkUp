/**
 * Complaints & Grievance Redressal Zod Validation Schemas (Phase 5.5).
 * Mandated under AICTE / UGC Grievance Redressal Regulations.
 * Strictly validates inputs, payload structures, category taxonomies, and lifecycle transitions.
 */

import { z } from 'zod';
import { objectIdSchema } from './common-schemas';

/**
 * Statutory grievance categories.
 */
export const complaintCategorySchema = z.enum([
  'academic',
  'lab_infrastructure',
  'hostel',
  'harassment',
  'administrative',
  'fee_accounts',
  'examination',
  'other',
]);

/**
 * Grievance triage priority ratings.
 */
export const complaintPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Controlled grievance lifecycle status values.
 */
export const complaintStatusSchema = z.enum([
  'submitted',
  'under_review',
  'in_progress',
  'responded',
  'resolved',
  'closed',
  'escalated',
  'reopened',
  'rejected',
]);

/**
 * Target recipient level for grievance redressal.
 */
export const complaintRecipientRoleSchema = z.enum(['hod', 'director']);

/**
 * Attachment validation schema.
 * Max 25MB per file, safe URL format.
 */
export const complaintAttachmentSchema = z.object({
  name: z.string().trim().min(1, 'Attachment name is required').max(150),
  url: z.string().trim().url('Invalid attachment URL'),
  sizeBytes: z
    .number()
    .int()
    .nonnegative('File size must be non-negative')
    .max(25 * 1024 * 1024, 'Attachment cannot exceed 25MB')
    .optional(),
  mimeType: z.string().trim().min(1, 'MIME type is required').optional(),
  publicId: z.string().trim().max(200).optional(),
});

/**
 * Academic context schema.
 */
export const complaintAcademicContextSchema = z.object({
  batchYear: z.number().int().min(2020).max(2035).optional(),
  semester: z.number().int().min(1).max(8).optional(),
  section: z.string().trim().max(5).optional(),
  courseCode: z.string().trim().max(20).optional(),
});

/**
 * Complaint creation schema.
 * Enforces authenticated student filing constraints.
 */
export const createComplaintSchema = z.object({
  recipientRole: complaintRecipientRoleSchema,
  category: complaintCategorySchema,
  priority: complaintPrioritySchema.default('medium'),
  subject: z
    .string()
    .trim()
    .min(5, 'Subject must be at least 5 characters')
    .max(200, 'Subject cannot exceed 200 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description narrative must be at least 10 characters')
    .max(10000, 'Description narrative cannot exceed 10,000 characters'),
  departmentId: objectIdSchema.optional(),
  academicContext: complaintAcademicContextSchema.optional(),
  attachments: z.array(complaintAttachmentSchema).max(5, 'Cannot exceed 5 attachments').optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

/**
 * Grievance response schema.
 */
export const addComplaintResponseSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Response message is required')
    .max(5000, 'Response message cannot exceed 5000 characters'),
  actionTaken: z.string().trim().max(200).optional(),
  attachments: z.array(complaintAttachmentSchema).max(5).optional(),
  isInternal: z.boolean().default(false),
});

export type AddComplaintResponseInput = z.infer<typeof addComplaintResponseSchema>;

/**
 * Controlled status transition schema.
 * Remarks are mandatory for all lifecycle mutations.
 */
export const updateComplaintStatusSchema = z.object({
  status: complaintStatusSchema,
  remarks: z
    .string()
    .trim()
    .min(3, 'Audit remarks must be at least 3 characters')
    .max(1000, 'Audit remarks cannot exceed 1000 characters'),
});

export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;

/**
 * Grievance escalation schema.
 * Escalates to Directorate with mandatory statutory reasoning.
 */
export const escalateComplaintSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Escalation reason must be at least 10 characters')
    .max(1000, 'Escalation reason cannot exceed 1000 characters'),
});

export type EscalateComplaintInput = z.infer<typeof escalateComplaintSchema>;

/**
 * Grievance investigator assignment schema.
 */
export const assignComplaintSchema = z.object({
  assignedToId: objectIdSchema,
  assignedToName: z.string().trim().min(2, 'Assignee name is required').max(100),
  assignedToRole: z.string().trim().max(50).optional(),
  remarks: z.string().trim().max(500).optional(),
});

export type AssignComplaintInput = z.infer<typeof assignComplaintSchema>;

/**
 * Complaint query parameters schema.
 */
export const complaintQuerySchema = z.object({
  status: complaintStatusSchema.optional(),
  category: complaintCategorySchema.optional(),
  priority: complaintPrioritySchema.optional(),
  recipientRole: complaintRecipientRoleSchema.optional(),
  departmentId: objectIdSchema.optional(),
  isEscalated: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  isBreached: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().trim().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ComplaintQueryParams = z.infer<typeof complaintQuerySchema>;

