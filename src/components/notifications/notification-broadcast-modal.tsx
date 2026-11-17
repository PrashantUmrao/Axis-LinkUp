'use client';

/**
 * Targeted Alert Broadcast Composer Modal (MOD-17 / Phase 5.13).
 * Respects PERMISSIONS.ALERTS_DISPATCH RBAC scope rules:
 * - Super Admin: All Campus Users, By Role, By Department, Specific Users
 * - Admin / Faculty: Own Department (locked) or Specific Users
 */

import React, { useState } from 'react';
import { Button, Input, Label, Textarea, Badge } from '@/components/ui';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationBroadcastResultDTO,
  type NotificationBroadcastScope,
  type NotificationCategory,
} from '@/types/notification';
import type { UserRole } from '@/types/user';
import { Megaphone, X, Send, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

export interface NotificationBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  departmentScope?: { id: string; name: string; code: string } | null;
  availableDepartments?: Array<{ id: string; name: string; code: string }>;
  onSuccess?: (result: NotificationBroadcastResultDTO) => void;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'student', label: 'Students' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'admin', label: 'Administrators' },
  { value: 'super_admin', label: 'Super Administrators' },
];

export function NotificationBroadcastModal({
  isOpen,
  onClose,
  userRole,
  departmentScope = null,
  availableDepartments = [],
  onSuccess,
}: NotificationBroadcastModalProps) {
  const isSuperAdmin = userRole === 'super_admin';

  const defaultScope: NotificationBroadcastScope = isSuperAdmin
    ? 'all_users'
    : departmentScope
      ? 'by_department'
      : 'specific_users';

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('system');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [linkUrl, setLinkUrl] = useState('');
  const [targetScope, setTargetScope] = useState<NotificationBroadcastScope>(defaultScope);
  const [targetRoles, setTargetRoles] = useState<UserRole[]>(['student']);
  const [targetDepartment, setTargetDepartment] = useState<string>(
    departmentScope?.id || availableDepartments[0]?.id || ''
  );
  const [recipientIdsText, setRecipientIdsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NotificationBroadcastResultDTO | null>(null);

  if (!isOpen) return null;

  const toggleRole = (role: UserRole) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const trimmedLink = linkUrl.trim();
    if (trimmedLink && (!trimmedLink.startsWith('/') || trimmedLink.startsWith('//'))) {
      setError('Deep link must be a relative internal path starting with "/" (e.g., /student/notices).');
      return;
    }

    const recipientUserIds = recipientIdsText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          category,
          priority,
          linkUrl: trimmedLink || null,
          targetScope,
          targetRoles: targetScope === 'by_role' ? targetRoles : [],
          targetDepartment:
            targetScope === 'by_department'
              ? isSuperAdmin
                ? targetDepartment
                : departmentScope?.id || targetDepartment
              : null,
          recipientUserIds: targetScope === 'specific_users' ? recipientUserIds : [],
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Failed to dispatch alert broadcast.');
        return;
      }

      const broadcastResult = json.data as NotificationBroadcastResultDTO;
      setResult(broadcastResult);
      setTitle('');
      setMessage('');
      setLinkUrl('');
      setRecipientIdsText('');
      if (onSuccess) onSuccess(broadcastResult);
    } catch {
      setError('Network error while dispatching alert broadcast. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-broadcast-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="bg-background border-border/60 relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close targeted alert modal"
          className="text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-md p-1 transition-colors"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Megaphone className="size-5" />
          </div>
          <div>
            <h2
              id="notification-broadcast-modal-title"
              className="font-heading text-lg font-bold tracking-tight"
            >
              Send Targeted Alert
            </h2>
            <p className="text-muted-foreground text-xs">
              Dispatch a real-time in-app notification within your authorized institutional scope.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Alert broadcast dispatched successfully</p>
                <p className="mt-0.5">
                  Delivered to {result.dispatchedCount} of {result.recipientCount} recipients
                  {result.skippedCount > 0 ? ` (${result.skippedCount} skipped by mute/dedupe)` : ''}.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-title">Alert Title</Label>
            <Input
              id="broadcast-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Internal Assessment Schedule Updated"
              minLength={3}
              maxLength={140}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-message">Message</Label>
            <Textarea
              id="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide concise, actionable details for recipients..."
              rows={3}
              minLength={5}
              maxLength={600}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-category">Category</Label>
              <select
                id="broadcast-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-xs shadow-xs focus-visible:ring-1 focus-visible:outline-none"
              >
                {NOTIFICATION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {NOTIFICATION_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="broadcast-priority">Priority</Label>
              <select
                id="broadcast-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'normal' | 'high' | 'urgent')}
                className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-xs shadow-xs focus-visible:ring-1 focus-visible:outline-none"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-scope">Audience Scope</Label>
            <select
              id="broadcast-scope"
              value={targetScope}
              onChange={(e) => setTargetScope(e.target.value as NotificationBroadcastScope)}
              className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-xs shadow-xs focus-visible:ring-1 focus-visible:outline-none"
            >
              {isSuperAdmin && <option value="all_users">All Campus Users</option>}
              {isSuperAdmin && <option value="by_role">Specific Institutional Roles</option>}
              <option value="by_department">
                {isSuperAdmin ? 'Specific Department' : 'My Assigned Department'}
              </option>
              <option value="specific_users">Specific User IDs</option>
            </select>
          </div>

          {targetScope === 'by_role' && isSuperAdmin && (
            <div className="space-y-2">
              <Label>Target Roles</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((opt) => {
                  const selected = targetRoles.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleRole(opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {targetScope === 'by_department' && (
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-department">Department Target</Label>
              {isSuperAdmin && availableDepartments.length > 0 ? (
                <select
                  id="broadcast-department"
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-xs shadow-xs focus-visible:ring-1 focus-visible:outline-none"
                >
                  {availableDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              ) : !isSuperAdmin && departmentScope ? (
                <div className="border-border/60 bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                  <span className="font-medium">
                    {departmentScope.name} ({departmentScope.code})
                  </span>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Lock className="size-3" />
                    Own Dept
                  </Badge>
                </div>
              ) : (
                <Input
                  id="broadcast-department"
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                  placeholder="Enter department code or ObjectId (e.g., CSE)"
                  required
                />
              )}
            </div>
          )}

          {targetScope === 'specific_users' && (
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-recipients">Recipient User IDs (comma or space separated)</Label>
              <Input
                id="broadcast-recipients"
                value={recipientIdsText}
                onChange={(e) => setRecipientIdsText(e.target.value)}
                placeholder="65f1a2b3c4d5e6f7a8b9c0d1, 65f1a2b3c4d5e6f7a8b9c0d2"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-link">Internal Action Link (Optional)</Label>
            <Input
              id="broadcast-link"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/student/notices"
              maxLength={300}
            />
            <p className="text-muted-foreground text-[11px]">
              Must be a relative path starting with &quot;/&quot; (external URLs are blocked for security).
            </p>
          </div>

          <div className="border-border/50 flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="gap-1.5">
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Dispatch Alert
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
