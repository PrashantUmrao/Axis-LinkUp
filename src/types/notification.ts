/**
 * Domain Type Definitions for Unified In-App Notification Center & Preferences (MOD-17 / Phase 5.13).
 * Strictly excludes any Academic Calendar categories.
 */

import type { Document, Types } from 'mongoose';

export const NOTIFICATION_CATEGORIES = [
  'assignment',
  'service_request',
  'facility_booking',
  'passport',
  'complaint',
  'notice',
  'poll',
  'chat',
  'emergency',
  'system',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * Categories that users are permitted to toggle in preferences.
 * 'emergency' is strictly non-mutable and always delivered.
 */
export const MUTABLE_NOTIFICATION_CATEGORIES = [
  'assignment',
  'service_request',
  'facility_booking',
  'passport',
  'complaint',
  'notice',
  'poll',
  'chat',
  'system',
] as const;

export type MutableNotificationCategory = (typeof MUTABLE_NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_BROADCAST_SCOPES = [
  'all_users',
  'by_role',
  'by_department',
  'specific_users',
] as const;

export type NotificationBroadcastScope = (typeof NOTIFICATION_BROADCAST_SCOPES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  assignment: 'Assignments & Grading',
  service_request: 'Service Requests',
  facility_booking: 'Facility Bookings',
  passport: 'Skill Passport',
  complaint: 'Complaints & Redressal',
  notice: 'Campus Notices',
  poll: 'Campus Polls',
  chat: 'Messages & Groups',
  emergency: 'Emergency Alerts',
  system: 'System & Announcements',
};

/**
 * Mongoose Document interface for a persisted In-App Notification (90-day TTL retention).
 */
export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  linkUrl?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: Date | null;
  isArchived: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client-safe Notification Data Transfer Object.
 */
export interface NotificationDTO {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  linkUrl: string | null;
  dedupeKey: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  isArchived: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Per-category user notification toggles.
 */
export interface NotificationCategoryPreferences {
  assignment: boolean;
  service_request: boolean;
  facility_booking: boolean;
  passport: boolean;
  complaint: boolean;
  notice: boolean;
  poll: boolean;
  chat: boolean;
  system: boolean;
  emergency: true; // Always forced true — cannot be disabled
}

/**
 * Mongoose Document interface for user notification preferences (1 per user).
 */
export interface INotificationPreference extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
  categories: {
    assignment: boolean;
    service_request: boolean;
    facility_booking: boolean;
    passport: boolean;
    complaint: boolean;
    notice: boolean;
    poll: boolean;
    chat: boolean;
    system: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client-safe Notification Preference DTO.
 */
export interface NotificationPreferenceDTO {
  id: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
  categories: NotificationCategoryPreferences;
  updatedAt: string;
}

/**
 * Fast summary payload for the Topbar Notification Bell.
 */
export interface NotificationUnreadSummaryDTO {
  unreadCount: number;
  byCategory: Partial<Record<NotificationCategory, number>>;
  recent: NotificationDTO[];
}

/**
 * Paginated personal notification inbox payload.
 */
export interface PaginatedNotificationsDTO {
  notifications: NotificationDTO[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Dispatch result returned by NotificationService.dispatch().
 */
export interface NotificationDispatchResult {
  skipped: boolean;
  reason?: 'muted_by_preference' | 'debounced_duplicate';
  notification?: NotificationDTO;
}

/**
 * Targeted ad-hoc broadcast execution result.
 */
export interface NotificationBroadcastResultDTO {
  recipientCount: number;
  dispatchedCount: number;
  skippedCount: number;
  targetScope: NotificationBroadcastScope;
}
