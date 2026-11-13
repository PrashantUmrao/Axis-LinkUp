'use client';

/**
 * Administrator Dashboard Notice Management Section.
 * College circulars & bulletin management desk.
 * Strictly adheres to truth-in-UI requirements and departmental authorization scopes.
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
import { Megaphone, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';

export function AdminNoticeManagement() {
  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      {/* Header */}
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <Megaphone className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              College Circulars &amp; Broadcast Desk
            </CardTitle>
            <CardDescription className="text-xs">
              Author, schedule, and dispatch official collegiate announcements and circulars
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
          icon={<Megaphone className="size-6 stroke-[1.5] text-amber-500" />}
          title="No College Circulars Published"
          description="Official institutional bulletins, examination notices, fee notifications, and departmental circulars will be drafted, scheduled, and dispatched here once Phase 5 broadcast desk activates."
          className="border-border/60 bg-muted/10 py-10"
        />

        {/* Notice Scope & Authority Matrix */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Departmental Publishing Scope */}
          <div className="border-border/40 bg-muted/20 space-y-1 rounded-xl border p-3.5">
            <div className="flex items-center gap-1.5 text-emerald-500">
              <CheckCircle2 className="size-3.5" />
              <span className="font-heading text-foreground text-xs font-semibold">
                Department Broadcast Scope
              </span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Administrators hold authority to publish circulars for their assigned department (
              <code className="text-[10px]">notices:publish_college: DEPT</code>).
            </p>
          </div>

          {/* Emergency Restriction Standard */}
          <div className="border-border/40 bg-muted/20 space-y-1 rounded-xl border p-3.5">
            <div className="flex items-center gap-1.5 text-amber-500">
              <ShieldAlert className="size-3.5" />
              <span className="font-heading text-foreground text-xs font-semibold">
                Emergency Siren Restricted
              </span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              High-priority emergency alarms (<code className="text-[10px]">emergency:trigger</code>
              ) require central executive authorization (Super Admin).
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="border-border/40 text-muted-foreground flex items-center gap-2 border-t pt-3 text-[11px]">
          <FileText className="size-3.5 shrink-0 text-amber-500" />
          <span>
            Publishing Policy: All collegiate circulars are cryptographically archived and broadcast
            across email &amp; in-app notification streams.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
