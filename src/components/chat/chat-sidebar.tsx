'use client';

/**
 * Chat Sidebar Component (WhatsApp Web Architecture).
 *
 * Conforms to Phase 5.6:
 * - Search bar across verified users, groups, and message previews
 * - Tabbed filtering: All, Direct Advisory, Academic Groups
 * - Live unread badge tracking
 * - Triggers for Faculty Group Creation and Collegiate Direct Messaging
 * - Ably real-time connection telemetry indicator
 */

import React, { useState } from 'react';
import { Input, Badge, Button, Avatar, AvatarFallback } from '@/components/ui';
import {
  Search,
  Plus,
  MessageSquare,
  Users,
} from 'lucide-react';
import type { Conversation } from '@/types/chat';
import type { UserRole } from '@/types/user';
import type { AblyConnectionStatus } from '@/hooks/use-ably-chat';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  currentUserRole: UserRole;
  onOpenCreateGroup: () => void;
  onOpenNewDirectChat: (initialQuery?: string) => void;
  ablyStatus?: AblyConnectionStatus;
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  currentUserRole,
  onOpenCreateGroup,
  onOpenNewDirectChat,
  ablyStatus = 'offline',
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'group'>('all');

  const isFacultyOrAdmin = currentUserRole === 'faculty' || currentUserRole === 'super_admin';

  const filteredConversations = conversations.filter((conv) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      conv.name.toLowerCase().includes(q) ||
      (conv.handle && conv.handle.toLowerCase().includes(q)) ||
      (conv.lastMessage && conv.lastMessage.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterType === 'direct') return !conv.isGroup;
    if (filterType === 'group') return conv.isGroup;
    return true;
  });

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <div className="bg-card/60 border-glass-border flex h-full flex-col border-r backdrop-blur-xl">
      {/* Top Header */}
      <div className="border-border/40 space-y-3 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-foreground text-lg font-bold">Messages</h2>
              {totalUnread > 0 && (
                <Badge variant="glass" className="bg-primary text-primary-foreground px-1.5 py-0 text-[10px]">
                  {totalUnread} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-muted-foreground">Institutional Communication</span>
              <span className="text-muted-foreground">•</span>
              <span
                className={`size-1.5 rounded-full ${
                  ablyStatus === 'connected'
                    ? 'bg-emerald-500'
                    : ablyStatus === 'connecting'
                      ? 'animate-pulse bg-amber-500'
                      : 'bg-muted-foreground'
                }`}
                title={`Ably Status: ${ablyStatus}`}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* New Direct Chat Action */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenNewDirectChat()}
              className="border-glass-border h-8 gap-1 px-2.5 text-xs shadow-xs"
              title="New Advisory Direct Message"
            >
              <MessageSquare className="size-3.5" />
              <span className="hidden sm:inline">Direct</span>
            </Button>

            {/* New Academic Group Action (Faculty Only) */}
            {isFacultyOrAdmin && (
              <Button
                type="button"
                variant="pill-primary"
                size="sm"
                onClick={onOpenCreateGroup}
                className="h-8 gap-1 px-2.5 text-xs shadow-xs"
                title="Create Faculty Academic Group"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Group</span>
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search users or academic groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-card/40 border-glass-border focus:ring-primary/40 h-9 rounded-xl pl-9 text-xs focus:ring-1"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
              filterType === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterType('direct')}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
              filterType === 'direct'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            <MessageSquare className="size-3" />
            Direct
          </button>
          <button
            type="button"
            onClick={() => setFilterType('group')}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
              filterType === 'group'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            <Users className="size-3" />
            Groups
          </button>
        </div>
      </div>

      {/* Conversations Scroll Feed */}
      <div className="divide-border/20 flex-1 divide-y overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
            {conversations.length === 0 ? (
              <>
                <div className="bg-primary/10 text-primary p-3 rounded-full">
                  <MessageSquare className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-semibold">No Conversations Yet</p>
                  <p className="text-muted-foreground text-xs max-w-xs">
                    Connect with faculty advisors or message peers across the institution.
                  </p>
                </div>
                <Button
                  variant="pill-primary"
                  size="sm"
                  onClick={() => onOpenNewDirectChat()}
                  className="gap-1.5 text-xs shadow-xs"
                >
                  <Plus className="size-3.5" />
                  Start a Conversation
                </Button>
              </>
            ) : (
              <>
                <div className="bg-muted text-muted-foreground p-3 rounded-full">
                  <Search className="size-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-foreground text-xs font-semibold">No matching conversations</p>
                  <p className="text-muted-foreground text-[11px]">
                    No messages match &ldquo;{searchQuery}&rdquo;.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenNewDirectChat(searchQuery)}
                  className="gap-1.5 text-xs"
                >
                  <Search className="size-3.5" />
                  Search Collegiate Directory
                </Button>
              </>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const initials = conv.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectConversation(conv.id)}
                className={`flex w-full items-start gap-3 p-3.5 text-left transition-all ${
                  isActive
                    ? 'border-primary/40 bg-primary/10 border-l-2'
                    : 'hover:bg-card/40 border-l-2 border-transparent'
                }`}
              >
                {/* Avatar with Group / Online status badge */}
                <div className="relative shrink-0">
                  <Avatar className="border-glass-border size-11 border">
                    <AvatarFallback
                      className={
                        conv.isGroup
                          ? 'bg-sky-500/10 font-bold text-sky-600 dark:text-sky-400'
                          : 'bg-primary/10 text-primary font-bold'
                      }
                    >
                      {conv.isGroup ? <Users className="size-4" /> : initials}
                    </AvatarFallback>
                  </Avatar>
                  {conv.isOnline && !conv.isGroup && (
                    <span className="border-card absolute right-0 bottom-0 size-3 rounded-full border-2 bg-emerald-500" />
                  )}
                </div>

                {/* Conversation Details */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-foreground truncate text-xs font-semibold">{conv.name}</h3>
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {conv.lastMessageTime
                        ? new Date(conv.lastMessageTime).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground truncate text-xs leading-relaxed">
                      {conv.lastMessage || 'No messages yet'}
                    </p>

                    {conv.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground flex size-4.5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {conv.isGroup && conv.groupPolicy && (
                    <div className="pt-0.5">
                      <span className="text-muted-foreground bg-muted/40 rounded px-1.5 py-0.2 font-mono text-[8px] uppercase">
                        {conv.groupPolicy === 'broadcast_only' ? 'Broadcast' : 'Discussion'}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
