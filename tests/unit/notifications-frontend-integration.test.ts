/**
 * Phase 5.13 Frontend & Portal Integration Tests (MOD-17).
 * Verifies SSR rendering, RBAC visibility, locked emergency preferences,
 * Topbar live bell upgrade, and /shared/notifications Server Component mount.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Types } from 'mongoose';

import {
  TopbarNotifications,
  TopbarNotificationPanel,
} from '@/components/navigation/topbar-notifications';
import {
  NotificationCenterView,
  NotificationBroadcastModal,
} from '@/components/notifications';
import SharedNotificationsPage from '@/app/(shared)/shared/notifications/page';
import { NotificationService } from '@/lib/services/notification.service';
import { __setTestSession } from '@/lib/auth/server';
import type {
  NotificationDTO,
  NotificationPreferenceDTO,
  NotificationUnreadSummaryDTO,
} from '@/types/notification';
import type { UserSession } from '@/types/user';

const SAMPLE_NOTIFICATIONS: NotificationDTO[] = [
  {
    id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId().toString(),
    title: 'Bonafide Certificate Approved',
    message: 'Your Bonafide Certificate request REQ-2026-0042 has been approved.',
    category: 'service_request',
    priority: 'high',
    linkUrl: '/student/requests',
    dedupeKey: null,
    metadata: null,
    isRead: false,
    readAt: null,
    isArchived: false,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId().toString(),
    title: 'Skill Passport Claim Verified',
    message: 'Your National Hackathon Winner credential has been cryptographically verified.',
    category: 'passport',
    priority: 'normal',
    linkUrl: '/student/passport',
    dedupeKey: null,
    metadata: null,
    isRead: true,
    readAt: new Date().toISOString(),
    isArchived: false,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
];

const SAMPLE_PREFS: NotificationPreferenceDTO = {
  id: 'pref-1',
  userId: new Types.ObjectId().toString(),
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
    poll: false,
    chat: true,
    system: true,
    emergency: true,
  },
  updatedAt: new Date().toISOString(),
};

describe('Phase 5.13 — Notification Center Frontend & Portal Integration', () => {
  const origList = NotificationService.listUserNotifications;
  const origPrefs = NotificationService.getPreferences;

  afterEach(() => {
    NotificationService.listUserNotifications = origList;
    NotificationService.getPreferences = origPrefs;
    __setTestSession(undefined);
  });

  it('renders TopbarNotifications trigger with unread badge and 99+ overflow cap', () => {
    const summary: NotificationUnreadSummaryDTO = {
      unreadCount: 142,
      byCategory: { service_request: 100, notice: 42 },
      recent: SAMPLE_NOTIFICATIONS,
    };

    const html = renderToStaticMarkup(
      React.createElement(TopbarNotifications, {
        user: { email: 'student@axiscolleges.in', role: 'student' },
        initialSummary: summary,
      })
    );

    assert.ok(html.includes('aria-label="View notifications (142 unread notifications)"'));
    assert.ok(html.includes('99+'));
  });

  it('renders TopbarNotificationPanel with recent notifications, Mark all read, and /shared/notifications link', () => {
    const html = renderToStaticMarkup(
      React.createElement(TopbarNotificationPanel, {
        unreadCount: 1,
        recent: SAMPLE_NOTIFICATIONS,
        loading: false,
        markingAll: false,
        noticePath: '/student/notices',
        onRefresh: () => {},
        onMarkAllRead: () => {},
        onItemClick: () => {},
        onCloseMenu: () => {},
      })
    );

    assert.ok(html.includes('Notifications'));
    assert.ok(html.includes('Mark all read'));
    assert.ok(html.includes('Bonafide Certificate Approved'));
    assert.ok(html.includes('Open Notification Center'));
    assert.ok(html.includes('href="/shared/notifications"'));
    assert.ok(html.includes('href="/student/requests"'));
  });

  it('renders NotificationCenterView Inbox tab and strictly hides Send Alert from students', () => {
    const studentHtml = renderToStaticMarkup(
      React.createElement(NotificationCenterView, {
        userRole: 'student',
        initialNotifications: SAMPLE_NOTIFICATIONS,
        initialUnreadCount: 1,
        initialPagination: { page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false },
        initialPreferences: SAMPLE_PREFS,
      })
    );

    assert.ok(studentHtml.includes('Notification Center'));
    assert.ok(studentHtml.includes('Bonafide Certificate Approved'));
    assert.ok(studentHtml.includes('Skill Passport Claim Verified'));
    assert.ok(studentHtml.includes('Mark All Read'));
    assert.ok(studentHtml.includes('Archive'));
    assert.ok(!studentHtml.includes('Send Alert'), 'Students must not see Send Alert broadcast button');
    assert.ok(!studentHtml.includes('Academic Calendar'), 'No Academic Calendar category permitted');

    const adminHtml = renderToStaticMarkup(
      React.createElement(NotificationCenterView, {
        userRole: 'admin',
        initialNotifications: SAMPLE_NOTIFICATIONS,
        initialUnreadCount: 1,
        initialPagination: { page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false },
        initialPreferences: SAMPLE_PREFS,
      })
    );

    assert.ok(adminHtml.includes('Send Alert'), 'Admins must see Send Alert broadcast button');
  });

  it('renders NotificationCenterView Preferences tab with permanently locked Emergency Alerts toggle', () => {
    const html = renderToStaticMarkup(
      React.createElement(NotificationCenterView, {
        userRole: 'faculty',
        initialNotifications: SAMPLE_NOTIFICATIONS,
        initialUnreadCount: 1,
        initialPagination: { page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false },
        initialPreferences: SAMPLE_PREFS,
        initialTab: 'preferences',
      })
    );

    assert.ok(html.includes('Delivery Channels'));
    assert.ok(html.includes('In-App Inbox'));
    assert.ok(html.includes('Category Subscriptions'));
    assert.ok(html.includes('Emergency Alerts — Always On'));
    assert.ok(html.includes('data-locked-emergency="true"'));
    assert.ok(html.includes('disabled=""'));
    assert.ok(html.includes('Save Preferences'));
  });

  it('renders NotificationBroadcastModal with role-scoped audience options', () => {
    const superAdminModalHtml = renderToStaticMarkup(
      React.createElement(NotificationBroadcastModal, {
        isOpen: true,
        onClose: () => {},
        userRole: 'super_admin',
      })
    );
    assert.ok(superAdminModalHtml.includes('All Campus Users'));
    assert.ok(superAdminModalHtml.includes('Specific Institutional Roles'));

    const adminModalHtml = renderToStaticMarkup(
      React.createElement(NotificationBroadcastModal, {
        isOpen: true,
        onClose: () => {},
        userRole: 'admin',
        departmentScope: {
          id: new Types.ObjectId().toString(),
          name: 'Computer Science & Engineering',
          code: 'CSE',
        },
      })
    );
    assert.ok(!adminModalHtml.includes('All Campus Users'));
    assert.ok(adminModalHtml.includes('Computer Science &amp; Engineering (CSE)'));
    assert.ok(adminModalHtml.includes('Own Dept'));
  });

  it('mounts /shared/notifications Server Component cleanly for authenticated users', async () => {
    const session: UserSession = {
      userId: new Types.ObjectId().toString(),
      authProviderId: 'clerk_ssr_test',
      email: 'student@axiscolleges.in',
      fullName: 'Test Student',
      role: 'student',
      status: 'active',
    };
    __setTestSession(session);

    NotificationService.listUserNotifications = async () => ({
      notifications: SAMPLE_NOTIFICATIONS,
      unreadCount: 1,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false },
    });
    NotificationService.getPreferences = async () => SAMPLE_PREFS;

    const element = await SharedNotificationsPage();
    const html = renderToStaticMarkup(element);

    assert.ok(html.includes('Notification Center'));
    assert.ok(html.includes('Bonafide Certificate Approved'));
    assert.ok(!html.includes('Send Alert'));
  });
});
