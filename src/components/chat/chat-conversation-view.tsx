'use client';

/**
 * Chat Conversation Area Component (WhatsApp Web Architecture).
 *
 * Conforms to Phase 5.6:
 * - Real-time message streaming with Ably WebSocket connection status
 * - Sender/receiver bubble alignment, timestamps, attachments, read receipts (blue double-check)
 * - Soft-deleted message handling ("This message was deleted")
 * - Message deletion authorization (authors & faculty group administrators)
 * - Message history pagination ("Load earlier messages")
 * - Strict Broadcast-Only policy enforcement (disables input for students with clear policy notice)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, Button, Input, Badge } from '@/components/ui';
import {
  Send,
  Paperclip,
  Smile,
  Info,
  ArrowLeft,
  Check,
  CheckCheck,
  FileText,
  VolumeX,
  Users,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { Conversation, ChatMessage } from '@/types/chat';
import type { UserRole } from '@/types/user';
import type { AblyConnectionStatus } from '@/hooks/use-ably-chat';

interface ChatConversationViewProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onLoadEarlier?: () => void;
  hasMore?: boolean;
  isLoadingEarlier?: boolean;
  onBackMobile?: () => void;
  onToggleInfoPanel: () => void;
  currentUserRole: UserRole;
  currentUserId: string;
  isInfoPanelOpen: boolean;
  ablyStatus?: AblyConnectionStatus;
}

export function ChatConversationView({
  conversation,
  messages,
  onSendMessage,
  onDeleteMessage,
  onLoadEarlier,
  hasMore = false,
  isLoadingEarlier = false,
  onBackMobile,
  onToggleInfoPanel,
  currentUserRole,
  currentUserId,
  isInfoPanelOpen,
  ablyStatus = 'offline',
}: ChatConversationViewProps) {
  const [inputText, setInputText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialLoadRef = useRef(true);

  // Auto-scroll on initial load or new message
  useEffect(() => {
    if (initialLoadRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      initialLoadRef.current = false;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (!conversation) {
    return (
      <div className="bg-card/30 flex flex-1 flex-col items-center justify-center p-8 text-center backdrop-blur-md">
        <div className="bg-primary/10 text-primary ring-primary/20 mb-4 flex size-16 items-center justify-center rounded-2xl ring-1">
          <Users className="size-8" />
        </div>
        <h3 className="font-heading text-foreground text-lg font-bold">
          Axis LinkUp Collegiate Chat
        </h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs">
          Select a verified conversation or faculty academic group from the sidebar to begin
          collegiate messaging.
        </p>
      </div>
    );
  }

  const isBroadcastOnly = conversation.isGroup && conversation.groupPolicy === 'broadcast_only';
  const isStudent = currentUserRole === 'student';
  const isRestrictedFromPosting = isBroadcastOnly && isStudent;
  const isFacultyOrAdmin =
    currentUserRole === 'faculty' ||
    currentUserRole === 'super_admin' ||
    conversation.createdBy === currentUserId;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isRestrictedFromPosting) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleDelete = async (messageId: string) => {
    if (!onDeleteMessage) return;
    setDeletingId(messageId);
    try {
      await onDeleteMessage(messageId);
    } finally {
      setDeletingId(null);
    }
  };

  const initials = conversation.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="bg-card/20 relative flex h-full flex-1 flex-col overflow-hidden backdrop-blur-md">
      {/* Conversation Topbar Header */}
      <div className="border-glass-border bg-card/60 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {onBackMobile && (
            <button
              type="button"
              onClick={onBackMobile}
              className="hover:bg-muted/40 text-muted-foreground rounded-lg p-1.5 lg:hidden"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}

          <div className="relative">
            <Avatar className="border-glass-border size-10 border">
              <AvatarFallback
                className={
                  conversation.isGroup
                    ? 'bg-sky-500/10 font-bold text-sky-600 dark:text-sky-400'
                    : 'bg-primary/10 text-primary font-bold'
                }
              >
                {conversation.isGroup ? <Users className="size-4" /> : initials}
              </AvatarFallback>
            </Avatar>
            {conversation.isOnline && !conversation.isGroup && (
              <span className="border-card absolute right-0 bottom-0 size-2.5 rounded-full border-2 bg-emerald-500" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-foreground text-sm font-bold">
                {conversation.name}
              </h3>
              {conversation.isGroup && conversation.groupPolicy && (
                <Badge
                  variant={conversation.groupPolicy === 'broadcast_only' ? 'warning' : 'glass'}
                  className="px-1.5 py-0 text-[9px]"
                >
                  {conversation.groupPolicy === 'broadcast_only' ? 'Broadcast Only' : 'Discussion'}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <p className="text-muted-foreground">
                {conversation.isGroup
                  ? `${conversation.members?.length || 0} enrolled members`
                  : conversation.handle || 'Collegiate Member'}
              </p>

              {/* Real-Time Connection Indicator */}
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                {ablyStatus === 'connected' ? (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Live
                  </span>
                ) : ablyStatus === 'connecting' ? (
                  <span className="flex items-center gap-1 text-amber-500">
                    <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                    Connecting...
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <span className="bg-muted-foreground size-1.5 rounded-full" />
                    Local Sync
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleInfoPanel}
            className={`h-8 rounded-lg p-2 ${
              isInfoPanelOpen
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Conversation Details"
          >
            <Info className="size-4" />
          </Button>
        </div>
      </div>

      {/* Message History Feed */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
        {/* Pagination Trigger: Load Earlier Messages */}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoadEarlier}
              disabled={isLoadingEarlier}
              className="border-glass-border bg-card/60 h-7 text-[10px]"
            >
              {isLoadingEarlier ? (
                <>
                  <Loader2 className="mr-1 size-3 animate-spin" />
                  Loading history...
                </>
              ) : (
                'Load earlier messages'
              )}
            </Button>
          </div>
        )}

        {/* Date Divider */}
        <div className="flex items-center justify-center">
          <span className="bg-card/60 border-glass-border text-muted-foreground rounded-full border px-3 py-0.5 font-mono text-[10px] font-medium">
            Collegiate Dialogue History
          </span>
        </div>

        {/* Empty messages note */}
        {messages.length === 0 && (
          <div className="text-muted-foreground py-8 text-center text-xs">
            No messages in this channel yet. Send an opening message to begin dialogue.
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => {
          const isOwn = msg.senderId === currentUserId || Boolean(msg.isOwn);
          const canDelete =
            !msg.isDeleted &&
            (isOwn ||
              (conversation.isGroup && isFacultyOrAdmin));

          return (
            <div
              key={msg.id}
              className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'} space-y-1`}
            >
              {/* Sender Label for group chats */}
              {!isOwn && conversation.isGroup && (
                <div className="text-primary flex items-center gap-1 px-1 text-[10px] font-semibold">
                  <span>{msg.senderName}</span>
                  <Badge variant="outline" className="px-1 py-0 font-mono text-[8px] uppercase">
                    {msg.senderRole}
                  </Badge>
                </div>
              )}

              {/* Bubble */}
              <div
                className={`relative max-w-[82%] rounded-2xl p-3 shadow-xs transition-all sm:max-w-md ${
                  msg.isDeleted
                    ? 'border-glass-border bg-card/40 text-muted-foreground rounded-tl-xs border italic'
                    : isOwn
                      ? 'bg-primary text-primary-foreground rounded-tr-xs'
                      : 'bg-card/75 border-glass-border text-foreground rounded-tl-xs border backdrop-blur-md'
                }`}
              >
                {msg.isDeleted ? (
                  <p className="text-xs leading-relaxed">
                    This message was deleted by {isOwn ? 'author' : 'moderator'}.
                  </p>
                ) : (
                  <>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap select-text sm:text-sm">
                      {msg.content}
                    </p>

                    {/* Attachments if any */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="border-border/20 mt-2 space-y-1.5 border-t pt-1">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="bg-card/40 flex items-center justify-between gap-2 rounded-lg p-2 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="text-primary size-4 shrink-0" />
                              <span className="truncate">{att.name}</span>
                            </div>
                            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                              {(att.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Timestamp, Read Status & Delete Action */}
                <div
                  className={`mt-1 flex items-center justify-end gap-1.5 font-mono text-[9px] ${
                    isOwn && !msg.isDeleted
                      ? 'text-primary-foreground/75'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span>{msg.timestamp}</span>

                  {/* WhatsApp-Style Read Receipt Indicator */}
                  {isOwn && !msg.isDeleted && (
                    <span title={msg.status === 'read' ? 'Read by recipient' : 'Sent to server'}>
                      {msg.status === 'read' ? (
                        <CheckCheck className="size-3 text-sky-300 dark:text-sky-400" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="size-3" />
                      ) : (
                        <Check className="size-3" />
                      )}
                    </span>
                  )}

                  {/* Soft Delete Trigger */}
                  {canDelete && onDeleteMessage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(msg.id)}
                      disabled={deletingId === msg.id}
                      className="hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                      title="Delete message"
                    >
                      {deletingId === msg.id ? (
                        <Loader2 className="size-2.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-2.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Broadcast Restricted Notice */}
      {isRestrictedFromPosting && (
        <div className="flex items-center justify-center gap-2 border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          <VolumeX className="size-4 shrink-0" />
          <span>
            This academic group is in Broadcast-Only mode. Only verified faculty moderators may
            post.
          </span>
        </div>
      )}

      {/* Composition Area */}
      <form
        onSubmit={handleSend}
        className="border-glass-border bg-card/60 flex items-center gap-2 border-t p-3 backdrop-blur-xl"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isRestrictedFromPosting}
          className="text-muted-foreground hover:text-foreground h-9 shrink-0 p-2"
          title="Attach document or coursework"
        >
          <Paperclip className="size-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isRestrictedFromPosting}
          className="text-muted-foreground hover:text-foreground hidden h-9 shrink-0 p-2 sm:flex"
          title="Insert emoji"
        >
          <Smile className="size-4" />
        </Button>

        <Input
          placeholder={
            isRestrictedFromPosting
              ? 'Posting restricted to Faculty Moderators'
              : `Message ${conversation.name}...`
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isRestrictedFromPosting}
          className="bg-card/40 border-glass-border focus:ring-primary/40 h-9 flex-1 rounded-xl text-xs focus:ring-1 sm:text-sm"
        />

        <Button
          type="submit"
          variant="pill-primary"
          size="sm"
          disabled={!inputText.trim() || isRestrictedFromPosting}
          className="h-9 shrink-0 gap-1 px-3.5 text-xs shadow-xs"
        >
          <Send className="size-3.5" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  );
}
