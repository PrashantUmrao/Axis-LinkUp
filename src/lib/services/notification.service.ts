/**
 * Unified Notification Service (MOD-17 / Phase 5.13).
 * Handles cross-module notification dispatch, 60-second deduplication,
 * user category preferences (with unmutable emergency override),
 * personal inbox CRUD, and RBAC-scoped ad-hoc alert broadcasts.
 */

import { Types } from 'mongoose';
import { NotificationRepository } from '@/lib/db/repositories/notification.repository';
import { NotificationPreferenceRepository } from '@/lib/db/repositories/notification-preference.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import {
  toNotificationDTO,
  NOTIFICATION_RETENTION_MS,
} from '@/lib/db/models/notification.model';
import { toNotificationPreferenceDTO } from '@/lib/db/models/notification-preference.model';
import { AuditService } from '@/lib/services/audit.service';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getPermissionScope } from '@/lib/auth/rbac';
import {
  broadcastNotificationSchema,
  isSafeInternalLinkUrl,
  updateNotificationPreferencesSchema,
  type NotificationQueryParams,
} from '@/lib/validations/notification.schema';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/app-error';
import type { UserSession } from '@/types/user';
import type {
  MutableNotificationCategory,
  NotificationBroadcastResultDTO,
  NotificationCategory,
  NotificationDispatchResult,
  NotificationDTO,
  NotificationPreferenceDTO,
  NotificationPriority,
  NotificationUnreadSummaryDTO,
  PaginatedNotificationsDTO,
} from '@/types/notification';

export const NOTIFICATION_DEDUPE_WINDOW_MS = 60_000; // 60 seconds

export interface DispatchNotificationInput {
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  linkUrl?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class NotificationService {
  /**
   * Dispatches a single persisted in-app notification with preference checking,
   * 60-second deduplication, relative link validation, 90-day TTL, and Ably push.
   */
  public static async dispatch(
    input: DispatchNotificationInput
  ): Promise<NotificationDispatchResult> {
    if (input.linkUrl && !isSafeInternalLinkUrl(input.linkUrl)) {
      throw new ValidationError(
        'Unsafe notification linkUrl rejected. Only relative internal paths starting with "/" are allowed.'
      );
    }

    // 1. Check user preferences (Emergency category ALWAYS bypasses mute preferences)
    if (input.category !== 'emergency') {
      const pref = await NotificationPreferenceRepository.findByUserId(input.userId);
      if (pref) {
        if (!pref.inAppEnabled) {
          return { skipped: true, reason: 'muted_by_preference' };
        }
        const catKey = input.category as MutableNotificationCategory;
        if (pref.categories && pref.categories[catKey] === false) {
          return { skipped: true, reason: 'muted_by_preference' };
        }
      }
    }

    // 2. 60-Second Deduplication Guard
    if (input.dedupeKey && input.dedupeKey.trim()) {
      const existingDup = await NotificationRepository.findRecentDuplicate(
        input.userId,
        input.dedupeKey,
        NOTIFICATION_DEDUPE_WINDOW_MS
      );
      if (existingDup) {
        return { skipped: true, reason: 'debounced_duplicate' };
      }
    }

    // 3. Persist notification with 90-day TTL
    const expiresAt = new Date(Date.now() + NOTIFICATION_RETENTION_MS);
    const created = await NotificationRepository.create({
      userId: new Types.ObjectId(input.userId),
      title: input.title.trim(),
      message: input.message.trim(),
      category: input.category,
      priority: input.priority || (input.category === 'emergency' ? 'urgent' : 'normal'),
      linkUrl: input.linkUrl ? input.linkUrl.trim() : null,
      dedupeKey: input.dedupeKey ? input.dedupeKey.trim() : null,
      metadata: input.metadata ?? null,
      isRead: false,
      readAt: null,
      isArchived: false,
      expiresAt,
    });

    const dto = toNotificationDTO(created);

    // 4. Real-time push to user:<userId>:notifications via Ably (non-blocking)
    try {
      const channel = AblyBroker.getUserNotificationChannel(input.userId);
      await AblyBroker.publish(channel, 'notification.created', {
        notification: dto,
      });
    } catch {
      // Non-blocking realtime delivery
    }

    return { skipped: false, notification: dto };
  }

  /**
   * Safe fire-and-forget cross-module dispatch hook.
   * Never throws and safely skips persistence when MONGODB_URI is absent (e.g., isolated unit tests).
   */
  public static async safeDispatchCrossModule(input: DispatchNotificationInput): Promise<void> {
    if (!process.env.MONGODB_URI) return;
    try {
      await this.dispatch(input);
    } catch {
      // Non-blocking side effect
    }
  }

  /**
   * Lists paginated personal notifications strictly owned by session.userId.
   */
  public static async listUserNotifications(
    session: UserSession,
    query: Partial<NotificationQueryParams> = {}
  ): Promise<PaginatedNotificationsDTO> {
    const filter: Record<string, unknown> = {};

    if (query.category) filter.category = query.category;
    if (query.priority) filter.priority = query.priority;
    if (query.isRead === 'true') filter.isRead = true;
    else if (query.isRead === 'false') filter.isRead = false;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [{ notifications, total }, unreadCount] = await Promise.all([
      NotificationRepository.findByUser(session.userId, filter, page, limit),
      NotificationRepository.countUnread(session.userId),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      notifications: notifications.map(toNotificationDTO),
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Returns fast Topbar bell summary (total unread, per-category counts, latest 5 unread).
   */
  public static async getUnreadSummary(
    session: UserSession
  ): Promise<NotificationUnreadSummaryDTO> {
    const summary = await NotificationRepository.getUnreadBreakdownAndRecent(session.userId, 5);
    return {
      unreadCount: summary.unreadCount,
      byCategory: summary.byCategory,
      recent: summary.recent.map(toNotificationDTO),
    };
  }

  /**
   * Marks a single notification owned by the caller as read.
   * Throws 403 on cross-user access attempts and 404 if missing.
   */
  public static async markNotificationRead(
    session: UserSession,
    id: string
  ): Promise<NotificationDTO> {
    const existing = await NotificationRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Notification', id);
    }

    if (existing.userId.toString() !== session.userId) {
      throw new ForbiddenError('You can only mark your own notifications as read.');
    }

    const updated = await NotificationRepository.markAsRead(id, session.userId);
    if (!updated) {
      throw new NotFoundError('Notification', id);
    }

    return toNotificationDTO(updated);
  }

  /**
   * Marks all unread notifications (or a specific category) as read for the caller.
   */
  public static async markAllRead(
    session: UserSession,
    category?: NotificationCategory
  ): Promise<{ modifiedCount: number }> {
    const modifiedCount = await NotificationRepository.markAllAsRead(session.userId, category);
    return { modifiedCount };
  }

  /**
   * Archives/dismisses a single notification owned by the caller.
   */
  public static async archiveNotification(
    session: UserSession,
    id: string
  ): Promise<{ archived: true; id: string }> {
    const existing = await NotificationRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Notification', id);
    }

    if (existing.userId.toString() !== session.userId) {
      throw new ForbiddenError('You can only archive your own notifications.');
    }

    await NotificationRepository.archiveNotification(id, session.userId);
    return { archived: true, id };
  }

  /**
   * Retrieves the caller's notification preferences (returning safe defaults if unset).
   */
  public static async getPreferences(session: UserSession): Promise<NotificationPreferenceDTO> {
    const existing = await NotificationPreferenceRepository.findByUserId(session.userId);
    if (existing) {
      return toNotificationPreferenceDTO(existing);
    }

    return {
      id: 'default',
      userId: session.userId,
      inAppEnabled: true,
      emailEnabled: true,
      soundEnabled: false,
      categories: {
        assignment: true,
        service_request: true,
        facility_booking: true,
        passport: true,
        complaint: true,
        notice: true,
        poll: true,
        chat: true,
        system: true,
        emergency: true,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Updates the caller's notification preferences, keeping 'emergency' permanently locked ON.
   */
  public static async updatePreferences(
    session: UserSession,
    rawInput: unknown
  ): Promise<NotificationPreferenceDTO> {
    const parsed = updateNotificationPreferencesSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError('Invalid notification preferences payload', parsed.error.flatten());
    }

    const updated = await NotificationPreferenceRepository.upsertByUserId(session.userId, {
      inAppEnabled: parsed.data.inAppEnabled,
      emailEnabled: parsed.data.emailEnabled,
      soundEnabled: parsed.data.soundEnabled,
      categories: parsed.data.categories,
    });

    return toNotificationPreferenceDTO(updated);
  }

  /**
   * Dispatches a targeted ad-hoc alert broadcast respecting PERMISSIONS.ALERTS_DISPATCH.
   * - student: 403 DENY
   * - faculty: OWN (specific_users or own department only)
   * - admin: DEPT (own department or specific_users in dept; blocks all_users)
   * - super_admin: ALLOW (all scopes)
   */
  public static async broadcastAlert(
    session: UserSession,
    rawInput: unknown
  ): Promise<NotificationBroadcastResultDTO> {
    const scope = getPermissionScope(session.role, PERMISSIONS.ALERTS_DISPATCH);
    if (scope === 'DENY') {
      throw new ForbiddenError(
        'Access denied. Students are not permitted to dispatch campus alert broadcasts.'
      );
    }

    const parsed = broadcastNotificationSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError('Invalid broadcast alert payload', parsed.error.flatten());
    }
    const data = parsed.data;

    // Enforce RBAC targeting scope boundaries
    if (session.role !== 'super_admin') {
      if (data.targetScope === 'all_users' || data.targetScope === 'by_role') {
        throw new ForbiddenError(
          'Campus-wide or institution role broadcasts are restricted strictly to Super Administrators.'
        );
      }

      if (data.targetScope === 'by_department') {
        if (!session.departmentId) {
          throw new ForbiddenError('Your account is not bound to a department for department broadcasts.');
        }
        const ownDept = await DepartmentRepository.findById(session.departmentId);
        const requested = (data.targetDepartment || '').trim().toLowerCase();
        const matchesOwn =
          ownDept &&
          (requested === ownDept._id.toString().toLowerCase() ||
            requested === ownDept.code.toLowerCase() ||
            requested === ownDept.name.toLowerCase());

        if (!matchesOwn) {
          throw new ForbiddenError(
            'Departmental isolation: you may only dispatch broadcasts to your own assigned department.'
          );
        }
      }
    }

    // Resolve recipient user IDs
    let recipientIds: string[] = [];

    if (data.targetScope === 'specific_users') {
      recipientIds = Array.from(new Set(data.recipientUserIds));
    } else if (data.targetScope === 'by_department') {
      const dept = data.targetDepartment
        ? await DepartmentRepository.findActiveByIdOrCode(data.targetDepartment)
        : null;
      const targetDeptId = dept ? dept._id.toString() : session.departmentId;
      if (targetDeptId) {
        const deptUsers = await UserRepository.findByDepartment(targetDeptId);
        recipientIds = deptUsers
          .filter((u) => u.status === 'active')
          .map((u) => u._id.toString());
      }
    } else if (data.targetScope === 'by_role') {
      const { users } = await UserRepository.findGovernedUsers(
        { status: 'active', role: { $in: data.targetRoles } },
        1,
        100
      );
      recipientIds = users.map((u) => u._id.toString());
    } else if (data.targetScope === 'all_users') {
      const { users } = await UserRepository.findGovernedUsers({ status: 'active' }, 1, 100);
      recipientIds = users.map((u) => u._id.toString());
    }

    let dispatchedCount = 0;
    let skippedCount = 0;
    const dedupeBase = `broadcast:${session.userId}:${data.title.toLowerCase().slice(0, 40)}`;

    for (const userId of recipientIds) {
      const res = await this.dispatch({
        userId,
        title: data.title,
        message: data.message,
        category: data.category,
        priority: data.priority,
        linkUrl: data.linkUrl ?? null,
        dedupeKey: `${dedupeBase}:${userId}`,
        metadata: {
          broadcastBy: session.userId,
          targetScope: data.targetScope,
        },
      });
      if (res.skipped) skippedCount += 1;
      else dispatchedCount += 1;
    }

    // Record immutable audit trail (non-blocking)
    try {
      await AuditService.recordEvent({
        actorId: session.userId,
        actorSnapshot: {
          fullName: session.fullName || 'Institutional Dispatcher',
          email: session.email,
          role: session.role,
          department: null,
        },
        action: 'SECURITY_POLICY_EVENT',
        module: 'NOTICES',
        severity: data.priority === 'urgent' ? 'high' : 'info',
        targetEntityType: 'NotificationBroadcast',
        targetEntityId: session.userId,
        targetLabel: `${data.title} (${recipientIds.length} recipients)`,
        newState: {
          targetScope: data.targetScope,
          category: data.category,
          priority: data.priority,
          dispatchedCount,
          skippedCount,
        },
        reason: `Dispatched targeted alert broadcast: ${data.title}`,
      });
    } catch {
      // Non-blocking audit hook
    }

    return {
      recipientCount: recipientIds.length,
      dispatchedCount,
      skippedCount,
      targetScope: data.targetScope,
    };
  }
}
