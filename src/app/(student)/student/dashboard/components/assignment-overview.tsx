'use client';

/**
 * Student Dashboard Assignment Overview Section.
 * Displays pending coursework and submission deadlines.
 * Adheres to the rule prohibiting fake assignments or premature backend endpoints.
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
import { FileCheck2, ShieldCheck, Sparkles } from 'lucide-react';

export function StudentAssignmentOverview() {
  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <FileCheck2 className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Coursework &amp; Assignments</CardTitle>
            <CardDescription className="text-xs">
              Subject submissions, lab records, and academic evaluations
            </CardDescription>
          </div>
        </div>

        <Badge
          variant="glass"
          className="gap-1 self-start text-[10px] font-semibold text-emerald-500 sm:self-auto"
        >
          <Sparkles className="size-3" />
          All Clear
        </Badge>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        {/* Zero-Pending-Assignment Empty State */}
        <EmptyState
          glass
          title="No Pending Coursework"
          description="You have no outstanding assignments due for submission. Coursework deadlines and grading rubrics will synchronize automatically when course instructors publish modules in Phase 5."
          className="py-8"
        />

        {/* Peer-Isolation Privacy Note */}
        <div className="border-border/30 bg-muted/20 text-muted-foreground mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>
              Peer submission isolation enforced via Attribute-Based Access Control (ABAC).
            </span>
          </div>
          <span className="font-mono text-[10px]">DOC-AUTH-005</span>
        </div>
      </CardContent>
    </Card>
  );
}
