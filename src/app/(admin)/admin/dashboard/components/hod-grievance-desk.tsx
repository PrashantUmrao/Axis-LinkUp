'use client';

/**
 * Head of Department (HOD) Grievance Adjudication Desk.
 * Fetches live departmental complaints from /api/v1/complaints and routes actions
 * directly to the live Grievance Tribunal portal (/admin/complaints).
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton } from '@/components/ui';
import { Scale, Clock, ArrowUpRight, CheckCircle2, ShieldAlert } from 'lucide-react';

interface LiveGrievanceRow {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  submittedAt: string;
  slaRemainingHours?: number;
  studentDetails?: {
    fullName?: string;
    rollNumber?: string;
  };
}

export function HodGrievanceDesk() {
  const [grievances, setGrievances] = useState<LiveGrievanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/complaints?recipientRole=hod&limit=5')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active) return;
        if (json?.success && Array.isArray(json.data)) {
          setGrievances(json.data);
        }
      })
      .catch(() => {
        // Non-blocking fallback to empty queue state
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
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <Scale className="size-4" />
          </div>
          <div>
            <CardTitle className="font-heading text-foreground text-sm font-bold">
              HOD Department Grievance Adjudication
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Tier-1 Grievance Redressal Cell — First authority for departmental concerns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="warning" className="gap-1 font-mono text-[10px]">
            <Clock className="size-3" />
            48h SLA Active
          </Badge>
          <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs">
            <Link href="/admin/complaints">
              Open Tribunal
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
        ) : grievances.length === 0 ? (
          <div className="border-border/50 bg-muted/10 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center">
            <Scale className="text-muted-foreground/50 size-6" />
            <p className="text-foreground text-xs font-semibold">
              No Pending Departmental Grievances
            </p>
            <p className="text-muted-foreground max-w-sm text-[11px]">
              Active HOD-scoped petitions will appear here in real time. Open the full Grievance
              Tribunal to inspect historical cases and SLA telemetry.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 h-7 gap-1 text-xs">
              <Link href="/admin/complaints">
                Go to Grievance Portal
                <ArrowUpRight className="size-3" />
              </Link>
            </Button>
          </div>
        ) : (
          grievances.map((grievance) => (
            <div
              key={grievance.id}
              className="bg-card/40 border-glass-border hover:border-glass-border-hover space-y-3 rounded-xl border p-3.5 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px]">
                      {grievance.ticketNumber}
                    </Badge>
                    <Badge variant="glass" className="px-1.5 py-0 text-[9px] capitalize">
                      {grievance.category.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="secondary" className="px-1.5 py-0 text-[9px] capitalize">
                      {grievance.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <h4 className="font-heading text-foreground text-xs font-bold sm:text-sm">
                    {grievance.subject}
                  </h4>
                </div>

                {typeof grievance.slaRemainingHours === 'number' && (
                  <div className="shrink-0 text-right">
                    <span className="flex items-center gap-1 font-mono text-[10px] font-medium text-amber-500">
                      <Clock className="size-3" />
                      {grievance.slaRemainingHours}h SLA Left
                    </span>
                  </div>
                )}
              </div>

              <div className="border-border/30 flex flex-col items-start justify-between gap-2 border-t pt-2 text-xs sm:flex-row sm:items-center">
                <div className="text-muted-foreground text-[11px]">
                  Complainant:{' '}
                  <span className="text-foreground font-medium">
                    {grievance.studentDetails?.fullName || 'Verified Student'}
                  </span>
                  {grievance.studentDetails?.rollNumber && (
                    <> (Roll: {grievance.studentDetails.rollNumber})</>
                  )}
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
                      Review &amp; Adjudicate
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}

        <div className="border-border/30 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
          <span className="flex items-center gap-1">
            <ShieldAlert className="size-3.5 text-amber-500" />
            Statutory AICTE Redressal Compliance required within 48 business hours
          </span>
          <Link
            href="/admin/complaints"
            className="text-primary text-[11px] font-medium hover:underline"
          >
            HOD Tribunal Log &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
