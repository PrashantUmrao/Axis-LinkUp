'use client';

/**
 * Booking Review Modal Component (MOD-14 / Phase 5.9).
 * Administrative approval console modal displaying requester snapshot,
 * capacity utilization, time-slot details, and Approve / Reject decision controls
 * with mandatory rejection remarks and atomic conflict alerting.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Badge,
  Button,
  Label,
  Textarea,
} from '@/components/ui';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import type { FacilityBookingDTO } from '@/types/facility';

interface BookingReviewModalProps {
  booking: FacilityBookingDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedBooking: FacilityBookingDTO) => void;
}

export function BookingReviewModal({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: BookingReviewModalProps) {
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    setDecision('approve');
    setRemarks('');
    setError(null);
    setConflictMessage(null);
  }, [booking, isOpen]);

  if (!booking) return null;

  const isPending = booking.status === 'pending';
  const capacityRatio = Math.min(
    100,
    Math.round((booking.expectedAttendees / Math.max(1, booking.facilitySnapshot.capacity)) * 100)
  );
  const requiresRemarks = decision === 'reject';
  const remarksTooShort = requiresRemarks && remarks.trim().length < 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflictMessage(null);

    if (remarksTooShort) {
      setError('Rejection requires descriptive remarks of at least 10 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/facilities/bookings/${booking.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: decision,
          remarks: remarks.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg = json.error?.message || json.message || 'Failed to process booking decision.';
        if (res.status === 409) {
          setConflictMessage(msg);
        } else {
          setError(msg);
        }
        return;
      }

      onSuccess(json.data as FacilityBookingDTO);
      onClose();
    } catch {
      setError('Network error while submitting administrative decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">
              Review Space Reservation — {booking.bookingCode}
            </DialogTitle>
            <Badge
              variant={
                booking.status === 'approved'
                  ? 'success'
                  : booking.status === 'rejected'
                    ? 'destructive'
                    : booking.status === 'pending'
                      ? 'warning'
                      : 'outline'
              }
              className="capitalize"
            >
              {booking.status}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Verify space capacity, requester credentials, and time-slot availability before approving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Facility & Time Slot Card */}
          <div className="border-border/50 bg-muted/20 space-y-2.5 rounded-lg border p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Building2 className="text-primary h-4 w-4" />
                <span>{booking.facilitySnapshot.name}</span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {booking.facilitySnapshot.code}
              </Badge>
            </div>

            <div className="text-muted-foreground grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span>
                  {new Date(booking.startTime).toLocaleString()} –{' '}
                  {new Date(booking.endTime).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  Attendees: <strong className="text-foreground">{booking.expectedAttendees}</strong>{' '}
                  / {booking.facilitySnapshot.capacity} ({capacityRatio}%)
                </span>
              </div>
            </div>
          </div>

          {/* Requester Snapshot */}
          <div className="border-border/50 bg-background/50 space-y-1.5 rounded-lg border p-3.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold">
              <User className="h-3.5 w-3.5 text-indigo-500" />
              <span>Requester Details</span>
            </div>
            <p className="text-foreground font-medium">
              {booking.requesterSnapshot.fullName}{' '}
              <span className="text-muted-foreground font-normal">
                ({booking.requesterSnapshot.email})
              </span>
            </p>
            <p className="text-muted-foreground text-[11px]">
              Role: <span className="capitalize">{booking.requesterSnapshot.role}</span>
              {booking.requesterSnapshot.department && ` • ${booking.requesterSnapshot.department}`}
              {booking.requesterSnapshot.employeeId && ` • ID: ${booking.requesterSnapshot.employeeId}`}
            </p>
          </div>

          {/* Booking Title & Purpose */}
          <div className="space-y-1 text-xs">
            <p className="font-semibold">{booking.title}</p>
            <p className="text-muted-foreground leading-relaxed">{booking.purpose}</p>
          </div>

          {/* Existing Review Remarks / Cancellation Reason */}
          {booking.reviewRemarks && (
            <div className="border-border/50 bg-muted/30 rounded-lg border p-3 text-xs">
              <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                Administrative Remarks
              </p>
              <p className="mt-1">{booking.reviewRemarks}</p>
            </div>
          )}

          {booking.cancellationReason && (
            <div className="border-border/50 bg-muted/30 rounded-lg border p-3 text-xs">
              <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                Cancellation Reason
              </p>
              <p className="mt-1">{booking.cancellationReason}</p>
            </div>
          )}

          {/* Decision Form (Only for pending reservations) */}
          {isPending && (
            <form onSubmit={handleSubmit} className="border-border/40 space-y-3 border-t pt-3">
              {conflictMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Approval Blocked — Overlap Conflict</p>
                    <p className="mt-0.5">{conflictMessage}</p>
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDecision('approve')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-semibold transition-colors ${
                    decision === 'approve'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'border-border/60 text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Slot
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('reject')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-semibold transition-colors ${
                    decision === 'reject'
                      ? 'border-destructive bg-destructive/15 text-destructive'
                      : 'border-border/60 text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <XCircle className="h-4 w-4" />
                  Reject Request
                </button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="review-remarks" className="text-xs">
                  {requiresRemarks
                    ? 'Rejection Remarks (Mandatory, min 10 characters) *'
                    : 'Approval Remarks (Optional)'}
                </Label>
                <Textarea
                  id="review-remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={
                    requiresRemarks
                      ? 'Explain why this reservation cannot be approved (e.g., conflicting lab exam, maintenance)...'
                      : 'Optional instructions regarding keys, AV setup, or lab technician support...'
                  }
                  rows={3}
                  maxLength={500}
                  required={requiresRemarks}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant={decision === 'reject' ? 'destructive' : 'default'}
                  disabled={isSubmitting || remarksTooShort}
                  className="gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {decision === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
