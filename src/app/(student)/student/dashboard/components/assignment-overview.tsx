'use client';

/**
 * Student Dashboard Assignment Overview Section.
 * Fetches real active coursework from /api/v1/assignments and provides
 * quick status indicators, submission progress, and a direct portal launcher.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  EmptyState,
} from '@/components/ui';
import {
  FileCheck2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Clock,
  Loader2,
} from 'lucide-react';
import type { AssignmentDTO } from '@/types/assignment';

export function StudentAssignmentOverview() {
  const [assignments, setAssignments] = useState<AssignmentDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadAssignments() {
      try {
        const res = await fetch('/api/v1/assignments?limit=10');
        const json = await res.json();
        if (isMounted && res.ok && json.success && Array.isArray(json.data?.assignments)) {
          setAssignments(json.data.assignments as AssignmentDTO[]);
        }
      } catch (err) {
        console.error('Failed to load dashboard assignments overview', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadAssignments();
    return () => {
      isMounted = false;
    };
  }, []);

  const now = new Date();
  const pendingAssignments = assignments.filter(
    (a) => !a.userSubmission && new Date(a.dueDate) >= now
  );

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

        <div className="flex items-center gap-2">
          {pendingAssignments.length > 0 ? (
            <Badge variant="glass" className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
              <Clock className="size-3" />
              {pendingAssignments.length} Pending
            </Badge>
          ) : (
            <Badge
              variant="glass"
              className="gap-1 text-[10px] font-semibold text-emerald-500"
            >
              <Sparkles className="size-3" />
              All Clear
            </Badge>
          )}

          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs font-semibold">
            <Link href="/student/assignments">
              <span>View All</span>
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState
            glass
            title="No Active Coursework"
            description="You have no outstanding assignments due for submission. Coursework deadlines and grading rubrics will synchronize automatically when course instructors publish modules."
            className="py-8"
          />
        ) : (
          <div className="space-y-2.5">
            {assignments.slice(0, 3).map((assignment) => {
              const isPastDue = new Date(assignment.dueDate) < now;
              const sub = assignment.userSubmission;

              return (
                <div
                  key={assignment.id}
                  className="border-border/40 bg-background/50 flex items-center justify-between rounded-lg border p-3 text-xs shadow-xs"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[9px]">
                        {assignment.courseCode}
                      </Badge>
                      <span className="truncate font-semibold text-foreground">
                        {assignment.title}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 flex items-center gap-3 text-[11px]">
                      <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{assignment.maxMarks} Marks</span>
                    </div>
                  </div>

                  <div>
                    {sub?.isGraded ? (
                      <Badge variant="glass" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        {sub.marksObtained}/{assignment.maxMarks}
                      </Badge>
                    ) : sub ? (
                      <Badge variant="glass" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px]">
                        Submitted
                      </Badge>
                    ) : isPastDue ? (
                      <Badge variant="glass" className="bg-destructive/10 text-destructive text-[10px]">
                        Overdue
                      </Badge>
                    ) : (
                      <Badge variant="glass" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="pt-2 text-center">
              <Button asChild variant="outline" size="sm" className="w-full text-xs font-semibold">
                <Link href="/student/assignments">
                  <span>Open Full Coursework Portal ({assignments.length} assignments)</span>
                </Link>
              </Button>
            </div>
          </div>
        )}

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
