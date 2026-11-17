/**
 * Zod Validation Schemas for Immutable Security Audit Logs (MOD-19) & IAM Governance Console.
 * Enforces mandatory justification reasons on all governance mutations and typed query filters.
 */

import { z } from 'zod';
import { objectIdSchema } from './common-schemas';
import { AUDIT_MODULES, AUDIT_SEVERITIES } from '@/types/governance';
import type { AdminSubRole } from '@/config/constants';

export const auditModuleEnum = z.enum(AUDIT_MODULES);
export const auditSeverityEnum = z.enum(AUDIT_SEVERITIES);

/**
 * Query filter parameters for the immutable Security Audit Log stream.
 */
export const auditLogQuerySchema = z.object({
  module: auditModuleEnum.optional(),
  severity: auditSeverityEnum.optional(),
  action: z.string().trim().max(80).optional(),
  actorId: objectIdSchema.optional(),
  targetEntityId: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  search: z.string().trim().max(150).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type AuditLogQueryParams = z.infer<typeof auditLogQuerySchema>;

/**
 * Query filter parameters for compliance audit export (CSV or JSON).
 */
export const auditExportQuerySchema = auditLogQuerySchema.extend({
  format: z.enum(['csv', 'json']).default('csv'),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export type AuditExportQueryParams = z.infer<typeof auditExportQuerySchema>;

/**
 * Schema for IAM role, administrative sub-role, and departmental assignment mutations.
 * Requires mandatory governance justification (10–500 characters).
 */
export const iamUpdateRoleSchema = z.object({
  role: z.enum(['student', 'faculty', 'admin', 'super_admin']),
  adminSubRole: z
    .enum(['sys_admin', 'hod', 'director', 'system_admin', ''])
    .optional()
    .nullable()
    .transform((val): AdminSubRole | null | undefined => {
      if (val === undefined) return undefined;
      if (val === null || val === '') return null;
      if (val === 'system_admin') return 'sys_admin';
      return val;
    }),
  department: z
    .string()
    .trim()
    .max(120, 'Department identifier cannot exceed 120 characters')
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val && val.length > 0 ? val : null;
    }),
  reason: z
    .string()
    .trim()
    .min(10, 'Governance justification must be at least 10 characters')
    .max(500, 'Governance justification cannot exceed 500 characters'),
});

export interface IamUpdateRoleInput {
  role: 'student' | 'faculty' | 'admin' | 'super_admin';
  adminSubRole?: AdminSubRole | null;
  department?: string | null;
  reason: string;
}

/**
 * Schema for IAM account lifecycle status mutations (active, suspended, deactivated).
 * Requires mandatory governance justification (10–500 characters).
 */
export const iamUpdateStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'deactivated']),
  reason: z
    .string()
    .trim()
    .min(10, 'Governance justification must be at least 10 characters')
    .max(500, 'Governance justification cannot exceed 500 characters'),
});

export type IamUpdateStatusInput = z.infer<typeof iamUpdateStatusSchema>;

/**
 * Query parameters for the IAM Governed User Directory.
 */
export const iamUserQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.enum(['student', 'faculty', 'admin', 'super_admin']).optional(),
  status: z
    .enum([
      'pending_verification',
      'active',
      'suspended',
      'deactivated',
      'graduated',
      'invited',
      'archived',
    ])
    .optional(),
  department: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type IamUserQueryParams = z.infer<typeof iamUserQuerySchema>;
