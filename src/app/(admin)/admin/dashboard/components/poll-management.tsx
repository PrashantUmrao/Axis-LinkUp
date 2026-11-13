'use client';

/**
 * Administrator Dashboard Poll Management Section.
 * Surfaces campus polling oversight, departmental surveys, and voting metrics.
 * Strictly adheres to truth-in-UI standards and RBAC matrix permissions.
 */

import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  EmptyState,
} from '@/components/ui';
import { BarChart3, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

export function AdminPollManagement() {
  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      {/* Header */}
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/20">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Campus Polls &amp; Student Feedback
            </CardTitle>
            <CardDescription className="text-xs">
              Departmental surveys, voting oversight, and collegiate sentiment analysis
            </CardDescription>
          </div>
        </div>

        <Badge variant="outline" className="self-start text-[10px] sm:self-auto">
          Phase 5
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Empty State */}
        <EmptyState
          icon={<BarChart3 className="size-6 stroke-[1.5] text-cyan-500" />}
          title="No Active Campus Polls"
          description="Department-wide student feedback surveys, curriculum feedback, and collegiate voting ballots will be managed here once Phase 5 polling activates."
          className="border-border/60 bg-muted/10 py-10"
        />

        {/* Polling Scopes & Anonymity Protocol */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Department Survey Authority */}
          <div className="border-border/40 bg-muted/20 space-y-1 rounded-xl border p-3.5">
            <div className="flex items-center gap-1.5 text-cyan-500">
              <CheckCircle2 className="size-3.5" />
              <span className="font-heading text-foreground text-xs font-semibold">
                Department Survey Scope
              </span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Administrators hold authority to initiate departmental feedback surveys (
              <code className="text-[10px]">polls:create_course: DEPT</code>) and inspect aggregated
              tallies.
            </p>
          </div>

          {/* Anonymity & Ballot Integrity */}
          <div className="border-border/40 bg-muted/20 space-y-1 rounded-xl border p-3.5">
            <div className="flex items-center gap-1.5 text-emerald-500">
              <ShieldCheck className="size-3.5" />
              <span className="font-heading text-foreground text-xs font-semibold">
                Cryptographic Ballot Integrity
              </span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Ballots ensure one-vote-per-identity enforcement with anonymized sentiment aggregation
              to protect student candor.
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="border-border/40 text-muted-foreground flex items-center gap-2 border-t pt-3 text-[11px]">
          <Sparkles className="size-3.5 shrink-0 text-cyan-500" />
          <span>
            Governance Standard: Campus polls comply with institutional student senate and academic
            council consultation standards.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
