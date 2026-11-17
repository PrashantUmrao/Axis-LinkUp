import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ChatService } from '@/lib/services/chat.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; messageId: string }>;
}

/**
 * DELETE /api/v1/chat/conversations/[id]/messages/[messageId]
 * Soft-deletes a message (Author or Faculty Group Administrator).
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id, messageId } = await params;

    const deleted = await ChatService.softDeleteMessage(session, id, messageId);
    return successResponse(deleted, 'Message soft-deleted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
