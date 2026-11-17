'use client';

/**
 * Emergency Deactivate / All-Clear Modal Component (MOD-16 / Phase 5.11).
 * Requires descriptive all-clear deactivation notes (>= 10 characters) and writes a
 * critical AuditLog entry on stand-down.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
  Textarea,
} from '@/components/ui';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { EmergencyAlertDTO } from '@/types/emergency';

interface EmergencyDeactivateModalProps {
  alert: EmergencyAlertDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deactivated: EmergencyAlertDTO) => void;
}

export function EmergencyDeactivateModal({
  alert,
  isOpen,
  onClose,
  onSuccess,
}: EmergencyDeactivateModalProps) {
  const [deactivationNotes, setDeactivationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDeactivationNotes('');
    setError(null);
  }, [alert, isOpen]);

  if (!alert) return null;

  const notesTooShort = deactivationNotes.trim().length < 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (notesTooShort) {
      setError('All-clear summary must be at least 10 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/emergency/${alert.id}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deactivationNotes: deactivationNotes.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Failed to deactivate emergency alert.');
        return;
      }

      onSuccess(json.data as EmergencyAlertDTO);
      onClose();
    } catch {
      setError('Network error while standing down emergency alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            Stand Down Emergency — {alert.alertCode}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Deactivating removes the campus-wide banner and takeover modal immediately and logs a
            critical stand-down entry in the immutable audit trail.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="border-border/50 bg-muted/20 rounded-lg border p-3 text-xs">
            <p className="font-semibold">{alert.title}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              Total Receipts Recorded: {alert.acknowledgmentCount}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emg-deact-notes" className="text-xs">
              Mandatory All-Clear Summary (min 10 characters) *
            </Label>
            <Textarea
              id="emg-deact-notes"
              value={deactivationNotes}
              onChange={(e) => setDeactivationNotes(e.target.value)}
              placeholder="e.g., Campus security confirmed all blocks clear; normal academic sessions resume at 14:00."
              rows={3}
              maxLength={500}
              required
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || notesTooShort}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm All-Clear Stand Down
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
