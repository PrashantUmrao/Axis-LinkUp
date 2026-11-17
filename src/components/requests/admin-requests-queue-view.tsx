'use client';

/**
 * Admin Requests Queue View Component (MOD-13 / Phase 5.8).
 * Triage and fulfillment workspace for Department Admins, HODs, and Directors.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Badge, Button, Input } from '@/components/ui';
import {
  Inbox,
  Search,
  FileText,
  Calendar,
  CreditCard,
  Cpu,
  HelpCircle,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { AdminRequestReviewModal } from './admin-request-review-modal';
import type {
  ServiceRequestDTO,
  ServiceRequestCategory,
  ServiceRequestStatus,
  ServiceRequestPriority,
  ServiceRequestStatsDTO,
} from '@/types/service-request';
import type { UserDTO } from '@/types/user';

interface AdminRequestsQueueViewProps {
  user?: UserDTO;
  initialRequests?: ServiceRequestDTO[];
  initialStats?: ServiceRequestStatsDTO | null;
  departmentScope?: string;
}

export function AdminRequestsQueueView({
  user: _user,
  initialRequests = [],
  initialStats = null,
  departmentScope,
}: AdminRequestsQueueViewProps) {
  const [requests, setRequests] = useState<ServiceRequestDTO[]>(initialRequests);
  const [stats, setStats] = useState<ServiceRequestStatsDTO | null>(initialStats);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ServiceRequestCategory>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | ServiceRequestStatus>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | ServiceRequestPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected for review modal
  const [reviewingRequest, setReviewingRequest] = useState<ServiceRequestDTO | null>(null);
  const [_isLoading, setIsLoading] = useState(false);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reqRes, statsRes] = await Promise.all([
        fetch('/api/v1/requests?page=1&limit=100'),
        fetch('/api/v1/requests/stats'),
      ]);

      const reqJson = await reqRes.json();
      if (reqRes.ok && reqJson.success && reqJson.data?.requests) {
        setRequests(reqJson.data.requests);
      }

      const statsJson = await statsRes.json();
      if (statsRes.ok && statsJson.success && statsJson.data) {
        setStats(statsJson.data);
      }
    } catch (err) {
      console.error('Failed to refresh admin request queue', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleActionSuccess = (updated: ServiceRequestDTO) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
    void refreshData();
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (selectedCategory !== 'all' && req.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && req.status !== selectedStatus) return false;
      if (selectedPriority !== 'all' && req.priority !== selectedPriority) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSubject = req.subject.toLowerCase().includes(q);
        const matchTicket = req.ticketNumber.toLowerCase().includes(q);
        const matchStudent = req.studentSnapshot.fullName.toLowerCase().includes(q);
        const matchRoll = req.studentSnapshot.enrollmentNo.toLowerCase().includes(q);
        if (!matchSubject && !matchTicket && !matchStudent && !matchRoll) return false;
      }

      return true;
    });
  }, [requests, selectedCategory, selectedStatus, selectedPriority, searchQuery]);

  const getCategoryIcon = (category: ServiceRequestCategory) => {
    switch (category) {
      case 'bonafide':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'leave':
        return <Calendar className="h-4 w-4 text-emerald-500" />;
      case 'id_replacement':
        return <CreditCard className="h-4 w-4 text-purple-500" />;
      case 'lab_access':
        return <Cpu className="h-4 w-4 text-indigo-500" />;
      case 'general_inquiry':
        return <HelpCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: ServiceRequestStatus) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="outline">Pending Triage</Badge>;
      case 'under_review':
        return <Badge variant="secondary">Under Review</Badge>;
      case 'action_required':
        return <Badge variant="warning">Action Required</Badge>;
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'fulfilled':
        return <Badge variant="default">Fulfilled</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Administrative Service Queue
            </h1>
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <Building2 className="h-3 w-3" />
              <span>{departmentScope ? `Dept: ${departmentScope}` : 'College-Wide Oversight'}</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Review, approve, and fulfill collegiate student requisitions, leave applications, and digital certificates.
          </p>
        </div>
      </div>

      {/* Queue Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="p-3.5 border border-border/80 bg-card">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Total In Queue
          </span>
          <div className="mt-1.5 text-xl font-bold text-foreground">
            {stats ? stats.total : requests.length}
          </div>
          <span className="text-[10px] text-muted-foreground">All Requisitions</span>
        </Card>

        <Card className="p-3.5 border border-border/80 bg-card">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Pending Triage
          </span>
          <div className="mt-1.5 text-xl font-bold text-blue-600 dark:text-blue-400">
            {stats ? stats.submitted : requests.filter((r) => r.status === 'submitted').length}
          </div>
          <span className="text-[10px] text-muted-foreground">Unassigned / New</span>
        </Card>

        <Card className="p-3.5 border border-border/80 bg-card">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Under Review
          </span>
          <div className="mt-1.5 text-xl font-bold text-amber-600 dark:text-amber-400">
            {stats ? stats.underReview : requests.filter((r) => r.status === 'under_review').length}
          </div>
          <span className="text-[10px] text-muted-foreground">Being Evaluated</span>
        </Card>

        <Card className="p-3.5 border border-border/80 bg-card">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Action Required
          </span>
          <div className="mt-1.5 text-xl font-bold text-orange-600 dark:text-orange-400">
            {stats ? stats.actionRequired : requests.filter((r) => r.status === 'action_required').length}
          </div>
          <span className="text-[10px] text-muted-foreground">Student Clarification</span>
        </Card>

        <Card className="p-3.5 border border-border/80 bg-card">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Fulfilled / Approved
          </span>
          <div className="mt-1.5 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats
              ? stats.approved + stats.fulfilled
              : requests.filter((r) => r.status === 'approved' || r.status === 'fulfilled').length}
          </div>
          <span className="text-[10px] text-muted-foreground">Resolved Successfully</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ticket, student name, or roll no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as 'all' | ServiceRequestCategory)}
            className="w-full h-9 px-2.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Categories</option>
            <option value="bonafide">Bonafide Certificate</option>
            <option value="leave">Leave Application</option>
            <option value="id_replacement">ID Replacement</option>
            <option value="lab_access">Special Lab Access</option>
            <option value="general_inquiry">General Inquiry</option>
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'all' | ServiceRequestStatus)}
            className="w-full h-9 px-2.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Pending Triage</option>
            <option value="under_review">Under Review</option>
            <option value="action_required">Action Required</option>
            <option value="approved">Approved</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as 'all' | ServiceRequestPriority)}
            className="w-full h-9 px-2.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Priorities</option>
            <option value="standard">Standard Priority</option>
            <option value="urgent">Urgent Priority</option>
          </select>
        </div>
      </div>

      {/* Queue Table */}
      <Card className="border border-border/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border/80 text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Category & Subject</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Submitted</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Inbox className="h-8 w-8 text-muted-foreground/60" />
                      <p className="font-medium text-sm">No requests match criteria</p>
                      <p className="text-xs">Try adjusting your filters or search keywords.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => setReviewingRequest(req)}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {req.ticketNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">
                        {req.studentSnapshot.fullName}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {req.studentSnapshot.enrollmentNo} &bull; {req.studentSnapshot.department}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        {getCategoryIcon(req.category)}
                        <span className="capitalize">{req.category.replace('_', ' ')}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                        {req.subject}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {req.priority === 'urgent' ? (
                        <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                          Urgent
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Standard</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewingRequest(req)}
                        className="text-xs h-8"
                      >
                        <span>Review</span>
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Modal */}
      <AdminRequestReviewModal
        request={reviewingRequest}
        isOpen={Boolean(reviewingRequest)}
        onClose={() => setReviewingRequest(null)}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}
