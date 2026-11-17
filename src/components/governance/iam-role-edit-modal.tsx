'use client';

/**
 * IAM Role Edit Modal Component (Phase 5.10).
 * Allows Super Administrators to modify a user's institutional role, administrative sub-role,
 * and department assignment with mandatory governance justification and self-demotion guard.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Textarea,
  Badge,
} from '@/components/ui';
import { AlertCircle, AlertTriangle, Loader2, Shield } from 'lucide-react';
import type { GovernedUserDTO, IamMutationResultDTO } from '@/types/governance';
import type { UserRole, AdminSubRole } from '@/types/user';

interface IamRoleEditModalProps {
  user: GovernedUserDTO | null;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: IamMutationResultDTO) => void;
}

export function IamRoleEditModal({
  user,
  currentUserId,
  isOpen,
  onClose,
  onSuccess,
}: IamRoleEditModalProps) {
  const [role, setRole] = useState<UserRole>(user?.role || 'student');
  const [adminSubRole, setAdminSubRole] = useState<string>(user?.adminSubRole || '');
  const [department, setDepartment] = useState<string>(
    user?.departmentCode || user?.departmentId || ''
  );
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setAdminSubRole(user.adminSubRole || '');
      setDepartment(user.departmentCode || user.departmentId || '');
    }
    setReason('');
    setError(null);
  }, [user, isOpen]);

  if (!user) return null;

  const isSelfDemotion = user.id === currentUserId && role !== 'super_admin';
  const reasonTooShort = reason.trim().length < 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSelfDemotion) {
      setError('Self-demotion is prohibited. Another Super Administrator must modify your role.');
      return;
    }

    if (reasonTooShort) {
      setError('Governance justification must be at least 10 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: {
        role: UserRole;
        adminSubRole: AdminSubRole | null;
        department?: string | null;
        reason: string;
      } = {
        role,
        adminSubRole:
          role === 'admin' || role === 'super_admin'
            ? ((adminSubRole || null) as AdminSubRole | null)
            : null,
        reason: reason.trim(),
      };

      if (department.trim()) {
        payload.department = department.trim();
      }

      const res = await fetch(`/api/v1/iam/users/${user.id}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Failed to update user role.');
        return;
      }

      onSuccess(json.data as IamMutationResultDTO);
      onClose();
    } catch {
      setError('Network error while executing IAM role governance update.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="text-primary h-4 w-4" />
            Modify Institutional Role &amp; Scope
          </DialogTitle>
          <DialogDescription className="text-xs">
            Every IAM role mutation is permanently recorded in the SHA-256 immutable audit ledger.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border-border/50 bg-muted/20 flex items-center justify-between rounded-lg border p-3 text-xs">
            <div>
              <p className="font-semibold">{user.fullName}</p>
              <p className="text-muted-foreground text-[11px]">{user.email}</p>
            </div>
            <Badge variant="outline" className="capitalize">
              Current: {user.role.replace('_', ' ')}
            </Badge>
          </div>

          {isSelfDemotion && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Self-demotion guard active: you cannot demote your own Super Administrator account.
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="iam-role-select" className="text-xs">
                Target Role *
              </Label>
              <select
                id="iam-role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="border-input bg-background h-9 w-full rounded-md border px-2.5 text-xs"
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
                <option value="admin">Administrator (HOD / Dept)</option>
                <option value="super_admin">Super Administrator</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="iam-subrole-select" className="text-xs">
                Administrative Sub-Role
              </Label>
              <select
                id="iam-subrole-select"
                value={adminSubRole}
                disabled={role !== 'admin' && role !== 'super_admin'}
                onChange={(e) => setAdminSubRole(e.target.value)}
                className="border-input bg-background h-9 w-full rounded-md border px-2.5 text-xs disabled:opacity-50"
              >
                <option value="">None / Standard</option>
                <option value="hod">Head of Department (HOD)</option>
                <option value="director">Executive Director</option>
                <option value="sys_admin">System Administrator</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="iam-dept-input" className="text-xs">
              Department Code or ID (Optional, e.g. CSE, ECE, ME)
            </Label>
            <Input
              id="iam-dept-input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="CSE"
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="iam-role-reason" className="text-xs">
              Mandatory Governance Justification (min 10 characters) *
            </Label>
            <Textarea
              id="iam-role-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Appointed HOD of Computer Science per Registrar Circular #2026-44."
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
              disabled={isSubmitting || isSelfDemotion || reasonTooShort}
              className="gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Commit Role Change
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
