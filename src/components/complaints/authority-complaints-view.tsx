'use client';

/**
 * Authority Grievance Management Inbox (HOD & Director Cockpit).
 * Reflects Phase 5.5 statutory redressal framework:
 * - HOD scope: Department complaints, 48h SLA, review, assign, resolve or escalate.
 * - Director scope: Directly addressed complaints & escalated HOD appeals, 7-day SLA.
 * - SysAdmin scope: Oversight metrics with protected narrative redaction.
 */

import React, { useState, useCallback } from 'react';
import { Card, Badge, Button, Input } from '@/components/ui';
import {
  Scale,
  Landmark,
  Clock,
  User,
  ChevronRight,
  Search,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Inbox,
} from 'lucide-react';
import { ComplaintDetailModal } from './complaint-detail-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-state';
import type {
  ComplaintDTO,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatsDTO,
} from '@/types/complaints';
import type { UserRole } from '@/types/user';

interface AuthorityComplaintsViewProps {
  initialComplaints?: ComplaintDTO[];
  authorityRole: 'hod' | 'director';
  departmentName?: string;
  adminSubRole?: string;
  userRole?: UserRole;
  userId?: string;
}

export function AuthorityComplaintsView({
  initialComplaints = [],
  authorityRole,
  departmentName = 'Computer Science & Engineering',
  adminSubRole,
  userRole = 'admin',
  userId,
}: AuthorityComplaintsViewProps) {
  const [complaints, setComplaints] = useState<ComplaintDTO[]>(initialComplaints);
  const [stats, setStats] = useState<ComplaintStatsDTO | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | ComplaintStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ComplaintCategory>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | ComplaintPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isDirector = authorityRole === 'director';
  const isSysAdmin = userRole === 'super_admin' && adminSubRole === 'sys_admin';

  // Live Refresh Handler
  const refreshComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const [complaintsRes, statsRes] = await Promise.all([
        fetch('/api/v1/complaints?page=1&limit=50'),
        fetch('/api/v1/complaints/stats'),
      ]);

      const complaintsJson = await complaintsRes.json();
      if (complaintsRes.ok && complaintsJson.success && Array.isArray(complaintsJson.data)) {
        setComplaints(complaintsJson.data as ComplaintDTO[]);
      }

      const statsJson = await statsRes.json();
      if (statsRes.ok && statsJson.success && statsJson.data) {
        setStats(statsJson.data as ComplaintStatsDTO);
      }
    } catch (err) {
      console.error('Failed to refresh authority complaints', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleComplaintUpdated = (updatedComplaint: ComplaintDTO) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === updatedComplaint.id ? updatedComplaint : c))
    );
    setSelectedComplaint(updatedComplaint);
    // Refresh stats in background
    fetch('/api/v1/complaints/stats')
      .then((r) => r.json())
      .then((j) => j.success && setStats(j.data))
      .catch(() => {});
  };

  const filteredComplaints = complaints.filter((c) => {
    // Edge scope filtering for HOD vs Director
    if (!isDirector && c.recipientRole !== 'hod') return false;

    if (activeFilter !== 'all' && c.status !== activeFilter) return false;
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
    if (selectedPriority !== 'all' && c.priority !== selectedPriority) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSubject = c.subject.toLowerCase().includes(q);
      const matchTicket = c.ticketNumber.toLowerCase().includes(q);
      const matchRoll = c.studentRoll?.toLowerCase().includes(q);
      const matchStudent = c.studentName?.toLowerCase().includes(q);
      if (!matchSubject && !matchTicket && !matchRoll && !matchStudent) return false;
    }

    return true;
  });

  // Derive counts from stats or local array
  const totalCount = stats?.total ?? complaints.length;
  const underReviewCount = stats?.underReview ?? complaints.filter((c) => c.status === 'under_review').length;
  const inProgressCount = stats?.inProgress ?? complaints.filter((c) => c.status === 'in_progress').length;
  const resolvedCount = stats?.resolved ?? complaints.filter((c) => c.status === 'resolved').length;
  const escalatedCount = stats?.escalated ?? complaints.filter((c) => c.status === 'escalated').length;
  const breachedCount = stats?.slaBreached ?? complaints.filter((c) => c.sla?.isBreached).length;

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

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive" className="uppercase text-[9px]">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning" className="uppercase text-[9px]">High</Badge>;
      case 'medium':
        return <Badge variant="info" className="uppercase text-[9px]">Medium</Badge>;
      default:
        return <Badge variant="outline" className="uppercase text-[9px]">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Cockpit Header */}
      <div className="bg-card/60 border-glass-border flex flex-col justify-between gap-4 rounded-2xl border p-5 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-xl ring-1 ${
              isDirector
                ? 'bg-indigo-500/10 text-indigo-500 ring-indigo-500/20'
                : 'bg-primary/10 text-primary ring-primary/20'
            }`}
          >
            {isDirector ? <Landmark className="size-6" /> : <Scale className="size-6" />}
          </div>

          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-foreground text-xl font-bold tracking-tight">
                {isDirector
                  ? 'Directorate Grievance Ombudsman'
                  : 'HOD Grievance Redressal Inbox'}
              </h1>
              <Badge variant="glass" className="text-primary text-[10px]">
                {isDirector ? 'Campus Ombudsman Tribunal' : 'AICTE Tier-1 Adjudication'}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {isDirector
                ? 'Executive Director Higher Authority Grievance Tribunal, Institutional Appeals & Overrides'
                : `Departmental Inquiry & Student Redressal Jurisdiction: ${departmentName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Badge variant="outline" className="font-mono text-xs">
            {isDirector ? 'Ombudsman SLA: 7 Days' : 'Department SLA: 48 Hours'}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshComplaints}
            disabled={isLoading}
            className="h-8 text-xs"
          >
            {isLoading ? <LoadingSpinner size="xs" /> : 'Refresh Docket'}
          </Button>
        </div>
      </div>

      {/* System Administrator Privacy Notice */}
      {isSysAdmin && (
        <div className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-3 rounded-xl border p-4 text-xs leading-relaxed">
          <ShieldAlert className="size-5 shrink-0 text-amber-500" />
          <div>
            <strong>Central IT Administrative Oversight Mode:</strong> You are viewing institutional grievance telemetry. Substantive petition statements, evidence narratives, and confidential communications are redacted from IT administrators to maintain AICTE statutory confidentiality.
          </div>
        </div>
      )}

      {/* Authority KPI Telemetry Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            Total In Docket
          </span>
          <div className="text-foreground text-xl font-bold font-mono">{totalCount}</div>
        </Card>
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            Under Review
          </span>
          <div className="text-amber-500 text-xl font-bold font-mono">{underReviewCount}</div>
        </Card>
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            In Progress
          </span>
          <div className="text-sky-500 text-xl font-bold font-mono">{inProgressCount}</div>
        </Card>
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            Resolved
          </span>
          <div className="text-emerald-500 text-xl font-bold font-mono">{resolvedCount}</div>
        </Card>
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            Escalated
          </span>
          <div className="text-rose-500 text-xl font-bold font-mono">{escalatedCount}</div>
        </Card>
        <Card variant="glass" className="p-3.5 space-y-1">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            SLA Breached
          </span>
          <div className={`text-xl font-bold font-mono ${breachedCount > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
            {breachedCount}
          </div>
        </Card>
      </div>

      {/* Query Filters & Search */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="text-muted-foreground absolute left-3 top-2.5 size-4" />
            <Input
              placeholder="Search by ticket, student name, roll number or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card/40 border-glass-border h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as 'all' | ComplaintPriority)}
              className="bg-card/60 border-glass-border text-foreground rounded-lg border px-2.5 py-1 text-xs"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {(
            [
              ['all', 'All Docket Items'],
              ['submitted', 'Submitted'],
              ['under_review', 'Under Review'],
              ['in_progress', 'In Progress'],
              ['resolved', 'Resolved'],
              ['escalated', 'Escalated'],
              ['closed', 'Closed'],
              ['rejected', 'Rejected'],
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
          title="No Matching Grievance Records"
          description={
            searchQuery || activeFilter !== 'all' || selectedCategory !== 'all'
              ? 'No grievances match your current search and filter selections.'
              : 'There are no active grievances registered under your jurisdiction.'
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
                      {getPriorityBadge(complaint.priority)}
                      <Badge variant="glass" className="text-[10px] capitalize">
                        {complaint.category.replace('_', ' ')}
                      </Badge>
                      {complaint.escalatedToDirector && (
                        <Badge variant="destructive" className="text-[9px] gap-1">
                          <ArrowUpRight className="size-2.5" />
                          Directorate Appeal
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-heading text-foreground group-hover:text-primary text-sm font-semibold transition-colors">
                      {complaint.subject}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                      <span className="flex items-center gap-1 text-foreground font-medium">
                        <User className="size-3 text-primary" />
                        {complaint.studentName}
                      </span>
                      <span>Roll: {complaint.studentRoll}</span>
                      <span>Dept: {complaint.department}</span>
                    </div>

                    <p className="text-muted-foreground line-clamp-1 text-xs">
                      {complaint.description || complaint.narrative}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 shrink-0 sm:flex-col sm:items-end">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      {isBreached ? (
                        <div className="flex items-center gap-1 text-rose-500 font-semibold">
                          <AlertTriangle className="size-3.5" />
                          <span>SLA Breached ({complaint.slaRemainingHours}h)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-500">
                          <Clock className="size-3.5" />
                          <span>{complaint.slaRemainingHours}h SLA Active</span>
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
        currentUserRole={userRole}
        currentAdminSubRole={adminSubRole}
        currentUserId={userId}
        onComplaintUpdated={handleComplaintUpdated}
      />
    </div>
  );
}
