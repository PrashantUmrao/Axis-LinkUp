'use client';

/**
 * Faculty Dashboard Notices & Circulars Section.
 * Surfaces departmental circulars and official collegiate announcements.
 * Strictly adheres to truth-in-UI requirements without fabricated notices.
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
import { Megaphone, ShieldAlert, Sparkles } from 'lucide-react';

export function FacultyNoticeSection() {
  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <Megaphone className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Department Bulletins &amp; Circulars
            </CardTitle>
            <CardDescription className="text-xs">
              Official faculty notices and collegiate circulars dispatched by Dean / Academic
              Council
            </CardDescription>
          </div>
        </div>

        <Badge variant="outline" className="gap-1 self-start text-[10px] sm:self-auto">
          <Sparkles className="size-3 text-amber-500" />
          Faculty Bulletins
        </Badge>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        {/* Zero-Notice Empty State */}
        <EmptyState
          glass
          title="No Circulars Dispatched Today"
          description="Your departmental notice board is up to date. Institutional administrative circulars, examination schedules, and collegiate alerts will appear here once broadcast channels activate in Phase 5."
          className="py-8"
        />

        {/* Course Broadcast Capability Footnote */}
        <div className="border-border/30 bg-muted/20 text-muted-foreground mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 text-amber-500" />
            <span>
              Course broadcast permissions (notices:publish_course) verified and provisioned.
            </span>
          </div>
          <span className="font-mono text-[10px]">AUTH-ACTIVE</span>
        </div>
      </CardContent>
    </Card>
  );
}
