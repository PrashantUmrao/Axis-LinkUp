'use client';

/**
 * Chat Information Panel Component.
 * Surfaces details for active direct conversation or faculty academic group,
 * including verified member roster and communication policies.
 */

import React from 'react';
import { Avatar, AvatarFallback, Badge, Button } from '@/components/ui';
import { X, Users, ShieldCheck, Volume2, MessageSquare } from 'lucide-react';
import type { Conversation } from '@/types/chat';

interface ChatInfoPanelProps {
  conversation: Conversation;
  onClose: () => void;
}

export function ChatInfoPanel({ conversation, onClose }: ChatInfoPanelProps) {
  const initials = conversation.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="border-glass-border bg-card/60 z-20 flex h-full w-80 flex-col border-l backdrop-blur-xl">
      {/* Header */}
      <div className="border-border/40 flex items-center justify-between border-b p-4">
        <h3 className="font-heading text-foreground text-sm font-bold">
          {conversation.isGroup ? 'Academic Group Details' : 'Contact Profile'}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground h-7 w-7 p-1.5"
          aria-label="Close info panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Profile Card */}
        <div className="border-border/30 flex flex-col items-center space-y-2 border-b pb-3 text-center">
          <Avatar className="border-primary/20 size-16 border-2 shadow-sm">
            <AvatarFallback
              className={
                conversation.isGroup
                  ? 'bg-sky-500/10 text-lg font-bold text-sky-600 dark:text-sky-400'
                  : 'bg-primary/10 text-primary text-lg font-bold'
              }
            >
              {conversation.isGroup ? <Users className="size-7" /> : initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-0.5">
            <h4 className="font-heading text-foreground text-base font-bold">
              {conversation.name}
            </h4>
            {conversation.handle && (
              <p className="text-muted-foreground font-mono text-xs">{conversation.handle}</p>
            )}
          </div>

          {conversation.isGroup && conversation.groupPolicy && (
            <Badge
              variant={conversation.groupPolicy === 'broadcast_only' ? 'warning' : 'glass'}
              className="gap-1 text-[10px]"
            >
              {conversation.groupPolicy === 'broadcast_only' ? (
                <>
                  <Volume2 className="size-3" />
                  Faculty Broadcast Only
                </>
              ) : (
                <>
                  <MessageSquare className="size-3" />
                  Open Academic Discussion
                </>
              )}
            </Badge>
          )}
        </div>

        {/* Description */}
        {conversation.description && (
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              About Channel
            </span>
            <p className="text-foreground bg-card/40 border-glass-border rounded-xl border p-2.5 text-xs leading-relaxed">
              {conversation.description}
            </p>
          </div>
        )}

        {/* Group Members List */}
        {conversation.isGroup && conversation.members && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Verified Members ({conversation.members.length})
              </span>
              <span className="text-primary text-[10px] font-medium">CSE Dept</span>
            </div>

            <div className="divide-border/20 border-glass-border bg-card/30 max-h-56 space-y-1.5 divide-y overflow-y-auto rounded-xl border p-2">
              {conversation.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2 pt-1.5 first:pt-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="border-glass-border size-7 border">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                        {member.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-xs font-semibold">
                        {member.name}
                      </p>
                      <span className="text-muted-foreground font-mono text-[9px] uppercase">
                        {member.role}
                      </span>
                    </div>
                  </div>

                  {member.isModerator && (
                    <Badge
                      variant="glass"
                      className="text-primary shrink-0 px-1 py-0 font-mono text-[8px]"
                    >
                      Moderator
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Institutional Code of Conduct Note */}
        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-3 text-xs">
          <div className="text-primary flex items-center gap-1.5 text-[11px] font-semibold">
            <ShieldCheck className="size-3.5" />
            <span>AITM Institutional Communication</span>
          </div>
          <p className="text-muted-foreground text-[10px] leading-relaxed">
            All messages, files, and discussion logs are protected under collegiate privacy policies
            and governed by the Axis IT Code of Conduct.
          </p>
        </div>
      </div>
    </div>
  );
}
