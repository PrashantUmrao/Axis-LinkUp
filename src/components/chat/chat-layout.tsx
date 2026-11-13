'use client';

/**
 * Master Chat & Group Messaging Layout (WhatsApp Web Architecture).
 * Coordinates multi-column responsive layout:
 * - Left: ChatSidebar
 * - Center: ChatConversationView
 * - Right: ChatInfoPanel (collapsible)
 * - Dialog: CreateGroupDialog (for authorized faculty)
 */

import React, { useState } from 'react';
import { ChatSidebar } from './chat-sidebar';
import { ChatConversationView } from './chat-conversation-view';
import { ChatInfoPanel } from './chat-info-panel';
import { CreateGroupDialog } from './create-group-dialog';
import type { Conversation, ChatMessage } from '@/types/chat';
import type { UserRole } from '@/types/user';

interface ChatLayoutProps {
  initialConversations: Conversation[];
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserName: string;
}

export function ChatLayout({
  initialConversations,
  currentUserRole,
  currentUserId,
  currentUserName,
}: ChatLayoutProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Initial demo messages per conversation
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({
    'conv-hod': [
      {
        id: 'msg-1',
        conversationId: 'conv-hod',
        senderId: 'fac-hod',
        senderName: 'Dr. R. K. Verma',
        senderRole: 'faculty',
        content:
          'Welcome to the CSE Academic Advisory Desk. Please state your query regarding semester projects or curriculum clearances.',
        timestamp: '10:15 AM',
        isOwn: false,
        status: 'read',
      },
    ],
    'grp-cse301': [
      {
        id: 'msg-g1',
        conversationId: 'grp-cse301',
        senderId: 'fac-hod',
        senderName: 'Dr. R. K. Verma (HOD)',
        senderRole: 'faculty',
        content:
          'Official Announcement: Practical Lab Assignment 4 is scheduled for submission this Friday at 4:00 PM in Computer Lab 2.',
        timestamp: '09:30 AM',
        isOwn: false,
        status: 'read',
        attachments: [
          {
            id: 'att-1',
            name: 'CSE301_Assignment_4_Specs.pdf',
            size: 245760,
            type: 'application/pdf',
            url: '#',
          },
        ],
      },
    ],
  });

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const activeMessages = activeConversationId ? messagesMap[activeConversationId] || [] : [];

  const handleSendMessage = (content: string) => {
    if (!activeConversationId) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversationId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      content,
      timestamp: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isOwn: true,
      status: 'sent',
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), newMessage],
    }));

    // Update conversation lastMessage
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              lastMessage: content,
              lastMessageTime: 'Just now',
            }
          : c
      )
    );
  };

  const handleGroupCreated = (newGroup: Conversation) => {
    setConversations((prev) => [newGroup, ...prev]);
    setActiveConversationId(newGroup.id);
  };

  return (
    <div className="border-glass-border bg-card/40 relative flex h-[calc(100vh-8.5rem)] min-h-[580px] overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl">
      {/* 1. Left Sidebar (Fixed on desktop, toggled on mobile) */}
      <div
        className={`h-full w-full shrink-0 lg:w-80 ${
          activeConversationId ? 'hidden lg:block' : 'block'
        }`}
      >
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => setActiveConversationId(id)}
          currentUserRole={currentUserRole}
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
        />
      </div>

      {/* 2. Main Conversation Area */}
      <div
        className={`flex h-full flex-1 flex-col ${
          !activeConversationId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <ChatConversationView
          conversation={activeConversation}
          messages={activeMessages}
          onSendMessage={handleSendMessage}
          onBackMobile={() => setActiveConversationId(null)}
          onToggleInfoPanel={() => setIsInfoPanelOpen((prev) => !prev)}
          currentUserRole={currentUserRole}
          isInfoPanelOpen={isInfoPanelOpen}
        />
      </div>

      {/* 3. Optional Right Information Panel */}
      {isInfoPanelOpen && activeConversation && (
        <div className="hidden h-full shrink-0 md:block">
          <ChatInfoPanel
            conversation={activeConversation}
            onClose={() => setIsInfoPanelOpen(false)}
          />
        </div>
      )}

      {/* 4. Faculty Academic Group Creation Dialog */}
      <CreateGroupDialog
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
}
