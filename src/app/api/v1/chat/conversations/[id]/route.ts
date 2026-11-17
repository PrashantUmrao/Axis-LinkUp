import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ChatService } from '@/lib/services/chat.service';
import { updateGroupChatSchema } from '@/lib/validations/chat.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError, BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/chat/conversations/[id]
 * Retrieves conversation details (with member list for groups).
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const conversation = await ChatService.getConversationDetails(session, id);
    return successResponse(conversation, 'Conversation details retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/chat/conversations/[id]
 * Updates academic group settings (faculty group admin only).
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new BadRequestError('Request body must be valid JSON');
    }

    const parseResult = updateGroupChatSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid group update parameters', parseResult.error.flatten());
    }

    const updated = await ChatService.updateGroup(session, id, parseResult.data);
    return successResponse(updated, 'Academic group updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
