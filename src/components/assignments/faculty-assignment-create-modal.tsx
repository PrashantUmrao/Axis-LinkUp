'use client';

/**
 * Faculty Assignment Creation & Editing Modal.
 * Scoped strictly to the faculty member's authorized teaching courses and academic department.
 * Enforces late submission cutoff boundaries, resubmission limits, and max marks constraints.
 */

import React, { useState, useEffect } from 'react';
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
} from '@/components/ui';
import { FileUploader } from './file-uploader';
import {
  AlertTriangle,
  Loader2,
  Save,
  Send,
} from 'lucide-react';
import type { AssignmentDTO, AssignmentAttachment } from '@/types/assignment';

interface FacultyAssignmentCreateModalProps {
  initialAssignment?: AssignmentDTO | null;
  assignedCourses: string[]; // e.g. ['CS301', 'CS502']
  departmentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedAssignment: AssignmentDTO) => void;
}

export function FacultyAssignmentCreateModal({
  initialAssignment,
  assignedCourses,
  departmentId,
  isOpen,
  onClose,
  onSuccess,
}: FacultyAssignmentCreateModalProps) {
  const isEditing = Boolean(initialAssignment);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [semester, setSemester] = useState<number>(3);
  const [section, setSection] = useState<string>('A');
  const [program, setProgram] = useState<string>('B.TECH');
  const [dueDate, setDueDate] = useState<string>('');
  const [maxMarks, setMaxMarks] = useState<number>(100);

  // Late submission policy
  const [allowLate, setAllowLate] = useState<boolean>(false);
  const [lateDueDate, setLateDueDate] = useState<string>('');
  const [penaltyPercentagePerDay, setPenaltyPercentagePerDay] = useState<number>(5);

  // Resubmission policy
  const [allowResubmission, setAllowResubmission] = useState<boolean>(false);
  const [maxResubmissions, setMaxResubmissions] = useState<number>(3);

  // Attachments
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize form on open
  useEffect(() => {
    if (initialAssignment) {
      setTitle(initialAssignment.title);
      setDescription(initialAssignment.description);
      setInstructions(initialAssignment.instructions || '');
      setCourseCode(initialAssignment.courseCode);
      setCourseName(initialAssignment.courseName);
      setSemester(initialAssignment.academicTarget.semester);
      setSection(initialAssignment.academicTarget.section || 'A');
      setProgram(initialAssignment.academicTarget.program || 'B.TECH');
      setMaxMarks(initialAssignment.maxMarks);

      // Format dueDate for datetime-local input
      const d = new Date(initialAssignment.dueDate);
      setDueDate(d.toISOString().slice(0, 16));

      setAllowLate(initialAssignment.lateSubmissionPolicy.allowLate);
      if (initialAssignment.lateSubmissionPolicy.lateDueDate) {
        const ld = new Date(initialAssignment.lateSubmissionPolicy.lateDueDate);
        setLateDueDate(ld.toISOString().slice(0, 16));
      } else {
        setLateDueDate('');
      }
      setPenaltyPercentagePerDay(initialAssignment.lateSubmissionPolicy.penaltyPercentagePerDay || 0);

      setAllowResubmission(initialAssignment.allowResubmission);
      setMaxResubmissions(initialAssignment.maxResubmissions);
      setAttachments(initialAssignment.attachments || []);
    } else {
      // Default to first assigned course if present
      const defaultCourse = assignedCourses[0] || 'CS301';
      setTitle('');
      setDescription('');
      setInstructions('');
      setCourseCode(defaultCourse);
      setCourseName('Coursework');
      setSemester(3);
      setSection('A');
      setProgram('B.TECH');
      setMaxMarks(100);

      // Default due date: 7 days from now
      const defaultDate = new Date(Date.now() + 7 * 86400000);
      setDueDate(defaultDate.toISOString().slice(0, 16));

      setAllowLate(false);
      setLateDueDate('');
      setPenaltyPercentagePerDay(5);
      setAllowResubmission(true);
      setMaxResubmissions(3);
      setAttachments([]);
    }
    setErrorMessage(null);
  }, [initialAssignment, assignedCourses, isOpen]);

  const handleSubmit = async (submitStatus: 'draft' | 'published') => {
    if (isSubmitting) return;

    if (!title.trim() || title.trim().length < 3) {
      setErrorMessage('Assignment title must be at least 3 characters.');
      return;
    }

    if (!description.trim() || description.trim().length < 3) {
      setErrorMessage('Assignment description must be at least 3 characters.');
      return;
    }

    if (!dueDate) {
      setErrorMessage('Due date and submission cutoff time are required.');
      return;
    }

    const primaryDue = new Date(dueDate);
    if (allowLate && lateDueDate) {
      const lateDue = new Date(lateDueDate);
      if (lateDue < primaryDue) {
        setErrorMessage('Late submission deadline must be on or after the primary due date.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim() || undefined,
      courseCode: courseCode.trim().toUpperCase(),
      courseName: courseName.trim() || courseCode.trim().toUpperCase(),
      departmentId,
      academicTarget: {
        semester: Number(semester),
        section: section.trim().toUpperCase(),
        program: program.trim().toUpperCase(),
      },
      dueDate: new Date(dueDate).toISOString(),
      maxMarks: Number(maxMarks),
      lateSubmissionPolicy: {
        allowLate,
        lateDueDate: allowLate && lateDueDate ? new Date(lateDueDate).toISOString() : null,
        penaltyPercentagePerDay: allowLate ? Number(penaltyPercentagePerDay) : 0,
      },
      allowResubmission,
      maxResubmissions: Number(maxResubmissions),
      attachments,
      status: submitStatus,
    };

    try {
      const url = isEditing
        ? `/api/v1/assignments/${initialAssignment!.id}`
        : '/api/v1/assignments';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to save assignment.');
      }

      onSuccess(json.data as AssignmentDTO);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save assignment.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <div className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Teaching Scope</span>
              <span>•</span>
              <span>Coursework Authoring</span>
            </div>
            <DialogTitle className="text-xl font-bold">
              {isEditing ? 'Edit Coursework Assignment' : 'Create Coursework Assignment'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure assignment deliverables, target student cohort, deadlines, and submission policies.
            </DialogDescription>
          </DialogHeader>

          {/* Form Fields Grid */}
          <div className="space-y-4 text-xs">
            {/* Title */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">
                Assignment Title <span className="text-destructive">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lab 4: Binary Search Trees Implementation"
                disabled={isSubmitting}
                className="text-xs"
              />
            </div>

            {/* Course & Target Cohort */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              {/* Course Selection */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-foreground">
                  Course Code <span className="text-destructive">*</span>
                </label>
                {assignedCourses.length > 0 ? (
                  <select
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    disabled={isSubmitting}
                    className="border-input bg-background text-foreground h-9 w-full rounded-md border px-3 py-1 text-xs"
                  >
                    {assignedCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. CS301"
                    disabled={isSubmitting}
                    className="text-xs uppercase"
                  />
                )}
              </div>

              {/* Course Name */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-foreground">Course Name</label>
                <Input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Advanced Data Structures"
                  disabled={isSubmitting}
                  className="text-xs"
                />
              </div>

              {/* Semester */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  disabled={isSubmitting}
                  className="border-input bg-background text-foreground h-9 w-full rounded-md border px-3 py-1 text-xs"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Section</label>
                <Input
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="A"
                  disabled={isSubmitting}
                  className="text-xs uppercase"
                />
              </div>

              {/* Program */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Program</label>
                <Input
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="B.TECH"
                  disabled={isSubmitting}
                  className="text-xs uppercase"
                />
              </div>

              {/* Max Marks */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Max Marks</label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Number(e.target.value))}
                  disabled={isSubmitting}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* Due Date & Time */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Primary Due Date &amp; Time <span className="text-destructive">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isSubmitting}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Late Submissions</label>
                <div className="flex h-9 items-center gap-2">
                  <input
                    type="checkbox"
                    id="allow-late"
                    checked={allowLate}
                    onChange={(e) => setAllowLate(e.target.checked)}
                    disabled={isSubmitting}
                    className="size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="allow-late" className="text-xs text-muted-foreground select-none">
                    Permit submissions after primary deadline
                  </label>
                </div>
              </div>
            </div>

            {/* Late Policy Sub-fields */}
            {allowLate && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Late Cutoff Date</label>
                  <Input
                    type="datetime-local"
                    value={lateDueDate}
                    onChange={(e) => setLateDueDate(e.target.value)}
                    disabled={isSubmitting}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Penalty (% per day)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={penaltyPercentagePerDay}
                    onChange={(e) => setPenaltyPercentagePerDay(Number(e.target.value))}
                    disabled={isSubmitting}
                    className="text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* Resubmission Policy */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">Allow Resubmissions</p>
                  <p className="text-[11px] text-muted-foreground">
                    Students can submit updated revisions prior to grading.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowResubmission}
                  onChange={(e) => setAllowResubmission(e.target.checked)}
                  disabled={isSubmitting}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
              </div>

              {allowResubmission && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Maximum Resubmissions:</span>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={maxResubmissions}
                    onChange={(e) => setMaxResubmissions(Number(e.target.value))}
                    disabled={isSubmitting}
                    className="h-8 w-20 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {/* Description & Problem Statement */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">
                Description &amp; Problem Statement <span className="text-destructive">*</span>
              </label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed assignment brief, questions, specifications..."
                disabled={isSubmitting}
                className="text-xs resize-y"
              />
            </div>

            {/* Instructions */}
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Submission Instructions</label>
              <Textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Upload source code in a ZIP archive and submit documentation as PDF..."
                disabled={isSubmitting}
                className="text-xs resize-y"
              />
            </div>

            {/* Reference Materials / Attachments */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Reference Materials &amp; Templates</label>
              <FileUploader
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                maxFiles={5}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSubmit('draft')}
              disabled={isSubmitting}
              className="gap-1.5 text-xs font-semibold"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>Save as Draft</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleSubmit('published')}
              disabled={isSubmitting}
              className="gap-1.5 text-xs font-semibold"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              <span>{isEditing ? 'Save & Publish Changes' : 'Publish Immediately'}</span>
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
