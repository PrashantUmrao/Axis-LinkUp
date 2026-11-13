'use client';

/**
 * Head of Department (HOD) Grievance Adjudication Desk.
 * Reflects Phase 4.8.2 student grievance workflow:
 * Departmental complaints triage, 48-hour resolution SLA, and escalation to Director Ombudsman.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { Scale, Clock, ArrowUpRight, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DepartmentGrievance {
  id: string;
  ticketNumber: string;
  title: string;
  category: 'academic' | 'lab_infrastructure' | 'harassment' | 'administrative';
  studentName: string;
  studentRoll: string;
  submittedAt: string;
  slaRemainingHours: number;
  status: 'pending_review' | 'investigation' | 'resolved';
}

const DEPARTMENT_GRIEVANCES: DepartmentGrievance[] = [
  {
    id: 'grv-101',
    ticketNumber: 'GRV-2026-0042',
    title: 'Lab 2 Workstation Network Downtime during Practical Exam',
    category: 'lab_infrastructure',
    studentName: 'Rahul Verma',
    studentRoll: '2101330100045',
    submittedAt: '6 hours ago',
    slaRemainingHours: 42,
    status: 'pending_review',
  },
  {
    id: 'grv-102',
    ticketNumber: 'GRV-2026-0039',
    title: 'Discrepancy in Mid-Term Internal Evaluation Marks for CSE-302',
    category: 'academic',
    studentName: 'Pooja Tiwari',
    studentRoll: '2101330100088',
    submittedAt: '28 hours ago',
    slaRemainingHours: 20,
    status: 'investigation',
  },
];

export function HodGrievanceDesk() {
  return (
    <Card variant="glass" className="border-glass-border space-y-4 border p-5">
      <CardHeader className="flex flex-row items-center justify-between p-0 pb-1">
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

        <Badge variant="warning" className="gap-1 font-mono text-[10px]">
          <Clock className="size-3" />
          48h SLA Active
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        {DEPARTMENT_GRIEVANCES.map((grievance) => (
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
                    {grievance.category.replace('_', ' ')}
                  </Badge>
                  <span className="text-muted-foreground text-[10px]">
                    Filed {grievance.submittedAt}
                  </span>
                </div>
                <h4 className="font-heading text-foreground text-xs font-bold sm:text-sm">
                  {grievance.title}
                </h4>
              </div>

              <div className="shrink-0 text-right">
                <span className="flex items-center gap-1 font-mono text-[10px] font-medium text-amber-500">
                  <Clock className="size-3" />
                  {grievance.slaRemainingHours}h SLA Left
                </span>
              </div>
            </div>

            <div className="border-border/30 flex flex-col items-start justify-between gap-2 border-t pt-2 text-xs sm:flex-row sm:items-center">
              <div className="text-muted-foreground text-[11px]">
                Complainant:{' '}
                <span className="text-foreground font-medium">{grievance.studentName}</span> (Roll:{' '}
                {grievance.studentRoll})
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-glass-border h-7 gap-1 px-2.5 text-xs"
                >
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  Resolve Case
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-rose-500 hover:text-rose-600"
                >
                  <ArrowUpRight className="size-3" />
                  Escalate to Director
                </Button>
              </div>
            </div>
          </div>
        ))}

        <div className="border-border/30 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
          <span className="flex items-center gap-1">
            <ShieldAlert className="size-3.5 text-amber-500" />
            Statutory AICTE Redressal Compliance required within 48 business hours
          </span>
          <span className="text-primary text-[11px] font-medium">HOD Tribunal Log Active</span>
        </div>
      </CardContent>
    </Card>
  );
}
