import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ChatService } from '@/lib/services/chat.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/chat/conversations/[id]/read
 * Explicitly marks all unread messages in a conversation as read.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const result = await ChatService.markConversationAsRead(session, id);
    return successResponse(result, 'Conversation marked as read successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
