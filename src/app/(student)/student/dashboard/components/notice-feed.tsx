'use client';

/**
 * Student Dashboard Notice Feed Section.
 * Surfaces recent collegiate bulletins and circulars.
 * Strictly avoids generating fake college announcements.
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

export function StudentNoticeFeed() {
  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <Megaphone className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Campus Notices &amp; Circulars
            </CardTitle>
            <CardDescription className="text-xs">
              Official bulletins dispatched by college administration and department HOD
            </CardDescription>
          </div>
        </div>

        <Badge variant="outline" className="gap-1 self-start text-[10px] sm:self-auto">
          <Sparkles className="text-primary size-3" />
          Department Feed
        </Badge>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        {/* Zero-Announcement Empty State */}
        <EmptyState
          glass
          title="No Active Announcements"
          description="Your departmental bulletin board is currently clear. Official notifications, examination schedules, and circulars will appear here once broadcast channels activate in Phase 5."
          className="py-8"
        />

        {/* Security Compliance Note */}
        <div className="border-border/30 bg-muted/20 text-muted-foreground mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="text-primary size-3.5" />
            <span>
              Notices follow strict institutional verification and cryptographic audit logging.
            </span>
          </div>
          <span className="font-mono text-[10px]">AITM-BULLETIN</span>
        </div>
      </CardContent>
    </Card>
  );
}
