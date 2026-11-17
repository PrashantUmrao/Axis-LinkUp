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
  title: 'Administrative Communications | Axis LinkUp',
  description:
    'Executive governance dispatch, departmental HOD channels, and administrative broadcasts.',
};

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
        currentUserRole="admin"
        currentUserId={session.userId || 'admin-id'}
        currentUserName={userName}
        currentUserDepartmentId={session.departmentId}
      />
    </ContentContainer>
  );
}
