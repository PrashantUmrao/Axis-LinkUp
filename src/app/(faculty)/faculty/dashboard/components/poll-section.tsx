'use client';

/**
 * Faculty Dashboard Interactive Polls & Sentiment Management Section.
 * Surfaces classroom sentiment surveys and departmental polls.
 * Supports:
 * - Poll creation for courses / classes (Approved Policy 3: Faculty authorized for course/section polls).
 * - Interactive voting on campus & department polls.
 * - Early poll closure & archival for creator.
 * - Real-time result percentage visualizations according to visibility configuration.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Skeleton,
} from '@/components/ui';
import { PollCard } from '@/components/polls/poll-card';
import { PollCreateDialog } from '@/components/polls/poll-create-dialog';
import type { PollDTO } from '@/types/poll';
import { Vote, Plus, RefreshCw, AlertCircle, BarChart3, ShieldCheck } from 'lucide-react';

interface FacultyPollSectionProps {
  user?: {
    id?: string;
    role?: string;
    departmentId?: string | null;
    adminSubRole?: string | null;
  };
}

export function FacultyPollSection({ user }: FacultyPollSectionProps) {
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const fetchPolls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/polls');
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
  }, []);

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

  return (
    <>
      <Card variant="glass" className="space-y-4 p-6 shadow-sm">
        <CardHeader className="border-border/40 flex flex-col gap-3 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
              <Vote className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Classroom Polls &amp; Sentiment
              </CardTitle>
              <CardDescription className="text-xs">
                Launch quick surveys for lecture pacing, assignment deadlines, or elective selections
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              className="h-8 gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Plus className="size-3.5" />
              Create Poll
            </Button>
          </div>
        </CardHeader>

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
          ) : polls.length === 0 ? (
            <div className="border-border/40 rounded-lg border border-dashed p-8 text-center">
              <BarChart3 className="text-muted-foreground/40 mx-auto size-8 mb-2" />
              <p className="text-foreground text-sm font-medium">No Polls Active</p>
              <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
                No active classroom polls or surveys are running. Click &apos;Create Poll&apos; to initiate a student sentiment query.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  onPollUpdated={handlePollUpdated}
                  currentUserRole={user?.role || 'faculty'}
                  currentUserId={user?.id}
                />
              ))}
            </div>
          )}

          {/* Security & Audit Note */}
          <div className="border-border/30 bg-muted/20 text-muted-foreground mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="text-amber-500 size-3.5" />
              <span>
                Policy 3 Active: Faculty poll creation verified. Anonymity preserved using SHA-256 ballot salts.
              </span>
            </div>
            <span className="font-mono text-[10px]">POLICY-3-ACTIVE</span>
          </div>
        </CardContent>
      </Card>

      {/* Poll Creation Dialog */}
      <PollCreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPollCreated={handlePollCreated}
        currentUserRole={user?.role || 'faculty'}
        adminSubRole={user?.adminSubRole}
        departmentId={user?.departmentId}
      />
    </>
  );
}
