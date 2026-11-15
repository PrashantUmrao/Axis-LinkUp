'use client';

/**
 * Administrator Dashboard Notice Management Section.
 * College circulars & bulletin management desk.
 * Context-aware controls based on activeScope ('sys_admin' | 'hod' | 'director'):
 * - sys_admin: Campus-wide emergency siren, urgent broadcasts, full archival & moderation.
 * - hod: Department circulars, department cohort targeting, receipt analytics inspection.
 * - director: Directorate circulars, institution-wide broadcasts, comprehensive oversight.
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
  BarChart2,
} from 'lucide-react';

interface AdminNoticeManagementProps {
  activeScope?: 'sys_admin' | 'hod' | 'director';
}

export function AdminNoticeManagement({ activeScope = 'sys_admin' }: AdminNoticeManagementProps) {
  const [notices, setNotices] = useState<NoticeDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedNotice, setSelectedNotice] = useState<NoticeDTO | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = new URL('/api/v1/notices', window.location.origin);
      if (statusFilter !== 'all') {
        url.searchParams.set('status', statusFilter);
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
  }, [statusFilter]);

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
      const matchesStatus = statusFilter === 'all' || notice.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [notices, searchQuery, statusFilter]);

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

  const scopeConfig = {
    sys_admin: {
      title: 'Institutional Broadcast & Emergency Desk',
      description: 'Campus-wide circulars, urgent sirens, and global bulletin governance',
      badge: 'System Admin Oversight',
      buttonText: 'Dispatch Circular',
      buttonBg: 'bg-primary hover:bg-primary/90 text-primary-foreground',
      policyText: 'Emergency siren broadcasts require System Administrator authorization.',
    },
    hod: {
      title: 'Department Circulars & Academic Bulletins',
      description: 'Departmental cohort circulars, semester schedules, and read analytics ledgers',
      badge: 'HOD Department Scope',
      buttonText: 'Dispatch Dept Circular',
      buttonBg: 'bg-amber-500 hover:bg-amber-600 text-white',
      policyText: 'HOD holds sole authority to broadcast notices across the entire department.',
    },
    director: {
      title: 'Directorate Executive Circular Desk',
      description: 'Directorate communiques, policy directives, and institutional sentiment tracking',
      badge: 'Directorate Scope',
      buttonText: 'Issue Executive Circular',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      policyText: 'Executive directives are broadcast campus-wide with permanent statutory audit retention.',
    },
  }[activeScope];

  return (
    <>
      <Card variant="glass" className="space-y-4 p-6 shadow-sm">
        <CardHeader className="border-border/40 flex flex-col gap-3 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Megaphone className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{scopeConfig.title}</CardTitle>
              <CardDescription className="text-xs">{scopeConfig.description}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px]">
              {scopeConfig.badge}
            </Badge>
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
              className={`h-8 gap-1.5 text-xs ${scopeConfig.buttonBg}`}
            >
              <Plus className="size-3.5" />
              {scopeConfig.buttonText}
            </Button>
          </div>
        </CardHeader>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
            <TabsList className="h-8 p-0.5">
              <TabsTrigger value="all" className="text-xs px-3 h-7">
                All Status
              </TabsTrigger>
              <TabsTrigger value="published" className="text-xs px-3 h-7">
                Published
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs px-3 h-7">
                Drafts
              </TabsTrigger>
              <TabsTrigger value="archived" className="text-xs px-3 h-7">
                Archived
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-3.5" />
            <Input
              placeholder="Filter circulars..."
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
              <p className="text-foreground text-sm font-medium">No Notices Recorded</p>
              <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
                No notices match the active status or search query. Click &apos;{scopeConfig.buttonText}&apos; to draft or dispatch a collegiate circular.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredNotices.map((notice) => (
                <div
                  key={notice.id}
                  onClick={() => handleNoticeClick(notice)}
                  className={`group border-border/60 hover:border-primary/50 hover:bg-muted/30 cursor-pointer rounded-lg border p-3.5 transition-all ${
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
                      <Badge
                        variant={
                          notice.status === 'published'
                            ? 'default'
                            : notice.status === 'draft'
                              ? 'secondary'
                              : 'outline'
                        }
                        className="text-[10px] capitalize"
                      >
                        {notice.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <Calendar className="size-3" />
                      <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
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
                      <span>{notice.author?.name || 'Governance Staff'}</span>
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
                      <span className="text-primary group-hover:underline font-medium text-xs flex items-center gap-1">
                        <BarChart2 className="size-3" />
                        Inspect Notice &amp; Ledger &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scope Policy Footnote */}
          <div className="border-border/30 bg-muted/20 text-muted-foreground mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-primary" />
              <span>{scopeConfig.policyText}</span>
            </div>
            <span className="font-mono text-[10px]">AUTH-VERIFIED</span>
          </div>
        </CardContent>
      </Card>

      {/* Notice Detail Dialog */}
      <NoticeDetailDialog
        notice={selectedNotice}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onNoticeUpdated={handleNoticeUpdated}
        currentUserRole="super_admin"
      />

      {/* Notice Form Dialog */}
      <NoticeFormDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onNoticeCreated={handleNoticeCreated}
        currentUserRole="super_admin"
        adminSubRole={activeScope}
      />
    </>
  );
}
