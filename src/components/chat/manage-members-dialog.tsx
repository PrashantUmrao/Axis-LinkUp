'use client';

/**
 * ManageMembersDialog Component
 * Allows authorized Faculty Group Administrators to:
 * - View existing verified members
 * - Add new students to the academic group (POST /api/v1/chat/conversations/[id]/members)
 * - Remove members (POST /api/v1/chat/conversations/[id]/members)
 * - Toggle broadcast-only vs open-discussion policy (PATCH /api/v1/chat/conversations/[id])
 * - Archive/Unarchive academic group
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
  Badge,
  Avatar,
  AvatarFallback,
} from '@/components/ui';
import {
  Users,
  UserPlus,
  UserMinus,
  ShieldCheck,
  Volume2,
  MessageSquare,
  AlertCircle,
  Archive,
  Loader2,
  Check,
} from 'lucide-react';
import type { Conversation, ConversationMember } from '@/types/chat';

interface ManageMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onConversationUpdated: (updated: Conversation) => void;
  currentUserId: string;
}

export function ManageMembersDialog({
  isOpen,
  onClose,
  conversation,
  onConversationUpdated,
  currentUserId,
}: ManageMembersDialogProps) {
  const [newUserId, setNewUserId] = useState('');
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isCreatorOrAdmin =
    conversation.createdBy === currentUserId ||
    conversation.moderatorId === currentUserId;

  const handleTogglePolicy = async () => {
    const nextPolicy =
      conversation.groupPolicy === 'broadcast_only' ? 'open_discussion' : 'broadcast_only';
    setIsUpdatingPolicy(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/chat/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupPolicy: nextPolicy }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Failed to update policy (HTTP ${res.status})`);
      }

      onConversationUpdated(json.data);
      setSuccessMessage(`Group policy updated to ${nextPolicy === 'broadcast_only' ? 'Broadcast Only' : 'Open Discussion'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUpdatingPolicy(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = newUserId.trim();
    if (!targetId) return;

    setIsAddingMember(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/chat/conversations/${conversation.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          userIds: [targetId],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Failed to add member (HTTP ${res.status})`);
      }

      onConversationUpdated(json.data);
      setNewUserId('');
      setSuccessMessage('Member successfully enrolled in academic group.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === conversation.createdBy) {
      setError('Cannot remove the group faculty administrator.');
      return;
    }

    setRemovingMemberId(memberId);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/chat/conversations/${conversation.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          userIds: [memberId],
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Failed to remove member (HTTP ${res.status})`);
      }

      onConversationUpdated(json.data);
      setSuccessMessage('Member removed from academic group.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleArchive = async () => {
    const nextArchived = !conversation.isArchived;
    setIsArchiving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/chat/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: nextArchived }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Failed to update archive status (HTTP ${res.status})`);
      }

      onConversationUpdated(json.data);
      setSuccessMessage(nextArchived ? 'Academic group archived.' : 'Academic group unarchived.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsArchiving(false);
    }
  };

  const members: ConversationMember[] = conversation.members || [];

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
                Manage Academic Group: {conversation.name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Configure group policies, enroll students, and manage member roster
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

        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {/* Policy Governance Card */}
          <div className="bg-card/50 border-glass-border space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-xs font-semibold">Group Channel Policy</span>
              <Badge
                variant={conversation.groupPolicy === 'broadcast_only' ? 'warning' : 'glass'}
                className="text-[10px]"
              >
                {conversation.groupPolicy === 'broadcast_only'
                  ? 'Broadcast Only'
                  : 'Open Discussion'}
              </Badge>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {conversation.groupPolicy === 'broadcast_only'
                ? 'Only faculty administrators and moderators may post announcements. Student replies are restricted.'
                : 'All enrolled students and faculty may participate in academic discussions.'}
            </p>
            {isCreatorOrAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTogglePolicy}
                disabled={isUpdatingPolicy}
                className="h-8 w-full gap-1.5 text-xs"
              >
                {conversation.groupPolicy === 'broadcast_only' ? (
                  <>
                    <MessageSquare className="size-3.5 text-emerald-500" />
                    Switch to Open Discussion Mode
                  </>
                ) : (
                  <>
                    <Volume2 className="text-primary size-3.5" />
                    Switch to Broadcast Only Mode
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Add New Member Input */}
          {isCreatorOrAdmin && (
            <form onSubmit={handleAddMember} className="space-y-1.5">
              <label className="text-foreground text-xs font-semibold">
                Enroll Student (MongoDB User ID)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e.g. 6730a005f8b1a2001a000301"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  className="bg-card/60 border-glass-border h-8 font-mono text-xs"
                  disabled={isAddingMember}
                />
                <Button
                  type="submit"
                  variant="pill-primary"
                  size="sm"
                  disabled={isAddingMember || !newUserId.trim()}
                  className="h-8 shrink-0 gap-1 text-xs"
                >
                  {isAddingMember ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="size-3.5" />
                  )}
                  Enroll
                </Button>
              </div>
            </form>
          )}

          {/* Member Roster List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-foreground text-xs font-semibold">
                Enrolled Members ({members.length})
              </span>
              <span className="text-muted-foreground text-[10px]">Verified Collegiate Roster</span>
            </div>

            <div className="border-glass-border bg-card/30 divide-border/20 max-h-48 divide-y overflow-y-auto rounded-xl border">
              {members.length === 0 ? (
                <div className="text-muted-foreground p-3 text-center text-xs">
                  No member records currently loaded.
                </div>
              ) : (
                members.map((member) => {
                  const isCreator = member.id === conversation.createdBy;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2.5 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar className="border-glass-border size-7 border">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                            {member.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground truncate text-xs font-semibold">
                              {member.name}
                            </span>
                            {isCreator && (
                              <Badge
                                variant="glass"
                                className="text-primary px-1 py-0 text-[8px]"
                              >
                                Creator
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground font-mono text-[9px] uppercase">
                            {member.role} • {member.id.slice(-6)}
                          </span>
                        </div>
                      </div>

                      {isCreatorOrAdmin && !isCreator && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingMemberId === member.id}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-7 px-2 text-[10px]"
                        >
                          {removingMemberId === member.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <UserMinus className="size-3" />
                          )}
                          Remove
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Archive / Governance Actions */}
          {isCreatorOrAdmin && (
            <div className="border-border/30 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleArchive}
                disabled={isArchiving}
                className="h-8 w-full gap-1.5 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
              >
                <Archive className="size-3.5" />
                {conversation.isArchived ? 'Unarchive Group' : 'Archive Academic Group'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-border/30 flex items-center justify-between border-t pt-3 sm:justify-between">
          <div className="flex items-center gap-1 text-[10px] text-emerald-500">
            <ShieldCheck className="size-3" />
            Collegiate Governance
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
