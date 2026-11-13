'use client';

/**
 * Executive Director Institutional Appeals Desk.
 * Reflects Phase 4.8.2 statutory escalation workflow:
 * Highest campus authority adjudicating appeals, severe disciplinary cases, and HOD escalations.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { Landmark, ShieldAlert, Clock, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface DirectorAppeal {
  id: string;
  appealNumber: string;
  department: string;
  title: string;
  escalatedFrom: string;
  submittedAt: string;
  severity: 'high' | 'critical' | 'statutory';
}

const ACTIVE_APPEALS: DirectorAppeal[] = [
  {
    id: 'apl-501',
    appealNumber: 'APL-DIR-2026-0008',
    department: 'Computer Science & Eng.',
    title: 'Formal Appeal: Department Lab Infrastructure Grant & System Upgrade Petition',
    escalatedFrom: 'HOD CSE (Dr. R. K. Verma)',
    submittedAt: 'Yesterday, 04:30 PM',
    severity: 'high',
  },
  {
    id: 'apl-502',
    appealNumber: 'APL-DIR-2026-0005',
    department: 'Electronics & Comm.',
    title: 'Academic Standing Petition: Attendance Condonation on Medical Grounds',
    escalatedFrom: 'Direct Ombudsman Appeal',
    submittedAt: '3 days ago',
    severity: 'statutory',
  },
];

export function DirectorAppealDesk() {
  return (
    <Card variant="glass" className="border-glass-border space-y-4 border p-5">
      <CardHeader className="flex flex-row items-center justify-between p-0 pb-1">
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

        <Badge variant="glass" className="text-primary gap-1 font-mono text-[10px]">
          <Clock className="size-3" />
          7-Day Tribunal SLA
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        {ACTIVE_APPEALS.map((appeal) => (
          <div
            key={appeal.id}
            className="bg-card/40 border-glass-border hover:border-glass-border-hover space-y-3 rounded-xl border p-3.5 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px]">
                    {appeal.appealNumber}
                  </Badge>
                  <Badge variant="glass" className="px-1.5 py-0 text-[9px]">
                    {appeal.department}
                  </Badge>
                  <Badge
                    variant={appeal.severity === 'critical' ? 'destructive' : 'warning'}
                    className="px-1.5 py-0 text-[9px] capitalize"
                  >
                    {appeal.severity}
                  </Badge>
                </div>
                <h4 className="font-heading text-foreground text-xs font-bold sm:text-sm">
                  {appeal.title}
                </h4>
              </div>

              <div className="shrink-0 text-right">
                <span className="text-muted-foreground block text-[10px]">
                  Filed {appeal.submittedAt}
                </span>
                <span className="text-primary font-mono text-[10px]">{appeal.escalatedFrom}</span>
              </div>
            </div>

            <div className="border-border/30 flex flex-col items-start justify-between gap-2 border-t pt-2 text-xs sm:flex-row sm:items-center">
              <div className="text-muted-foreground text-[11px]">
                Jurisdiction: Executive Director final review under AICTE ombudsman regulations.
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-glass-border h-7 gap-1 px-2.5 text-xs"
                >
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  Grant Executive Order
                </Button>
                <Button variant="ghost" size="sm" className="text-primary h-7 gap-1 px-2 text-xs">
                  Full Docket
                  <ArrowUpRight className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        <div className="border-border/30 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
          <span className="flex items-center gap-1">
            <ShieldAlert className="text-primary size-3.5" />
            Executive Ombudsman decisions are final and binding on all institutional departments
          </span>
          <span className="text-primary text-[11px] font-medium">Statutory AICTE Roster</span>
        </div>
      </CardContent>
    </Card>
  );
}
