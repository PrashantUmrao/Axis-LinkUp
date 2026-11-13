'use client';

/**
 * Chat Sidebar Component (WhatsApp Web Inspired).
 * Houses search bar, filter tabs, individual & group conversation feeds, and group creation triggers.
 */

import React, { useState } from 'react';
import { Input, Badge, Button, Avatar, AvatarFallback } from '@/components/ui';
import { Search, Plus, MessageSquare, Users, CheckCheck, Clock } from 'lucide-react';
import type { Conversation } from '@/types/chat';
import type { UserRole } from '@/types/user';

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  currentUserRole: UserRole;
  onOpenCreateGroup: () => void;
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  currentUserRole,
  onOpenCreateGroup,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'group'>('all');

  const isFacultyOrAdmin = currentUserRole === 'faculty' || currentUserRole === 'super_admin';

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.handle && conv.handle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (conv.lastMessage && conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'direct') return !conv.isGroup;
    if (filterType === 'group') return conv.isGroup;
    return true;
  });

  return (
    <div className="bg-card/60 border-glass-border flex h-full flex-col border-r backdrop-blur-xl">
      {/* Top Header */}
      <div className="border-border/40 space-y-3 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="font-heading text-foreground text-lg font-bold">Messages</h2>
            <p className="text-muted-foreground text-[11px]">Institutional Communication</p>
          </div>

          {isFacultyOrAdmin && (
            <Button
              type="button"
              variant="pill-primary"
              size="sm"
              onClick={onOpenCreateGroup}
              className="h-8 gap-1 text-xs shadow-xs"
              title="Create Faculty Academic Group"
            >
              <Plus className="size-3.5" />
              New Group
            </Button>
          )}
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

      {/* Conversation List */}
      <div className="divide-border/20 flex-1 divide-y overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="text-muted-foreground space-y-2 p-8 text-center">
            <MessageSquare className="mx-auto size-8 opacity-30" />
            <p className="text-xs">No conversations match your filter.</p>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-primary text-xs"
              >
                Clear Search
              </Button>
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
                className={`flex w-full items-start gap-3 p-3.5 text-left transition-colors ${
                  isActive ? 'bg-primary/10 border-primary border-l-2' : 'hover:bg-muted/30'
                }`}
              >
                {/* Avatar with Online/Group indicator */}
                <div className="relative shrink-0">
                  <Avatar className="border-glass-border size-11 border shadow-xs">
                    <AvatarFallback
                      className={
                        conv.isGroup
                          ? 'bg-sky-500/10 font-bold text-sky-600 dark:text-sky-400'
                          : 'bg-primary/10 text-primary font-bold'
                      }
                    >
                      {conv.isGroup ? <Users className="size-5" /> : initials}
                    </AvatarFallback>
                  </Avatar>
                  {conv.isOnline && !conv.isGroup && (
                    <span
                      className="border-card absolute right-0 bottom-0 size-3 rounded-full border-2 bg-emerald-500"
                      title="Online"
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-foreground truncate text-xs font-semibold sm:text-sm">
                      {conv.name}
                    </h3>
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                      {conv.lastMessageTime}
                    </span>
                  </div>

                  {conv.handle && (
                    <p className="text-muted-foreground truncate font-mono text-[10px]">
                      {conv.handle}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-1">
                    <p className="text-muted-foreground line-clamp-1 flex-1 truncate text-xs">
                      {conv.lastMessage || 'No messages yet'}
                    </p>

                    {conv.unreadCount > 0 ? (
                      <Badge
                        variant="default"
                        className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full p-0 text-[10px] font-bold"
                      >
                        {conv.unreadCount}
                      </Badge>
                    ) : (
                      <CheckCheck className="text-muted-foreground/60 size-3.5 shrink-0" />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer System Strip */}
      <div className="border-border/40 text-muted-foreground flex items-center justify-between border-t p-3 text-[10px]">
        <span className="flex items-center gap-1 font-mono">
          <Clock className="size-3 text-sky-500" />
          Realtime Engine Ready
        </span>
        <span className="text-primary font-medium">AITM Campus Net</span>
      </div>
    </div>
  );
}
