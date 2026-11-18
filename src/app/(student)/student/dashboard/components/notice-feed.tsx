'use client';

/**
 * Student Dashboard Notice Feed Section.
 * Surfaces live collegiate bulletins and circulars fetched from /api/v1/notices.
 * Strictly avoids generating fake college announcements.
 * Supports searching, category filtering, reading, and statutory acknowledgment.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/ui';
import { NoticeDetailDialog } from '@/components/notices/notice-detail-dialog';
import type { NoticeDTO } from '@/types/notice';
import {
  Megaphone,
  ShieldAlert,
  Search,
  RefreshCw,
  User,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

export function StudentNoticeFeed() {
  const [notices, setNotices] = useState<NoticeDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedNotice, setSelectedNotice] = useState<NoticeDTO | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = new URL('/api/v1/notices', window.location.origin);
      url.searchParams.set('status', 'published');
      if (categoryFilter !== 'all') {
        url.searchParams.set('category', categoryFilter);
      }
      if (debouncedSearch) {
        url.searchParams.set('search', debouncedSearch);
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Failed to load notices: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.notices)) {
        setNotices(json.data.notices);
      } else {
        setNotices([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notices');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, debouncedSearch]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleNoticeClick = (notice: NoticeDTO) => {
    setSelectedNotice(notice);
    setIsDetailOpen(true);
  };

  const handleNoticeUpdated = (updated: NoticeDTO) => {
    setNotices((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setSelectedNotice(updated);
  };

  // Filter client-side if instant search is needed
  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      const matchesSearch =
        !searchQuery ||
        notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notice.contentMarkdown.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = categoryFilter === 'all' || notice.category === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [notices, searchQuery, categoryFilter]);

  const priorityBadgeVariant = (priority: string): 'destructive' | 'secondary' | 'outline' => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
      case 'important':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <>
      <Card variant="glass" className="space-y-4 p-6 shadow-sm">
        <CardHeader className="border-border/40 flex flex-col gap-3 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
              <Megaphone className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Campus Notices &amp; Circulars
              </CardTitle>
              <CardDescription className="text-xs">
                Official bulletins dispatched by college administration and department HOD
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNotices}
              disabled={loading}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="sm:col-span-2 relative">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
            <Input
              placeholder="Search circulars by keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>
          <div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="examination">Examination</SelectItem>
                <SelectItem value="fee_accounts">Fees &amp; Accounts</SelectItem>
                <SelectItem value="event_cultural">Events &amp; Cultural</SelectItem>
                <SelectItem value="placement">Training &amp; Placement</SelectItem>
                <SelectItem value="administrative">Administrative</SelectItem>
                <SelectItem value="emergency">Emergency / Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-0 pt-2 space-y-3">
          {loading && notices.length === 0 ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-border/40 rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-4 text-center">
              <AlertTriangle className="text-destructive mx-auto size-6 mb-1" />
              <p className="text-destructive text-xs font-medium">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNotices}
                className="mt-2 text-xs h-7"
              >
                Retry
              </Button>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="border-border/40 rounded-lg border border-dashed p-8 text-center">
              <Megaphone className="text-muted-foreground/40 mx-auto size-8 mb-2" />
              <p className="text-foreground text-sm font-medium">No Announcements Found</p>
              <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
                {searchQuery || categoryFilter !== 'all'
                  ? 'No notices match the specified search or filter criteria.'
                  : 'Your departmental bulletin board is currently clear. Official notifications and examination schedules will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredNotices.map((notice) => (
                <div
                  key={notice.id}
                  onClick={() => handleNoticeClick(notice)}
                  className={`group border-border/60 hover:border-primary/50 hover:bg-muted/30 cursor-pointer rounded-lg border p-3.5 transition-all ${
                    notice.priority === 'urgent'
                      ? 'border-destructive/40 bg-destructive/5'
                      : 'bg-card/50'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={priorityBadgeVariant(notice.priority)}
                        className="text-[10px] capitalize px-2 py-0.5"
                      >
                        {notice.priority}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {notice.category.replace(/_/g, ' ')}
                      </Badge>
                      {notice.targetScope?.scopeType && (
                        <span className="text-muted-foreground font-mono text-[10px] uppercase">
                          [{notice.targetScope.scopeType}]
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <Calendar className="size-3" />
                      <span>
                        {new Intl.DateTimeFormat('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'Asia/Kolkata',
                        }).format(new Date(notice.createdAt))}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-foreground font-semibold text-sm group-hover:text-primary transition-colors">
                    {notice.title}
                  </h4>

                  <p className="text-muted-foreground text-xs line-clamp-2 mt-1">
                    {notice.contentMarkdown}
                  </p>

                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/30 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="size-3" />
                      <span>{notice.author?.name || 'Administration'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {notice.requiresAcknowledgment && (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] gap-1"
                        >
                          <ShieldAlert className="size-3" />
                          Acknowledgment Required
                        </Badge>
                      )}
                      <span className="text-primary group-hover:underline font-medium text-xs">
                        Read Notice &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Security Compliance Note */}
          <div className="border-border/30 bg-muted/20 text-muted-foreground mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="text-primary size-3.5" />
              <span>
                Notices follow strict institutional verification and cryptographic audit logging.
              </span>
            </div>
            <span className="font-mono text-[10px]">AITM-BULLETIN</span>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <NoticeDetailDialog
        notice={selectedNotice}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onNoticeUpdated={handleNoticeUpdated}
        currentUserRole="student"
      />
    </>
  );
}
