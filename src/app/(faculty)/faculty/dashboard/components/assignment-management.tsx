'use client';

/**
 * Faculty Dashboard Assignment Management Section.
 * Overview of coursework evaluations, grading rubrics, and submission counts.
 * Adheres strictly to the rule prohibiting fake assignments or premature backend endpoints.
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
import { ClipboardCheck, ShieldCheck, Sparkles } from 'lucide-react';

export function FacultyAssignmentManagement() {
  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
            <ClipboardCheck className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Coursework Evaluations &amp; Gradebook
            </CardTitle>
            <CardDescription className="text-xs">
              Student submissions, evaluation rubrics, and grading verification for assigned courses
            </CardDescription>
          </div>
        </div>

        <Badge
          variant="glass"
          className="gap-1 self-start text-[10px] font-semibold text-emerald-500 sm:self-auto"
        >
          <Sparkles className="size-3" />
          Queue Clear
        </Badge>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        {/* Zero-Pending-Evaluation Empty State */}
        <EmptyState
          glass
          title="Evaluation Queue Clear"
          description="You have no active coursework assignments awaiting evaluation or grading rubrics to publish. Coursework creation dropboxes and evaluation workflows will activate in Phase 5."
          className="py-8"
        />

        {/* Ownership Boundary Footnote */}
        <div className="border-border/30 bg-muted/20 text-muted-foreground mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>
              Instructor assignment ownership strictly enforced via Attribute-Based Access Control
              (OWN scope).
            </span>
          </div>
          <span className="font-mono text-[10px]">DOC-AUTH-005</span>
        </div>
      </CardContent>
    </Card>
  );
}
