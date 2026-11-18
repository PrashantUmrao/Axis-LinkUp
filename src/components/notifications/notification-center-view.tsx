'use client';

/**
 * Unified Notification Center & Preference Engine Workspace (MOD-17 / Phase 5.13).
 * Accessible to all four collegiate personas at /shared/notifications.
 * Features filterable personal Inbox, category/channel Preferences (with locked Emergency Alerts),
 * and RBAC-gated Targeted Alert Broadcast modal for Faculty, Admin, and Super Admin.
 */

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { GlassPanel, Button, Badge, EmptyState } from '@/components/ui';
import {
  NOTIFICATION_CATEGORIES,
  MUTABLE_NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  type MutableNotificationCategory,
  type NotificationCategory,
  type NotificationDTO,
  type NotificationPreferenceDTO,
} from '@/types/notification';
import type { UserRole } from '@/types/user';
import {
  formatRelativeNotificationTime,
  getNotificationCategoryIcon,
} from '@/components/navigation/topbar-notifications';
import { NotificationBroadcastModal } from './notification-broadcast-modal';
import {
  Bell,
  CheckCheck,
  Check,
  Archive,
  SlidersHorizontal,
  Inbox as InboxIcon,
  Megaphone,
  Lock,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export interface NotificationCenterViewProps {
  userRole: UserRole;
  initialNotifications: NotificationDTO[];
  initialUnreadCount: number;
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  initialPreferences: NotificationPreferenceDTO;
  departmentScope?: { id: string; name: string; code: string } | null;
  availableDepartments?: Array<{ id: string; name: string; code: string }>;
  initialTab?: 'inbox' | 'preferences';
}

const PRIORITY_BADGE_VARIANT: Record<
  NotificationDTO['priority'],
  'outline' | 'info' | 'warning' | 'destructive'
> = {
  low: 'outline',
  normal: 'info',
  high: 'warning',
  urgent: 'destructive',
};

export function NotificationCenterView({
  userRole,
  initialNotifications,
  initialUnreadCount,
  initialPagination,
  initialPreferences,
  departmentScope = null,
  availableDepartments = [],
  initialTab = 'inbox',
}: NotificationCenterViewProps) {
  const canBroadcast = userRole !== 'student';

  const [activeTab, setActiveTab] = useState<'inbox' | 'preferences'>(initialTab);
  const [notifications, setNotifications] = useState<NotificationDTO[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [pagination, setPagination] = useState(initialPagination);
  const [readFilter, setReadFilter] = useState<'all' | 'false'>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [loadingInbox, setLoadingInbox] = useState<boolean>(false);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState<boolean>(false);
  const [mountedNow, setMountedNow] = useState<number | null>(null);

  useEffect(() => {
    setMountedNow(Date.now());
  }, []);

  // Preferences state
  const [prefs, setPrefs] = useState<NotificationPreferenceDTO>(initialPreferences);
  const [savingPrefs, setSavingPrefs] = useState<boolean>(false);
  const [prefsStatus, setPrefsStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const fetchNotifications = useCallback(
    async (
      nextReadFilter: 'all' | 'false',
      nextCategory: NotificationCategory | 'all',
      nextPage: number
    ) => {
      setLoadingInbox(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(nextPage));
        params.set('limit', String(pagination.limit || 20));
        if (nextReadFilter === 'false') params.set('isRead', 'false');
        if (nextCategory !== 'all') params.set('category', nextCategory);

        const res = await fetch(`/api/v1/notifications?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          setNotifications(json.data.notifications || []);
          setUnreadCount(typeof json.data.unreadCount === 'number' ? json.data.unreadCount : 0);
          if (json.data.pagination) setPagination(json.data.pagination);
        }
      } catch {
        // Silent network fallback
      } finally {
        setLoadingInbox(false);
      }
    },
    [pagination.limit]
  );

  const handleFilterChange = (
    nextRead: 'all' | 'false',
    nextCat: NotificationCategory | 'all'
  ) => {
    setReadFilter(nextRead);
    setCategoryFilter(nextCat);
    void fetchNotifications(nextRead, nextCat, 1);
  };

  const handleMarkRead = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const payload = categoryFilter !== 'all' ? { category: categoryFilter } : {};
      const res = await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchNotifications(readFilter, categoryFilter, pagination.page);
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const handleArchive = async (id: string) => {
    setBusyId(id);
    try {
      const target = notifications.find((n) => n.id === id);
      const res = await fetch(`/api/v1/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (target && !target.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const toggleCategoryPref = (cat: MutableNotificationCategory) => {
    setPrefsStatus(null);
    setPrefs((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [cat]: !prev.categories[cat],
        emergency: true,
      },
    }));
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setPrefsStatus(null);
    try {
      const res = await fetch('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inAppEnabled: prefs.inAppEnabled,
          emailEnabled: prefs.emailEnabled,
          soundEnabled: prefs.soundEnabled,
          categories: {
            ...prefs.categories,
            emergency: true,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPrefsStatus({
          type: 'error',
          text: json.error?.message || json.message || 'Unable to save preferences.',
        });
        return;
      }
      setPrefs(json.data as NotificationPreferenceDTO);
      setPrefsStatus({
        type: 'success',
        text: 'Notification preferences saved. Emergency alerts remain permanently enabled.',
      });
    } catch {
      setPrefsStatus({
        type: 'error',
        text: 'Network error while saving preferences.',
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <GlassPanel className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <Bell className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
                Notification Center
              </h1>
              {unreadCount > 0 ? (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount} unread
                </Badge>
              ) : (
                <Badge variant="success" className="text-xs">
                  All caught up
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              Real-time campus updates across assignments, requests, bookings, skill passport, and official notices.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && activeTab === 'inbox' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={markingAll}
              onClick={() => void handleMarkAllRead()}
              className="gap-1.5"
            >
              {markingAll ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5" />
              )}
              Mark All Read
            </Button>
          )}

          {canBroadcast && (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsBroadcastOpen(true)}
              className="gap-1.5"
            >
              <Megaphone className="size-3.5" />
              Send Alert
            </Button>
          )}
        </div>
      </GlassPanel>

      {/* Primary Workspace Tabs */}
      <div className="border-border/60 flex items-center gap-2 border-b pb-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inbox'}
          onClick={() => setActiveTab('inbox')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'inbox'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
          }`}
        >
          <InboxIcon className="size-3.5" />
          Inbox
          {unreadCount > 0 && (
            <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'preferences'}
          onClick={() => setActiveTab('preferences')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'preferences'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
          }`}
        >
          <SlidersHorizontal className="size-3.5" />
          Preferences
        </button>
      </div>

      {/* TAB 1: INBOX */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <GlassPanel className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFilterChange('all', categoryFilter)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    readFilter === 'all'
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent/60'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('false', categoryFilter)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    readFilter === 'false'
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent/60'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {loadingInbox && (
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <Loader2 className="size-3.5 animate-spin" />
                  Refreshing...
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleFilterChange(readFilter, 'all')}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  categoryFilter === 'all'
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                All Categories
              </button>
              {NOTIFICATION_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleFilterChange(readFilter, cat)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {NOTIFICATION_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </GlassPanel>

          {/* Notification Feed */}
          {notifications.length === 0 ? (
            <GlassPanel className="p-8">
              <EmptyState
                icon={<Bell className="size-8" />}
                title="No notifications found"
                description={
                  readFilter === 'false'
                    ? 'You have read all notifications matching your current filter.'
                    : 'New campus updates, request decisions, and broadcasts will appear here.'
                }
              />
            </GlassPanel>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((item) => {
                const Icon = getNotificationCategoryIcon(item.category);
                const isEmergency = item.category === 'emergency' || item.priority === 'urgent';
                const safeHref =
                  item.linkUrl && item.linkUrl.startsWith('/') && !item.linkUrl.startsWith('//')
                    ? item.linkUrl
                    : null;

                return (
                  <GlassPanel
                    key={item.id}
                    className={`flex flex-col justify-between gap-3 p-4 transition-colors sm:flex-row sm:items-start ${
                      !item.isRead
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/50 opacity-90'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
                          isEmergency
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {!item.isRead && (
                            <span
                              className="bg-primary size-2 shrink-0 rounded-full"
                              aria-label="Unread"
                            />
                          )}
                          <h3 className="text-foreground text-sm font-semibold">{item.title}</h3>
                          <Badge variant="outline" className="text-[10px]">
                            {NOTIFICATION_CATEGORY_LABELS[item.category]}
                          </Badge>
                          {(item.priority === 'high' || item.priority === 'urgent') && (
                            <Badge
                              variant={PRIORITY_BADGE_VARIANT[item.priority]}
                              className="text-[10px] uppercase"
                            >
                              {item.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {item.message}
                        </p>
                        <p className="text-muted-foreground/80 text-[11px]">
                          {mountedNow !== null
                            ? formatRelativeNotificationTime(item.createdAt, mountedNow)
                            : new Intl.DateTimeFormat('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                timeZone: 'Asia/Kolkata',
                              }).format(new Date(item.createdAt))}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {safeHref && (
                        <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
                          <Link
                            href={safeHref}
                            onClick={() => {
                              if (!item.isRead) void handleMarkRead(item.id);
                            }}
                          >
                            Open
                            <ExternalLink className="size-3" />
                          </Link>
                        </Button>
                      )}
                      {!item.isRead && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => void handleMarkRead(item.id)}
                          className="h-7 gap-1 text-xs"
                          title="Mark as read"
                        >
                          <Check className="size-3.5" />
                          Mark Read
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => void handleArchive(item.id)}
                        className="text-muted-foreground hover:text-destructive h-7 gap-1 text-xs"
                        title="Dismiss / Archive notification"
                      >
                        <Archive className="size-3.5" />
                        Archive
                      </Button>
                    </div>
                  </GlassPanel>
                );
              })}

              {/* Pagination Footer */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-xs">
                  <span className="text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1 || loadingInbox}
                      onClick={() =>
                        void fetchNotifications(readFilter, categoryFilter, pagination.page - 1)
                      }
                      className="h-7 gap-1 text-xs"
                    >
                      <ChevronLeft className="size-3.5" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasMore || loadingInbox}
                      onClick={() =>
                        void fetchNotifications(readFilter, categoryFilter, pagination.page + 1)
                      }
                      className="h-7 gap-1 text-xs"
                    >
                      Next
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PREFERENCES */}
      {activeTab === 'preferences' && (
        <GlassPanel className="space-y-6 p-6">
          <div>
            <h2 className="font-heading text-base font-bold">Delivery Channels</h2>
            <p className="text-muted-foreground text-xs">
              Control how non-emergency Axis LinkUp notifications are delivered to your account.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="border-border/60 bg-background/60 flex cursor-pointer items-center justify-between rounded-xl border p-3.5">
              <div className="pr-3">
                <p className="text-xs font-semibold">In-App Inbox</p>
                <p className="text-muted-foreground text-[11px]">Live topbar bell &amp; feed</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.inAppEnabled}
                onChange={(e) => {
                  setPrefsStatus(null);
                  setPrefs((prev) => ({ ...prev, inAppEnabled: e.target.checked }));
                }}
                className="accent-primary size-4 rounded"
              />
            </label>

            <label className="border-border/60 bg-background/60 flex cursor-pointer items-center justify-between rounded-xl border p-3.5">
              <div className="pr-3">
                <p className="text-xs font-semibold">Email Digest</p>
                <p className="text-muted-foreground text-[11px]">Summary alerts via email</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.emailEnabled}
                onChange={(e) => {
                  setPrefsStatus(null);
                  setPrefs((prev) => ({ ...prev, emailEnabled: e.target.checked }));
                }}
                className="accent-primary size-4 rounded"
              />
            </label>

            <label className="border-border/60 bg-background/60 flex cursor-pointer items-center justify-between rounded-xl border p-3.5">
              <div className="pr-3">
                <p className="text-xs font-semibold">Notification Sound</p>
                <p className="text-muted-foreground text-[11px]">Subtle chime on live events</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.soundEnabled}
                onChange={(e) => {
                  setPrefsStatus(null);
                  setPrefs((prev) => ({ ...prev, soundEnabled: e.target.checked }));
                }}
                className="accent-primary size-4 rounded"
              />
            </label>
          </div>

          <div className="border-border/50 border-t pt-5">
            <h2 className="font-heading text-base font-bold">Category Subscriptions</h2>
            <p className="text-muted-foreground text-xs">
              Choose which institutional modules may push notifications into your inbox.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {MUTABLE_NOTIFICATION_CATEGORIES.map((cat) => {
                const Icon = getNotificationCategoryIcon(cat);
                const enabled = prefs.categories[cat];
                return (
                  <label
                    key={cat}
                    className="border-border/60 bg-background/60 hover:border-primary/40 flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                        <Icon className="size-4" />
                      </div>
                      <span className="text-xs font-semibold">
                        {NOTIFICATION_CATEGORY_LABELS[cat]}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleCategoryPref(cat)}
                      className="accent-primary size-4 rounded"
                    />
                  </label>
                );
              })}

              {/* Permanently Locked Emergency Row */}
              <div
                className="border-destructive/40 bg-destructive/5 flex items-center justify-between rounded-xl border p-3 sm:col-span-2"
                data-locked-emergency="true"
              >
                <div className="flex items-start gap-2.5">
                  <div className="bg-destructive/15 text-destructive flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <ShieldAlert className="size-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold">Emergency Alerts — Always On</span>
                      <Badge variant="destructive" className="gap-1 text-[10px]">
                        <Lock className="size-2.5" />
                        Locked
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      Campus emergency directives cannot be muted or disabled for institutional safety compliance.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  readOnly
                  aria-label="Emergency Alerts Always On (locked)"
                  className="accent-destructive size-4 cursor-not-allowed rounded opacity-75"
                />
              </div>
            </div>
          </div>

          {prefsStatus && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
                prefsStatus.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-destructive/40 bg-destructive/10 text-destructive'
              }`}
            >
              {prefsStatus.type === 'success' ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span>{prefsStatus.text}</span>
            </div>
          )}

          <div className="border-border/50 flex justify-end border-t pt-4">
            <Button
              type="button"
              size="sm"
              disabled={savingPrefs}
              onClick={() => void handleSavePreferences()}
              className="gap-1.5"
            >
              {savingPrefs && <Loader2 className="size-3.5 animate-spin" />}
              Save Preferences
            </Button>
          </div>
        </GlassPanel>
      )}

      {/* RBAC-Gated Broadcast Composer Modal */}
      {canBroadcast && (
        <NotificationBroadcastModal
          isOpen={isBroadcastOpen}
          onClose={() => setIsBroadcastOpen(false)}
          userRole={userRole}
          departmentScope={departmentScope}
          availableDepartments={availableDepartments}
          onSuccess={() => {
            void fetchNotifications(readFilter, categoryFilter, 1);
          }}
        />
      )}
    </div>
  );
}
