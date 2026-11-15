'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
  Input,
  Label,
} from '@/components/ui';
import type { RosterStudentDTO } from '@/types/profile';
import {
  GraduationCap,
  Layers,
  BookOpen,
  Calendar,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface AcademicEditDialogProps {
  student: RosterStudentDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AcademicEditDialog({
  student,
  open,
  onOpenChange,
  onSuccess,
}: AcademicEditDialogProps) {
  const [program, setProgram] = useState(student?.program || '');
  const [batchYear, setBatchYear] = useState<number>(student?.batchYear || 2026);
  const [currentSemester, setCurrentSemester] = useState<number>(student?.currentSemester || 1);
  const [section, setSection] = useState(student?.section || 'A');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      setProgram(student.program || '');
      setBatchYear(student.batchYear || 2026);
      setCurrentSemester(student.currentSemester || 1);
      setSection(student.section || 'A');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [student, open]);

  if (!student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        program: program.trim() || undefined,
        batchYear: Number(batchYear),
        currentSemester: Number(currentSemester),
        section: section.trim().toUpperCase(),
      };

      const res = await fetch(`/api/v1/admin/users/${student.id}/academic-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Failed to update academic profile');
      }

      setSuccessMessage('Student academic cohort updated successfully!');
      onSuccess();

      setTimeout(() => {
        onOpenChange(false);
      }, 700);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error updating academic profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <GraduationCap className="size-4 text-primary" />
            Update Student Academic Cohort
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Administrative cohort progression for{' '}
            <span className="font-semibold text-foreground">{student.fullName}</span> ({student.rollNumber}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {errorMessage && (
            <div className="bg-destructive/10 text-destructive border-destructive/20 flex items-start gap-2 rounded-lg border p-3 text-xs leading-snug">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex items-center gap-2 rounded-lg border p-3 text-xs font-medium">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Immutable Registry Identifiers Notice */}
          <div className="bg-muted/30 border-border/60 flex items-center justify-between rounded-lg border p-2.5">
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-[10.5px]">Roll Number:</span>
              <p className="font-mono font-semibold text-foreground">{student.rollNumber}</p>
            </div>
            <div className="space-y-0.5 text-right">
              <span className="text-muted-foreground text-[10.5px]">Enrollment Number:</span>
              <p className="font-mono font-medium text-foreground">
                {student.enrollmentNumber || 'Not Registered'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground pl-2 border-l border-border/40">
              <Lock className="size-3 text-primary" />
              <span>Immutable</span>
            </div>
          </div>

          {/* Academic Program */}
          <div className="space-y-1.5">
            <Label htmlFor="program" className="text-xs font-medium flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-muted-foreground" />
              Academic Program
            </Label>
            <Input
              id="program"
              value={program}
              onChange={(e) => setProgram(e.target.value.toUpperCase())}
              placeholder="e.g. BTECH_CSE, BTECH_AIML"
              disabled={isSubmitting}
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Must be an active, approved program for {student.departmentCode || 'this department'}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Batch Year */}
            <div className="space-y-1.5">
              <Label htmlFor="batchYear" className="text-xs font-medium flex items-center gap-1">
                <Calendar className="size-3 text-muted-foreground" /> Batch Year
              </Label>
              <Input
                id="batchYear"
                type="number"
                min={2020}
                max={2035}
                value={batchYear}
                onChange={(e) => setBatchYear(Number(e.target.value))}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Current Semester */}
            <div className="space-y-1.5">
              <Label htmlFor="currentSemester" className="text-xs font-medium flex items-center gap-1">
                <Layers className="size-3 text-muted-foreground" /> Semester
              </Label>
              <Input
                id="currentSemester"
                type="number"
                min={1}
                max={8}
                value={currentSemester}
                onChange={(e) => setCurrentSemester(Number(e.target.value))}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Section */}
            <div className="space-y-1.5">
              <Label htmlFor="section" className="text-xs font-medium">
                Section
              </Label>
              <Input
                id="section"
                value={section}
                onChange={(e) => setSection(e.target.value.toUpperCase())}
                placeholder="A"
                maxLength={5}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Updating...
                </>
              ) : (
                'Save Cohort'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

