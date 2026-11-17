'use client';

/**
 * NewDirectChatDialog Component
 * Allows students, faculty, and administrators to discover real registered collegiate users
 * and initiate 1-to-1 direct messaging.
 *
 * Conforms to Zero-Trust Architecture:
 * - Queries real MongoDB provisioned accounts via GET /api/v1/users/search
 * - Server-side authorization & filtering: active provisioned accounts only
 * - Disallows self-messaging (validated client-side and enforced server-side)
 * - Returns safe public directory fields (no passwords, tokens, or private secrets)
 * - Idempotently creates or reopens conversations via POST /api/v1/chat/conversations
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { MessageSquare, Search, Plus, UserCheck, AlertCircle, Loader2 } from 'lucide-react';
import type { Conversation } from '@/types/chat';
import type { UserRole, DirectoryUserDTO } from '@/types/user';

interface NewDirectChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: Conversation) => void;
  currentUserRole: UserRole;
  currentUserId: string;
  departmentId?: string;
  initialQuery?: string;
}

export function NewDirectChatDialog({
  isOpen,
  onClose,
  onConversationCreated,
  currentUserId,
  initialQuery = '',
}: NewDirectChatDialogProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [contacts, setContacts] = useState<DirectoryUserDTO[]>([]);
  const [selectedContact, setSelectedContact] = useState<DirectoryUserDTO | null>(null);
  const [manualUserId, setManualUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial query when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(initialQuery || '');
      setSelectedContact(null);
      setError(null);
    }
  }, [isOpen, initialQuery]);

  // Debounced real-time user directory search
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const q = searchQuery.trim();
        const url = `/api/v1/users/search?q=${encodeURIComponent(q)}&limit=25`;
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Failed to load directory (HTTP ${res.status})`);
        }

        const json = await res.json();
        const results: DirectoryUserDTO[] = json.data || [];
        setContacts(results);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setContacts([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isOpen, searchQuery]);

  const handleStartChatWithRecipient = async (recipientId: string) => {
    if (!recipientId || !recipientId.trim()) {
      setError('Please select a collegiate contact or enter a valid user ID.');
      return;
    }

    if (recipientId === currentUserId) {
      setError('You cannot start a direct conversation with yourself.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: recipientId.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Failed to start chat (HTTP ${res.status})`);
      }

      onConversationCreated(json.data);
      onClose();
      setSelectedContact(null);
      setManualUserId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const recipientId = selectedContact?.id || manualUserId.trim();
    handleStartChatWithRecipient(recipientId);
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'faculty':
        return 'border-primary/40 bg-primary/10 text-primary';
      case 'admin':
      case 'super_admin':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-500';
      default:
        return 'border-blue-500/40 bg-blue-500/10 text-blue-500';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card/95 border-glass-border max-w-md space-y-4 border p-6 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-heading text-foreground text-base font-bold">
                New Collegiate Advisory Message
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Search verified students, faculty advisors, and institutional leadership.
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

        <form onSubmit={handleFormSubmit} className="space-y-4 pt-1">
          {/* Search bar */}
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search by name, @username, or institutional email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card/60 border-glass-border h-9 pr-8 pl-9 text-xs"
              autoFocus
            />
            {isLoading && (
              <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin" />
            )}
          </div>

          {/* Directory Contact List */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Collegiate Directory
              </label>
              <span className="text-muted-foreground text-[10px]">
                {contacts.length} {contacts.length === 1 ? 'member' : 'members'} found
              </span>
            </div>

            <div className="border-glass-border bg-card/30 divide-border/20 max-h-56 divide-y overflow-y-auto rounded-xl border">
              {isLoading && contacts.length === 0 ? (
                <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>Searching active collegiate directory...</span>
                </div>
              ) : contacts.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">No matching collegiate members found</p>
                  <p className="text-[11px]">
                    {searchQuery.trim()
                      ? `No active accounts matched "${searchQuery.trim()}".`
                      : 'No other active accounts are currently registered.'}
                  </p>
                </div>
              ) : (
                contacts.map((contact) => {
                  const isSelected = selectedContact?.id === contact.id;
                  const initials = contact.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  const subtitle =
                    contact.designation ||
                    (contact.rollNumber ? `Roll No: ${contact.rollNumber}` : null) ||
                    contact.departmentName ||
                    contact.email;

                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => {
                        setSelectedContact(contact);
                        setManualUserId(contact.id);
                        setError(null);
                      }}
                      onDoubleClick={() => handleStartChatWithRecipient(contact.id)}
                      className={`flex w-full items-center justify-between p-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 ring-primary/30 ring-1'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-8 shrink-0 border border-glass-border">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="space-y-0.5 truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground text-xs font-semibold truncate">
                              {contact.fullName}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[8px] uppercase px-1 py-0 ${getRoleBadgeVariant(
                                contact.role
                              )}`}
                            >
                              {contact.role}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                            {contact.username && (
                              <span className="font-mono text-primary/80">@{contact.username}</span>
                            )}
                            {contact.username && subtitle && <span>•</span>}
                            {subtitle && <span className="truncate">{subtitle}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2">
                        {isSelected ? (
                          <UserCheck className="text-primary size-4" />
                        ) : (
                          <Plus className="text-muted-foreground size-3.5 hover:text-foreground" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Custom User Identifier fallback */}
          <div className="space-y-1.5">
            <label className="text-foreground text-xs font-semibold">
              Or Enter Target Collegiate ID
            </label>
            <Input
              placeholder="e.g. 6af97658b80eb71c9a3a93d1"
              value={manualUserId}
              onChange={(e) => {
                setManualUserId(e.target.value);
                setSelectedContact(null);
                setError(null);
              }}
              className="bg-card/60 border-glass-border h-9 font-mono text-xs"
            />
          </div>

          <DialogFooter className="border-border/30 flex items-center justify-end gap-2 border-t pt-3">
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
              disabled={isSubmitting || (!selectedContact && !manualUserId.trim())}
              className="gap-1.5 text-xs shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <MessageSquare className="size-3.5" />
                  Start Conversation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
