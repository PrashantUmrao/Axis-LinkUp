'use client';

/**
 * Faculty Assignment Management Workspace.
 * Comprehensive coursework cockpit supporting lifecycle mutations (Draft, Publish, Close, Archive),
 * submission inspections, and evaluation gradebooks within authorized teaching scopes.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  Badge,
  Button,
  Input,
  EmptyState,
} from '@/components/ui';
import {
  Plus,
  Calendar,
  Users,
  AlertTriangle,
  Search,
  Archive,
  RefreshCw,
  Edit,
  Eye,
  Send,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { FacultyAssignmentCreateModal } from './faculty-assignment-create-modal';
import { FacultySubmissionsModal } from './faculty-submissions-modal';
import type { AssignmentDTO, AssignmentStatus } from '@/types/assignment';
import type { UserDTO } from '@/types/user';

interface FacultyAssignmentViewProps {
  user: UserDTO;
  assignedCourses: string[];
  initialAssignments?: AssignmentDTO[];
  departmentName?: string;
}

type TabFilter = 'all' | 'published' | 'draft' | 'closed' | 'archived';

export function FacultyAssignmentView({
  user,
  assignedCourses = [],
  initialAssignments = [],
  departmentName = 'Academic Department',
}: FacultyAssignmentViewProps) {
  const [assignments, setAssignments] = useState<AssignmentDTO[]>(initialAssignments);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentDTO | null>(null);
  const [reviewingAssignment, setReviewingAssignment] = useState<AssignmentDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch live assignments from API
  const refreshAssignments = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/v1/assignments?limit=100');
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data?.assignments)) {
        setAssignments(json.data.assignments as AssignmentDTO[]);
      }
    } catch (err) {
      console.error('Failed to refresh faculty assignments', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Compute Overview Statistics
  const stats = useMemo(() => {
    const total = assignments.length;
    let drafts = 0;
    let published = 0;
    let closed = 0;
    let totalSubmissions = 0;
    let pendingEvaluations = 0;

    for (const a of assignments) {
      if (a.status === 'draft') drafts++;
      if (a.status === 'published') published++;
      if (a.status === 'closed') closed++;

      const subCount = a.submissionCount || 0;
      const gradCount = a.gradedCount || 0;
      totalSubmissions += subCount;
      pendingEvaluations += Math.max(0, subCount - gradCount);
    }

    return {
      total,
      drafts,
      published,
      closed,
      totalSubmissions,
      pendingEvaluations,
    };
  }, [assignments]);

  // Unique Courses List for Dropdown
  const uniqueCourses = useMemo(() => {
    const courses = new Set<string>();
    assignedCourses.forEach((c) => courses.add(c));
    assignments.forEach((a) => courses.add(a.courseCode));
    return Array.from(courses);
  }, [assignedCourses, assignments]);

  // Filtered Assignments List
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // 1. Course Filter
      if (selectedCourseFilter !== 'all' && a.courseCode !== selectedCourseFilter) {
        return false;
      }

      // 2. Tab Filter
      if (activeTab !== 'all' && a.status !== activeTab) {
        return false;
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = a.title.toLowerCase().includes(q);
        const matchesCode = a.courseCode.toLowerCase().includes(q);
        const matchesName = a.courseName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesName) return false;
      }

      return true;
    });
  }, [assignments, activeTab, selectedCourseFilter, searchQuery]);

  // Lifecycle action handler (Publish, Close, Archive)
  const handleLifecycleAction = async (
    assignmentId: string,
    action: 'publish' | 'close' | 'archive'
  ) => {
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/assignments/${assignmentId}/${action}`, {
        method: 'POST',
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || `Failed to ${action} assignment.`);
      }

      // Update local state
      const targetStatus: AssignmentStatus =
        action === 'publish' ? 'published' : action === 'close' ? 'closed' : 'archived';

      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? { ...a, status: targetStatus } : a))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} assignment.`;
      setActionError(msg);
    }
  };

  const handleSavedSuccess = (saved: AssignmentDTO) => {
    setAssignments((prev) => {
      const existing = prev.find((a) => a.id === saved.id);
      if (existing) {
        return prev.map((a) => (a.id === saved.id ? saved : a));
      }
      return [saved, ...prev];
    });
  };

  const handleSubmissionGraded = (assignmentId: string) => {
    // Increment gradedCount in local state
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id === assignmentId) {
          return {
            ...a,
            gradedCount: (a.gradedCount || 0) + 1,
          };
        }
        return a;
      })
    );
  };

  const getStatusBadge = (status: AssignmentStatus) => {
    switch (status) {
      case 'published':
        return (
          <Badge variant="glass" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
            Published
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="glass" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
            Draft
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="glass" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px]">
            Closed
          </Badge>
        );
      case 'archived':
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px]">
            Archived
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Coursework &amp; Gradebook
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              {departmentName}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Coursework authoring, student submission inspections, and grading verification.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAssignments}
            disabled={isLoading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setEditingAssignment(null);
              setIsCreateOpen(true);
            }}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            <span>Create Assignment</span>
          </Button>
        </div>
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* 1. Metrics Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total */}
        <Card
          variant="glass"
          onClick={() => setActiveTab('all')}
          className={`cursor-pointer p-4 transition-all hover:border-primary/40 ${
            activeTab === 'all' ? 'ring-2 ring-primary/40' : ''
          }`}
        >
          <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Total
          </div>
          <div className="mt-2 text-2xl font-black">{stats.total}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">All coursework</p>
        </Card>

        {/* Drafts */}
        <Card
          variant="glass"
          onClick={() => setActiveTab('draft')}
          className={`cursor-pointer p-4 transition-all hover:border-amber-500/40 ${
            activeTab === 'draft' ? 'ring-2 ring-amber-500/40' : ''
          }`}
        >
          <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Drafts
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500">{stats.drafts}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Unpublished</p>
        </Card>

        {/* Published */}
        <Card
          variant="glass"
          onClick={() => setActiveTab('published')}
          className={`cursor-pointer p-4 transition-all hover:border-emerald-500/40 ${
            activeTab === 'published' ? 'ring-2 ring-emerald-500/40' : ''
          }`}
        >
          <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Published
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500">{stats.published}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Active submissions</p>
        </Card>

        {/* Closed */}
        <Card
          variant="glass"
          onClick={() => setActiveTab('closed')}
          className={`cursor-pointer p-4 transition-all hover:border-blue-500/40 ${
            activeTab === 'closed' ? 'ring-2 ring-blue-500/40' : ''
          }`}
        >
          <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Closed
          </div>
          <div className="mt-2 text-2xl font-black text-blue-500">{stats.closed}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Submissions closed</p>
        </Card>

        {/* Total Submissions */}
        <Card variant="glass" className="p-4">
          <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Submissions
          </div>
          <div className="mt-2 text-2xl font-black">{stats.totalSubmissions}</div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Logged deliverables</p>
        </Card>

        {/* Pending Evaluations */}
        <Card variant="glass" className="p-4">
          <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Pending Grades
          </div>
          <div className="mt-2 text-2xl font-black text-purple-500">
            {stats.pendingEvaluations}
          </div>
          <p className="text-muted-foreground mt-0.5 text-[11px]">Need grading</p>
        </Card>
      </div>

      {/* 2. Search & Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 p-1">
          {(
            [
              { key: 'all', label: 'All', count: stats.total },
              { key: 'published', label: 'Published', count: stats.published },
              { key: 'draft', label: 'Drafts', count: stats.drafts },
              { key: 'closed', label: 'Closed', count: stats.closed },
              { key: 'archived', label: 'Archived', count: assignments.filter((a) => a.status === 'archived').length },
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

        {/* Search & Course Filter */}
        <div className="flex items-center gap-2">
          {uniqueCourses.length > 0 && (
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="border-input bg-background text-foreground h-9 rounded-md border px-3 py-1 text-xs"
            >
              <option value="all">All Courses</option>
              {uniqueCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <div className="relative w-full sm:max-w-xs">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assignment title..."
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 3. Coursework Cards Listing */}
      {filteredAssignments.length === 0 ? (
        <EmptyState
          glass
          title="No Assignments Found"
          description={
            searchQuery
              ? `No coursework matched your search "${searchQuery}".`
              : 'You have not created any coursework assignments in this category yet.'
          }
          className="py-12"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssignments.map((assignment) => {
            const subCount = assignment.submissionCount || 0;
            const gradedCount = assignment.gradedCount || 0;

            return (
              <Card
                key={assignment.id}
                variant="glass"
                className="flex flex-col justify-between p-5 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="space-y-3">
                  {/* Header: Course & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {assignment.courseCode}
                    </Badge>
                    {getStatusBadge(assignment.status)}
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

                  {/* Cohort & Target */}
                  <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
                    <span>
                      Target: Sem {assignment.academicTarget.semester} • Section{' '}
                      {assignment.academicTarget.section || 'ALL'} •{' '}
                      {assignment.academicTarget.program || 'Collegiate'}
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="space-y-1.5 border-t border-border/40 pt-3 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3 shrink-0" />
                        <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-foreground">
                        {assignment.maxMarks} Marks
                      </span>
                    </div>

                    {/* Submissions & Grading Progress */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="size-3 shrink-0" />
                        <span>
                          Submissions: <strong className="text-foreground">{subCount}</strong>
                        </span>
                      </div>
                      <span className="text-[11px]">
                        Graded: <strong className="text-emerald-500">{gradedCount}</strong>/{subCount}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {subCount > 0 && (
                      <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{
                            width: `${Math.round((gradedCount / subCount) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Card Action Buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                  <div className="flex items-center gap-1.5">
                    {/* View Submissions */}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setReviewingAssignment(assignment)}
                      className="gap-1 text-xs font-semibold"
                    >
                      <Eye className="size-3" />
                      <span>Submissions ({subCount})</span>
                    </Button>

                    {/* Edit */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingAssignment(assignment);
                        setIsCreateOpen(true);
                      }}
                      className="size-8 p-0"
                      title="Edit Coursework"
                    >
                      <Edit className="size-3.5" />
                    </Button>
                  </div>

                  {/* Lifecycle Buttons */}
                  <div className="flex items-center gap-1">
                    {assignment.status === 'draft' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleLifecycleAction(assignment.id, 'publish')}
                        className="gap-1 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                      >
                        <Send className="size-3" />
                        <span>Publish</span>
                      </Button>
                    )}

                    {assignment.status === 'published' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleLifecycleAction(assignment.id, 'close')}
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Lock className="size-3" />
                        <span>Close</span>
                      </Button>
                    )}

                    {assignment.status === 'closed' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleLifecycleAction(assignment.id, 'archive')}
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Archive className="size-3" />
                        <span>Archive</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Course Scope Footer */}
      <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>
            Faculty teaching scope strictly enforced via Attribute-Based Access Control (ABAC). Coursework authoring restricted to assigned teaching roster.
          </span>
        </div>
        <span className="font-mono text-[10px]">DOC-AUTH-005</span>
      </div>

      {/* Create / Edit Modal */}
      <FacultyAssignmentCreateModal
        initialAssignment={editingAssignment}
        assignedCourses={assignedCourses}
        departmentId={user.departmentId || ''}
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingAssignment(null);
        }}
        onSuccess={handleSavedSuccess}
      />

      {/* Submissions Review Modal */}
      <FacultySubmissionsModal
        assignment={reviewingAssignment}
        isOpen={Boolean(reviewingAssignment)}
        onClose={() => setReviewingAssignment(null)}
        onSubmissionGraded={handleSubmissionGraded}
      />
    </div>
  );
}
