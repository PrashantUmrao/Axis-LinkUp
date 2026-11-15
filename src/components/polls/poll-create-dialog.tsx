'use client';

/**
 * Poll Creation Modal Dialog.
 * Enforces role-based poll creation rules (Approved Policy 3):
 * - Students strictly prohibited from poll creation.
 * - Faculty: course/section or department scoped.
 * - HOD: department scoped.
 * - Director / SysAdmin: institution-wide.
 * - Options invariant: 2 to 10 distinct choices.
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
import { BarChart3, Plus, Trash2, Send, Lock, ShieldAlert } from 'lucide-react';
import type { PollDTO, CreatePollInput, PollResultsVisibility } from '@/types/poll';

interface PollCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPollCreated?: (poll: PollDTO) => void;
  currentUserRole: string;
  adminSubRole?: string | null;
  departmentId?: string | null;
}

export function PollCreateDialog({
  isOpen,
  onClose,
  onPollCreated,
  currentUserRole,
  adminSubRole,
  departmentId,
}: PollCreateDialogProps) {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'single' | 'multiple'>('single');
  const [maxSelections, setMaxSelections] = useState(1);
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [resultsVisibility, setResultsVisibility] = useState<PollResultsVisibility>('after_vote');
  const [scopeType, setScopeType] = useState<'institution_wide' | 'department' | 'cohort'>('department');
  const [courseCode, setCourseCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDirector = currentUserRole === 'super_admin' && adminSubRole === 'director';
  const isSysAdmin = currentUserRole === 'super_admin' && (!adminSubRole || adminSubRole === 'sys_admin');
  const canCreateInstitutionWide = isDirector || isSysAdmin;

  const handleAddOption = () => {
    if (options.length >= 10) {
      setErrorMessage('A poll cannot exceed 10 options.');
      return;
    }
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      setErrorMessage('A poll must have at least 2 options.');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    // Question validation
    if (!question.trim() || question.trim().length < 5) {
      setErrorMessage('Poll question must be at least 5 characters.');
      setIsSubmitting(false);
      return;
    }

    // Cleaned options
    const cleanedOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (cleanedOptions.length < 2) {
      setErrorMessage('Please enter at least 2 non-empty choices.');
      setIsSubmitting(false);
      return;
    }

    // Check distinct options
    const lowerTexts = cleanedOptions.map((o) => o.toLowerCase());
    if (new Set(lowerTexts).size !== cleanedOptions.length) {
      setErrorMessage('All poll choices must have distinct, unique text labels.');
      setIsSubmitting(false);
      return;
    }

    const targetScope: CreatePollInput['targetScope'] = {
      scopeType,
      departmentIds: departmentId ? [departmentId] : undefined,
      courseCode: courseCode.trim() || undefined,
    };

    const payload: CreatePollInput = {
      question: question.trim(),
      description: description.trim() || undefined,
      type,
      maxSelections: type === 'single' ? 1 : Math.min(maxSelections, cleanedOptions.length),
      options: cleanedOptions.map((text) => ({ text })),
      isAnonymous,
      resultsVisibility,
      status: 'active',
      targetScope,
    };

    try {
      const res = await fetch('/api/v1/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.error?.message || json.message || 'Failed to initiate poll.');
        return;
      }

      if (onPollCreated) {
        onPollCreated(json.data);
      }

      onClose();
    } catch {
      setErrorMessage('Network error while connecting to polling service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
              <BarChart3 className="size-4" />
            </div>
            <DialogTitle className="text-lg font-bold">Initiate Campus Poll</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Deploy an audited collegiate survey or class ballot (2 to 10 choices).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium">
              {errorMessage}
            </div>
          )}

          {/* Question */}
          <div className="space-y-1.5">
            <Label htmlFor="poll-question" className="text-xs font-semibold">
              Poll Question *
            </Label>
            <Input
              id="poll-question"
              placeholder="e.g. Which programming language for the Advanced Web Systems project?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="text-xs"
              maxLength={250}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="poll-desc" className="text-xs font-semibold">
              Description / Instructions (Optional)
            </Label>
            <Textarea
              id="poll-desc"
              placeholder="Provide background context or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16 text-xs"
              maxLength={1000}
            />
          </div>

          {/* Type & Max Selections */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ballot Type</Label>
              <Select
                value={type}
                onValueChange={(val: 'single' | 'multiple') => {
                  setType(val);
                  if (val === 'single') setMaxSelections(1);
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Choice (1 Option)</SelectItem>
                  <SelectItem value="multiple">Multiple Choice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === 'multiple' && (
              <div className="space-y-1.5">
                <Label htmlFor="max-selections" className="text-xs font-semibold">
                  Max Selections Allowed
                </Label>
                <Input
                  id="max-selections"
                  type="number"
                  min={1}
                  max={options.length}
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(parseInt(e.target.value, 10) || 1)}
                  className="text-xs"
                />
              </div>
            )}
          </div>

          {/* Poll Options (2 to 10) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Choices ({options.length}/10) *</Label>
              {options.length < 10 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddOption}
                  className="h-7 text-xs text-primary gap-1"
                >
                  <Plus className="size-3" />
                  Add Choice
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
                  <Input
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    className="text-xs flex-1"
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(idx)}
                      className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Target Audience Scope */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-cyan-500" />
              Audience Scope
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pollScope"
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
                  name="pollScope"
                  value="institution_wide"
                  checked={scopeType === 'institution_wide'}
                  disabled={!canCreateInstitutionWide}
                  onChange={() => setScopeType('institution_wide')}
                  className="size-3.5 text-primary"
                />
                <span className={!canCreateInstitutionWide ? 'text-muted-foreground line-through' : 'text-foreground'}>
                  Institution Wide
                </span>
              </label>
            </div>

            {currentUserRole === 'faculty' && (
              <div>
                <Label htmlFor="poll-course" className="text-[11px] text-muted-foreground">
                  Course Code (Optional)
                </Label>
                <Input
                  id="poll-course"
                  placeholder="e.g. CS601"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                  className="text-xs font-mono uppercase"
                  maxLength={15}
                />
              </div>
            )}
          </div>

          {/* Results Visibility */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Results Visibility Policy</Label>
            <Select
              value={resultsVisibility}
              onValueChange={(val: PollResultsVisibility) => setResultsVisibility(val)}
            >
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="after_vote">Reveal After Vote (Standard)</SelectItem>
                <SelectItem value="after_close">Reveal Only After Poll Closes</SelectItem>
                <SelectItem value="always">Always Visible (Public Live Tally)</SelectItem>
                <SelectItem value="creator_only">Confidential (Creator &amp; Admins Only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Anonymous Ballot Toggle */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/30 pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(Boolean(checked))}
              />
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="size-3 text-emerald-500" />
                  Cryptographically Anonymous Voting (HMAC-SHA256)
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Hides student identity from database ballots while strictly enforcing one vote per student.
                </div>
              </div>
            </label>
          </div>
        </div>

        <DialogFooter className="border-t border-border/40 pt-3 flex flex-row items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <Send className="size-3.5" />
            {isSubmitting ? 'Deploying...' : 'Deploy Poll'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

