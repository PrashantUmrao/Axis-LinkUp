'use client';

/**
 * Faculty Academic Group Creation Dialog.
 * Enforces Phase 5.6 permission rules & ADR-007 specifications:
 * - Only verified Faculty (or Super Admin) can initiate academic group creation.
 * - Students cannot create groups or add members (Zero-Trust enforced on server).
 * - Configures broadcast policy (broadcast-only vs open-discussion).
 * - Connects to POST /api/v1/chat/conversations to persist in MongoDB.
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
  Badge,
} from '@/components/ui';
import {
  Users,
  Search,
  Plus,
  X,
  ShieldCheck,
  Volume2,
  MessageSquare,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { Conversation, ConversationMember } from '@/types/chat';

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (newGroup: Conversation) => void;
  departmentId?: string;
}

// Fallback student roster for demo / offline mode
const FALLBACK_STUDENTS: ConversationMember[] = [
  { id: '6730a005f8b1a2001a000301', name: 'Aarav Sharma', role: 'student' },
  { id: '6730a005f8b1a2001a000302', name: 'Priya Verma', role: 'student' },
  { id: '6730a005f8b1a2001a000303', name: 'Rohan Gupta', role: 'student' },
  { id: '6730a005f8b1a2001a000304', name: 'Ananya Mishra', role: 'student' },
];

export function CreateGroupDialog({
  isOpen,
  onClose,
  onGroupCreated,
  departmentId,
}: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [policy, setPolicy] = useState<'broadcast_only' | 'open_discussion'>('broadcast_only');
  const [courseCode, setCourseCode] = useState('');
  const [semester, setSemester] = useState<string>('3');
  const [section, setSection] = useState('A');
  const [searchQuery, setSearchQuery] = useState('');
  const [eligibleStudents, setEligibleStudents] = useState<ConversationMember[]>(FALLBACK_STUDENTS);
  const [selectedStudents, setSelectedStudents] = useState<ConversationMember[]>([]);
  const [manualStudentId, setManualStudentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamically load department academic roster when opened
  useEffect(() => {
    if (!isOpen || !departmentId) return;

    let isMounted = true;
    async function loadDepartmentRoster() {
      try {
        const res = await fetch(`/api/v1/departments/${departmentId}/roster?limit=50`);
        if (!res.ok) return;
        const json = await res.json();
        const students = json.data?.students || [];
        if (isMounted && students.length > 0) {
          const mapped: ConversationMember[] = students.map(
            (s: { id: string; fullName: string; rollNumber?: string }) => ({
              id: s.id,
              name: s.fullName,
              role: 'student',
            })
          );
          setEligibleStudents((prev) => {
            const combined = [...mapped, ...prev];
            const seen = new Set<string>();
            return combined.filter((s) => {
              if (seen.has(s.id)) return false;
              seen.add(s.id);
              return true;
            });
          });
        }
      } catch {
        // Safe offline fallback
      }
    }
    loadDepartmentRoster();
    return () => {
      isMounted = false;
    };
  }, [isOpen, departmentId]);

  const filteredStudents = eligibleStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedStudents.some((s) => s.id === student.id)
  );

  const toggleSelectStudent = (student: ConversationMember) => {
    setSelectedStudents((prev) => [...prev, student]);
  };

  const removeStudent = (studentId: string) => {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== studentId));
  };

  const addManualStudentId = () => {
    const id = manualStudentId.trim();
    if (!id) return;
    if (selectedStudents.some((s) => s.id === id)) return;
    setSelectedStudents((prev) => [
      ...prev,
      { id, name: `Student (${id.slice(-4)})`, role: 'student' },
    ]);
    setManualStudentId('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: groupName.trim(),
      description: groupDescription.trim() || undefined,
      groupPolicy: policy,
      departmentId: departmentId || undefined,
      academicContext: {
        courseCode: courseCode.trim() || undefined,
        semester: semester ? Number(semester) : undefined,
        section: section.trim().toUpperCase() || undefined,
      },
      initialMemberIds: selectedStudents.map((s) => s.id),
    };

    try {
      const res = await fetch('/api/v1/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Failed to create group (HTTP ${res.status})`);
      }

      onGroupCreated(json.data);
      onClose();
      setGroupName('');
      setGroupDescription('');
      setCourseCode('');
      setSelectedStudents([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card/95 border-glass-border max-w-lg space-y-4 border p-6 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
              <Users className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-heading text-foreground text-base font-bold">
                Create Academic Group Cohort
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Faculty-moderated collegiate channel with course context and policy governance
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl border p-2.5 text-xs">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="max-h-[75vh] space-y-3.5 overflow-y-auto pr-1 pt-1">
          {/* Group Name */}
          <div className="space-y-1">
            <label className="text-foreground text-xs font-semibold">
              Group Title <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="e.g. CSE-301 Data Structures Official"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-card/60 border-glass-border h-9 text-xs"
              required
              minLength={3}
            />
          </div>

          {/* Academic Context (Course Code, Semester, Section) */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-foreground text-xs font-semibold">Course Code</label>
              <Input
                placeholder="e.g. CS301"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="bg-card/60 border-glass-border h-8 text-xs uppercase"
              />
            </div>
            <div className="space-y-1">
              <label className="text-foreground text-xs font-semibold">Semester</label>
              <Input
                type="number"
                min={1}
                max={12}
                placeholder="3"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="bg-card/60 border-glass-border h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-foreground text-xs font-semibold">Section</label>
              <Input
                placeholder="A"
                maxLength={5}
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="bg-card/60 border-glass-border h-8 text-xs uppercase"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-foreground text-xs font-semibold">Description</label>
            <Textarea
              placeholder="Coursework clarifications, syllabus notices, and assignment deadlines."
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className="bg-card/60 border-glass-border min-h-[56px] text-xs"
            />
          </div>

          {/* Communication Policy */}
          <div className="space-y-1">
            <label className="text-foreground text-xs font-semibold">Channel Policy</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPolicy('broadcast_only')}
                className={`rounded-xl border p-2.5 text-left transition-all ${
                  policy === 'broadcast_only'
                    ? 'border-primary bg-primary/10 ring-primary/30 ring-1'
                    : 'border-glass-border bg-card/40 hover:bg-card/60'
                }`}
              >
                <div className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                  <Volume2 className="text-primary size-3.5" />
                  <span>Broadcast Only</span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  Only faculty moderators can post announcements.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPolicy('open_discussion')}
                className={`rounded-xl border p-2.5 text-left transition-all ${
                  policy === 'open_discussion'
                    ? 'border-primary bg-primary/10 ring-primary/30 ring-1'
                    : 'border-glass-border bg-card/40 hover:bg-card/60'
                }`}
              >
                <div className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                  <MessageSquare className="size-3.5 text-emerald-500" />
                  <span>Open Discussion</span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  Enrolled students may ask questions and participate.
                </p>
              </button>
            </div>
          </div>

          {/* Student Member Multi-Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-foreground text-xs font-semibold">
                Initial Student Members ({selectedStudents.length} selected)
              </label>
              <span className="text-muted-foreground text-[10px]">Academic Department</span>
            </div>

            {/* Selected Pills */}
            {selectedStudents.length > 0 && (
              <div className="bg-card/40 border-glass-border flex max-h-20 flex-wrap gap-1.5 overflow-y-auto rounded-lg border p-1.5">
                {selectedStudents.map((student) => (
                  <Badge
                    key={student.id}
                    variant="glass"
                    className="gap-1 py-0.5 pr-1 pl-2 text-[10px]"
                  >
                    <span>{student.name}</span>
                    <button
                      type="button"
                      onClick={() => removeStudent(student.id)}
                      className="hover:text-destructive"
                      aria-label={`Remove ${student.name}`}
                    >
                      <X className="size-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search department students by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card/60 border-glass-border h-8 pl-9 text-xs"
              />
            </div>

            {/* Student Dropdown / Quick Select */}
            <div className="border-glass-border bg-card/30 divide-border/20 max-h-28 divide-y overflow-y-auto rounded-lg border">
              {filteredStudents.length === 0 ? (
                <div className="text-muted-foreground p-2 text-center text-[11px]">
                  {searchQuery ? 'No matching students found' : 'All roster candidates selected'}
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="hover:bg-muted/40 flex items-center justify-between p-2 transition-colors"
                  >
                    <span className="text-foreground text-xs font-medium">{student.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSelectStudent(student)}
                      className="text-primary hover:bg-primary/10 h-6 px-2 text-[10px]"
                    >
                      <Plus className="mr-0.5 size-3" />
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Manual user ID entry */}
            <div className="flex items-center gap-1.5 pt-1">
              <Input
                placeholder="Or enter 24-hex MongoDB user ID..."
                value={manualStudentId}
                onChange={(e) => setManualStudentId(e.target.value)}
                className="bg-card/60 border-glass-border h-7 font-mono text-[11px]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addManualStudentId}
                disabled={!manualStudentId.trim()}
                className="h-7 shrink-0 text-[10px]"
              >
                Add ID
              </Button>
            </div>
          </div>

          <DialogFooter className="border-border/30 flex items-center justify-between border-t pt-3 sm:justify-between">
            <div className="flex items-center gap-1 text-[10px] text-emerald-500">
              <ShieldCheck className="size-3" />
              Zero-Trust Verification Active
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="pill-primary"
                size="sm"
                disabled={isSubmitting || !groupName.trim()}
                className="gap-1.5 text-xs shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    Create Group
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
