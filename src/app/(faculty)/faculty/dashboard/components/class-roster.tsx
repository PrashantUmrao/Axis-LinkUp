'use client';

/**
 * Faculty Dashboard Class & Subject Roster.
 * Displays assigned courses, sections, and department curriculum.
 * Strictly isolates data to the authenticated faculty member's authorized scope.
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
import { BookOpen, ShieldCheck, Sparkles } from 'lucide-react';

export function FacultyClassRoster() {
  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <BookOpen className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Teaching Allocations &amp; Course Sections
            </CardTitle>
            <CardDescription className="text-xs">
              Class sections, theoretical lectures, and laboratory batches assigned to your faculty
              scope
            </CardDescription>
          </div>
        </div>

        <Badge variant="outline" className="gap-1 self-start text-[10px] sm:self-auto">
          <Sparkles className="text-primary size-3" />
          Department Scope
        </Badge>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        {/* Zero-Classroom Empty State */}
        <EmptyState
          glass
          title="No Course Sections Assigned Yet"
          description="Your departmental teaching timetable has not been linked to your faculty profile. Course allocations, batch sections, and syllabus modules will synchronize upon semester academic scheduling in Phase 5."
          className="py-8"
        />

        {/* Departmental Isolation Privacy Footnote */}
        <div className="border-border/30 bg-muted/20 text-muted-foreground mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>
              Class rosters enforce Departmental Isolation boundaries (DOC-AUTH-005 ABAC).
            </span>
          </div>
          <span className="font-mono text-[10px]">DEPT-ISOLATED</span>
        </div>
      </CardContent>
    </Card>
  );
}
