'use client';

/**
 * Unified Campus Notification Bell & Live Popover Menu (MOD-17 / Phase 5.13).
 * Connects to /api/v1/notifications/unread-summary and Ably Realtime (user:<id>:notifications)
 * to surface real-time cross-module notifications across all collegiate portals.
 * Preserves /api/v1/notices/unread-count fallback and full backwards compatibility.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  Button,
  Badge,
} from '@/components/ui';
import type { UserRole } from '@/types/user';
import type {
  NotificationCategory,
  NotificationDTO,
  NotificationUnreadSummaryDTO,
} from '@/types/notification';
import { NOTIFICATION_CATEGORY_LABELS } from '@/types/notification';
import {
  Bell,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  CheckCheck,
  FileCheck,
  Inbox,
  Building2,
  Award,
  Scale,
  Megaphone,
  BarChart3,
  MessageSquare,
  ShieldAlert,
  Info,
} from 'lucide-react';

export interface TopbarNotificationsProps {
  user: {
    id?: string;
    email: string;
    role: UserRole;
    fullName?: string;
  };
  initialSummary?: NotificationUnreadSummaryDTO;
}

export function formatRelativeNotificationTime(isoDate: string): string {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function getNotificationCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'assignment':
      return FileCheck;
    case 'service_request':
      return Inbox;
    case 'facility_booking':
      return Building2;
    case 'passport':
      return Award;
    case 'complaint':
      return Scale;
    case 'notice':
      return Megaphone;
    case 'poll':
      return BarChart3;
    case 'chat':
      return MessageSquare;
    case 'emergency':
      return ShieldAlert;
    case 'system':
    default:
      return Info;
  }
}

export interface TopbarNotificationListProps {
  unreadCount: number;
  recent: NotificationDTO[];
  loading: boolean;
  markingAll: boolean;
  noticePath: string;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onItemClick: (item: NotificationDTO) => void;
  onCloseMenu: () => void;
}

/**
 * Pure presentation body of the notification bell dropdown.
 * Exported separately so both the live Radix popover and SSR/unit tests render identically.
 */
export function TopbarNotificationPanel({
  unreadCount,
  recent,
  loading,
  markingAll,
  noticePath,
  onRefresh,
  onMarkAllRead,
  onItemClick,
  onCloseMenu,
}: TopbarNotificationListProps) {
  return (
    <div className="w-full">
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {unreadCount > 99 ? '99+' : unreadCount} unread
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onMarkAllRead();
                }}
                disabled={markingAll}
                className="text-primary hover:bg-primary/10 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50"
                title="Mark all notifications as read"
              >
                <CheckCheck className="size-3" />
                <span>Mark all read</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onRefresh();
              }}
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
              title="Refresh notifications"
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <p className="text-muted-foreground mt-1 text-xs font-normal">
          Unified real-time updates across Axis LinkUp
        </p>
      </div>

      <div className="border-border/50 border-t" />

      <div className="max-h-80 overflow-y-auto p-1.5">
        {recent.length > 0 ? (
          <ul className="space-y-1">
            {recent.slice(0, 5).map((item) => {
              const Icon = getNotificationCategoryIcon(item.category);
              const isEmergency = item.category === 'emergency' || item.priority === 'urgent';
              const targetHref =
                item.linkUrl && item.linkUrl.startsWith('/') && !item.linkUrl.startsWith('//')
                  ? item.linkUrl
                  : '/shared/notifications';

              return (
                <li key={item.id}>
                  <Link
                    href={targetHref}
                    onClick={() => onItemClick(item)}
                    className={`hover:bg-accent/60 flex items-start gap-2.5 rounded-lg p-2 transition-colors ${
                      !item.isRead ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                        isEmergency
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-foreground line-clamp-1 text-xs font-semibold">
                          {item.title}
                        </p>
                        {!item.isRead && (
                          <span
                            className="bg-primary mt-1 size-2 shrink-0 rounded-full"
                            aria-label="Unread notification"
                          />
                        )}
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-[11px] leading-snug">
                        {item.message}
                      </p>
                      <div className="text-muted-foreground/80 flex items-center gap-1.5 text-[10px]">
                        <span>{NOTIFICATION_CATEGORY_LABELS[item.category]}</span>
                        <span>•</span>
                        <span>{formatRelativeNotificationTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="text-muted-foreground/60 mb-1.5 size-6" />
            <p className="text-muted-foreground text-xs font-medium">You&apos;re all caught up</p>
            <p className="text-muted-foreground/80 text-[11px]">
              No unread notifications at this time
            </p>
          </div>
        )}
      </div>

      <div className="border-border/50 border-t" />

      <div className="flex flex-col gap-0.5 p-1.5">
        <Link
          href="/shared/notifications"
          onClick={onCloseMenu}
          className="text-primary hover:bg-accent/60 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold transition-colors"
        >
          <span>Open Notification Center</span>
          <ExternalLink className="size-3.5" />
        </Link>
        <Link
          href={noticePath}
          onClick={onCloseMenu}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/50 flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] transition-colors"
        >
          <span>Campus Notice Board</span>
          <ExternalLink className="size-3" />
        </Link>
      </div>
    </div>
  );
}

export function TopbarNotifications({ user, initialSummary }: TopbarNotificationsProps) {
  const [unreadCount, setUnreadCount] = useState<number>(initialSummary?.unreadCount ?? 0);
  const [recent, setRecent] = useState<NotificationDTO[]>(initialSummary?.recent ?? []);
  const [loading, setLoading] = useState<boolean>(!initialSummary);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/notifications/unread-summary', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setUnreadCount(typeof json.data.unreadCount === 'number' ? json.data.unreadCount : 0);
          setRecent(Array.isArray(json.data.recent) ? json.data.recent : []);
          return;
        }
      }

      // Safe fallback to legacy unread notices endpoint if unified summary is unavailable
      const fallbackRes = await fetch('/api/v1/notices/unread-count', { cache: 'no-store' });
      if (fallbackRes.ok) {
        const fallbackJson = await fallbackRes.json();
        if (fallbackJson.success && typeof fallbackJson.data?.unreadCount === 'number') {
          setUnreadCount(fallbackJson.data.unreadCount);
        }
      }
    } catch {
      // Gracefully silent on background fetch failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSummary) return;
    void fetchSummary();

    // Poll every 60 seconds as HTTP fail-safe
    const interval = setInterval(() => {
      void fetchSummary();
    }, 60000);

    // Optional Ably Realtime push subscription on user:<userId>:notifications
    let realtimeClient: { close: () => void } | null = null;
    let isMounted = true;

    async function connectRealtime() {
      try {
        const tokenRes = await fetch('/api/v1/chat/token');
        if (!tokenRes.ok || !isMounted) return;
        const tokenJson = await tokenRes.json();
        if (!tokenJson.success || tokenJson.data?.isMock) return;

        const clientId = (tokenJson.data?.clientId as string | undefined) || user.id;
        if (!clientId) return;

        const Ably = await import('ably');
        if (!isMounted) return;

        const client = new Ably.Realtime({
          authCallback: async (_params, callback) => {
            try {
              const r = await fetch('/api/v1/chat/token');
              const j = await r.json();
              if (r.ok && j.success && j.data) {
                callback(null, j.data);
              } else {
                callback('Token error', null);
              }
            } catch (err) {
              callback(err instanceof Error ? err.message : 'Token error', null);
            }
          },
        });

        realtimeClient = client;
        const channel = client.channels.get(`user:${clientId}:notifications`);
        await channel.subscribe((msg) => {
          if (!isMounted) return;
          if (msg.name === 'notification.created') {
            const incoming = (msg.data as { notification?: NotificationDTO } | undefined)
              ?.notification;
            if (incoming) {
              setUnreadCount((prev) => prev + 1);
              setRecent((prev) => [incoming, ...prev.filter((n) => n.id !== incoming.id)].slice(0, 5));
            } else {
              void fetchSummary();
            }
          }
        });
      } catch {
        // Graceful fallback to HTTP polling
      }
    }

    void connectRealtime();

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (realtimeClient) {
        try {
          realtimeClient.close();
        } catch {
          // Ignore close errors
        }
      }
    };
  }, [fetchSummary, initialSummary, user.id]);

  const handleMarkItemRead = async (item: NotificationDTO) => {
    setOpen(false);
    if (item.isRead) return;

    // Optimistic UI update
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setRecent((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );

    try {
      await fetch(`/api/v1/notifications/${item.id}/read`, { method: 'PATCH' });
    } catch {
      // Non-blocking background mark-read
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch('/api/v1/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setUnreadCount(0);
        setRecent((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch {
      // Non-blocking
    } finally {
      setMarkingAll(false);
    }
  };

  // Determine notice link based on role
  const noticePath =
    user.role === 'student'
      ? '/student/notices'
      : user.role === 'faculty'
        ? '/faculty/notices'
        : '/admin/notices';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground relative size-9 rounded-lg transition-colors"
          aria-label={
            unreadCount > 0
              ? `View notifications (${unreadCount} unread notifications)`
              : 'View notifications'
          }
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground ring-background absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="border-border/60 bg-popover/95 w-88 p-0 backdrop-blur-md"
      >
        <TopbarNotificationPanel
          unreadCount={unreadCount}
          recent={recent}
          loading={loading}
          markingAll={markingAll}
          noticePath={noticePath}
          onRefresh={() => void fetchSummary()}
          onMarkAllRead={() => void handleMarkAllRead()}
          onItemClick={(item) => void handleMarkItemRead(item)}
          onCloseMenu={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
