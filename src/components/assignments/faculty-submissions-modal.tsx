'use client';

/**
 * Faculty Submissions Review Modal.
 * Lists all student submissions for a selected coursework assignment with
 * status filters, roll number search, file inspection, and evaluation launchers.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  Input,
  EmptyState,
} from '@/components/ui';
import {
  Search,
  Award,
  Clock,
  Paperclip,
  Download,
  Loader2,
} from 'lucide-react';
import { FacultyEvaluateModal } from './faculty-evaluate-modal';
import type { AssignmentDTO, SubmissionDTO } from '@/types/assignment';

interface FacultySubmissionsModalProps {
  assignment: AssignmentDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmissionGraded: (assignmentId: string) => void;
}

type SubmissionFilterStatus = 'all' | 'pending' | 'graded';

export function FacultySubmissionsModal({
  assignment,
  isOpen,
  onClose,
  onSubmissionGraded,
}: FacultySubmissionsModalProps) {
  const [submissions, setSubmissions] = useState<SubmissionDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<SubmissionFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [evaluatingSubmission, setEvaluatingSubmission] = useState<SubmissionDTO | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!assignment) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/assignments/${assignment.id}/submissions?limit=100`);
      const json = await response.json();
      if (response.ok && json.success && Array.isArray(json.data?.submissions)) {
        setSubmissions(json.data.submissions as SubmissionDTO[]);
      }
    } catch (err) {
      console.error('Failed to fetch submissions', err);
    } finally {
      setIsLoading(false);
    }
  }, [assignment]);

  useEffect(() => {
    if (isOpen && assignment) {
      fetchSubmissions();
      setSearchQuery('');
      setFilterStatus('all');
    }
  }, [isOpen, assignment, fetchSubmissions]);

  // Compute metrics
  const gradedCount = submissions.filter((s) => s.evaluation?.isGraded).length;
  const pendingCount = submissions.length - gradedCount;

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.studentSnapshot.fullName.toLowerCase().includes(q);
        const matchesRoll = (s.studentSnapshot.rollNumber || '').toLowerCase().includes(q);
        const matchesEmail = s.studentSnapshot.email.toLowerCase().includes(q);
        if (!matchesName && !matchesRoll && !matchesEmail) return false;
      }

      // 2. Status filter
      if (filterStatus === 'pending') return !s.evaluation?.isGraded;
      if (filterStatus === 'graded') return Boolean(s.evaluation?.isGraded);

      return true;
    });
  }, [submissions, searchQuery, filterStatus]);

  const handleEvaluationSuccess = (updatedSub: SubmissionDTO) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === updatedSub.id ? updatedSub : s))
    );
    if (assignment) {
      onSubmissionGraded(assignment.id);
    }
  };

  if (!assignment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="space-y-1.5 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{assignment.courseCode}</span>
              <span>•</span>
              <span>Submissions Workspace</span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {submissions.length} Submissions
              </Badge>
              <Badge variant="glass" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                {gradedCount} Graded
              </Badge>
            </div>
          </div>

          <DialogTitle className="text-xl font-bold">
            {assignment.title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Review student deliverables, inspect uploaded files, and award evaluations out of {assignment.maxMarks} marks.
          </DialogDescription>
        </DialogHeader>

        {/* Filter & Search Bar */}
        <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 p-1">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                filterStatus === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              All ({submissions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                filterStatus === 'pending'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('graded')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                filterStatus === 'graded'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Graded ({gradedCount})
            </button>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or roll number..."
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>

        {/* Submissions List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-muted-foreground mt-2 text-xs">Loading student submissions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <EmptyState
            glass
            title={
              searchQuery ? 'No Matching Students' : 'No Submissions Logged Yet'
            }
            description={
              searchQuery
                ? `No submissions found matching "${searchQuery}".`
                : 'Enrolled students have not submitted coursework for this assignment yet.'
            }
            className="py-10"
          />
        ) : (
          <div className="space-y-2.5">
            {filteredSubmissions.map((sub) => {
              const isGraded = Boolean(sub.evaluation?.isGraded);

              return (
                <div
                  key={sub.id}
                  className="border-border/50 bg-background/50 flex flex-col justify-between gap-3 rounded-xl border p-3.5 text-xs shadow-xs transition-colors hover:border-primary/40 sm:flex-row sm:items-center"
                >
                  {/* Student Details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {sub.studentSnapshot.fullName}
                      </span>
                      {sub.studentSnapshot.rollNumber && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {sub.studentSnapshot.rollNumber}
                        </Badge>
                      )}
                      <Badge variant="glass" className="text-[10px]">
                        v{sub.version}
                      </Badge>
                      {sub.isLate && (
                        <Badge variant="destructive" className="text-[10px]">
                          Late
                        </Badge>
                      )}
                    </div>

                    <p className="text-muted-foreground text-[11px]">
                      {sub.studentSnapshot.email} • Submitted {new Date(sub.submittedAt).toLocaleString()}
                    </p>

                    {/* Files Attached */}
                    {sub.attachments && sub.attachments.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {sub.attachments.map((file, idx) => (
                          <a
                            key={file.url + idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group bg-muted/40 hover:bg-primary/10 text-foreground flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors"
                          >
                            <Paperclip className="size-2.5 text-primary" />
                            <span className="max-w-[120px] truncate">{file.name}</span>
                            <Download className="size-2.5 text-muted-foreground group-hover:text-primary" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions & Evaluation Indicator */}
                  <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-2 sm:border-0 sm:pt-0">
                    {isGraded ? (
                      <div className="text-right">
                        <Badge variant="glass" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                          <Award className="size-3" />
                          <span>{sub.evaluation?.marksObtained} / {assignment.maxMarks}</span>
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="glass" className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Clock className="size-3" />
                        <span>Pending Evaluation</span>
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      variant={isGraded ? 'outline' : 'default'}
                      onClick={() => setEvaluatingSubmission(sub)}
                      className="gap-1 text-xs font-semibold"
                    >
                      <Award className="size-3.5" />
                      <span>{isGraded ? 'Edit Grade' : 'Grade Submission'}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="border-t border-border/40 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Evaluation Sub-Modal */}
      <FacultyEvaluateModal
        assignment={assignment}
        submission={evaluatingSubmission}
        isOpen={Boolean(evaluatingSubmission)}
        onClose={() => setEvaluatingSubmission(null)}
        onEvaluationSuccess={handleEvaluationSuccess}
      />
    </Dialog>
  );
}
