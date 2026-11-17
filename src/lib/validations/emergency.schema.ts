/**
 * Zod Validation Schemas for Campus Emergency Mode & Broadcast Console (MOD-16 / Phase 5.11).
 * Enforces dual-confirmation phrase matching, department scope integrity, and all-clear summaries.
 */

import { z } from 'zod';
import {
  EMERGENCY_SEVERITIES,
  EMERGENCY_CATEGORIES,
  EMERGENCY_SCOPES,
  EMERGENCY_CONFIRMATION_PHRASE,
} from '@/types/emergency';

export const emergencySeverityEnum = z.enum(EMERGENCY_SEVERITIES);
export const emergencyCategoryEnum = z.enum(EMERGENCY_CATEGORIES);
export const emergencyScopeEnum = z.enum(EMERGENCY_SCOPES);

/**
 * Schema for triggering a campus emergency broadcast.
 * Requires exact case-sensitive confirmationPhrase: "CONFIRM EMERGENCY".
 */
export const triggerEmergencySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, 'Emergency title must be at least 5 characters')
      .max(140, 'Emergency title cannot exceed 140 characters'),
    message: z
      .string()
      .trim()
      .min(15, 'Actionable safety directive must be at least 15 characters')
      .max(2000, 'Directive message cannot exceed 2000 characters'),
    severity: emergencySeverityEnum,
    category: emergencyCategoryEnum,
    instructions: z
      .array(
        z
          .string()
          .trim()
          .min(3, 'Each safety instruction must be at least 3 characters')
          .max(300, 'Each safety instruction cannot exceed 300 characters')
      )
      .max(10, 'Maximum 10 safety instructions allowed')
      .optional()
      .default([]),
    affectedScope: emergencyScopeEnum.optional().default('all_campus'),
    targetDepartments: z
      .array(z.string().trim().min(1).max(120))
      .max(25)
      .optional()
      .default([]),
    confirmationPhrase: z.string().refine((val) => val === EMERGENCY_CONFIRMATION_PHRASE, {
      message: `Dual-confirmation required: confirmationPhrase must literally equal "${EMERGENCY_CONFIRMATION_PHRASE}"`,
    }),
  })
  .superRefine((data, ctx) => {
    if (
      data.affectedScope === 'specific_departments' &&
      (!data.targetDepartments || data.targetDepartments.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one target department is required when scope is specific_departments',
        path: ['targetDepartments'],
      });
    }
  });

export type TriggerEmergencyInput = z.infer<typeof triggerEmergencySchema>;

/**
 * Schema for deactivating (standing down) an active campus emergency.
 */
export const deactivateEmergencySchema = z.object({
  deactivationNotes: z
    .string()
    .trim()
    .min(10, 'All-clear deactivation notes must be at least 10 characters')
    .max(500, 'Deactivation notes cannot exceed 500 characters'),
});

export type DeactivateEmergencyInput = z.infer<typeof deactivateEmergencySchema>;

/**
 * Query parameters for historical emergency broadcasts.
 */
export const emergencyHistoryQuerySchema = z.object({
  severity: emergencySeverityEnum.optional(),
  category: emergencyCategoryEnum.optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (typeof val === 'boolean') return val;
      return val === 'true';
    }),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type EmergencyHistoryQueryParams = z.infer<typeof emergencyHistoryQuerySchema>;

/**
 * Query parameters for live emergency acknowledgment roster inspection.
 */
export const acknowledgmentQuerySchema = z.object({
  role: z.enum(['student', 'faculty', 'admin', 'super_admin']).optional(),
  department: z.string().trim().max(120).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type AcknowledgmentQueryParams = z.infer<typeof acknowledgmentQuerySchema>;
