'use client';

/**
 * Executive Director Institutional Appeals Desk.
 * Fetches live Director-scoped appeals from /api/v1/complaints and links actions
 * directly to the live Grievance Tribunal portal (/admin/complaints).
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton } from '@/components/ui';
import { Landmark, ShieldAlert, Clock, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface LiveDirectorAppeal {
  id: string;
  ticketNumber: string;
  subject: string;
  priority: string;
  status: string;
  departmentDetails?: {
    name?: string;
    code?: string;
  };
  escalation?: {
    isEscalated?: boolean;
    escalatedByName?: string;
  };
}

export function DirectorAppealDesk() {
  const [appeals, setAppeals] = useState<LiveDirectorAppeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/complaints?recipientRole=director&limit=5')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active) return;
        if (json?.success && Array.isArray(json.data)) {
          setAppeals(json.data);
        }
      })
      .catch(() => {
        // Non-blocking fallback for non-Director viewers or offline state
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card variant="glass" className="border-glass-border space-y-4 border p-5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-0 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <Landmark className="size-4" />
          </div>
          <div>
            <CardTitle className="font-heading text-foreground text-sm font-bold">
              Directorate Statutory Appeals Desk
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Executive Institutional Authority — Ombudsman tribunal and campus-wide governance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="glass" className="text-primary gap-1 font-mono text-[10px]">
            <Clock className="size-3" />
            7-Day Tribunal SLA
          </Badge>
          <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs">
            <Link href="/admin/complaints">
              Full Docket
              <ArrowUpRight className="size-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        {loading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : appeals.length === 0 ? (
          <div className="border-border/50 bg-muted/10 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center">
            <Landmark className="text-muted-foreground/50 size-6" />
            <p className="text-foreground text-xs font-semibold">
              No Active Directorate Appeals in Queue
            </p>
            <p className="text-muted-foreground max-w-sm text-[11px]">
              Escalated ombudsman appeals and Director-only confidential cases appear exclusively
              for verified Executive Director sessions.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 h-7 gap-1 text-xs">
              <Link href="/admin/complaints">
                Open Grievance Tribunal
                <ArrowUpRight className="size-3" />
              </Link>
            </Button>
          </div>
        ) : (
          appeals.map((appeal) => (
            <div
              key={appeal.id}
              className="bg-card/40 border-glass-border hover:border-glass-border-hover space-y-3 rounded-xl border p-3.5 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px]">
                      {appeal.ticketNumber}
                    </Badge>
                    {appeal.departmentDetails?.name && (
                      <Badge variant="glass" className="px-1.5 py-0 text-[9px]">
                        {appeal.departmentDetails.name}
                      </Badge>
                    )}
                    <Badge
                      variant={appeal.priority === 'urgent' ? 'destructive' : 'warning'}
                      className="px-1.5 py-0 text-[9px] capitalize"
                    >
                      {appeal.priority}
                    </Badge>
                  </div>
                  <h4 className="font-heading text-foreground text-xs font-bold sm:text-sm">
                    {appeal.subject}
                  </h4>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-primary font-mono text-[10px]">
                    {appeal.escalation?.isEscalated
                      ? `Escalated${appeal.escalation.escalatedByName ? ` by ${appeal.escalation.escalatedByName}` : ''}`
                      : 'Direct Ombudsman Petition'}
                  </span>
                </div>
              </div>

              <div className="border-border/30 flex flex-col items-start justify-between gap-2 border-t pt-2 text-xs sm:flex-row sm:items-center">
                <div className="text-muted-foreground text-[11px]">
                  Jurisdiction: Executive Director final review under AICTE ombudsman regulations.
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-glass-border h-7 gap-1 px-2.5 text-xs"
                  >
                    <Link href="/admin/complaints">
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      Open Adjudication
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}

        <div className="border-border/30 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
          <span className="flex items-center gap-1">
            <ShieldAlert className="text-primary size-3.5" />
            Executive Ombudsman decisions are final and binding on all institutional departments
          </span>
          <Link
            href="/admin/complaints"
            className="text-primary text-[11px] font-medium hover:underline"
          >
            Statutory AICTE Roster &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
