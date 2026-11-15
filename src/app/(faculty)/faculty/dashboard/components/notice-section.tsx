'use client';

/**
 * Faculty Dashboard Notices & Circulars Section.
 * Surfaces departmental circulars and official collegiate announcements.
 * Supports:
 * - Role-scoped notice authoring (Course/Section broadcasts).
 * - Department circular reading and statutory acknowledgment.
 * - Author receipt analytics ledger access.
 * - Policy 1: Faculty department-wide publishing blocked without HOD authorization.
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
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { NoticeDetailDialog } from '@/components/notices/notice-detail-dialog';
import { NoticeFormDialog } from '@/components/notices/notice-form-dialog';
import type { NoticeDTO } from '@/types/notice';
import {
  Megaphone,
  ShieldAlert,
  Search,
  RefreshCw,
  Plus,
  Calendar,
  User,
  AlertTriangle,
} from 'lucide-react';

interface FacultyNoticeSectionProps {
  user?: {
    id?: string;
    role?: string;
    departmentId?: string | null;
    adminSubRole?: string | null;
  };
}

export function FacultyNoticeSection({ user }: FacultyNoticeSectionProps) {
  const [notices, setNotices] = useState<NoticeDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedNotice, setSelectedNotice] = useState<NoticeDTO | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = new URL('/api/v1/notices', window.location.origin);
      if (activeTab === 'drafts') {
        url.searchParams.set('status', 'draft');
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
  }, [activeTab]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleNoticeClick = (notice: NoticeDTO) => {
    setSelectedNotice(notice);
    setIsDetailOpen(true);
  };

  const handleNoticeCreated = (created: NoticeDTO) => {
    setNotices((prev) => [created, ...prev]);
    setIsCreateOpen(false);
  };

  const handleNoticeUpdated = (updated: NoticeDTO) => {
    setNotices((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setSelectedNotice(updated);
  };

  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      const matchesSearch =
        !searchQuery ||
        notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notice.contentMarkdown.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeTab === 'my') {
        const isAuthor = user?.id && notice.author.id === user.id;
        return matchesSearch && isAuthor;
      }
      if (activeTab === 'drafts') {
        return matchesSearch && notice.status === 'draft';
      }
      return matchesSearch;
    });
  }, [notices, searchQuery, activeTab, user?.id]);

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
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
              <Megaphone className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Department Bulletins &amp; Circulars
              </CardTitle>
              <CardDescription className="text-xs">
                Official faculty notices, collegiate circulars, and course-level broadcast channels
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
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="h-8 gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Plus className="size-3.5" />
              New Notice
            </Button>
          </div>
        </CardHeader>

        {/* Tab & Search Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="h-8 p-0.5">
              <TabsTrigger value="all" className="text-xs px-3 h-7">
                All Bulletins
              </TabsTrigger>
              <TabsTrigger value="my" className="text-xs px-3 h-7">
                My Notices
              </TabsTrigger>
              <TabsTrigger value="drafts" className="text-xs px-3 h-7">
                Drafts
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-3.5" />
            <Input
              placeholder="Search circulars..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
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
              <p className="text-foreground text-sm font-medium">No Circulars Found</p>
              <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
                {activeTab === 'drafts'
                  ? 'You have no saved notice drafts.'
                  : activeTab === 'my'
                    ? "You haven't authored any course notices yet. Click 'New Notice' to broadcast to your students."
                    : 'Your departmental notice board is up to date.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredNotices.map((notice) => (
                <div
                  key={notice.id}
                  onClick={() => handleNoticeClick(notice)}
                  className={`group border-border/60 hover:border-amber-500/50 hover:bg-muted/30 cursor-pointer rounded-lg border p-3.5 transition-all ${
                    notice.status === 'draft'
                      ? 'border-dashed bg-muted/10'
                      : notice.priority === 'urgent'
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
                        {notice.category}
                      </Badge>
                      {notice.targetScope?.scopeType && (
                        <span className="text-muted-foreground font-mono text-[10px] uppercase">
                          [{notice.targetScope.scopeType}]
                        </span>
                      )}
                      {notice.status === 'draft' && (
                        <Badge variant="secondary" className="text-[10px] bg-muted">
                          Draft
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <Calendar className="size-3" />
                      <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <h4 className="text-foreground font-semibold text-sm group-hover:text-amber-500 transition-colors">
                    {notice.title}
                  </h4>

                  <p className="text-muted-foreground text-xs line-clamp-2 mt-1">
                    {notice.contentMarkdown}
                  </p>

                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/30 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="size-3" />
                      <span>{notice.author?.name || 'Faculty'}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {notice.requiresAcknowledgment && (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]"
                        >
                          Mandatory Ack
                        </Badge>
                      )}
                      <span className="text-amber-500 group-hover:underline font-medium text-xs">
                        View Details &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Institutional Policy Footnote */}
          <div className="border-border/30 bg-muted/20 text-muted-foreground mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-amber-500" />
              <span>
                Policy 1 Active: Faculty course broadcasts enabled. Department-wide broadcasts require HOD authorization.
              </span>
            </div>
            <span className="font-mono text-[10px]">POLICY-1-ACTIVE</span>
          </div>
        </CardContent>
      </Card>

      {/* Notice Detail Dialog */}
      <NoticeDetailDialog
        notice={selectedNotice}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onNoticeUpdated={handleNoticeUpdated}
        currentUserRole={user?.role || 'faculty'}
        currentUserId={user?.id}
      />

      {/* Notice Form Dialog */}
      <NoticeFormDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onNoticeCreated={handleNoticeCreated}
        currentUserRole={user?.role || 'faculty'}
        adminSubRole={user?.adminSubRole}
        departmentId={user?.departmentId}
      />
    </>
  );
}
