'use client';

/**
 * Faculty Dashboard Student Academic Overview.
 * Displays enrolled cohort statistics and academic mentorship status.
 * Strictly enforces student privacy and RBAC/ABAC boundary isolation.
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
import { Users, Lock, Sparkles } from 'lucide-react';

export function FacultyStudentOverview() {
  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/20">
            <Users className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Enrolled Students &amp; Academic Cohorts
            </CardTitle>
            <CardDescription className="text-xs">
              Student roster oversight and academic progress for assigned course sections
            </CardDescription>
          </div>
        </div>

        <Badge variant="outline" className="gap-1 self-start text-[10px] sm:self-auto">
          <Sparkles className="size-3 text-cyan-500" />
          Cohort Oversight
        </Badge>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        {/* Zero-Student Roster Empty State */}
        <EmptyState
          glass
          title="Student Roster Pending Batch Allocation"
          description="Enrolled student counts, submission velocity, and mentorship advising records will populate once course sections are assigned to your faculty profile in Phase 5."
          className="py-8"
        />

        {/* Student Data Protection Footnote */}
        <div className="border-border/30 bg-muted/20 text-muted-foreground mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Lock className="size-3.5 text-cyan-500" />
            <span>
              Student privacy protected. Peer submissions and personal records are isolated per
              DOC-AUTH-005.
            </span>
          </div>
          <span className="font-mono text-[10px]">PRIVACY-ISOLATED</span>
        </div>
      </CardContent>
    </Card>
  );
}
