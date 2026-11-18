'use client';

/**
 * Administrator Dashboard Request Tracking Section (MOD-13).
 * Surfaces student service requisition queues, leave clearances, and bonafide approvals.
 * Strictly adheres to truth-in-UI requirements and departmental authorization scopes.
 */

import React from 'react';
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
import { Inbox, Clock, QrCode, ShieldCheck, CheckCircle2, ChevronRight } from 'lucide-react';

interface AdminRequestTrackingProps {
  pendingRequests?: number;
}

export function AdminRequestTracking({ pendingRequests = 0 }: AdminRequestTrackingProps) {
  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      {/* Header */}
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <Inbox className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Service Requisitions &amp; Approvals (MOD-13)
            </CardTitle>
            <CardDescription className="text-xs">
              Process student leave applications, bona fide certificates, and departmental
              clearances
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={pendingRequests > 0 ? 'warning' : 'outline'} className="text-[10px]">
            {pendingRequests > 0 ? `${pendingRequests} Pending` : 'Live Queue'}
          </Badge>
          <Button size="sm" variant="outline" asChild className="text-xs h-7">
            <Link href="/admin/requests" className="flex items-center gap-1">
              <span>Open Queue</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {pendingRequests > 0 ? (
          <div className="border-amber-500/30 bg-amber-500/5 flex flex-col items-start justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p className="font-heading text-foreground text-sm font-semibold">
                {pendingRequests} Student Requisition{pendingRequests === 1 ? '' : 's'} Awaiting Review
              </p>
              <p className="text-muted-foreground text-xs">
                Active bonafide certificates, leave applications, and departmental clearances are
                queued for approval within the 48-hour SLA.
              </p>
            </div>
            <Button size="sm" asChild className="shrink-0 text-xs">
              <Link href="/admin/requests">
                Review Queue
                <ChevronRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={<Inbox className="size-6 stroke-[1.5] text-amber-500" />}
            title="Service Requisition Queue Empty"
            description="All student leave applications, bona fide certificate requests, hostel night passes, and departmental clearances are processed here with verifiable approval audit trails."
            className="border-border/60 bg-muted/10 py-10"
          />
        )}

        {/* SLA Standards & Verification Protocol */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* SLA Turnaround Standard */}
          <div className="border-border/40 bg-muted/20 space-y-1 rounded-xl border p-3.5">
            <div className="flex items-center gap-1.5 text-amber-500">
              <Clock className="size-3.5" />
              <span className="font-heading text-foreground text-xs font-semibold">
                Turnaround SLA
              </span>
            </div>
            <p className="font-heading text-foreground text-sm font-semibold">48 Business Hours</p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Standard institutional turnaround window for bona fide certificates and leave
              clearance.
            </p>
          </div>

          {/* Cryptographic Verification */}
          <div className="border-border/40 bg-muted/20 space-y-1 rounded-xl border p-3.5">
            <div className="flex items-center gap-1.5 text-emerald-500">
              <QrCode className="size-3.5" />
              <span className="font-heading text-foreground text-xs font-semibold">
                Digital Verification
              </span>
            </div>
            <p className="font-heading text-foreground text-sm font-semibold">QR Signed Passes</p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Issued clearances embed cryptographically verifiable QR tokens for campus gate
              security.
            </p>
          </div>

          {/* Departmental Queue Scope */}
          <div className="border-border/40 bg-muted/20 space-y-1 rounded-xl border p-3.5">
            <div className="flex items-center gap-1.5 text-cyan-500">
              <ShieldCheck className="size-3.5" />
              <span className="font-heading text-foreground text-xs font-semibold">
                Approval Scope
              </span>
            </div>
            <p className="font-heading text-foreground text-sm font-semibold">DEPT Scope Gate</p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Clearance authority bounded to assigned departmental queues (
              <code className="text-[10px]">requests:approve_reject: DEPT</code>).
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="border-border/40 text-muted-foreground flex items-center gap-2 border-t pt-3 text-[11px]">
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
          <span>
            Compliance Policy: Requisition decisions generate immutable audit events and dispatch
            SMS/email notifications to students.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
