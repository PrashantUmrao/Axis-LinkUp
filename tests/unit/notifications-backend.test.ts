/**
 * Phase 5.13 Backend Verification Suite: Unified In-App Notification Center & Preferences (MOD-17).
 * Covers:
 * - 60-second deduplication window
 * - Category & global preference enforcement + unmutable emergency override
 * - Open-redirect linkUrl sanitization
 * - Strict personal ownership isolation & RBAC broadcast scoping (PERMISSIONS.ALERTS_DISPATCH)
 * - End-to-end Next.js REST API route handler checks across all 7 endpoints
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

import { NotificationService } from '@/lib/services/notification.service';
import { NotificationRepository } from '@/lib/db/repositories/notification.repository';
import { NotificationPreferenceRepository } from '@/lib/db/repositories/notification-preference.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { AuditService } from '@/lib/services/audit.service';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { __setTestSession } from '@/lib/auth/server';
import {
  isSafeInternalLinkUrl,
  updateNotificationPreferencesSchema,
  broadcastNotificationSchema,
} from '@/lib/validations/notification.schema';
import { NOTIFICATION_CATEGORIES } from '@/types/notification';
import type { UserSession } from '@/types/user';
import type { INotification, INotificationPreference } from '@/types/notification';

import { GET as getNotificationsRoute } from '@/app/api/v1/notifications/route';
import { GET as getUnreadSummaryRoute } from '@/app/api/v1/notifications/unread-summary/route';
import { PATCH as markReadRoute } from '@/app/api/v1/notifications/[id]/read/route';
import { POST as markAllReadRoute } from '@/app/api/v1/notifications/read-all/route';
import { DELETE as archiveRoute } from '@/app/api/v1/notifications/[id]/route';
import {
  GET as getPreferencesRoute,
  PATCH as patchPreferencesRoute,
} from '@/app/api/v1/notifications/preferences/route';
import { POST as broadcastRoute } from '@/app/api/v1/notifications/broadcast/route';

const STUDENT_A_ID = new Types.ObjectId().toString();
const STUDENT_B_ID = new Types.ObjectId().toString();
const FACULTY_ID = new Types.ObjectId().toString();
const ADMIN_ID = new Types.ObjectId().toString();
const SUPER_ADMIN_ID = new Types.ObjectId().toString();
const CSE_DEPT_ID = new Types.ObjectId().toString();
const ECE_DEPT_ID = new Types.ObjectId().toString();

const studentASession: UserSession = {
  userId: STUDENT_A_ID,
  authProviderId: 'clerk_stu_a',
  email: 'student.a@axiscolleges.in',
  fullName: 'Aarav Verma',
  role: 'student',
  status: 'active',
  departmentId: CSE_DEPT_ID,
};

const studentBSession: UserSession = {
  userId: STUDENT_B_ID,
  authProviderId: 'clerk_stu_b',
  email: 'student.b@axiscolleges.in',
  fullName: 'Diya Sharma',
  role: 'student',
  status: 'active',
  departmentId: CSE_DEPT_ID,
};

const facultySession: UserSession = {
  userId: FACULTY_ID,
  authProviderId: 'clerk_fac',
  email: 'faculty@axiscolleges.in',
  fullName: 'Prof. Rakesh Singh',
  role: 'faculty',
  status: 'active',
  departmentId: CSE_DEPT_ID,
};

const adminSession: UserSession = {
  userId: ADMIN_ID,
  authProviderId: 'clerk_adm',
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. Kavita Rao',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: CSE_DEPT_ID,
};

const superAdminSession: UserSession = {
  userId: SUPER_ADMIN_ID,
  authProviderId: 'clerk_sa',
  email: 'director@axiscolleges.in',
  fullName: 'Dr. Vikram Mehta',
  role: 'super_admin',
  status: 'active',
};

describe('Phase 5.13 — Unified Notification Center Backend & API', () => {
  // Original repository/service methods saved for restoration
  const origNotificationRepo = { ...NotificationRepository };
  const origPrefRepo = { ...NotificationPreferenceRepository };
  const origUserRepo = { ...UserRepository };
  const origDeptRepo = { ...DepartmentRepository };
  const origAuditRecord = AuditService.recordEvent;
  const origAblyPublish = AblyBroker.publish;

  let notifStore: INotification[] = [];
  let prefStore: Map<string, INotificationPreference> = new Map();
  let publishedAblyEvents: Array<{ channel: string; event: string }> = [];
  let auditEventsCount = 0;

  beforeEach(() => {
    notifStore = [];
    prefStore = new Map();
    publishedAblyEvents = [];
    auditEventsCount = 0;
    __setTestSession(undefined);

    NotificationRepository.create = async (data) => {
      const now = new Date();
      const doc = {
        _id: new Types.ObjectId(),
        userId: data.userId as Types.ObjectId,
        title: data.title || '',
        message: data.message || '',
        category: data.category || 'system',
        priority: data.priority || 'normal',
        linkUrl: data.linkUrl ?? null,
        dedupeKey: data.dedupeKey ?? null,
        metadata: data.metadata ?? null,
        isRead: Boolean(data.isRead),
        readAt: data.readAt ?? null,
        isArchived: Boolean(data.isArchived),
        expiresAt: data.expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      } as unknown as INotification;
      notifStore.push(doc);
      return doc;
    };

    NotificationRepository.findRecentDuplicate = async (userId, dedupeKey, windowMs = 60_000) => {
      const cutoff = Date.now() - windowMs;
      return (
        notifStore.find(
          (n) =>
            n.userId.toString() === userId.toString() &&
            n.dedupeKey === dedupeKey &&
            n.createdAt.getTime() >= cutoff
        ) ?? null
      );
    };

    NotificationRepository.findById = async (id) => {
      return notifStore.find((n) => n._id.toString() === id) ?? null;
    };

    NotificationRepository.findByUser = async (userId, filter = {}, page = 1, limit = 20) => {
      let filtered = notifStore.filter(
        (n) => n.userId.toString() === userId && !n.isArchived
      );
      if (filter.category) {
        filtered = filtered.filter((n) => n.category === filter.category);
      }
      if (filter.priority) {
        filtered = filtered.filter((n) => n.priority === filter.priority);
      }
      if (typeof filter.isRead === 'boolean') {
        filtered = filtered.filter((n) => n.isRead === filter.isRead);
      }
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const start = (page - 1) * limit;
      return {
        notifications: filtered.slice(start, start + limit),
        total: filtered.length,
      };
    };

    NotificationRepository.countUnread = async (userId) => {
      return notifStore.filter(
        (n) => n.userId.toString() === userId && !n.isArchived && !n.isRead
      ).length;
    };

    NotificationRepository.getUnreadBreakdownAndRecent = async (userId, recentLimit = 5) => {
      const unread = notifStore
        .filter((n) => n.userId.toString() === userId && !n.isArchived && !n.isRead)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const byCategory: Partial<Record<INotification['category'], number>> = {};
      for (const item of unread) {
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      }
      return {
        unreadCount: unread.length,
        byCategory,
        recent: unread.slice(0, recentLimit),
      };
    };

    NotificationRepository.markAsRead = async (id, userId) => {
      const target = notifStore.find(
        (n) => n._id.toString() === id && n.userId.toString() === userId
      );
      if (!target) return null;
      target.isRead = true;
      target.readAt = new Date();
      return target;
    };

    NotificationRepository.markAllAsRead = async (userId, category) => {
      let modified = 0;
      for (const n of notifStore) {
        if (
          n.userId.toString() === userId &&
          !n.isArchived &&
          !n.isRead &&
          (!category || n.category === category)
        ) {
          n.isRead = true;
          n.readAt = new Date();
          modified += 1;
        }
      }
      return modified;
    };

    NotificationRepository.archiveNotification = async (id, userId) => {
      const target = notifStore.find(
        (n) => n._id.toString() === id && n.userId.toString() === userId
      );
      if (!target) return null;
      target.isArchived = true;
      return target;
    };

    NotificationPreferenceRepository.findByUserId = async (userId) => {
      return prefStore.get(userId.toString()) ?? null;
    };

    NotificationPreferenceRepository.upsertByUserId = async (userId, update) => {
      const uid = userId.toString();
      const existing = prefStore.get(uid);
      const now = new Date();
      const mergedCategories = {
        assignment: existing?.categories.assignment ?? true,
        service_request: existing?.categories.service_request ?? true,
        facility_booking: existing?.categories.facility_booking ?? true,
        passport: existing?.categories.passport ?? true,
        complaint: existing?.categories.complaint ?? true,
        notice: existing?.categories.notice ?? true,
        poll: existing?.categories.poll ?? true,
        chat: existing?.categories.chat ?? true,
        system: existing?.categories.system ?? true,
        ...(update.categories || {}),
        emergency: true as const,
      };

      const doc = {
        _id: existing?._id || new Types.ObjectId(),
        userId: new Types.ObjectId(uid),
        inAppEnabled: update.inAppEnabled ?? existing?.inAppEnabled ?? true,
        emailEnabled: update.emailEnabled ?? existing?.emailEnabled ?? true,
        soundEnabled: update.soundEnabled ?? existing?.soundEnabled ?? false,
        categories: mergedCategories,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      } as unknown as INotificationPreference;
      prefStore.set(uid, doc);
      return doc;
    };

    DepartmentRepository.findById = async (id) => {
      if (id === CSE_DEPT_ID) {
        return {
          _id: new Types.ObjectId(CSE_DEPT_ID),
          name: 'Computer Science & Engineering',
          code: 'CSE',
        } as never;
      }
      if (id === ECE_DEPT_ID) {
        return {
          _id: new Types.ObjectId(ECE_DEPT_ID),
          name: 'Electronics & Communication Engineering',
          code: 'ECE',
        } as never;
      }
      return null;
    };

    DepartmentRepository.findActiveByIdOrCode = async (identifier) => {
      const norm = identifier.toUpperCase();
      if (identifier === CSE_DEPT_ID || norm === 'CSE') {
        return {
          _id: new Types.ObjectId(CSE_DEPT_ID),
          name: 'Computer Science & Engineering',
          code: 'CSE',
        } as never;
      }
      if (identifier === ECE_DEPT_ID || norm === 'ECE') {
        return {
          _id: new Types.ObjectId(ECE_DEPT_ID),
          name: 'Electronics & Communication Engineering',
          code: 'ECE',
        } as never;
      }
      return null;
    };

    UserRepository.findByDepartment = async (deptId) => {
      if (deptId === CSE_DEPT_ID) {
        return [
          { _id: new Types.ObjectId(STUDENT_A_ID), status: 'active' },
          { _id: new Types.ObjectId(STUDENT_B_ID), status: 'active' },
        ] as never;
      }
      return [] as never;
    };

    UserRepository.findGovernedUsers = async () => {
      return {
        users: [
          { _id: new Types.ObjectId(STUDENT_A_ID), status: 'active', role: 'student' },
          { _id: new Types.ObjectId(STUDENT_B_ID), status: 'active', role: 'student' },
          { _id: new Types.ObjectId(FACULTY_ID), status: 'active', role: 'faculty' },
        ] as never,
        total: 3,
      };
    };

    AuditService.recordEvent = async () => {
      auditEventsCount += 1;
      return {} as never;
    };

    AblyBroker.publish = async (channel, event) => {
      publishedAblyEvents.push({ channel, event });
      return { published: true, channel, eventName: event, provider: 'mock' };
    };
  });

  afterEach(() => {
    Object.assign(NotificationRepository, origNotificationRepo);
    Object.assign(NotificationPreferenceRepository, origPrefRepo);
    Object.assign(UserRepository, origUserRepo);
    Object.assign(DepartmentRepository, origDeptRepo);
    AuditService.recordEvent = origAuditRecord;
    AblyBroker.publish = origAblyPublish;
    __setTestSession(undefined);
  });

  it('strictly excludes any Academic Calendar notification category', () => {
    assert.ok(!(NOTIFICATION_CATEGORIES as readonly string[]).includes('calendar'));
    assert.ok(!(NOTIFICATION_CATEGORIES as readonly string[]).includes('academic_calendar'));
    assert.equal(NOTIFICATION_CATEGORIES.length, 10);
  });

  it('enforces 60-second deduplication when identical dedupeKey is dispatched twice', async () => {
    const first = await NotificationService.dispatch({
      userId: STUDENT_A_ID,
      title: 'Assignment Graded',
      message: 'Your Data Structures Lab 3 submission has been graded.',
      category: 'assignment',
      linkUrl: '/student/assignments',
      dedupeKey: 'assign-grade:123',
    });

    const second = await NotificationService.dispatch({
      userId: STUDENT_A_ID,
      title: 'Assignment Graded',
      message: 'Duplicate trigger within 60 seconds.',
      category: 'assignment',
      linkUrl: '/student/assignments',
      dedupeKey: 'assign-grade:123',
    });

    assert.equal(first.skipped, false);
    assert.ok(first.notification);
    assert.equal(second.skipped, true);
    assert.equal(second.reason, 'debounced_duplicate');
    assert.equal(notifStore.length, 1);
    assert.equal(publishedAblyEvents.length, 1);
    assert.equal(publishedAblyEvents[0]?.channel, `user:${STUDENT_A_ID}:notifications`);
    assert.equal(publishedAblyEvents[0]?.event, 'notification.created');
  });

  it('respects muted categories while ALWAYS delivering emergency notifications', async () => {
    await NotificationService.updatePreferences(studentASession, {
      inAppEnabled: false,
      categories: { assignment: false, notice: false },
    });

    const mutedResult = await NotificationService.dispatch({
      userId: STUDENT_A_ID,
      title: 'New Homework',
      message: 'Should be skipped because inAppEnabled and assignment are disabled.',
      category: 'assignment',
    });

    assert.equal(mutedResult.skipped, true);
    assert.equal(mutedResult.reason, 'muted_by_preference');
    assert.equal(notifStore.length, 0);

    // Emergency notification MUST bypass inAppEnabled=false and always persist
    const emergencyResult = await NotificationService.dispatch({
      userId: STUDENT_A_ID,
      title: 'Campus Severe Weather Directive',
      message: 'Immediate evacuation to designated indoor zones.',
      category: 'emergency',
      priority: 'urgent',
    });

    assert.equal(emergencyResult.skipped, false);
    assert.equal(emergencyResult.notification?.category, 'emergency');
    assert.equal(emergencyResult.notification?.priority, 'urgent');
    assert.equal(notifStore.length, 1);
  });

  it('rejects any attempt to mute emergency alerts via validation schema or service', async () => {
    const schemaRes = updateNotificationPreferencesSchema.safeParse({
      categories: { emergency: false },
    });
    assert.equal(schemaRes.success, false);

    await assert.rejects(
      () =>
        NotificationService.updatePreferences(studentASession, {
          categories: { emergency: false },
        }),
      /Invalid notification preferences payload/
    );
  });

  it('blocks open-redirect and javascript: linkUrl payloads while allowing relative paths', async () => {
    assert.equal(isSafeInternalLinkUrl('/student/requests'), true);
    assert.equal(isSafeInternalLinkUrl('/shared/notifications?tab=inbox'), true);
    assert.equal(isSafeInternalLinkUrl('https://evil.com/phish'), false);
    assert.equal(isSafeInternalLinkUrl('//evil.com/phish'), false);
    assert.equal(isSafeInternalLinkUrl('javascript:alert(1)'), false);
    assert.equal(isSafeInternalLinkUrl('/\\evil.com'), false);

    await assert.rejects(
      () =>
        NotificationService.dispatch({
          userId: STUDENT_A_ID,
          title: 'Malicious Link',
          message: 'Trying external redirect',
          category: 'system',
          linkUrl: 'https://evil.com/steal',
        }),
      /Unsafe notification linkUrl/
    );

    const parsed = broadcastNotificationSchema.safeParse({
      title: 'Valid Title',
      message: 'Valid broadcast body message.',
      targetScope: 'all_users',
      linkUrl: '//evil.example',
    });
    assert.equal(parsed.success, false);
  });

  it('enforces strict personal ownership isolation on mark-read and archive', async () => {
    const dispatched = await NotificationService.dispatch({
      userId: STUDENT_A_ID,
      title: 'Bonafide Certificate Ready',
      message: 'Download your signed PDF certificate.',
      category: 'service_request',
      linkUrl: '/student/requests',
    });
    const notifId = dispatched.notification!.id;

    // Student B cannot mark Student A's notification as read or archive it
    await assert.rejects(
      () => NotificationService.markNotificationRead(studentBSession, notifId),
      /only mark your own notifications/
    );

    await assert.rejects(
      () => NotificationService.archiveNotification(studentBSession, notifId),
      /only archive your own notifications/
    );

    // Student A can mark read & archive their own notification
    const marked = await NotificationService.markNotificationRead(studentASession, notifId);
    assert.equal(marked.isRead, true);

    const archived = await NotificationService.archiveNotification(studentASession, notifId);
    assert.equal(archived.archived, true);
  });

  it('enforces PERMISSIONS.ALERTS_DISPATCH RBAC scopes across student, faculty, admin, and super_admin', async () => {
    // Student strictly denied (403)
    await assert.rejects(
      () =>
        NotificationService.broadcastAlert(studentASession, {
          title: 'Unauthorized Alert',
          message: 'Students must never broadcast alerts.',
          targetScope: 'all_users',
        }),
      /Students are not permitted/
    );

    // Admin blocked from all_users
    await assert.rejects(
      () =>
        NotificationService.broadcastAlert(adminSession, {
          title: 'Campus Wide Attempt',
          message: 'Department admin attempting campus wide broadcast.',
          targetScope: 'all_users',
        }),
      /restricted strictly to Super Administrators/
    );

    // Admin blocked from foreign department (ECE)
    await assert.rejects(
      () =>
        NotificationService.broadcastAlert(adminSession, {
          title: 'Foreign Dept Attempt',
          message: 'CSE HOD attempting to target ECE department.',
          targetScope: 'by_department',
          targetDepartment: ECE_DEPT_ID,
        }),
      /Departmental isolation/
    );

    // Admin allowed for own department (CSE)
    const deptBroadcast = await NotificationService.broadcastAlert(adminSession, {
      title: 'CSE Lab Maintenance',
      message: 'Networking Lab 2 will undergo maintenance at 4 PM.',
      category: 'facility_booking',
      priority: 'high',
      targetScope: 'by_department',
      targetDepartment: 'CSE',
    });
    assert.equal(deptBroadcast.recipientCount, 2);
    assert.equal(deptBroadcast.dispatchedCount, 2);
    assert.equal(auditEventsCount, 1);

    // Faculty allowed for specific users
    const facBroadcast = await NotificationService.broadcastAlert(facultySession, {
      title: 'Viva Slot Update',
      message: 'Please report to Seminar Hall B at 11 AM.',
      category: 'assignment',
      targetScope: 'specific_users',
      recipientUserIds: [STUDENT_A_ID],
    });
    assert.equal(facBroadcast.dispatchedCount, 1);

    // Super Admin allowed for all_users
    const saBroadcast = await NotificationService.broadcastAlert(superAdminSession, {
      title: 'Convocation Rehearsal',
      message: 'All students and faculty are requested to assemble in the Main Auditorium.',
      category: 'notice',
      priority: 'high',
      targetScope: 'all_users',
    });
    assert.equal(saBroadcast.recipientCount, 3);
    assert.equal(saBroadcast.dispatchedCount, 3);
  });

  it('verifies all 7 REST API route handlers end-to-end with auth and RBAC', async () => {
    // 1. Seed 2 notifications for Student A
    const n1 = await NotificationService.dispatch({
      userId: STUDENT_A_ID,
      title: 'Passport Claim Verified',
      message: 'Your IEEE publication has been verified by Dr. Rao.',
      category: 'passport',
      linkUrl: '/student/passport',
    });
    await NotificationService.dispatch({
      userId: STUDENT_A_ID,
      title: 'New Campus Notice',
      message: 'Mid-semester examination schedule published.',
      category: 'notice',
      linkUrl: '/student/notices',
    });
    const n1Id = n1.notification!.id;

    // 2. GET /api/v1/notifications
    __setTestSession(studentASession);
    const listRes = await getNotificationsRoute(
      new NextRequest('http://localhost:3000/api/v1/notifications?isRead=false&limit=10')
    );
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    assert.equal(listJson.data.notifications.length, 2);
    assert.equal(listJson.data.unreadCount, 2);

    // 3. GET /api/v1/notifications/unread-summary
    const summaryRes = await getUnreadSummaryRoute(
      new NextRequest('http://localhost:3000/api/v1/notifications/unread-summary')
    );
    assert.equal(summaryRes.status, 200);
    const summaryJson = await summaryRes.json();
    assert.equal(summaryJson.data.unreadCount, 2);
    assert.equal(summaryJson.data.byCategory.passport, 1);
    assert.equal(summaryJson.data.recent.length, 2);

    // 4. PATCH /api/v1/notifications/[id]/read — cross-user returns 403
    __setTestSession(studentBSession);
    const crossReadRes = await markReadRoute(
      new NextRequest(`http://localhost:3000/api/v1/notifications/${n1Id}/read`, {
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: n1Id }) }
    );
    assert.equal(crossReadRes.status, 403);

    // Owner marks read -> 200
    __setTestSession(studentASession);
    const ownReadRes = await markReadRoute(
      new NextRequest(`http://localhost:3000/api/v1/notifications/${n1Id}/read`, {
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: n1Id }) }
    );
    assert.equal(ownReadRes.status, 200);
    const ownReadJson = await ownReadRes.json();
    assert.equal(ownReadJson.data.isRead, true);

    // 5. POST /api/v1/notifications/read-all
    const readAllRes = await markAllReadRoute(
      new NextRequest('http://localhost:3000/api/v1/notifications/read-all', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    assert.equal(readAllRes.status, 200);
    const readAllJson = await readAllRes.json();
    assert.equal(readAllJson.data.modifiedCount, 1);

    // 6. DELETE /api/v1/notifications/[id]
    const deleteRes = await archiveRoute(
      new NextRequest(`http://localhost:3000/api/v1/notifications/${n1Id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: n1Id }) }
    );
    assert.equal(deleteRes.status, 200);

    // 7. GET & PATCH /api/v1/notifications/preferences
    const getPrefRes = await getPreferencesRoute(
      new NextRequest('http://localhost:3000/api/v1/notifications/preferences')
    );
    assert.equal(getPrefRes.status, 200);
    const getPrefJson = await getPrefRes.json();
    assert.equal(getPrefJson.data.categories.emergency, true);

    const badPrefRes = await patchPreferencesRoute(
      new NextRequest('http://localhost:3000/api/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ categories: { emergency: false } }),
      })
    );
    assert.equal(badPrefRes.status, 400);

    const goodPrefRes = await patchPreferencesRoute(
      new NextRequest('http://localhost:3000/api/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ soundEnabled: true, categories: { poll: false } }),
      })
    );
    assert.equal(goodPrefRes.status, 200);
    const goodPrefJson = await goodPrefRes.json();
    assert.equal(goodPrefJson.data.soundEnabled, true);
    assert.equal(goodPrefJson.data.categories.poll, false);
    assert.equal(goodPrefJson.data.categories.emergency, true);

    // 8. POST /api/v1/notifications/broadcast — student 403, super_admin 201
    const studentBroadcastRes = await broadcastRoute(
      new NextRequest('http://localhost:3000/api/v1/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Blocked Alert',
          message: 'Students cannot broadcast.',
          targetScope: 'all_users',
        }),
      })
    );
    assert.equal(studentBroadcastRes.status, 403);

    __setTestSession(superAdminSession);
    const saBroadcastRes = await broadcastRoute(
      new NextRequest('http://localhost:3000/api/v1/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Campus Innovation Hackathon',
          message: 'Registration closes tonight at 11:59 PM.',
          category: 'notice',
          priority: 'high',
          linkUrl: '/student/notices',
          targetScope: 'all_users',
        }),
      })
    );
    assert.equal(saBroadcastRes.status, 201);
    const saBroadcastJson = await saBroadcastRes.json();
    assert.equal(saBroadcastJson.data.dispatchedCount, 3);
  });
});
