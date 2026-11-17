import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ChatService } from '@/lib/services/chat.service';
import { ContentContainer } from '@/components/layouts';
import { ChatLayout } from '@/components/chat';
import type { Conversation } from '@/types/chat';

export const metadata: Metadata = {
  title: 'Collegiate Messages | Axis LinkUp',
  description: 'Verified direct advisory messaging and faculty-moderated academic channels.',
};

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

  let conversations: Conversation[] = [];
  try {
    const dbConversations = await ChatService.getUserConversations(session, { limit: 50 });
    if (dbConversations) {
      conversations = dbConversations;
    }
  } catch {
    conversations = [];
  }

  return (
    <ContentContainer maxWidth="default" className="py-2">
      <ChatLayout
        initialConversations={conversations}
        currentUserRole="student"
        currentUserId={session.userId || 'student-id'}
        currentUserName={userName}
        currentUserDepartmentId={session.departmentId}
      />
    </ContentContainer>
  );
}
