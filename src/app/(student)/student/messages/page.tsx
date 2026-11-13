import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { ChatLayout } from '@/components/chat';
import type { Conversation } from '@/types/chat';

export const metadata: Metadata = {
  title: 'Collegiate Messages | Axis LinkUp',
  description: 'Verified direct advisory messaging and faculty-moderated academic channels.',
};

const STUDENT_CONVERSATIONS: Conversation[] = [
  {
    id: 'grp-cse301',
    type: 'group',
    name: 'CSE-301 Data Structures Official',
    handle: '@cse301_official',
    description: 'Official department announcements and assignment schedules for CSE-301.',
    unreadCount: 1,
    isGroup: true,
    groupPolicy: 'broadcast_only',
    lastMessage: 'Official Announcement: Practical Lab Assignment 4 is scheduled for Friday...',
    lastMessageTime: '09:30 AM',
    members: [
      { id: 'fac-hod', name: 'Dr. R. K. Verma (HOD)', role: 'faculty', isModerator: true },
      { id: 'std-you', name: 'Student (You)', role: 'student' },
      { id: 'std-2', name: 'Priya Verma', role: 'student' },
      { id: 'std-3', name: 'Rohan Gupta', role: 'student' },
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
    lastMessage: 'Welcome to the CSE Academic Advisory Desk. Please state your query...',
    lastMessageTime: '10:15 AM',
  },
  {
    id: 'grp-algo',
    type: 'group',
    name: 'Algorithm Research Colloquium',
    handle: '@algo_research_grp',
    description: 'Peer discussion and competitive algorithm problem walkthroughs.',
    unreadCount: 0,
    isGroup: true,
    groupPolicy: 'open_discussion',
    lastMessage: 'Weekly dynamic programming problem set has been published on GitHub.',
    lastMessageTime: 'Yesterday',
    members: [
      { id: 'fac-anjali', name: 'Prof. Anjali Sharma', role: 'faculty', isModerator: true },
      { id: 'std-you', name: 'Student (You)', role: 'student' },
      { id: 'std-1', name: 'Aarav Sharma', role: 'student' },
    ],
  },
  {
    id: 'conv-anjali',
    type: 'direct',
    name: 'Prof. Anjali Sharma',
    handle: 'Academic Proctor & Advisor',
    unreadCount: 0,
    isOnline: false,
    isGroup: false,
    lastMessage: 'Please submit your proctorial progress card before 3:00 PM.',
    lastMessageTime: 'Nov 12',
  },
];

export default async function StudentMessagesPage() {
  const session = await requireRole(['student', 'super_admin']);

  let userName = session.fullName || session.email?.split('@')[0] || 'Student';
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
        initialConversations={STUDENT_CONVERSATIONS}
        currentUserRole="student"
        currentUserId={session.userId || 'student-id'}
        currentUserName={userName}
      />
    </ContentContainer>
  );
}
