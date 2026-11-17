/**
 * Zod Validation Schemas for Unified In-App Notification Center & Preferences (MOD-17 / Phase 5.13).
 * Enforces relative internal link safety (open-redirect defense), non-mutable emergency alerts,
 * and contextual broadcast targeting rules.
 */

import { z } from 'zod';
import { objectIdSchema } from './common-schemas';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_BROADCAST_SCOPES,
} from '@/types/notification';

export const notificationCategoryEnum = z.enum(NOTIFICATION_CATEGORIES);
export const notificationPriorityEnum = z.enum(NOTIFICATION_PRIORITIES);
export const notificationBroadcastScopeEnum = z.enum(NOTIFICATION_BROADCAST_SCOPES);

/**
 * Validates that a notification deep-link is strictly a safe relative internal path
 * starting with '/' and not '//' or '\\' (blocks open redirects and javascript: URIs).
 */
export function isSafeInternalLinkUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.includes('\\')) return false;
  if (/^\/?\s*javascript:/i.test(trimmed)) return false;
  return true;
}

export const safeInternalLinkSchema = z
  .string()
  .trim()
  .max(300, 'Link URL cannot exceed 300 characters')
  .refine(isSafeInternalLinkUrl, {
    message: 'linkUrl must be a safe relative internal path starting with "/" (e.g., "/student/requests")',
  });

/**
 * Query parameters for personal notification inbox listing.
 */
export const notificationQuerySchema = z.object({
  category: notificationCategoryEnum.optional(),
  isRead: z.enum(['true', 'false', 'all']).optional().default('all'),
  priority: notificationPriorityEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type NotificationQueryParams = z.infer<typeof notificationQuerySchema>;

/**
 * Schema for updating personal notification preferences.
 * Explicitly rejects any attempt to mute 'emergency' notifications.
 */
export const updateNotificationPreferencesSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  categories: z
    .object({
      assignment: z.boolean().optional(),
      service_request: z.boolean().optional(),
      facility_booking: z.boolean().optional(),
      passport: z.boolean().optional(),
      complaint: z.boolean().optional(),
      notice: z.boolean().optional(),
      poll: z.boolean().optional(),
      chat: z.boolean().optional(),
      system: z.boolean().optional(),
      emergency: z
        .boolean()
        .optional()
        .refine((val) => val !== false, {
          message: 'Emergency campus alerts cannot be muted or disabled.',
        }),
    })
    .optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

/**
 * Schema for mark-all-read endpoint (optional category filter).
 */
export const markAllReadSchema = z.object({
  category: notificationCategoryEnum.optional(),
});

/**
 * Schema for targeted ad-hoc alert broadcast (PERMISSIONS.ALERTS_DISPATCH).
 */
export const broadcastNotificationSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Alert title must be at least 3 characters')
      .max(140, 'Alert title cannot exceed 140 characters'),
    message: z
      .string()
      .trim()
      .min(5, 'Alert message must be at least 5 characters')
      .max(600, 'Alert message cannot exceed 600 characters'),
    category: notificationCategoryEnum.optional().default('system'),
    priority: z.enum(['normal', 'high', 'urgent']).optional().default('normal'),
    linkUrl: safeInternalLinkSchema
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
    targetScope: notificationBroadcastScopeEnum,
    targetRoles: z
      .array(z.enum(['student', 'faculty', 'admin', 'super_admin']))
      .optional()
      .default([]),
    targetDepartment: z.string().trim().max(120).optional().nullable(),
    recipientUserIds: z.array(objectIdSchema).max(200).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.targetScope === 'by_role' && (!data.targetRoles || data.targetRoles.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one target role is required when targetScope is by_role',
        path: ['targetRoles'],
      });
    }

    if (
      data.targetScope === 'by_department' &&
      (!data.targetDepartment || data.targetDepartment.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'targetDepartment is required when targetScope is by_department',
        path: ['targetDepartment'],
      });
    }

    if (
      data.targetScope === 'specific_users' &&
      (!data.recipientUserIds || data.recipientUserIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one recipientUserId is required when targetScope is specific_users',
        path: ['recipientUserIds'],
      });
    }
  });

export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
