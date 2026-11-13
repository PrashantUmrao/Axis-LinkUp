'use client';

/**
 * Faculty Academic Group Creation Dialog.
 * Enforces Phase 4.8.2 permission rules:
 * - Only verified Faculty (or Super Admin) can initiate academic group creation.
 * - Students cannot create groups or add members.
 * - Configures broadcast policy (broadcast-only vs open-discussion).
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
  Badge,
} from '@/components/ui';
import { Users, Search, Plus, X, ShieldCheck, Volume2, MessageSquare, Check } from 'lucide-react';
import type { Conversation, ConversationMember } from '@/types/chat';

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (newGroup: Conversation) => void;
}

// Verified institutional student roster for selection
const ELIGIBLE_STUDENTS: ConversationMember[] = [
  { id: 'std-1', name: 'Aarav Sharma', role: 'student' },
  { id: 'std-2', name: 'Priya Verma', role: 'student' },
  { id: 'std-3', name: 'Rohan Gupta', role: 'student' },
  { id: 'std-4', name: 'Ananya Mishra', role: 'student' },
  { id: 'std-5', name: 'Kabir Patel', role: 'student' },
  { id: 'std-6', name: 'Sneha Reddy', role: 'student' },
  { id: 'std-7', name: 'Vikram Singh', role: 'student' },
];

export function CreateGroupDialog({ isOpen, onClose, onGroupCreated }: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [policy, setPolicy] = useState<'broadcast_only' | 'open_discussion'>('broadcast_only');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<ConversationMember[]>([]);

  const filteredStudents = ELIGIBLE_STUDENTS.filter(
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const newGroup: Conversation = {
      id: `grp-${Date.now()}`,
      type: 'group',
      name: groupName.trim(),
      handle: `@${groupName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      description: groupDescription.trim() || 'Department academic cohort',
      isGroup: true,
      unreadCount: 0,
      groupPolicy: policy,
      lastMessage: 'Academic group created by Faculty Moderator',
      lastMessageTime: 'Just now',
      members: [
        { id: 'fac-current', name: 'Faculty Moderator (You)', role: 'faculty', isModerator: true },
        ...selectedStudents,
      ],
    };

    onGroupCreated(newGroup);
    onClose();
    setGroupName('');
    setGroupDescription('');
    setSelectedStudents([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card/95 border-glass-border max-w-md space-y-4 border p-6 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
              <Users className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-heading text-foreground text-base font-bold">
                Create Academic Group
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Faculty-moderated collegiate channel with access governance
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 pt-1">
          {/* Group Name & Handle */}
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-semibold">Group Title</label>
            <Input
              placeholder="e.g. CSE-301 Algorithms Batch A"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-card/60 border-glass-border h-9 text-xs"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-semibold">
              Description & Objectives
            </label>
            <Textarea
              placeholder="Coursework clarifications, syllabus notices, and peer academic queries."
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className="bg-card/60 border-glass-border min-h-[64px] text-xs"
            />
          </div>

          {/* Communication Policy */}
          <div className="space-y-1.5">
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
                Add Students ({selectedStudents.length} selected)
              </label>
              <span className="text-muted-foreground text-[10px]">CSE Department</span>
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
                placeholder="Search registered students by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card/60 border-glass-border h-8 pl-9 text-xs"
              />
            </div>

            {/* Student Dropdown / Quick Select */}
            <div className="border-glass-border bg-card/30 divide-border/20 max-h-28 divide-y overflow-y-auto rounded-lg border">
              {filteredStudents.length === 0 ? (
                <div className="text-muted-foreground p-2 text-center text-[11px]">
                  {searchQuery ? 'No matching students found' : 'All available students selected'}
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
          </div>

          <DialogFooter className="border-border/30 flex items-center justify-between border-t pt-2 sm:justify-between">
            <div className="flex items-center gap-1 text-[10px] text-emerald-500">
              <ShieldCheck className="size-3" />
              Faculty Governance Active
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="pill-primary"
                size="sm"
                disabled={!groupName.trim()}
                className="gap-1 text-xs"
              >
                <Check className="size-3.5" />
                Create Channel
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
