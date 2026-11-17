'use client';

/**
 * IAM Account Status Transition Modal Component (Phase 5.10).
 * Allows Super Administrators to activate, suspend, or deactivate accounts
 * with mandatory justification, self-suspension protection, and explicit confirmation.
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
  Badge,
} from '@/components/ui';
import { AlertCircle, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import type {
  GovernedUserDTO,
  IamGovernableStatus,
  IamMutationResultDTO,
} from '@/types/governance';

interface IamStatusModalProps {
  user: GovernedUserDTO | null;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: IamMutationResultDTO) => void;
}

export function IamStatusModal({
  user,
  currentUserId,
  isOpen,
  onClose,
  onSuccess,
}: IamStatusModalProps) {
  const [status, setStatus] = useState<IamGovernableStatus>('suspended');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setStatus(user.status === 'active' ? 'suspended' : 'active');
    }
    setReason('');
    setConfirmed(false);
    setError(null);
  }, [user, isOpen]);

  if (!user) return null;

  const isSelfLockout = user.id === currentUserId && status !== 'active';
  const reasonTooShort = reason.trim().length < 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSelfLockout) {
      setError('Self-suspension or self-deactivation is prohibited.');
      return;
    }

    if (reasonTooShort) {
      setError('Governance justification must be at least 10 characters.');
      return;
    }

    if (!confirmed) {
      setError('Please confirm this executive account lifecycle transition.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/iam/users/${user.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reason: reason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Failed to update account status.');
        return;
      }

      onSuccess(json.data as IamMutationResultDTO);
      onClose();
    } catch {
      setError('Network error while executing account status change.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Change Account Lifecycle Status
          </DialogTitle>
          <DialogDescription className="text-xs">
            Suspending or deactivating an account immediately blocks portal access and writes a critical audit record.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-border/50 bg-muted/20 flex items-center justify-between rounded-lg border p-3 text-xs">
            <div>
              <p className="font-semibold">{user.fullName}</p>
              <p className="text-muted-foreground text-[11px]">{user.email}</p>
            </div>
            <Badge variant={user.status === 'active' ? 'success' : 'warning'} className="capitalize">
              Current: {user.status.replace('_', ' ')}
            </Badge>
          </div>

          {isSelfLockout && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Executive lockout guard: you cannot suspend or deactivate your own active account.
              </span>
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

          <div className="space-y-1.5">
            <Label htmlFor="iam-status-select" className="text-xs">
              Target Account Status *
            </Label>
            <select
              id="iam-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as IamGovernableStatus)}
              className="border-input bg-background h-9 w-full rounded-md border px-2.5 text-xs"
            >
              <option value="active">Active (Restore Full Authorized Access)</option>
              <option value="suspended">Suspended (Administrative Hold)</option>
              <option value="deactivated">Deactivated (Permanent Revocation)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="iam-status-reason" className="text-xs">
              Mandatory Governance Justification (min 10 characters) *
            </Label>
            <Textarea
              id="iam-status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide formal disciplinary, security, or registrar reference..."
              rows={3}
              maxLength={500}
              required
              className="text-xs"
            />
          </div>

          <label className="border-border/50 bg-muted/20 flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="accent-primary mt-0.5 h-3.5 w-3.5"
            />
            <span>
              I confirm this status transition for <strong>{user.email}</strong> and acknowledge it
              will be permanently recorded in the immutable audit ledger.
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={status === 'active' ? 'default' : 'destructive'}
              disabled={isSubmitting || isSelfLockout || reasonTooShort || !confirmed}
              className="gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm Status Transition
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
