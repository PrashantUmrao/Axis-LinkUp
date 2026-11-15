'use client';

/**
 * Student Dashboard Campus Polls & Student Sentiment Section.
 * Fetches active polls accessible to the student from /api/v1/polls?status=active.
 * Enforces:
 * - Single-choice or multiple-choice interactive voting.
 * - Confirmed ballot submission.
 * - Strict ballot immutability (Approved Policy 2: Student votes are immutable once cast).
 * - Context-aware results visualization (only revealed when allowed by resultsVisibility policy).
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
import type { PollDTO } from '@/types/poll';
import { Vote, RefreshCw, AlertCircle, ShieldCheck, BarChart3 } from 'lucide-react';

export function StudentPollSection() {
  const [polls, setPolls] = useState<PollDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/polls?status=active');
      if (!res.ok) {
        throw new Error(`Failed to load campus polls: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.polls)) {
        setPolls(json.data.polls);
      } else {
        setPolls([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load campus polls');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handlePollUpdated = (updated: PollDTO) => {
    setPolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-3 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <Vote className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Campus Polls &amp; Feedback</CardTitle>
            <CardDescription className="text-xs">
              Cast your vote on departmental initiatives, curriculum surveys, and campus activities
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
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
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
            <p className="text-foreground text-sm font-medium">No Active Polls</p>
            <p className="text-muted-foreground text-xs mt-1 max-w-sm mx-auto">
              There are currently no active polls or sentiment surveys for your cohort. New polls created by faculty or administration will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                onPollUpdated={handlePollUpdated}
                currentUserRole="student"
              />
            ))}
          </div>
        )}

        {/* Security & Immutability Notice */}
        <div className="border-border/30 bg-muted/20 text-muted-foreground mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="text-emerald-500 size-3.5" />
            <span>
              Institutional Policy: Student votes are recorded with strict ballot immutability.
            </span>
          </div>
          <span className="font-mono text-[10px]">POLICY-2-ACTIVE</span>
        </div>
      </CardContent>
    </Card>
  );
}
