'use client';

/**
 * Student Assignment Portal View.
 * Core dashboard providing real-time coursework metrics, tabbed status filters,
 * responsive coursework cards, and direct submission integration.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Card,
  Badge,
  Button,
  Input,
  EmptyState,
} from '@/components/ui';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  Award,
  AlertCircle,
  Search,
  Calendar,
  User,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { StudentAssignmentDetailModal } from './student-assignment-detail-modal';
import { StudentSubmissionModal } from './student-submission-modal';
import type { AssignmentDTO, SubmissionDTO } from '@/types/assignment';
import type { UserDTO } from '@/types/user';

interface StudentAssignmentViewProps {
  user: UserDTO;
  initialAssignments?: AssignmentDTO[];
}

type TabFilter = 'all' | 'pending' | 'submitted' | 'evaluated' | 'overdue';

export function StudentAssignmentView({
  user,
  initialAssignments = [],
}: StudentAssignmentViewProps) {
  const [assignments, setAssignments] = useState<AssignmentDTO[]>(initialAssignments);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDetailAssignment, setSelectedDetailAssignment] = useState<AssignmentDTO | null>(null);
  const [selectedSubmitAssignment, setSelectedSubmitAssignment] = useState<AssignmentDTO | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  // Live refresh from API
  const refreshAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/assignments?limit=50');
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data?.assignments)) {
        setAssignments(json.data.assignments as AssignmentDTO[]);
      }
    } catch (err) {
      console.error('Failed to refresh assignments:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Compute Overview Statistics (hydration-safe via post-mount clock)
  const stats = useMemo(() => {
    const total = assignments.length;
    let pending = 0;
    let submitted = 0;
    let evaluated = 0;
    let overdue = 0;

    for (const a of assignments) {
      const isPastDue = nowMs !== null && new Date(a.dueDate).getTime() < nowMs;
      if (a.userSubmission?.isGraded) {
        evaluated++;
      } else if (a.userSubmission) {
        submitted++;
      } else if (isPastDue) {
        overdue++;
      } else {
        pending++;
      }
    }

    return { total, pending, submitted, evaluated, overdue };
  }, [assignments, nowMs]);

  // Filtered Assignments List
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = a.title.toLowerCase().includes(query);
        const matchesCode = a.courseCode.toLowerCase().includes(query);
        const matchesName = a.courseName.toLowerCase().includes(query);
        const matchesCreator = a.creatorSnapshot.fullName.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCode && !matchesName && !matchesCreator) {
          return false;
        }
      }

      // 2. Tab Filter
      const isPastDue = nowMs !== null && new Date(a.dueDate).getTime() < nowMs;
      if (activeTab === 'pending') {
        return !a.userSubmission && !isPastDue;
      }
      if (activeTab === 'submitted') {
        return Boolean(a.userSubmission && !a.userSubmission.isGraded);
      }
      if (activeTab === 'evaluated') {
        return Boolean(a.userSubmission?.isGraded);
      }
      if (activeTab === 'overdue') {
        return !a.userSubmission && isPastDue;
      }

      return true;
    });
  }, [assignments, activeTab, searchQuery, nowMs]);

  const handleSubmissionSuccess = (newSub: SubmissionDTO) => {
    // Update local assignment state with userSubmission summary
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id === newSub.assignmentId) {
          return {
            ...a,
            userSubmission: {
              id: newSub.id,
              status: newSub.status,
              submittedAt: newSub.submittedAt,
              isLate: newSub.isLate,
              version: newSub.version,
              isGraded: false,
            },
          };
        }
        return a;
      })
    );
  };

  const getRemainingTimeNotice = (dueDateStr: string) => {
    if (nowMs === null) {
      return null;
    }
    const diff = new Date(dueDateStr).getTime() - nowMs;
    if (diff < 0) {
      return <span className="font-semibold text-destructive">Past Due</span>;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 1) {
      return <span className="text-muted-foreground">{days} days remaining</span>;
    }
    if (days === 1) {
      return <span className="text-amber-500 font-semibold">1 day, {hours}h remaining</span>;
    }
    if (hours > 0) {
      return <span className="text-amber-500 font-semibold">{hours} hours remaining</span>;
    }
    const mins = Math.max(1, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
    return <span className="text-destructive font-bold">{mins} minutes remaining</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Coursework &amp; Assignments
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Subject submissions, lab records, and academic evaluations for Semester{' '}
            {user.studentProfile?.currentSemester || 'Active'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={refreshAssignments}
          disabled={isLoading}
          className="gap-2 self-start text-xs sm:self-auto"
        >
          <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </Button>
      </div>

      {/* 1. Metrics Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total */}
        <Card
          variant="glass"
          onClick={() => setActiveTab('all')}
          className={`cursor-pointer p-4 transition-all hover:border-primary/40 ${
            activeTab === 'all' ? 'ring-2 ring-primary/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Total
            </span>
            <FileCheck2 className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-black">{stats.total}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">All coursework</p>
        </Card>

        {/* Pending */}
        <Card
          variant="glass"
          onClick={() => setActiveTab('pending')}
          className={`cursor-pointer p-4 transition-all hover:border-amber-500/40 ${
            activeTab === 'pending' ? 'ring-2 ring-amber-500/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Pending
            </span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500">{stats.pending}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Due for submission</p>
        </Card>

        {/* Submitted */}
        <Card
          variant="glass"
          onClick={() => setActiveTab('submitted')}
          className={`cursor-pointer p-4 transition-all hover:border-blue-500/40 ${
            activeTab === 'submitted' ? 'ring-2 ring-blue-500/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Submitted
            </span>
            <CheckCircle2 className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-500">{stats.submitted}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Awaiting evaluation</p>
        </Card>

        {/* Evaluated */}
        <Card
          variant="glass"
          onClick={() => setActiveTab('evaluated')}
          className={`cursor-pointer p-4 transition-all hover:border-emerald-500/40 ${
            activeTab === 'evaluated' ? 'ring-2 ring-emerald-500/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Evaluated
            </span>
            <Award className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500">{stats.evaluated}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Marks published</p>
        </Card>

        {/* Overdue */}
        <Card
          variant="glass"
          onClick={() => setActiveTab('overdue')}
          className={`cursor-pointer p-4 transition-all hover:border-destructive/40 ${
            activeTab === 'overdue' ? 'ring-2 ring-destructive/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Overdue
            </span>
            <AlertCircle className="size-4 text-destructive" />
          </div>
          <div className="mt-2 text-2xl font-black text-destructive">{stats.overdue}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Deadline passed</p>
        </Card>
      </div>

      {/* 2. Search & Tab Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 p-1">
          {(
            [
              { key: 'all', label: 'All', count: stats.total },
              { key: 'pending', label: 'Pending', count: stats.pending },
              { key: 'submitted', label: 'Submitted', count: stats.submitted },
              { key: 'evaluated', label: 'Evaluated', count: stats.evaluated },
              { key: 'overdue', label: 'Overdue', count: stats.overdue },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === t.key
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  activeTab === t.key
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search coursework, subject, instructor..."
            className="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      {/* 3. Coursework Cards Listing */}
      {filteredAssignments.length === 0 ? (
        <EmptyState
          glass
          title={
            searchQuery ? 'No Matching Coursework Found' : 'No Coursework in this Category'
          }
          description={
            searchQuery
              ? `No coursework matched your search term "${searchQuery}". Try searching by course code or subject.`
              : activeTab === 'all'
              ? 'There are currently no coursework assignments published for your academic cohort.'
              : `You have zero coursework items under the "${activeTab}" filter.`
          }
          className="py-12"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssignments.map((assignment) => {
            const dueDate = new Date(assignment.dueDate);
            const isPastDue = nowMs !== null && nowMs > dueDate.getTime();
            const sub = assignment.userSubmission;

            return (
              <Card
                key={assignment.id}
                variant="glass"
                className="flex flex-col justify-between p-5 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="space-y-3">
                  {/* Top Header: Course & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {assignment.courseCode}
                    </Badge>

                    {sub?.isGraded ? (
                      <Badge variant="glass" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        <Award className="size-3" />
                        <span>Graded: {sub.marksObtained}/{assignment.maxMarks}</span>
                      </Badge>
                    ) : sub ? (
                      <Badge variant="glass" className="gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px]">
                        <CheckCircle2 className="size-3" />
                        <span>Submitted (v{sub.version})</span>
                      </Badge>
                    ) : isPastDue ? (
                      <Badge variant="glass" className="gap-1 bg-destructive/10 text-destructive text-[10px]">
                        <AlertCircle className="size-3" />
                        <span>Overdue</span>
                      </Badge>
                    ) : (
                      <Badge variant="glass" className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                        <Clock className="size-3" />
                        <span>Due Soon</span>
                      </Badge>
                    )}
                  </div>

                  {/* Title & Subject */}
                  <div>
                    <h3 className="line-clamp-2 text-base font-bold text-foreground">
                      {assignment.title}
                    </h3>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs font-medium">
                      {assignment.courseName}
                    </p>
                  </div>

                  {/* Metadata Row */}
                  <div className="space-y-1.5 border-t border-border/40 pt-3 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="size-3 shrink-0" />
                        <span className="truncate">{assignment.creatorSnapshot.fullName}</span>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-foreground">
                        {assignment.maxMarks} Marks
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3 shrink-0" />
                        <span>
                          {new Intl.DateTimeFormat('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            timeZone: 'Asia/Kolkata',
                          }).format(dueDate)}
                        </span>
                      </div>
                      <div className="text-[11px]">
                        {getRemainingTimeNotice(assignment.dueDate)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Actions */}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDetailAssignment(assignment)}
                    className="text-xs"
                  >
                    Details &amp; Brief
                  </Button>

                  {!sub ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSelectedSubmitAssignment(assignment)}
                      className="gap-1 text-xs font-semibold"
                    >
                      <span>Submit</span>
                      <ArrowRight className="size-3" />
                    </Button>
                  ) : sub.isGraded ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDetailAssignment(assignment)}
                      className="gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-xs dark:text-emerald-400"
                    >
                      <Award className="size-3" />
                      <span>View Grade</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDetailAssignment(assignment)}
                      className="text-xs"
                    >
                      <span>Review Submission</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Peer Isolation Footer */}
      <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>
            Collegiate peer isolation enforced. Coursework deliverables and evaluations are strictly isolated to your enrolled cohort.
          </span>
        </div>
        <span className="font-mono text-[10px]">DOC-AUTH-005</span>
      </div>

      {/* Detail Modal */}
      <StudentAssignmentDetailModal
        assignment={selectedDetailAssignment}
        isOpen={Boolean(selectedDetailAssignment)}
        onClose={() => setSelectedDetailAssignment(null)}
        onOpenSubmit={(assign) => setSelectedSubmitAssignment(assign)}
      />

      {/* Submission Modal */}
      <StudentSubmissionModal
        assignment={selectedSubmitAssignment}
        isOpen={Boolean(selectedSubmitAssignment)}
        onClose={() => setSelectedSubmitAssignment(null)}
        onSubmissionSuccess={handleSubmissionSuccess}
      />
    </div>
  );
}
