'use client';

/**
 * Student Requests View Component (MOD-13 / Phase 5.8).
 * Primary client-facing workspace for students to track requisitions and submit administrative forms.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Badge, Button, Input } from '@/components/ui';
import {
  Inbox,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  Search,
  FileText,
  Calendar,
  CreditCard,
  Cpu,
  HelpCircle,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { StudentRequestComposeModal } from './student-request-compose-modal';
import { StudentRequestDetailModal } from './student-request-detail-modal';
import type {
  ServiceRequestDTO,
  ServiceRequestCategory,
  ServiceRequestStatus,
  ServiceRequestStatsDTO,
} from '@/types/service-request';
import type { UserDTO } from '@/types/user';

interface StudentRequestsViewProps {
  user?: UserDTO;
  initialRequests?: ServiceRequestDTO[];
  initialStats?: ServiceRequestStatsDTO | null;
}

export function StudentRequestsView({
  user: _user,
  initialRequests = [],
  initialStats = null,
}: StudentRequestsViewProps) {
  const [requests, setRequests] = useState<ServiceRequestDTO[]>(initialRequests);
  const [stats, setStats] = useState<ServiceRequestStatsDTO | null>(initialStats);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ServiceRequestCategory>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | ServiceRequestStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestDTO | null>(null);
  const [_isLoading, setIsLoading] = useState(false);

  // Refresh requests and metrics
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reqRes, statsRes] = await Promise.all([
        fetch('/api/v1/requests?page=1&limit=50'),
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
      console.error('Failed to refresh student service requests', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRequestCreated = (newReq: ServiceRequestDTO) => {
    setRequests((prev) => [newReq, ...prev]);
    setSelectedRequest(newReq);
    void refreshData();
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (selectedCategory !== 'all' && req.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && req.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSubject = req.subject.toLowerCase().includes(q);
        const matchTicket = req.ticketNumber.toLowerCase().includes(q);
        if (!matchSubject && !matchTicket) return false;
      }
      return true;
    });
  }, [requests, selectedCategory, selectedStatus, searchQuery]);

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
        return <Badge variant="outline">Submitted</Badge>;
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
              Service Request Tracker
            </h1>
            <Badge variant="outline" className="text-xs">
              Paperless Requisitions
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Submit bonafide applications, leave requests, ID replacements, and track administrative reviews in real time.
          </p>
        </div>

        <Button
          onClick={() => setIsComposeOpen(true)}
          className="flex items-center gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Service Request</span>
        </Button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border border-border/80 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Applications
            </span>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {stats ? stats.total : requests.length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Lifetime submitted</p>
        </Card>

        <Card className="p-4 border border-border/80 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Under Review
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats
              ? stats.submitted + stats.underReview
              : requests.filter((r) => r.status === 'submitted' || r.status === 'under_review').length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">In administrative queue</p>
        </Card>

        <Card className="p-4 border border-border/80 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Action Required
            </span>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {stats
              ? stats.actionRequired
              : requests.filter((r) => r.status === 'action_required').length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Clarification requested</p>
        </Card>

        <Card className="p-4 border border-border/80 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fulfilled / Approved
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats
              ? stats.approved + stats.fulfilled
              : requests.filter((r) => r.status === 'approved' || r.status === 'fulfilled').length}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Successfully issued</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            All Categories
          </button>
          <button
            onClick={() => setSelectedCategory('bonafide')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'bonafide'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            <FileText className="h-3 w-3" />
            <span>Bonafide</span>
          </button>
          <button
            onClick={() => setSelectedCategory('leave')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'leave'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span>Leave</span>
          </button>
          <button
            onClick={() => setSelectedCategory('id_replacement')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'id_replacement'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            <CreditCard className="h-3 w-3" />
            <span>ID Card</span>
          </button>
          <button
            onClick={() => setSelectedCategory('lab_access')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'lab_access'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            <Cpu className="h-3 w-3" />
            <span>Lab Access</span>
          </button>
          <button
            onClick={() => setSelectedCategory('general_inquiry')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'general_inquiry'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            <HelpCircle className="h-3 w-3" />
            <span>Inquiry</span>
          </button>
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ticket or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'all' | ServiceRequestStatus)}
              className="h-9 px-2.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="action_required">Action Required</option>
              <option value="approved">Approved</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Request Applications List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Inbox className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                No Service Requests Found
              </h3>
              <p className="text-xs text-muted-foreground text-center">
                {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                  ? 'No applications match your current search and filter criteria.'
                  : 'You have not submitted any administrative service requisitions yet. Click below to submit your first application.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsComposeOpen(true)}
                className="mt-2"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Submit Application
              </Button>
            </div>
          </Card>
        ) : (
          filteredRequests.map((req) => (
            <Card
              key={req.id}
              onClick={() => setSelectedRequest(req)}
              className="p-4 border border-border/80 hover:border-primary/50 transition-all cursor-pointer group bg-card hover:shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      {req.ticketNumber}
                    </span>
                    <span className="text-muted-foreground text-xs">&bull;</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                      {getCategoryIcon(req.category)}
                      <span className="capitalize">{req.category.replace('_', ' ')}</span>
                    </span>
                    {req.priority === 'urgent' && (
                      <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                        Urgent
                      </Badge>
                    )}
                    {getStatusBadge(req.status)}
                  </div>

                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {req.subject}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Applied {new Date(req.createdAt).toLocaleDateString()}</span>
                    {req.attachments && req.attachments.length > 0 && (
                      <span>&bull; {req.attachments.length} attachments</span>
                    )}
                    {req.reviewHistory.length > 1 && (
                      <span>
                        &bull; Last updated {new Date(req.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                  >
                    <span>View Details</span>
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Compose Modal */}
      <StudentRequestComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleRequestCreated}
      />

      {/* Detail Modal */}
      <StudentRequestDetailModal
        request={selectedRequest}
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  );
}
