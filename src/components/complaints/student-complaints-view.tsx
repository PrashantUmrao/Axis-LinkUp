'use client';

/**
 * Student Complaints & Grievance Workspace.
 * Title: Complaints & Communication
 * Provides complete petition tracking, SLA status indicators, and compose integration.
 */

import React, { useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { Scale, Plus, Clock, ChevronRight, Landmark } from 'lucide-react';
import { ComplaintComposeForm } from './complaint-compose-form';
import { ComplaintDetailModal } from './complaint-detail-modal';
import type { ComplaintTicket, ComplaintStatus } from '@/types/complaints';
import type { UserDTO } from '@/types/user';

interface StudentComplaintsViewProps {
  user: UserDTO;
  initialComplaints: ComplaintTicket[];
}

export function StudentComplaintsView({ user, initialComplaints }: StudentComplaintsViewProps) {
  const [complaints, setComplaints] = useState<ComplaintTicket[]>(initialComplaints);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'submitted' | 'under_review' | 'responded' | 'resolved'
  >('all');
  const [isComposing, setIsComposing] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintTicket | null>(null);

  const filteredComplaints = complaints.filter((c) => {
    if (activeFilter === 'all') return true;
    return c.status === activeFilter;
  });

  const handleComplaintSubmitted = (newComplaint: ComplaintTicket) => {
    setComplaints((prev) => [newComplaint, ...prev]);
    setIsComposing(false);
    setSelectedComplaint(newComplaint);
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="outline">Submitted</Badge>;
      case 'under_review':
        return <Badge variant="warning">Under Review</Badge>;
      case 'responded':
        return <Badge variant="info">Responded</Badge>;
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      case 'escalated':
        return <Badge variant="destructive">Escalated</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="bg-card/60 border-glass-border flex flex-col justify-between gap-4 rounded-2xl border p-5 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-12 shrink-0 items-center justify-center rounded-xl ring-1">
            <Scale className="size-6" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-foreground text-xl font-bold tracking-tight">
                Complaints &amp; Communication
              </h1>
              <Badge variant="glass" className="text-primary text-[10px]">
                AICTE / UGC
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              Official collegiate grievance portal for academic, infrastructure, and administrative
              petitions
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="pill-primary"
          size="sm"
          onClick={() => setIsComposing(true)}
          className="shrink-0 gap-1.5 self-start text-xs shadow-xs sm:self-center"
        >
          <Plus className="size-3.5" />
          Compose Complaint
        </Button>
      </div>

      {/* KPI Status Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Filed
          </span>
          <div className="font-heading text-foreground text-2xl font-bold">{complaints.length}</div>
          <p className="text-muted-foreground text-[10px]">All logged petitions</p>
        </div>

        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Under Review
          </span>
          <div className="font-heading text-2xl font-bold text-amber-500">
            {
              complaints.filter((c) => c.status === 'under_review' || c.status === 'submitted')
                .length
            }
          </div>
          <p className="text-muted-foreground text-[10px]">Active in inquiry</p>
        </div>

        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Official Responses
          </span>
          <div className="font-heading text-2xl font-bold text-sky-500">
            {complaints.filter((c) => c.status === 'responded').length}
          </div>
          <p className="text-muted-foreground text-[10px]">Awaiting your review</p>
        </div>

        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3.5">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Resolved
          </span>
          <div className="font-heading text-2xl font-bold text-emerald-500">
            {complaints.filter((c) => c.status === 'resolved').length}
          </div>
          <p className="text-muted-foreground text-[10px]">Case closed</p>
        </div>
      </div>

      {/* If Compose Active, Render Form */}
      {isComposing ? (
        <ComplaintComposeForm
          user={user}
          onComplaintSubmitted={handleComplaintSubmitted}
          onCancel={() => setIsComposing(false)}
        />
      ) : (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="border-border/30 flex items-center gap-1.5 overflow-x-auto border-b pb-2">
            {(
              [
                ['all', 'All Complaints'],
                ['submitted', 'Submitted'],
                ['under_review', 'Under Review'],
                ['responded', 'Responded'],
                ['resolved', 'Resolved'],
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

          {/* Complaints Feed List */}
          {filteredComplaints.length === 0 ? (
            <Card variant="glass" className="border-glass-border space-y-3 border p-12 text-center">
              <Scale className="text-muted-foreground/40 mx-auto size-10" />
              <div className="space-y-1">
                <h3 className="font-heading text-foreground text-base font-bold">
                  No Complaints in this view
                </h3>
                <p className="text-muted-foreground mx-auto max-w-sm text-xs">
                  You have no petitions matching the selected filter. Have an academic or campus
                  issue? File a signed petition.
                </p>
              </div>
              <Button
                variant="pill-primary"
                size="sm"
                onClick={() => setIsComposing(true)}
                className="gap-1 text-xs"
              >
                <Plus className="size-3.5" />
                Compose Complaint
              </Button>
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
                      {getStatusBadge(c.status)}
                      <Badge variant="glass" className="text-[10px] capitalize">
                        {c.category.replace('_', ' ')}
                      </Badge>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {c.submittedAt}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs text-amber-500">
                      <Clock className="size-3.5" />
                      <span>{c.slaRemainingHours}h SLA Left</span>
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
                      <span>Addressed to:</span>
                      <span className="text-foreground flex items-center gap-1 font-semibold">
                        {c.recipientRole === 'director' ? (
                          <Landmark className="size-3 text-indigo-500" />
                        ) : (
                          <Scale className="text-primary size-3" />
                        )}
                        {c.recipientName}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {c.responses.length > 0 && (
                        <span className="text-[11px] font-medium text-emerald-500">
                          {c.responses.length} Official Response{c.responses.length > 1 ? 's' : ''}
                        </span>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedComplaint(c)}
                        className="text-primary h-7 gap-1 px-2.5 text-xs"
                      >
                        View Docket
                        <ChevronRight className="size-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Docket Detail Modal */}
      <ComplaintDetailModal
        complaint={selectedComplaint}
        isOpen={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        currentUserRole="student"
      />
    </div>
  );
}
