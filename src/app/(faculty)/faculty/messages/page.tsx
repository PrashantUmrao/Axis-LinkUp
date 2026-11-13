import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { ChatLayout } from '@/components/chat';
import type { Conversation } from '@/types/chat';

export const metadata: Metadata = {
  title: 'Faculty Messaging Cockpit | Axis LinkUp',
  description:
    'Manage academic communication cohorts, student advisories, and department broadcasts.',
};

const FACULTY_CONVERSATIONS: Conversation[] = [
  {
    id: 'grp-cse301',
    type: 'group',
    name: 'CSE-301 Data Structures Official',
    handle: '@cse301_official',
    description: 'Coursework notices and assignment deadlines for CSE-301 Batch A & B.',
    unreadCount: 0,
    isGroup: true,
    groupPolicy: 'broadcast_only',
    lastMessage: 'Practical Lab Assignment 4 is scheduled for Friday at 4:00 PM.',
    lastMessageTime: '09:30 AM',
    members: [
      { id: 'fac-current', name: 'Faculty Moderator (You)', role: 'faculty', isModerator: true },
      { id: 'std-1', name: 'Aarav Sharma', role: 'student' },
      { id: 'std-2', name: 'Priya Verma', role: 'student' },
      { id: 'std-3', name: 'Rohan Gupta', role: 'student' },
    ],
  },
  {
    id: 'grp-algo',
    type: 'group',
    name: 'Algorithm Research Colloquium',
    handle: '@algo_research_grp',
    description: 'Faculty-moderated student algorithm research and contest preparation.',
    unreadCount: 2,
    isGroup: true,
    groupPolicy: 'open_discussion',
    lastMessage: 'Rohan: Professor, should we use Dijkstra or Bellman-Ford for question 3?',
    lastMessageTime: '11:20 AM',
    members: [
      { id: 'fac-current', name: 'Faculty Moderator (You)', role: 'faculty', isModerator: true },
      { id: 'std-3', name: 'Rohan Gupta', role: 'student' },
      { id: 'std-4', name: 'Ananya Mishra', role: 'student' },
    ],
  },
  {
    id: 'conv-hod',
    type: 'direct',
    name: 'Dr. R. K. Verma',
    handle: 'Head of Department (CSE)',
    unreadCount: 0,
    isOnline: true,
    isGroup: false,
    lastMessage: 'Please submit the revised Mid-Term question paper blueprint.',
    lastMessageTime: 'Yesterday',
  },
  {
    id: 'conv-rep',
    type: 'direct',
    name: 'Rahul Verma',
    handle: 'Class Representative (CSE 3rd Year)',
    unreadCount: 0,
    isOnline: false,
    isGroup: false,
    lastMessage: 'Sir, all 64 students have received the laboratory manual.',
    lastMessageTime: 'Nov 12',
  },
];

export default async function FacultyMessagesPage() {
  const session = await requireRole(['faculty', 'super_admin']);

  let userName = session.fullName || session.email?.split('@')[0] || 'Faculty Member';
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
        initialConversations={FACULTY_CONVERSATIONS}
        currentUserRole="faculty"
        currentUserId={session.userId || 'faculty-id'}
        currentUserName={userName}
      />
    </ContentContainer>
  );
}
