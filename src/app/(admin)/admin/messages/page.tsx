import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { ChatLayout } from '@/components/chat';
import type { Conversation } from '@/types/chat';

export const metadata: Metadata = {
  title: 'Administrative Communications | Axis LinkUp',
  description:
    'Executive governance dispatch, departmental HOD channels, and administrative broadcasts.',
};

const ADMIN_CONVERSATIONS: Conversation[] = [
  {
    id: 'grp-council',
    type: 'group',
    name: 'AITM Academic Council',
    handle: '@aitm_academic_council',
    description: 'Executive leadership, Academic Deans, and Department HODs.',
    unreadCount: 0,
    isGroup: true,
    groupPolicy: 'open_discussion',
    lastMessage: 'Meeting notice: Semester Curriculum Review scheduled for Wednesday 11:00 AM.',
    lastMessageTime: '08:45 AM',
    members: [
      { id: 'dir-main', name: 'Executive Director (Ombudsman)', role: 'admin', isModerator: true },
      { id: 'hod-cse', name: 'Dr. R. K. Verma (HOD CSE)', role: 'faculty' },
      { id: 'admin-cur', name: 'Administrator (You)', role: 'admin' },
    ],
  },
  {
    id: 'conv-director',
    type: 'direct',
    name: 'Executive Director Office',
    handle: 'Directorate Administrative Chamber',
    unreadCount: 0,
    isOnline: true,
    isGroup: false,
    lastMessage: 'All statutory AICTE compliance reports have been filed for Session 2026.',
    lastMessageTime: 'Yesterday',
  },
  {
    id: 'conv-hod-cse',
    type: 'direct',
    name: 'Dr. R. K. Verma',
    handle: 'Head of Department (CSE)',
    unreadCount: 1,
    isOnline: true,
    isGroup: false,
    lastMessage: 'Requisition submitted for additional workstation licenses in Lab 2.',
    lastMessageTime: '10:05 AM',
  },
];

export default async function AdminMessagesPage() {
  const session = await requireRole(['admin', 'super_admin']);

  let userName = session.fullName || session.email?.split('@')[0] || 'Administrator';
  try {
    const userDoc = await UserRepository.findById(session.userId);
    if (userDoc) {
      const userDTO = toUserDTO(userDoc);
      userName = userDTO.fullName;
    }
  } catch {
    // Session fallback
  }

  return (
    <ContentContainer maxWidth="default" className="py-2">
      <ChatLayout
        initialConversations={ADMIN_CONVERSATIONS}
        currentUserRole="admin"
        currentUserId={session.userId || 'admin-id'}
        currentUserName={userName}
      />
    </ContentContainer>
  );
}
