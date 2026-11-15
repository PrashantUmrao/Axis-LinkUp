'use client';

/**
 * Student Complaints & Grievance Workspace.
 * Title: Complaints & Communication
 * Provides complete petition tracking, SLA status indicators, and compose integration.
 */

import React, { useState, useCallback } from 'react';
import { Card, Badge, Button, Input } from '@/components/ui';
import {
  Scale,
  Plus,
  Clock,
  ChevronRight,
  Landmark,
  Search,
  AlertTriangle,
  Inbox,
  Filter,
} from 'lucide-react';
import { ComplaintComposeForm } from './complaint-compose-form';
import { ComplaintDetailModal } from './complaint-detail-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-state';
import type { ComplaintDTO, ComplaintStatus, ComplaintCategory } from '@/types/complaints';
import type { UserDTO } from '@/types/user';

interface StudentComplaintsViewProps {
  user: UserDTO;
  initialComplaints?: ComplaintDTO[];
}

export function StudentComplaintsView({ user, initialComplaints = [] }: StudentComplaintsViewProps) {
  const [complaints, setComplaints] = useState<ComplaintDTO[]>(initialComplaints);
  const [activeFilter, setActiveFilter] = useState<'all' | ComplaintStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ComplaintCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch complaints from live API
  const refreshComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/complaints?page=1&limit=50');
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setComplaints(json.data as ComplaintDTO[]);
      }
    } catch (err) {
      console.error('Failed to load student complaints', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleComplaintSubmitted = (newComplaint: ComplaintDTO) => {
    setComplaints((prev) => [newComplaint, ...prev.filter((c) => c.id !== newComplaint.id)]);
    setIsComposing(false);
    setSelectedComplaint(newComplaint);
  };

  const handleComplaintUpdated = (updatedComplaint: ComplaintDTO) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === updatedComplaint.id ? updatedComplaint : c))
    );
    setSelectedComplaint(updatedComplaint);
  };

  const filteredComplaints = complaints.filter((c) => {
    if (activeFilter !== 'all' && c.status !== activeFilter) return false;
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSubject = c.subject.toLowerCase().includes(q);
      const matchTicket = c.ticketNumber.toLowerCase().includes(q);
      if (!matchSubject && !matchTicket) return false;
    }
    return true;
  });

  // Calculate live KPIs
  const totalCount = complaints.length;
  const activeCount = complaints.filter(
    (c) => c.status === 'submitted' || c.status === 'under_review' || c.status === 'in_progress'
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.status === 'resolved' || c.status === 'closed'
  ).length;
  const breachedCount = complaints.filter(
    (c) => c.sla?.isBreached || (c.slaRemainingHours !== undefined && c.slaRemainingHours <= 0 && c.status !== 'closed' && c.status !== 'resolved')
  ).length;

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="outline">Submitted</Badge>;
      case 'under_review':
        return <Badge variant="warning">Under Review</Badge>;
      case 'in_progress':
        return <Badge variant="info">In Progress</Badge>;
      case 'responded':
        return <Badge variant="info">Responded</Badge>;
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      case 'closed':
        return <Badge variant="outline">Closed</Badge>;
      case 'escalated':
        return <Badge variant="destructive">Escalated</Badge>;
      case 'reopened':
        return <Badge variant="warning">Reopened</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
              Official collegiate grievance portal for academic, infrastructure, and administrative petitions
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

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            Total Filed
          </span>
          <div className="text-foreground text-xl font-bold font-mono">{totalCount}</div>
        </Card>
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            Under Investigation
          </span>
          <div className="text-amber-500 text-xl font-bold font-mono">{activeCount}</div>
        </Card>
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            Resolved / Concluded
          </span>
          <div className="text-emerald-500 text-xl font-bold font-mono">{resolvedCount}</div>
        </Card>
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            SLA Attention
          </span>
          <div className={`text-xl font-bold font-mono ${breachedCount > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
            {breachedCount}
          </div>
        </Card>
      </div>

      {/* Compose Form Overlay */}
      {isComposing && (
        <ComplaintComposeForm
          user={user}
          onComplaintSubmitted={handleComplaintSubmitted}
          onCancel={() => setIsComposing(false)}
        />
      )}

      {/* Search and Filters Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
            <Input
              placeholder="Search by ticket or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card/40 border-glass-border h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="text-muted-foreground size-3.5" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as 'all' | ComplaintCategory)}
              className="bg-card/60 border-glass-border text-foreground rounded-lg border px-2.5 py-1 text-xs"
            >
              <option value="all">All Categories</option>
              <option value="academic">Academic &amp; Evaluation</option>
              <option value="lab_infrastructure">Lab &amp; Infrastructure</option>
              <option value="hostel">Hostel &amp; Residential</option>
              <option value="harassment">Harassment / Anti-Ragging</option>
              <option value="fee_accounts">Fee &amp; Accounts</option>
              <option value="administrative">Administrative</option>
              <option value="examination">Examination</option>
              <option value="other">Other</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshComplaints}
              disabled={isLoading}
              className="h-8 text-xs"
            >
              {isLoading ? <LoadingSpinner size="xs" /> : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {(
            [
              ['all', 'All Petitions'],
              ['submitted', 'Submitted'],
              ['under_review', 'Under Review'],
              ['in_progress', 'In Progress'],
              ['responded', 'Responded'],
              ['resolved', 'Resolved'],
              ['closed', 'Closed'],
              ['escalated', 'Escalated'],
              ['reopened', 'Reopened'],
            ] as const
          ).map(([statusKey, label]) => (
            <button
              key={statusKey}
              type="button"
              onClick={() => setActiveFilter(statusKey)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activeFilter === statusKey
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card/40 border-glass-border text-muted-foreground hover:bg-muted/40 hover:text-foreground border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Complaints Feed */}
      {isLoading && complaints.length === 0 ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredComplaints.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6 text-primary" />}
          title="No Grievance Petitions Found"
          description={
            searchQuery || activeFilter !== 'all' || selectedCategory !== 'all'
              ? 'No complaints match your active filter criteria.'
              : 'You have not submitted any grievance petitions. Use the button above to lodge an official petition.'
          }
          action={
            !isComposing
              ? {
                  label: 'Lodge New Petition',
                  onClick: () => setIsComposing(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredComplaints.map((complaint) => {
            const isBreached = complaint.sla?.isBreached || (complaint.slaRemainingHours !== undefined && complaint.slaRemainingHours <= 0);
            return (
              <Card
                key={complaint.id}
                variant="glass"
                onClick={() => setSelectedComplaint(complaint)}
                className="hover:border-primary/50 group cursor-pointer p-4 transition-all hover:shadow-md"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {complaint.ticketNumber}
                      </span>
                      {getStatusBadge(complaint.status)}
                      <Badge variant="glass" className="text-[10px] capitalize">
                        {complaint.category.replace('_', ' ')}
                      </Badge>
                      {complaint.recipientRole === 'director' ? (
                        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <Landmark className="size-3 text-indigo-500" />
                          Directorate Appeal
                        </span>
                      ) : (
                        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                          <Scale className="text-primary size-3" />
                          Department HOD
                        </span>
                      )}
                    </div>

                    <h3 className="font-heading text-foreground group-hover:text-primary text-sm font-semibold transition-colors">
                      {complaint.subject}
                    </h3>

                    <p className="text-muted-foreground line-clamp-1 text-xs">
                      {complaint.description || complaint.narrative}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 shrink-0 sm:flex-col sm:items-end">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      {isBreached ? (
                        <div className="flex items-center gap-1 text-rose-500 font-semibold">
                          <AlertTriangle className="size-3.5" />
                          <span>SLA Breached</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-500">
                          <Clock className="size-3.5" />
                          <span>{complaint.slaRemainingHours}h Left</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground text-xs">
                      <span>{complaint.responses.length} responses</span>
                      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Complaint Detail Modal */}
      <ComplaintDetailModal
        complaint={selectedComplaint}
        isOpen={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        currentUserRole="student"
        currentUserId={user.id}
        onComplaintUpdated={handleComplaintUpdated}
      />
    </div>
  );
}
