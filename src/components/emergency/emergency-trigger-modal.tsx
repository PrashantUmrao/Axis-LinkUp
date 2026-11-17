'use client';

/**
 * Emergency Broadcast Trigger Modal with Dual-Confirmation Gate (MOD-16 / Phase 5.11).
 * Step 1: Configure severity, category, directive, safety instructions checklist, and scope.
 * Step 2: Dual-confirmation requiring literal phrase "CONFIRM EMERGENCY" to eliminate accidental triggers.
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
} from '@/components/ui';
import {
  AlertCircle,
  AlertTriangle,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  EMERGENCY_CATEGORIES,
  EMERGENCY_CONFIRMATION_PHRASE,
  type EmergencyAffectedScope,
  type EmergencyAlertDTO,
  type EmergencyCategory,
  type EmergencySeverity,
} from '@/types/emergency';

interface EmergencyTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (alert: EmergencyAlertDTO) => void;
}

export function EmergencyTriggerModal({
  isOpen,
  onClose,
  onSuccess,
}: EmergencyTriggerModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [severity, setSeverity] = useState<EmergencySeverity>('red');
  const [category, setCategory] = useState<EmergencyCategory>('security');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [instructions, setInstructions] = useState<string[]>([
    'Remain indoors and follow faculty/security marshal instructions.',
  ]);
  const [newInstruction, setNewInstruction] = useState('');
  const [affectedScope, setAffectedScope] = useState<EmergencyAffectedScope>('all_campus');
  const [departmentsInput, setDepartmentsInput] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setConfirmationPhrase('');
      setError(null);
    }
  }, [isOpen]);

  const handleAddInstruction = () => {
    const trimmed = newInstruction.trim();
    if (trimmed.length < 3 || instructions.length >= 10) return;
    setInstructions((prev) => [...prev, trimmed]);
    setNewInstruction('');
  };

  const handleRemoveInstruction = (index: number) => {
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 5) {
      setError('Emergency title must be at least 5 characters.');
      return;
    }
    if (message.trim().length < 15) {
      setError('Safety directive message must be at least 15 characters.');
      return;
    }

    const parsedDepts = departmentsInput
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    if (affectedScope === 'specific_departments' && parsedDepts.length === 0) {
      setError('Provide at least one target department code/name (comma-separated).');
      return;
    }

    setStep(2);
  };

  const handleTriggerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (confirmationPhrase !== EMERGENCY_CONFIRMATION_PHRASE) {
      setError(`You must type "${EMERGENCY_CONFIRMATION_PHRASE}" verbatim to authorize broadcast.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const targetDepartments =
        affectedScope === 'specific_departments'
          ? departmentsInput
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean)
          : [];

      const res = await fetch('/api/v1/emergency/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          severity,
          category,
          instructions: instructions.filter((s) => s.trim().length >= 3),
          affectedScope,
          targetDepartments,
          confirmationPhrase,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Failed to activate emergency broadcast.');
        return;
      }

      setTitle('');
      setMessage('');
      setConfirmationPhrase('');
      onSuccess(json.data as EmergencyAlertDTO);
      onClose();
    } catch {
      setError('Network error while broadcasting emergency directive.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5" />
            {step === 1
              ? 'Configure Campus Emergency Broadcast (Step 1 of 2)'
              : 'Dual-Confirmation Authorization (Step 2 of 2)'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === 1
              ? 'Specify alert severity, actionable directives, and affected scope. RED alerts trigger a mandatory full-screen takeover across portals.'
              : 'Final safety interlock: verify alert details and enter the exact confirmation phrase to fire the live campus broadcast.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleProceedToConfirm} className="space-y-4">
            {/* Severity Cards */}
            <div className="space-y-1.5">
              <Label className="text-xs">Alert Severity Tier *</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  {
                    value: 'yellow' as const,
                    label: 'Yellow Advisory',
                    desc: 'Persistent top banner',
                    activeClass: 'border-yellow-500 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
                  },
                  {
                    value: 'amber' as const,
                    label: 'Amber High Alert',
                    desc: 'Banner + ack prompt',
                    activeClass: 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300',
                  },
                  {
                    value: 'red' as const,
                    label: 'Red Critical Lockdown',
                    desc: 'Mandatory full-screen takeover',
                    activeClass: 'border-red-600 bg-red-600/15 text-red-700 dark:text-red-300',
                  },
                ].map((tier) => (
                  <button
                    key={tier.value}
                    type="button"
                    onClick={() => setSeverity(tier.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      severity === tier.value
                        ? tier.activeClass
                        : 'border-border/60 text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    <p className="text-xs font-bold">{tier.label}</p>
                    <p className="mt-0.5 text-[10px] opacity-85">{tier.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emg-category" className="text-xs">
                  Emergency Category *
                </Label>
                <select
                  id="emg-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EmergencyCategory)}
                  className="border-input bg-background h-9 w-full rounded-md border px-2.5 text-xs capitalize"
                >
                  {EMERGENCY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emg-scope" className="text-xs">
                  Affected Campus Scope *
                </Label>
                <select
                  id="emg-scope"
                  value={affectedScope}
                  onChange={(e) => setAffectedScope(e.target.value as EmergencyAffectedScope)}
                  className="border-input bg-background h-9 w-full rounded-md border px-2.5 text-xs"
                >
                  <option value="all_campus">All Campus (Institutional Broadcast)</option>
                  <option value="specific_departments">Specific Departments Only</option>
                </select>
              </div>
            </div>

            {affectedScope === 'specific_departments' && (
              <div className="space-y-1.5">
                <Label htmlFor="emg-depts" className="text-xs">
                  Target Departments (Comma-separated codes/names) *
                </Label>
                <Input
                  id="emg-depts"
                  value={departmentsInput}
                  onChange={(e) => setDepartmentsInput(e.target.value)}
                  placeholder="CSE, ECE, ME"
                  className="text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="emg-title" className="text-xs">
                Directive Headline *
              </Label>
              <Input
                id="emg-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Campus Closure — Severe Storm Warning"
                minLength={5}
                maxLength={140}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emg-message" className="text-xs">
                Actionable Safety Directive *
              </Label>
              <Textarea
                id="emg-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Provide clear instructions, safe assembly points, and campus helpline contacts..."
                rows={3}
                minLength={15}
                maxLength={2000}
                required
                className="text-xs"
              />
            </div>

            {/* Safety Instructions Checklist */}
            <div className="space-y-2">
              <Label className="text-xs">Ordered Safety Checklist (Max 10)</Label>
              <div className="space-y-1.5">
                {instructions.map((stepText, idx) => (
                  <div
                    key={`${idx}-${stepText}`}
                    className="border-border/50 bg-muted/20 flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate">
                      {idx + 1}. {stepText}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveInstruction(idx)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                  placeholder="Add an actionable safety step..."
                  className="flex-1 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddInstruction}
                  disabled={instructions.length >= 10}
                  className="gap-1 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Step
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="destructive">
                Continue to Confirmation
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTriggerSubmit} className="space-y-4">
            <div className="border-destructive/40 bg-destructive/10 space-y-2 rounded-xl border p-4 text-xs">
              <div className="text-destructive flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4" />
                <span>IMMEDIATE CAMPUS-WIDE BROADCAST WARNING</span>
              </div>
              <p>
                <strong>Severity:</strong> {severity.toUpperCase()} • <strong>Category:</strong>{' '}
                {category.toUpperCase()}
              </p>
              <p>
                <strong>Headline:</strong> {title}
              </p>
              <p className="text-muted-foreground">
                This action will push an instant alert across authenticated portals and record a
                CRITICAL entry in the immutable SHA-256 audit log.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emg-confirm-phrase" className="text-xs font-semibold">
                Type <span className="font-mono text-red-500">{EMERGENCY_CONFIRMATION_PHRASE}</span>{' '}
                to authorize broadcast *
              </Label>
              <Input
                id="emg-confirm-phrase"
                value={confirmationPhrase}
                onChange={(e) => setConfirmationPhrase(e.target.value)}
                placeholder={EMERGENCY_CONFIRMATION_PHRASE}
                required
                className="font-mono text-xs"
              />
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)}>
                Back to Edit
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={isSubmitting || confirmationPhrase !== EMERGENCY_CONFIRMATION_PHRASE}
                className="gap-1.5 font-bold"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Activate Emergency Broadcast
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
