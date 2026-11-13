'use client';

/**
 * Chat Conversation Area Component (WhatsApp Web Inspired).
 * Handles message history, sender/receiver bubble alignment, timestamps, attachments, and message composition.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, Button, Input, Badge } from '@/components/ui';
import {
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Info,
  ArrowLeft,
  CheckCheck,
  FileText,
  VolumeX,
  Users,
} from 'lucide-react';
import type { Conversation, ChatMessage } from '@/types/chat';
import type { UserRole } from '@/types/user';

interface ChatConversationViewProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onBackMobile?: () => void;
  onToggleInfoPanel: () => void;
  currentUserRole: UserRole;
  isInfoPanelOpen: boolean;
}

export function ChatConversationView({
  conversation,
  messages,
  onSendMessage,
  onBackMobile,
  onToggleInfoPanel,
  currentUserRole,
  isInfoPanelOpen,
}: ChatConversationViewProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          Select a verified conversation or academic group from the left panel to begin secure
          messaging.
        </p>
      </div>
    );
  }

  const isBroadcastOnly = conversation.isGroup && conversation.groupPolicy === 'broadcast_only';
  const isStudent = currentUserRole === 'student';
  const isRestrictedFromPosting = isBroadcastOnly && isStudent;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isRestrictedFromPosting) return;
    onSendMessage(inputText.trim());
    setInputText('');
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

            <p className="text-muted-foreground text-[11px]">
              {conversation.isGroup
                ? `${conversation.members?.length || 0} enrolled members`
                : conversation.isOnline
                  ? 'Active on campus'
                  : 'Offline'}
            </p>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 rounded-lg p-2"
            title="Options"
          >
            <MoreVertical className="size-4" />
          </Button>
        </div>
      </div>

      {/* Message History Feed */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Date Divider */}
        <div className="flex items-center justify-center">
          <span className="bg-card/60 border-glass-border text-muted-foreground rounded-full border px-3 py-1 font-mono text-[10px] font-medium">
            Today
          </span>
        </div>

        {/* Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'} space-y-1`}
          >
            {/* Sender Label for group chats */}
            {!msg.isOwn && conversation.isGroup && (
              <div className="text-primary flex items-center gap-1 px-1 text-[10px] font-semibold">
                <span>{msg.senderName}</span>
                <Badge variant="outline" className="px-1 py-0 font-mono text-[8px] uppercase">
                  {msg.senderRole}
                </Badge>
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[82%] rounded-2xl p-3 shadow-xs transition-all sm:max-w-md ${
                msg.isOwn
                  ? 'bg-primary text-primary-foreground rounded-tr-xs'
                  : 'bg-card/75 border-glass-border text-foreground rounded-tl-xs border backdrop-blur-md'
              }`}
            >
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

              {/* Timestamp & Status */}
              <div
                className={`mt-1 flex items-center justify-end gap-1 font-mono text-[9px] ${
                  msg.isOwn ? 'text-primary-foreground/75' : 'text-muted-foreground'
                }`}
              >
                <span>{msg.timestamp}</span>
                {msg.isOwn && <CheckCheck className="size-3" />}
              </div>
            </div>
          </div>
        ))}

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
