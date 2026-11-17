'use client';

/**
 * Faculty Evaluation & Grading Modal.
 * Enables course instructors to grade submissions, validate maximum mark limits,
 * provide constructive academic feedback, and immediately or conditionally release grades.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Badge,
} from '@/components/ui';
import {
  Award,
  AlertTriangle,
  Paperclip,
  Download,
  Loader2,
} from 'lucide-react';
import type { AssignmentDTO, SubmissionDTO } from '@/types/assignment';

interface FacultyEvaluateModalProps {
  assignment: AssignmentDTO | null;
  submission: SubmissionDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onEvaluationSuccess: (updatedSub: SubmissionDTO) => void;
}

export function FacultyEvaluateModal({
  assignment,
  submission,
  isOpen,
  onClose,
  onEvaluationSuccess,
}: FacultyEvaluateModalProps) {
  const [marks, setMarks] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [releaseGrade, setReleaseGrade] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pre-fill existing grade if already evaluated
  useEffect(() => {
    if (submission?.evaluation?.marksObtained != null) {
      setMarks(String(submission.evaluation.marksObtained));
      setFeedback(submission.evaluation.feedback || '');
      setReleaseGrade(submission.evaluation.isGraded);
    } else {
      setMarks('');
      setFeedback('');
      setReleaseGrade(true);
    }
    setErrorMessage(null);
  }, [submission]);

  if (!assignment || !submission) return null;

  const maxMarks = assignment.maxMarks;

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const numericMarks = Number(marks);
    if (isNaN(numericMarks) || numericMarks < 0) {
      setErrorMessage('Please enter a valid non-negative mark.');
      return;
    }

    if (numericMarks > maxMarks) {
      setErrorMessage(`Awarded marks (${numericMarks}) cannot exceed maximum marks (${maxMarks}).`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/v1/assignments/${assignment.id}/submissions/${submission.id}/evaluate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marksObtained: numericMarks,
            feedback: feedback.trim() || undefined,
            releaseGrade,
          }),
        }
      );

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to record evaluation.');
      }

      onEvaluationSuccess(json.data as SubmissionDTO);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Evaluation submission failed.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSaveEvaluation} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{assignment.courseCode}</span>
              <span>•</span>
              <span>Evaluation Desk</span>
            </div>
            <DialogTitle className="text-lg font-bold">
              Grade Student Submission
            </DialogTitle>
            <DialogDescription className="text-xs">
              {assignment.title}
            </DialogDescription>
          </DialogHeader>

          {/* Student Profile Snapshot */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                  {submission.studentSnapshot.fullName.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-foreground">
                    {submission.studentSnapshot.fullName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {submission.studentSnapshot.rollNumber || 'Enrolled Student'} • {submission.studentSnapshot.email}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <Badge variant="outline" className="text-[10px]">
                  Version {submission.version}
                </Badge>
                {submission.isLate && (
                  <Badge variant="destructive" className="ml-1 text-[10px]">
                    Late
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Student Deliverables Review */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Submitted Work &amp; Attachments
            </h4>

            {submission.submissionText && (
              <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {submission.submissionText}
              </div>
            )}

            {submission.attachments && submission.attachments.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {submission.attachments.map((file, idx) => (
                  <a
                    key={file.url + idx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-2 text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Paperclip className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate font-medium text-foreground group-hover:text-primary">
                        {file.name}
                      </span>
                    </div>
                    <Download className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Grading Inputs */}
          <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Awarded Marks <span className="text-destructive">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max={maxMarks}
                    step="0.5"
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                    placeholder="0"
                    required
                    disabled={isSubmitting}
                    className="h-9 font-mono text-sm font-bold"
                  />
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    / {maxMarks}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-end space-y-1">
                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={releaseGrade}
                    onChange={(e) => setReleaseGrade(e.target.checked)}
                    disabled={isSubmitting}
                    className="size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Release Grade to Student</span>
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Publishes score and feedback to the student&apos;s portal immediately.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Instructor Remarks &amp; Feedback
              </label>
              <Textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Constructive feedback, code review notes, rubric breakdown..."
                disabled={isSubmitting}
                className="text-xs resize-y"
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || marks === ''}
              className="gap-1.5 font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving Grade...</span>
                </>
              ) : (
                <>
                  <Award className="size-3.5" />
                  <span>Save &amp; Publish Evaluation</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
