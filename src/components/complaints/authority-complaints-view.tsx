'use client';

/**
 * Authority Grievance Management Inbox (HOD & Director Cockpit).
 * Reflects Phase 4.8.2 statutory redressal framework:
 * - HOD scope: Department complaints, 48h SLA, resolve or escalate.
 * - Director scope: Directly addressed complaints & escalated HOD appeals, 7-day SLA.
 */

import React, { useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import {
  Scale,
  Landmark,
  Clock,
  ShieldCheck,
  User,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { ComplaintDetailModal } from './complaint-detail-modal';
import type { ComplaintTicket, ComplaintStatus } from '@/types/complaints';

interface AuthorityComplaintsViewProps {
  initialComplaints: ComplaintTicket[];
  authorityRole: 'hod' | 'director';
  departmentName?: string;
}

export function AuthorityComplaintsView({
  initialComplaints,
  authorityRole,
  departmentName = 'Computer Science & Engineering',
}: AuthorityComplaintsViewProps) {
  const [complaints, setComplaints] = useState<ComplaintTicket[]>(initialComplaints);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'pending' | 'under_review' | 'resolved' | 'escalated'
  >('all');
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintTicket | null>(null);

  const isDirector = authorityRole === 'director';

  const filteredComplaints = complaints.filter((c) => {
    // Scope boundary check
    if (!isDirector && c.recipientRole !== 'hod') return false;

    if (activeFilter === 'pending') return c.status === 'submitted';
    if (activeFilter === 'under_review') return c.status === 'under_review';
    if (activeFilter === 'resolved') return c.status === 'resolved';
    if (activeFilter === 'escalated') return c.status === 'escalated';
    return true;
  });

  const handleAddResponse = (
    complaintId: string,
    responseText: string,
    action?: 'resolve' | 'escalate'
  ) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== complaintId) return c;

        const newResponse = {
          id: `resp-${Date.now()}`,
          authorId: 'auth-user',
          authorName: isDirector ? 'Executive Director (Ombudsman)' : 'Dr. R. K. Verma (HOD)',
          authorRole: isDirector ? ('director' as const) : ('faculty' as const),
          message: responseText,
          timestamp: 'Just now',
          actionTaken:
            action === 'resolve'
              ? 'Marked as Resolved'
              : action === 'escalate'
                ? 'Escalated to Director Ombudsman'
                : 'Response Recorded',
        };

        const updatedStatus: ComplaintStatus =
          action === 'resolve' ? 'resolved' : action === 'escalate' ? 'escalated' : 'responded';

        return {
          ...c,
          status: updatedStatus,
          updatedAt: 'Just now',
          responses: [...c.responses, newResponse],
        };
      })
    );

    // Update active modal reference if open
    if (selectedComplaint && selectedComplaint.id === complaintId) {
      setSelectedComplaint((prev) =>
        prev
          ? {
              ...prev,
              status:
                action === 'resolve'
                  ? 'resolved'
                  : action === 'escalate'
                    ? 'escalated'
                    : 'responded',
              responses: [
                ...prev.responses,
                {
                  id: `resp-${Date.now()}`,
                  authorId: 'auth-user',
                  authorName: isDirector
                    ? 'Executive Director (Ombudsman)'
                    : 'Dr. R. K. Verma (HOD)',
                  authorRole: isDirector ? 'director' : 'faculty',
                  message: responseText,
                  timestamp: 'Just now',
                  actionTaken:
                    action === 'resolve'
                      ? 'Marked as Resolved'
                      : action === 'escalate'
                        ? 'Escalated to Director Ombudsman'
                        : 'Response Recorded',
                },
              ],
            }
          : null
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="bg-card/60 border-glass-border flex flex-col justify-between gap-4 rounded-2xl border p-5 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-12 shrink-0 items-center justify-center rounded-xl ring-1">
            {isDirector ? (
              <Landmark className="size-6 text-indigo-500" />
            ) : (
              <Scale className="text-primary size-6" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-foreground text-xl font-bold tracking-tight">
                {isDirector
                  ? 'Directorate Statutory Appeals Inbox'
                  : 'HOD Grievance Adjudication Inbox'}
              </h1>
              <Badge variant="glass" className="text-primary text-[10px]">
                {isDirector ? 'Ombudsman Tribunal' : departmentName}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {isDirector
                ? 'Institutional ombudsman portal adjudicating direct petitions and escalated HOD appeals'
                : 'First-authority departmental redressal cell under AICTE mandatory guidelines'}
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          className="gap-1 self-start font-mono text-xs text-emerald-500 sm:self-center"
        >
          <ShieldCheck className="size-3.5 text-emerald-500" />
          {isDirector ? 'Ombudsman Jurisdiction' : 'ABAC Department Scope'}
        </Badge>
      </div>

      {/* KPI Metrics Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Dockets
          </span>
          <div className="font-heading text-foreground text-2xl font-bold">{complaints.length}</div>
          <p className="text-muted-foreground text-[10px]">Assigned cases</p>
        </div>

        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Pending Action
          </span>
          <div className="font-heading text-2xl font-bold text-amber-500">
            {
              complaints.filter((c) => c.status === 'submitted' || c.status === 'under_review')
                .length
            }
          </div>
          <p className="text-muted-foreground text-[10px]">Within SLA timer</p>
        </div>

        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Escalated
          </span>
          <div className="font-heading text-2xl font-bold text-rose-500">
            {complaints.filter((c) => c.status === 'escalated').length}
          </div>
          <p className="text-muted-foreground text-[10px]">Directorate tribunal</p>
        </div>

        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Resolved
          </span>
          <div className="font-heading text-2xl font-bold text-emerald-500">
            {complaints.filter((c) => c.status === 'resolved').length}
          </div>
          <p className="text-muted-foreground text-[10px]">Settled &amp; recorded</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="space-y-4">
        <div className="border-border/30 flex items-center gap-1.5 overflow-x-auto border-b pb-2">
          {(
            [
              ['all', 'All Dockets'],
              ['pending', 'Pending Review'],
              ['under_review', 'Under Investigation'],
              ['resolved', 'Resolved Cases'],
              ['escalated', 'Escalations'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                activeFilter === key
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Complaints List */}
        {filteredComplaints.length === 0 ? (
          <Card variant="glass" className="border-glass-border space-y-2 border p-12 text-center">
            <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
            <h3 className="font-heading text-foreground text-base font-bold">
              Inbox Clear — No Dockets in this View
            </h3>
            <p className="text-muted-foreground mx-auto max-w-sm text-xs">
              All student grievances within this category have been adjudicated and recorded.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredComplaints.map((c) => (
              <Card
                key={c.id}
                variant="glass"
                className="border-glass-border hover:border-glass-border-hover space-y-3 border p-4 transition-all duration-200 hover:-translate-y-0.5 sm:p-5"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground font-mono text-xs font-semibold">
                      {c.ticketNumber}
                    </span>
                    <Badge
                      variant={
                        c.status === 'resolved'
                          ? 'success'
                          : c.status === 'escalated'
                            ? 'destructive'
                            : c.status === 'under_review'
                              ? 'warning'
                              : 'outline'
                      }
                    >
                      {c.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="glass" className="text-[10px] capitalize">
                      {c.category.replace('_', ' ')}
                    </Badge>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      Filed {c.submittedAt}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-xs text-amber-500">
                    <Clock className="size-3.5" />
                    <span>{c.slaRemainingHours}h SLA Active</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-heading text-foreground text-sm font-bold sm:text-base">
                    {c.subject}
                  </h3>
                  <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                    {c.narrative}
                  </p>
                </div>

                <div className="border-border/30 flex flex-col justify-between gap-2 border-t pt-2 text-xs sm:flex-row sm:items-center">
                  <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                    <User className="text-primary size-3.5 shrink-0" />
                    <span>
                      <strong className="text-foreground">{c.studentName}</strong> (Roll:{' '}
                      {c.studentRoll}) • {c.department}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="pill-primary"
                      size="sm"
                      onClick={() => setSelectedComplaint(c)}
                      className="h-7 gap-1 px-3 text-xs"
                    >
                      Adjudicate Docket
                      <ChevronRight className="size-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Adjudication Detail Modal */}
      <ComplaintDetailModal
        complaint={selectedComplaint}
        isOpen={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        currentUserRole={isDirector ? 'admin' : 'faculty'}
        onAddResponse={handleAddResponse}
      />
    </div>
  );
}
