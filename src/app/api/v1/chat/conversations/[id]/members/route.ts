import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ChatService } from '@/lib/services/chat.service';
import { manageGroupMembersSchema } from '@/lib/validations/chat.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError, BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/chat/conversations/[id]/members
 * Adds or removes student members in an academic group.
 * Payload: { action: 'add' | 'remove', userIds: ['...'] }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new BadRequestError('Request body must be valid JSON');
    }

    const parseResult = manageGroupMembersSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid member management parameters', parseResult.error.flatten());
    }

    const updated = await ChatService.manageGroupMembers(session, id, parseResult.data);
    const actionMessage =
      parseResult.data.action === 'add'
        ? 'Members added to academic group successfully'
        : 'Members removed from academic group successfully';

    return successResponse(updated, actionMessage);
  } catch (error) {
    return handleApiError(error);
  }
}
