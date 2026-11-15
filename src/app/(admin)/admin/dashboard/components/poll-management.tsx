'use client';

/**
 * Administrator Dashboard Poll Management Section.
 * Surfaces campus polling oversight, departmental surveys, and voting metrics.
 * Configured per activeScope ('sys_admin' | 'hod' | 'director'):
 * - sys_admin / director: Institution-wide student sentiment, governance ballots.
 * - hod: Department-scoped feedback, curriculum sentiment, course election tallies.
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
import { PollCard } from '@/components/polls/poll-card';
import { PollCreateDialog } from '@/components/polls/poll-create-dialog';
import type { PollDTO } from '@/types/poll';
import {
  BarChart3,
  Plus,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Search,
} from 'lucide-react';

interface AdminPollManagementProps {
  activeScope?: 'sys_admin' | 'hod' | 'director';
}

export function AdminPollManagement({ activeScope = 'sys_admin' }: AdminPollManagementProps) {
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const fetchPolls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = new URL('/api/v1/polls', window.location.origin);
      if (statusFilter !== 'all') {
        url.searchParams.set('status', statusFilter);
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Failed to load polls: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.polls)) {
        setPolls(json.data.polls);
      } else {
        setPolls([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load polls');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handlePollCreated = (newPoll: PollDTO) => {
    setPolls((prev) => [newPoll, ...prev]);
    setIsCreateOpen(false);
  };

  const handlePollUpdated = (updated: PollDTO) => {
    setPolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const filteredPolls = useMemo(() => {
    return polls.filter((poll) => {
      const matchesSearch =
        !searchQuery ||
        poll.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (poll.description && poll.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || poll.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [polls, searchQuery, statusFilter]);

  const scopeConfig = {
    sys_admin: {
      title: 'Institutional Surveys & Campus Polling Desk',
      description: 'Campus-wide student sentiment, governance ballots, and ballot integrity oversight',
      badge: 'Super Admin Polling',
      buttonText: 'Launch Campus Poll',
      buttonBg: 'bg-cyan-600 hover:bg-cyan-700 text-white',
      policyText: 'Ballot immutability and HMAC voter privacy strictly audited per institutional standards.',
    },
    hod: {
      title: 'Department Student Sentiment & Polling Desk',
      description: 'Departmental feedback surveys, elective polling, and cohort sentiment tracking',
      badge: 'HOD Department Scope',
      buttonText: 'Launch Dept Poll',
      buttonBg: 'bg-amber-500 hover:bg-amber-600 text-white',
      policyText: 'Department polls are targeted strictly to students enrolled in your department.',
    },
    director: {
      title: 'Directorate Executive Sentiment & Opinion Polls',
      description: 'College-wide student feedback, institutional policy referendums, and oversight',
      badge: 'Directorate Oversight',
      buttonText: 'Launch Institutional Poll',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      policyText: 'Executive polls provide anonymized sentiment analytics for governing council reviews.',
    },
  }[activeScope];

  return (
    <>
      <Card variant="glass" className="space-y-4 p-6 shadow-sm">
        <CardHeader className="border-border/40 flex flex-col gap-3 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/20">
              <BarChart3 className="size-4" />
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
              onClick={fetchPolls}
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
              <TabsTrigger value="active" className="text-xs px-3 h-7">
                Active
              </TabsTrigger>
              <TabsTrigger value="closed" className="text-xs px-3 h-7">
                Closed
              </TabsTrigger>
              <TabsTrigger value="archived" className="text-xs px-3 h-7">
                Archived
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-3.5" />
            <Input
              placeholder="Filter polls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        <CardContent className="p-0 pt-2 space-y-4">
          {loading && polls.length === 0 ? (
            <div className="space-y-4 py-2">
              {[1, 2].map((i) => (
                <div key={i} className="border-border/40 rounded-xl border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-4 text-center">
              <AlertCircle className="text-destructive mx-auto size-6 mb-1" />
              <p className="text-destructive text-xs font-medium">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPolls}
                className="mt-2 text-xs h-7"
              >
                Retry
              </Button>
            </div>
          ) : filteredPolls.length === 0 ? (
            <div className="border-border/40 rounded-lg border border-dashed p-8 text-center">
              <BarChart3 className="text-muted-foreground/40 mx-auto size-8 mb-2" />
              <p className="text-foreground text-sm font-medium">No Polls Found</p>
              <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
                No surveys or ballots match the selected status. Click &apos;{scopeConfig.buttonText}&apos; to create an institutional poll.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPolls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  onPollUpdated={handlePollUpdated}
                  currentUserRole="super_admin"
                />
              ))}
            </div>
          )}

          {/* Scope Policy Footnote */}
          <div className="border-border/30 bg-muted/20 text-muted-foreground mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="text-cyan-500 size-3.5" />
              <span>{scopeConfig.policyText}</span>
            </div>
            <span className="font-mono text-[10px]">AUTH-VERIFIED</span>
          </div>
        </CardContent>
      </Card>

      {/* Poll Creation Dialog */}
      <PollCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPollCreated={handlePollCreated}
        currentUserRole="super_admin"
        adminSubRole={activeScope}
      />
    </>
  );
}
