'use client';

/**
 * Campus Notifications Trigger & Popover Menu.
 * Connects to /api/v1/notices/unread-count to show real-time unread notice counts.
 * Provides quick access to the institutional notice board based on the active user role.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button,
  Badge,
} from '@/components/ui';
import type { UserRole } from '@/types/user';
import { Bell, ExternalLink, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface TopbarNotificationsProps {
  user: {
    email: string;
    role: UserRole;
    fullName?: string;
  };
}

export function TopbarNotifications({ user }: TopbarNotificationsProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [open, setOpen] = useState<boolean>(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/notices/unread-count');
      if (res.ok) {
        const json = await res.json();
        if (json.success && typeof json.data?.unreadCount === 'number') {
          setUnreadCount(json.data.unreadCount);
        }
      }
    } catch {
      // Gracefully silent on background count failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    // Poll every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

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
              ? `View notifications (${unreadCount} unread notices)`
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
        className="border-border/60 bg-popover/95 w-80 backdrop-blur-md"
      >
        <DropdownMenuLabel className="p-3 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Campus Notices</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                fetchUnreadCount();
              }}
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
              title="Refresh unread count"
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-muted-foreground font-normal text-xs mt-1">
            Official announcements from AITM Kanpur
          </p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <div className="p-3">
          {unreadCount > 0 ? (
            <div className="bg-primary/5 border-primary/20 flex items-start gap-2.5 rounded-lg border p-2.5">
              <AlertCircle className="text-primary size-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-foreground text-xs font-medium">
                  {unreadCount} new {unreadCount === 1 ? 'notice' : 'notices'} waiting for you
                </p>
                <p className="text-muted-foreground text-[11px] leading-tight">
                  Check the institutional notice board for academic, exam, or administrative updates.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-3 text-center">
              <CheckCircle2 className="text-muted-foreground/60 size-6 mb-1.5" />
              <p className="text-muted-foreground text-xs font-medium">You&apos;re all caught up</p>
              <p className="text-muted-foreground/80 text-[11px]">No unread notices at this time</p>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="p-2 cursor-pointer">
          <Link
            href={noticePath}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between w-full font-medium text-xs text-primary"
          >
            <span>Open Notice Board</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

