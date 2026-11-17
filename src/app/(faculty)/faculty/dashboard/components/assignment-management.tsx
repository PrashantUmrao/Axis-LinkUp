'use client';

/**
 * Faculty Dashboard Assignment Management Section.
 * Overview of coursework evaluations, grading rubrics, and submission counts.
 * Displays live statistics from /api/v1/assignments and links to the full Gradebook portal.
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
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Clock,
  Loader2,
} from 'lucide-react';
import type { AssignmentDTO } from '@/types/assignment';

export function FacultyAssignmentManagement() {
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
        console.error('Failed to load faculty assignments overview', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadAssignments();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalSubmissions = assignments.reduce((sum, a) => sum + (a.submissionCount || 0), 0);
  const totalGraded = assignments.reduce((sum, a) => sum + (a.gradedCount || 0), 0);
  const pendingGrading = Math.max(0, totalSubmissions - totalGraded);

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

        <div className="flex items-center gap-2">
          {pendingGrading > 0 ? (
            <Badge variant="glass" className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
              <Clock className="size-3" />
              {pendingGrading} to Grade
            </Badge>
          ) : (
            <Badge
              variant="glass"
              className="gap-1 text-[10px] font-semibold text-emerald-500"
            >
              <Sparkles className="size-3" />
              Queue Clear
            </Badge>
          )}

          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs font-semibold">
            <Link href="/faculty/assignments">
              <span>Manage</span>
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
            title="Evaluation Queue Clear"
            description="You have no active coursework assignments awaiting evaluation or grading rubrics to publish. Coursework assignments and grading rubrics will appear here once published."
            className="py-8"
          />
        ) : (
          <div className="space-y-3">
            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Assignments</span>
                <p className="mt-1 text-lg font-black">{assignments.length}</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Submissions</span>
                <p className="mt-1 text-lg font-black">{totalSubmissions}</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5">
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">Graded</span>
                <p className="mt-1 text-lg font-black text-emerald-500">{totalGraded}</p>
              </div>
            </div>

            {/* Recent Assignments List */}
            <div className="space-y-2">
              {assignments.slice(0, 3).map((assignment) => (
                <div
                  key={assignment.id}
                  className="border-border/40 bg-background/50 flex items-center justify-between rounded-lg border p-2.5 text-xs shadow-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="font-mono text-[9px]">
                        {assignment.courseCode}
                      </Badge>
                      <span className="truncate font-semibold text-foreground">
                        {assignment.title}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                      Due: {new Date(assignment.dueDate).toLocaleDateString()} • {assignment.submissionCount || 0} Submissions
                    </p>
                  </div>

                  <Badge variant="glass" className="text-[10px] capitalize">
                    {assignment.status}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="pt-1 text-center">
              <Button asChild variant="outline" size="sm" className="w-full text-xs font-semibold">
                <Link href="/faculty/assignments">
                  <span>Open Full Gradebook &amp; Coursework Portal</span>
                </Link>
              </Button>
            </div>
          </div>
        )}

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
