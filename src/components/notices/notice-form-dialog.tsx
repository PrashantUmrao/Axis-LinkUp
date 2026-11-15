'use client';

/**
 * Notice Authoring & Dispatch Modal Dialog.
 * Enforces role-based publishing scopes (Approved Policy 1):
 * - Faculty: course or section-specific within department.
 * - HOD: department-wide circulars.
 * - Director / SysAdmin: institution-wide and urgent emergency alerts.
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
  Input,
  Textarea,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
} from '@/components/ui';
import { Megaphone, Send, Save, ShieldAlert } from 'lucide-react';
import type { NoticeDTO, CreateNoticeInput, NoticeCategory, NoticePriority } from '@/types/notice';

interface NoticeFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNoticeCreated?: (notice: NoticeDTO) => void;
  currentUserRole: string;
  adminSubRole?: string | null;
  departmentId?: string | null;
}

export function NoticeFormDialog({
  isOpen,
  onClose,
  onNoticeCreated,
  currentUserRole,
  adminSubRole,
  departmentId,
}: NoticeFormDialogProps) {
  const [title, setTitle] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('academic');
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [scopeType, setScopeType] = useState<'institution_wide' | 'department' | 'cohort'>('department');
  const [courseCode, setCourseCode] = useState('');
  const [section, setSection] = useState('');
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFaculty = currentUserRole === 'faculty';
  const isHOD = currentUserRole === 'admin' && adminSubRole === 'hod';
  const isDirector = currentUserRole === 'super_admin' && adminSubRole === 'director';
  const isSysAdmin = currentUserRole === 'super_admin' && (!adminSubRole || adminSubRole === 'sys_admin');
  const canPublishUrgent = isDirector || isSysAdmin;
  const canPublishInstitutionWide = isDirector || isSysAdmin;

  const handleSubmit = async (publishImmediately: boolean) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    // Frontend validation
    if (!title.trim() || title.length < 3) {
      setErrorMessage('Title must be at least 3 characters.');
      setIsSubmitting(false);
      return;
    }

    if (!contentMarkdown.trim() || contentMarkdown.length < 10) {
      setErrorMessage('Notice content must be at least 10 characters.');
      setIsSubmitting(false);
      return;
    }

    if (isFaculty && scopeType === 'department' && !courseCode.trim() && !section.trim()) {
      setErrorMessage('Faculty must specify a course code or section. Department-wide circulars require HOD authorization.');
      setIsSubmitting(false);
      return;
    }

    const targetScope: CreateNoticeInput['targetScope'] = {
      scopeType,
      departmentIds: departmentId ? [departmentId] : undefined,
      courseCode: courseCode.trim() || undefined,
      sections: section.trim() ? [section.trim().toUpperCase()] : undefined,
    };

    const payload: CreateNoticeInput = {
      title: title.trim(),
      contentMarkdown: contentMarkdown.trim(),
      summary: summary.trim() || undefined,
      category,
      priority,
      status: publishImmediately ? 'published' : 'draft',
      targetScope,
      requiresAcknowledgment,
      isPinned,
    };

    try {
      const res = await fetch('/api/v1/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.error?.message || json.message || 'Failed to dispatch notice.');
        return;
      }

      if (onNoticeCreated) {
        onNoticeCreated(json.data);
      }

      onClose();
    } catch {
      setErrorMessage('Network error while connecting to campus bulletin server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Megaphone className="size-4" />
            </div>
            <DialogTitle className="text-lg font-bold">Compose Collegiate Circular</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Author an audited institutional announcement or department academic circular.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
              {errorMessage}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="notice-title" className="text-xs font-semibold">
              Notice Title *
            </Label>
            <Input
              id="notice-title"
              placeholder="e.g. CS601 Mid-Semester Lab Schedule Announcement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs"
              maxLength={150}
            />
          </div>

          {/* Category & Priority Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as NoticeCategory)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">Academic &amp; Coursework</SelectItem>
                  <SelectItem value="examination">Examination &amp; Schedules</SelectItem>
                  <SelectItem value="fee_accounts">Fee &amp; Accounts</SelectItem>
                  <SelectItem value="event_cultural">Events &amp; Cultural</SelectItem>
                  <SelectItem value="placement">Placement &amp; Training</SelectItem>
                  <SelectItem value="administrative">Administrative Notice</SelectItem>
                  <SelectItem value="emergency">Emergency Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority Level</Label>
              <Select value={priority} onValueChange={(val) => setPriority(val as NoticePriority)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">General (Standard)</SelectItem>
                  <SelectItem value="important">Important (Highlighted)</SelectItem>
                  <SelectItem value="urgent" disabled={!canPublishUrgent}>
                    {canPublishUrgent ? 'Urgent Siren (Emergency)' : 'Urgent (Requires Director)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Audience Scope */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-3">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-primary" />
              Target Audience &amp; Publishing Scope
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scopeType"
                  value="institution_wide"
                  checked={scopeType === 'institution_wide'}
                  disabled={!canPublishInstitutionWide}
                  onChange={() => setScopeType('institution_wide')}
                  className="size-3.5 text-primary"
                />
                <span className={!canPublishInstitutionWide ? 'text-muted-foreground line-through' : 'text-foreground'}>
                  Institution Wide
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scopeType"
                  value="department"
                  checked={scopeType === 'department'}
                  onChange={() => setScopeType('department')}
                  className="size-3.5 text-primary"
                />
                <span className="text-foreground">Department Scope</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scopeType"
                  value="cohort"
                  checked={scopeType === 'cohort'}
                  onChange={() => setScopeType('cohort')}
                  className="size-3.5 text-primary"
                />
                <span className="text-foreground">Specific Cohort</span>
              </label>
            </div>

            {/* Course / Section Fields for Faculty */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <Label htmlFor="course-code" className="text-[11px] text-muted-foreground">
                  Course Code {isFaculty && '(Required for Faculty)'}
                </Label>
                <Input
                  id="course-code"
                  placeholder="e.g. CS601"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                  className="text-xs font-mono uppercase"
                  maxLength={15}
                />
              </div>

              <div>
                <Label htmlFor="section-name" className="text-[11px] text-muted-foreground">
                  Section (Optional)
                </Label>
                <Input
                  id="section-name"
                  placeholder="e.g. A"
                  value={section}
                  onChange={(e) => setSection(e.target.value.toUpperCase())}
                  className="text-xs font-mono uppercase"
                  maxLength={5}
                />
              </div>
            </div>

            {isFaculty && (
              <p className="text-[10px] text-muted-foreground italic">
                * Institutional Policy: Faculty publishing is scoped to courses and sections. Department-wide broadcasts require HOD approval.
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label htmlFor="notice-summary" className="text-xs font-semibold">
              Brief Summary (Optional)
            </Label>
            <Input
              id="notice-summary"
              placeholder="One-line synopsis for cards and feeds"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="text-xs"
              maxLength={300}
            />
          </div>

          {/* Content Markdown */}
          <div className="space-y-1.5">
            <Label htmlFor="notice-content" className="text-xs font-semibold">
              Notice Content (Markdown Supported) *
            </Label>
            <Textarea
              id="notice-content"
              placeholder="Enter official bulletin text..."
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              className="min-h-28 text-xs font-mono"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between border-t border-border/30 pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={requiresAcknowledgment}
                onCheckedChange={(checked) => setRequiresAcknowledgment(Boolean(checked))}
              />
              <span className="text-xs text-foreground font-medium">
                Require Formal Acknowledgment (Statutory Policy 5)
              </span>
            </label>

            {(isHOD || isDirector || isSysAdmin) && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={isPinned}
                  onCheckedChange={(checked) => setIsPinned(Boolean(checked))}
                />
                <span className="text-xs text-foreground font-medium">Pin to Top of Feed</span>
              </label>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border/40 pt-3 flex flex-row items-center justify-between sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="gap-1.5 text-xs"
            >
              <Save className="size-3.5" />
              Save Draft
            </Button>

            <Button
              size="sm"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="gap-1.5 text-xs font-semibold"
            >
              <Send className="size-3.5" />
              {isSubmitting ? 'Dispatching...' : 'Publish Notice'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

