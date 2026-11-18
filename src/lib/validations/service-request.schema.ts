/**
 * Zod Validation Schemas for Student Request Tracker & Administrative Service Queues (MOD-13).
 * Conforms to Phase 5.8 Architecture Specification.
 */

import { z } from 'zod';
import { safeHttpUrlSchema } from './common-schemas';

export const MAX_REQUEST_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const requestAttachmentInputSchema = z.object({
  name: z.string().trim().min(1, 'Attachment name is required').max(200),
  url: safeHttpUrlSchema,
  fileType: z.string().trim().default('application/octet-stream'),
  size: z
    .number()
    .int()
    .min(0)
    .max(MAX_REQUEST_ATTACHMENT_SIZE_BYTES, 'Attachment size cannot exceed 25MB'),
  publicId: z.string().trim().max(200).optional().nullable(),
});

export const bonafideDetailsSchema = z
  .object({
    purpose: z.enum(['scholarship', 'visa_passport', 'education_loan', 'internship', 'other']),
    customPurpose: z.string().trim().max(200).optional(),
  })
  .refine(
    (data) => {
      if (data.purpose === 'other') {
        return Boolean(data.customPurpose && data.customPurpose.trim().length >= 3);
      }
      return true;
    },
    {
      message: 'Custom purpose is required when purpose is "other" (minimum 3 characters).',
      path: ['customPurpose'],
    }
  );

export const leaveDetailsSchema = z
  .object({
    startDate: z.string().trim().min(1, 'Start date is required'),
    endDate: z.string().trim().min(1, 'End date is required'),
    reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(1000),
    emergencyContact: z.string().trim().min(5, 'Emergency contact is required').max(50),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
      return end >= start;
    },
    {
      message: 'Leave end date must be on or after the start date.',
      path: ['endDate'],
    }
  );

export const idReplacementDetailsSchema = z.object({
  reason: z.enum(['lost', 'damaged', 'stolen']),
  policeReportRef: z.string().trim().max(100).optional(),
});

export const labAccessDetailsSchema = z.object({
  labName: z.string().trim().min(2, 'Lab name is required').max(100),
  facultySupervisor: z.string().trim().min(2, 'Faculty supervisor name is required').max(100),
  durationHours: z.coerce.number().min(1).max(24),
  requiredDates: z.string().trim().min(2, 'Required dates specification is required').max(200),
});

export const generalInquiryDetailsSchema = z.object({
  queryDetails: z
    .string()
    .trim()
    .min(10, 'Inquiry details must be at least 10 characters')
    .max(2000),
});

export const createServiceRequestSchema = z
  .object({
    category: z.enum(['bonafide', 'leave', 'id_replacement', 'lab_access', 'general_inquiry']),
    subject: z
      .string()
      .trim()
      .min(5, 'Subject must be at least 5 characters')
      .max(120, 'Subject cannot exceed 120 characters'),
    priority: z.enum(['standard', 'urgent']).default('standard'),
    details: z.record(z.string(), z.any()),
    attachments: z.array(requestAttachmentInputSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.attachments && data.attachments.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Maximum 5 attachments are permitted per service request.',
        path: ['attachments'],
      });
    }

    if (data.category === 'bonafide') {
      const res = bonafideDetailsSchema.safeParse(data.details);
      if (!res.success) {
        res.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ['details', ...issue.path],
          });
        });
      }
    } else if (data.category === 'leave') {
      const res = leaveDetailsSchema.safeParse(data.details);
      if (!res.success) {
        res.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ['details', ...issue.path],
          });
        });
      }
    } else if (data.category === 'id_replacement') {
      const res = idReplacementDetailsSchema.safeParse(data.details);
      if (!res.success) {
        res.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ['details', ...issue.path],
          });
        });
      }
    } else if (data.category === 'lab_access') {
      const res = labAccessDetailsSchema.safeParse(data.details);
      if (!res.success) {
        res.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ['details', ...issue.path],
          });
        });
      }
    } else if (data.category === 'general_inquiry') {
      const res = generalInquiryDetailsSchema.safeParse(data.details);
      if (!res.success) {
        res.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ['details', ...issue.path],
          });
        });
      }
    }
  });

export const reviewServiceRequestSchema = z
  .object({
    action: z.enum(['under_review', 'action_required', 'approved', 'rejected', 'fulfilled']),
    remarks: z.string().trim().max(2000).optional().nullable(),
    fulfillmentDocument: z
      .object({
        name: z.string().trim().min(1, 'Document name is required').max(200),
        url: safeHttpUrlSchema,
        referenceId: z.string().trim().max(100).optional(),
      })
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'rejected' || data.action === 'action_required') {
      if (!data.remarks || data.remarks.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Descriptive remarks (minimum 10 characters) are required when rejecting or requesting action.',
          path: ['remarks'],
        });
      }
    }
  });

export const SERVICE_REQUEST_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'priority',
  'status',
  'ticketNumber',
] as const;

export const serviceRequestQuerySchema = z.object({
  status: z
    .enum(['submitted', 'under_review', 'action_required', 'approved', 'rejected', 'fulfilled'])
    .optional(),
  category: z
    .enum(['bonafide', 'leave', 'id_replacement', 'lab_access', 'general_inquiry'])
    .optional(),
  priority: z.enum(['standard', 'urgent']).optional(),
  department: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(SERVICE_REQUEST_SORT_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
export type ReviewServiceRequestInput = z.infer<typeof reviewServiceRequestSchema>;
export type ServiceRequestQueryParams = z.infer<typeof serviceRequestQuerySchema>;
