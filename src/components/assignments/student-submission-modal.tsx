'use client';

/**
 * Student Assignment Submission Modal.
 * Supports initial submission and resubmission with revision tracking.
 * Includes honor code confirmation, attachment uploads, and late submission warnings.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Textarea,
} from '@/components/ui';
import { FileUploader } from './file-uploader';
import {
  AlertTriangle,
  Send,
  Loader2,
  History,
} from 'lucide-react';
import type { AssignmentDTO, AssignmentAttachment, SubmissionDTO } from '@/types/assignment';

interface StudentSubmissionModalProps {
  assignment: AssignmentDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmissionSuccess: (submission: SubmissionDTO) => void;
}

export function StudentSubmissionModal({
  assignment,
  isOpen,
  onClose,
  onSubmissionSuccess,
}: StudentSubmissionModalProps) {
  const [submissionText, setSubmissionText] = useState('');
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);
  const [isHonorConfirmed, setIsHonorConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!assignment) return null;

  const isResubmission = Boolean(assignment.userSubmission);
  const currentVersion = assignment.userSubmission ? assignment.userSubmission.version + 1 : 1;
  const now = new Date();
  const dueDate = new Date(assignment.dueDate);
  const isPastDue = now > dueDate;
  const lateAllowed = assignment.lateSubmissionPolicy?.allowLate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!submissionText.trim() && attachments.length === 0) {
      setErrorMessage('Please provide either written responses or upload at least one deliverable file.');
      return;
    }

    if (!isHonorConfirmed) {
      setErrorMessage('You must confirm the Academic Integrity statement before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/v1/assignments/${assignment.id}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionText: submissionText.trim() || undefined,
          attachments,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to submit assignment.');
      }

      // Reset form and notify parent
      setSubmissionText('');
      setAttachments([]);
      setIsHonorConfirmed(false);
      onSubmissionSuccess(json.data as SubmissionDTO);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while submitting.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{assignment.courseCode}</span>
              <span>•</span>
              <span>{assignment.courseName}</span>
            </div>
            <DialogTitle className="text-lg font-bold">
              {isResubmission ? `Resubmit Coursework (Version ${currentVersion})` : 'Submit Coursework Deliverable'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {assignment.title}
            </DialogDescription>
          </DialogHeader>

          {/* Resubmission or Late Warning Banner */}
          {isResubmission && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <History className="size-4 shrink-0" />
              <span>
                You are submitting Version {currentVersion}. Your previous version will be preserved in your revision history.
              </span>
            </div>
          )}

          {isPastDue && lateAllowed && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                <strong>Late Submission Notice:</strong> The deadline ({new Date(assignment.dueDate).toLocaleString()}) has passed. This deliverable will be marked as late
                {assignment.lateSubmissionPolicy.penaltyPercentagePerDay
                  ? ` and incurs a penalty of ${assignment.lateSubmissionPolicy.penaltyPercentagePerDay}% per day.`
                  : '.'}
              </span>
            </div>
          )}

          {/* Submission Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Written Responses / Solution Notes (Optional if attaching files)
            </label>
            <Textarea
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Type your answer, methodology, code explanation, or submission remarks here..."
              rows={4}
              disabled={isSubmitting}
              className="resize-y text-xs"
            />
          </div>

          {/* Deliverables Attachment Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Deliverable Files &amp; Attachments
            </label>
            <FileUploader
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              maxFiles={5}
              disabled={isSubmitting}
            />
          </div>

          {/* Academic Integrity Confirmation */}
          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3">
            <input
              type="checkbox"
              id="honor-code"
              checked={isHonorConfirmed}
              onChange={(e) => setIsHonorConfirmed(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="honor-code" className="text-xs leading-relaxed text-muted-foreground select-none">
              <span className="font-semibold text-foreground">Collegiate Academic Integrity Pledge:</span>{' '}
              I declare that this submitted coursework is entirely my own original work, completed in adherence to Axis LinkUp collegiate integrity guidelines.
            </label>
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
              disabled={isSubmitting || !isHonorConfirmed}
              className="gap-1.5 font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Submitting Deliverable...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  <span>{isResubmission ? `Confirm Resubmission (v${currentVersion})` : 'Submit Deliverable'}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
