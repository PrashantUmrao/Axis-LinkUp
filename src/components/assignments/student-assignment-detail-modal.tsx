'use client';

/**
 * Student Assignment Details Modal.
 * Displays comprehensive coursework description, instructor materials,
 * student's active submission, version history, and graded faculty evaluation.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Badge,
} from '@/components/ui';
import {
  FileText,
  Calendar,
  Clock,
  User,
  Paperclip,
  Download,
  CheckCircle2,
  AlertCircle,
  History,
  Award,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import type { AssignmentDTO } from '@/types/assignment';

interface StudentAssignmentDetailModalProps {
  assignment: AssignmentDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenSubmit: (assignment: AssignmentDTO) => void;
}

export function StudentAssignmentDetailModal({
  assignment,
  isOpen,
  onClose,
  onOpenSubmit,
}: StudentAssignmentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'brief' | 'my-submission'>('brief');

  if (!assignment) return null;

  const now = new Date();
  const dueDate = new Date(assignment.dueDate);
  const isPastDue = now > dueDate;
  const sub = assignment.userSubmission;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = () => {
    if (sub?.isGraded) {
      return (
        <Badge variant="glass" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Award className="size-3" />
          Graded ({sub.marksObtained}/{assignment.maxMarks})
        </Badge>
      );
    }
    if (sub) {
      return (
        <Badge variant="glass" className="gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <CheckCircle2 className="size-3" />
          Submitted (v{sub.version})
        </Badge>
      );
    }
    if (isPastDue) {
      return (
        <Badge variant="glass" className="gap-1 bg-destructive/10 text-destructive">
          <AlertCircle className="size-3" />
          Overdue
        </Badge>
      );
    }
    return (
      <Badge variant="glass" className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Clock className="size-3" />
        Pending Submission
      </Badge>
    );
  };

  const canResubmit =
    assignment.allowResubmission &&
    sub &&
    !sub.isGraded &&
    sub.version < assignment.maxResubmissions &&
    (!isPastDue || assignment.lateSubmissionPolicy?.allowLate);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="space-y-2 border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Badge variant="outline" className="font-mono text-[10px]">
                {assignment.courseCode}
              </Badge>
              <span>{assignment.courseName}</span>
            </div>
            {getStatusBadge()}
          </div>

          <DialogTitle className="text-xl font-bold leading-snug">
            {assignment.title}
          </DialogTitle>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="size-3.5" />
              <span>{assignment.creatorSnapshot.fullName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              <span>Due: {new Date(assignment.dueDate).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="size-3.5" />
              <span>Max Marks: {assignment.maxMarks}</span>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('brief')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'brief'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              Assignment Brief
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('my-submission')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'my-submission'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <span>My Submission</span>
              {sub && (
                <span className="flex size-2 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>
        </DialogHeader>

        {activeTab === 'brief' && (
          <div className="space-y-5 py-2">
            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Overview &amp; Problem Statement
              </h4>
              <div className="rounded-lg border border-border/50 bg-muted/10 p-3.5 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {assignment.description}
              </div>
            </div>

            {/* Instructions */}
            {assignment.instructions && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Submission Instructions &amp; Guidelines
                </h4>
                <div className="rounded-lg border border-border/50 bg-muted/10 p-3.5 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {assignment.instructions}
                </div>
              </div>
            )}

            {/* Downloadable Reference Attachments */}
            {assignment.attachments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reference Materials &amp; Templates ({assignment.attachments.length})
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {assignment.attachments.map((file, idx) => (
                    <a
                      key={file.url + idx}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                          <Paperclip className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground group-hover:text-primary">
                            {file.name}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {formatFileSize(file.sizeBytes)}
                          </p>
                        </div>
                      </div>
                      <Download className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Policies Summary */}
            <div className="grid gap-3 rounded-lg border border-border/40 bg-muted/20 p-3 text-xs sm:grid-cols-2">
              <div>
                <span className="font-semibold text-foreground">Late Submissions: </span>
                <span className="text-muted-foreground">
                  {assignment.lateSubmissionPolicy.allowLate
                    ? `Permitted until ${assignment.lateSubmissionPolicy.lateDueDate ? new Date(assignment.lateSubmissionPolicy.lateDueDate).toLocaleDateString() : 'close'} (${assignment.lateSubmissionPolicy.penaltyPercentagePerDay}% penalty/day)`
                    : 'Strictly prohibited after due date.'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Resubmission: </span>
                <span className="text-muted-foreground">
                  {assignment.allowResubmission
                    ? `Allowed up to ${assignment.maxResubmissions} versions before evaluation.`
                    : 'Single final submission only.'}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'my-submission' && (
          <div className="space-y-5 py-2">
            {!sub ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-10 text-center">
                <FileCheck2 className="size-10 text-muted-foreground/60" />
                <h4 className="mt-3 text-sm font-semibold">No Submission Yet</h4>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  You have not submitted work for this assignment yet. Submissions will be logged with version tracking.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenSubmit(assignment);
                  }}
                  className="mt-4 gap-1.5 font-semibold"
                >
                  <FileText className="size-3.5" />
                  <span>Submit Work Now</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status & Graded Banner */}
                {sub.isGraded ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="size-5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                            Evaluated &amp; Graded
                          </h4>
                          <p className="text-xs text-emerald-800 dark:text-emerald-300">
                            Instructor has published official marks for your deliverable.
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                          {sub.marksObtained}
                        </span>
                        <span className="text-xs font-semibold text-emerald-700/80 dark:text-emerald-300/80">
                          {' '}
                          / {assignment.maxMarks}
                        </span>
                      </div>
                    </div>

                    {sub.feedback && (
                      <div className="mt-3 border-t border-emerald-500/20 pt-3">
                        <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                          Instructor Feedback:
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-950/90 dark:text-emerald-100/90 whitespace-pre-wrap">
                          {sub.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>
                        Your deliverable has been securely logged (Version {sub.version}). Awaiting faculty evaluation.
                      </span>
                    </div>
                    {sub.isLate && (
                      <Badge variant="destructive" className="text-[10px]">
                        Late
                      </Badge>
                    )}
                  </div>
                )}

                {/* Submission Meta */}
                <div className="rounded-lg border border-border/50 bg-background/50 p-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground sm:grid-cols-3">
                    <div>
                      <span className="font-semibold text-foreground">Active Version:</span> v{sub.version}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Submitted At:</span>{' '}
                      {new Date(sub.submittedAt).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Timing:</span>{' '}
                      <span className={sub.isLate ? 'text-destructive font-semibold' : 'text-emerald-500 font-semibold'}>
                        {sub.isLate ? 'Late' : 'On Time'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resubmission trigger */}
                {canResubmit && (
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-center gap-2">
                      <History className="size-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Resubmissions permitted ({sub.version}/{assignment.maxResubmissions} versions used).
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onClose();
                        onOpenSubmit(assignment);
                      }}
                      className="gap-1 text-xs"
                    >
                      <RefreshCw className="size-3" />
                      <span>Resubmit</span>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          {!sub && (
            <Button
              size="sm"
              onClick={() => {
                onClose();
                onOpenSubmit(assignment);
              }}
              className="gap-1.5 font-semibold"
            >
              <FileText className="size-3.5" />
              <span>Submit Coursework</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
