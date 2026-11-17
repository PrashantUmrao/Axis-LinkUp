'use client';

/**
 * Admin Request Review Modal Component (MOD-13 / Phase 5.8).
 * Enables Department Administrators, HODs, and Directors to review, triage, approve,
 * reject, and fulfill student service requisitions.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Badge,
  Button,
  Input,
  Label,
  Textarea,
} from '@/components/ui';
import {
  AlertCircle,
  Loader2,
  Paperclip,
  Download,
} from 'lucide-react';
import { RequestStatusStepper } from './request-status-stepper';
import type {
  ServiceRequestDTO,
  ServiceRequestStatus,
  BonafideDetails,
  LeaveDetails,
  IdReplacementDetails,
  LabAccessDetails,
  GeneralInquiryDetails,
} from '@/types/service-request';

interface AdminRequestReviewModalProps {
  request: ServiceRequestDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedRequest: ServiceRequestDTO) => void;
}

export function AdminRequestReviewModal({
  request,
  isOpen,
  onClose,
  onSuccess,
}: AdminRequestReviewModalProps) {
  const [action, setAction] = useState<ServiceRequestStatus>('under_review');
  const [remarks, setRemarks] = useState('');

  // Fulfillment document fields
  const [docName, setDocName] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docRefId, setDocRefId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!request) return null;

  const isTerminal = request.status === 'fulfilled' || request.status === 'rejected';

  const getAvailableActions = (): { value: ServiceRequestStatus; label: string }[] => {
    switch (request.status) {
      case 'submitted':
        return [
          { value: 'under_review', label: 'Mark Under Review' },
          { value: 'action_required', label: 'Request Clarification (Action Required)' },
          { value: 'approved', label: 'Approve Application' },
          { value: 'rejected', label: 'Reject Application' },
        ];
      case 'under_review':
        return [
          { value: 'action_required', label: 'Request Clarification (Action Required)' },
          { value: 'approved', label: 'Approve Application' },
          { value: 'fulfilled', label: 'Fulfill & Issue Document' },
          { value: 'rejected', label: 'Reject Application' },
        ];
      case 'action_required':
        return [
          { value: 'under_review', label: 'Resume Review' },
          { value: 'approved', label: 'Approve Application' },
          { value: 'rejected', label: 'Reject Application' },
        ];
      case 'approved':
        return [
          { value: 'fulfilled', label: 'Fulfill & Issue Document' },
          { value: 'rejected', label: 'Revoke / Reject' },
        ];
      default:
        return [];
    }
  };

  const availableActions = getAvailableActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);

    // Validation for reject and action required
    if ((action === 'rejected' || action === 'action_required') && (!remarks || remarks.trim().length < 10)) {
      setError('Please provide descriptive remarks (minimum 10 characters) explaining this action.');
      return;
    }

    // Validation for fulfill document
    if (action === 'fulfilled') {
      if (!docName.trim() || !docUrl.trim()) {
        setError('Document name and valid URL are required for digital fulfillment.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        action,
        remarks: remarks.trim() || undefined,
      };

      if (action === 'fulfilled') {
        payload.fulfillmentDocument = {
          name: docName.trim(),
          url: docUrl.trim(),
          referenceId: docRefId.trim() || undefined,
        };
      }

      const res = await fetch(`/api/v1/requests/${request.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || data?.message || 'Failed to process request action.';
        throw new Error(msg);
      }

      onSuccess(data.data as ServiceRequestDTO);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-primary tracking-wide">
                {request.ticketNumber}
              </span>
              <Badge variant="outline" className="capitalize">
                {request.category.replace('_', ' ')}
              </Badge>
              {request.priority === 'urgent' && (
                <Badge variant="destructive">Urgent</Badge>
              )}
            </div>
            <time className="text-xs text-muted-foreground">
              Submitted {new Date(request.createdAt).toLocaleDateString()}
            </time>
          </div>
          <DialogTitle className="text-lg font-bold mt-1 text-foreground">
            {request.subject}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Reviewing student requisition from {request.studentSnapshot.fullName} ({request.studentSnapshot.department})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-rose-700 dark:text-rose-400 text-sm flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Student Profile Snapshot */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Student Information
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Name:</span>
                <span className="font-medium text-foreground">{request.studentSnapshot.fullName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Roll / Enrollment:</span>
                <span className="font-mono font-medium text-foreground">{request.studentSnapshot.enrollmentNo}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Department:</span>
                <span className="font-medium text-foreground">{request.studentSnapshot.department}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Email:</span>
                <span className="font-medium text-foreground truncate block">{request.studentSnapshot.email}</span>
              </div>
            </div>
          </div>

          {/* Contextual Details */}
          <div className="rounded-lg border border-border/80 p-3.5 space-y-2 text-xs">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Requisition Details
            </h4>

            {request.category === 'bonafide' && (() => {
              const details = request.details as BonafideDetails;
              return (
                <div>
                  <span className="text-muted-foreground">Stated Purpose: </span>
                  <span className="font-medium capitalize text-foreground">{details.purpose?.replace('_', ' ')}</span>
                  {details.customPurpose && (
                    <p className="mt-1 text-muted-foreground">Specification: {details.customPurpose}</p>
                  )}
                </div>
              );
            })()}

            {request.category === 'leave' && (() => {
              const details = request.details as LeaveDetails;
              return (
                <div className="space-y-1.5">
                  <div className="flex gap-4">
                    <span><strong>From:</strong> {new Date(details.startDate).toLocaleDateString()}</span>
                    <span><strong>To:</strong> {new Date(details.endDate).toLocaleDateString()}</span>
                    <span><strong>Emergency:</strong> {details.emergencyContact}</span>
                  </div>
                  <p className="text-muted-foreground bg-muted/30 p-2 rounded border border-border/40 mt-1">
                    {details.reason}
                  </p>
                </div>
              );
            })()}

            {request.category === 'id_replacement' && (() => {
              const details = request.details as IdReplacementDetails;
              return (
                <div>
                  <span><strong>Reason:</strong> <span className="capitalize">{details.reason}</span></span>
                  {details.policeReportRef && (
                    <p className="mt-1"><strong>Police Ref:</strong> {details.policeReportRef}</p>
                  )}
                </div>
              );
            })()}

            {request.category === 'lab_access' && (() => {
              const details = request.details as LabAccessDetails;
              return (
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Lab:</strong> {details.labName}</div>
                  <div><strong>Supervisor:</strong> {details.facultySupervisor}</div>
                  <div><strong>Duration:</strong> {details.durationHours} hrs/day</div>
                  <div><strong>Dates:</strong> {details.requiredDates}</div>
                </div>
              );
            })()}

            {request.category === 'general_inquiry' && (() => {
              const details = request.details as GeneralInquiryDetails;
              return (
                <p className="whitespace-pre-wrap bg-muted/30 p-2 rounded border border-border/40">
                  {details.queryDetails}
                </p>
              );
            })()}
          </div>

          {/* Evidence Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Submitted Attachments ({request.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {request.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg border border-border/70 hover:bg-muted/40 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate font-medium">{att.name}</span>
                    </div>
                    <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Action Formulation Form (if not terminal) */}
          {!isTerminal ? (
            <form onSubmit={handleSubmit} className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                Administrative Action & Triage
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="review-action">Select Next Action *</Label>
                  <select
                    id="review-action"
                    value={action}
                    onChange={(e) => setAction(e.target.value as ServiceRequestStatus)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium"
                  >
                    {availableActions.map((act) => (
                      <option key={act.value} value={act.value}>
                        {act.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <Label htmlFor="review-remarks">
                  Administrative Remarks / Feedback {action === 'rejected' || action === 'action_required' ? '*' : '(Optional)'}
                </Label>
                <Textarea
                  id="review-remarks"
                  placeholder={
                    action === 'rejected'
                      ? 'Specify reasons for rejecting this requisition (minimum 10 characters)...'
                      : action === 'action_required'
                      ? 'Specify clarification or additional documents required from student (min 10 chars)...'
                      : 'Internal or student-visible remarks...'
                  }
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  required={action === 'rejected' || action === 'action_required'}
                />
              </div>

              {/* Fulfillment Document Upload / Details */}
              {action === 'fulfilled' && (
                <div className="space-y-3 rounded-md border border-border/80 bg-background/80 p-3">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Digital Fulfillment Document
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="doc-name">Document Title *</Label>
                      <Input
                        id="doc-name"
                        placeholder="e.g., Bonafide Certificate - Verified"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="doc-ref">Official Reference ID</Label>
                      <Input
                        id="doc-ref"
                        placeholder="e.g., AXIS/CERT/2026/0491"
                        value={docRefId}
                        onChange={(e) => setDocRefId(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="doc-url">Secure Document Download URL *</Label>
                    <Input
                      id="doc-url"
                      placeholder="https://res.cloudinary.com/.../certificate.pdf"
                      value={docUrl}
                      onChange={(e) => setDocUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Request...
                    </>
                  ) : (
                    'Confirm Action'
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="rounded-lg border border-muted bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              This request is in a terminal state ({request.status}) and cannot be modified further.
            </div>
          )}

          {/* Stepper & History */}
          <div className="border-t pt-4">
            <RequestStatusStepper
              status={request.status}
              reviewHistory={request.reviewHistory}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
