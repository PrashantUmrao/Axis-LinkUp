'use client';

/**
 * Student Grievance & Redressal Desk Component.
 * AICTE / UGC statutory student grievance redressal portal integration.
 * Enables students to lodge formal petitions directly to HOD with escalation to Director.
 */

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { ShieldAlert, FileText, ArrowUpRight, Scale, Clock, CheckCircle } from 'lucide-react';

export function StudentGrievancePortalCard() {
  return (
    <Card variant="glass" className="border-glass-border space-y-4 border p-5">
      <CardHeader className="flex flex-row items-center justify-between p-0 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <Scale className="size-4" />
          </div>
          <div>
            <CardTitle className="font-heading text-foreground text-sm font-bold">
              Statutory Grievance Redressal
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              AICTE / UGC Mandated Student Rights &amp; Grievance Redressal Portal
            </p>
          </div>
        </div>

        <Badge variant="glass" className="text-primary gap-1 font-mono text-[10px]">
          <Clock className="size-3" />
          48h HOD SLA
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Status Strip */}
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
          <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Open Petitions
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-foreground text-xl font-bold">0</span>
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-500">
                <CheckCircle className="size-3" /> Clean Record
              </span>
            </div>
          </div>

          <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Resolution Authority
            </span>
            <div className="text-foreground truncate text-xs font-semibold">Department HOD</div>
            <span className="text-muted-foreground block text-[10px]">
              Escalation: Director Ombudsman
            </span>
          </div>

          <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Confidentiality
            </span>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
              <ShieldAlert className="size-3.5 text-emerald-500" />
              Protected Identity
            </div>
            <span className="text-muted-foreground block text-[10px]">
              Anti-Ragging / Internal Committee
            </span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="border-border/30 flex flex-col items-center justify-between gap-3 border-t pt-2 sm:flex-row">
          <div className="text-muted-foreground text-xs">
            Have an academic, administrative, or harassment concern? File a signed petition.
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Link href="/student/complaints" className="w-full sm:w-auto">
              <Button variant="pill-primary" size="sm" className="w-full gap-1 text-xs sm:w-auto">
                <FileText className="size-3.5" />
                Lodge Grievance
                <ArrowUpRight className="size-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
