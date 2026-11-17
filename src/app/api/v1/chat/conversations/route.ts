import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ChatService } from '@/lib/services/chat.service';
import {
  createDirectChatSchema,
  createGroupChatSchema,
  conversationQuerySchema,
} from '@/lib/validations/chat.schema';
import { successResponse, createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError, BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/chat/conversations
 * Retrieves all conversations (direct and groups) for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      type: searchParams.get('type') || undefined,
      search: searchParams.get('search') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const parseResult = conversationQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid conversation query parameters', parseResult.error.flatten());
    }

    const conversations = await ChatService.getUserConversations(session, parseResult.data);
    return successResponse(conversations, 'User conversations retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/chat/conversations
 * Initiates a 1-to-1 direct conversation or creates a faculty academic group.
 * Differentiated by payload:
 * - Direct: { recipientId: "..." }
 * - Group: { name: "...", description?: "...", ... }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await req.json();
    } catch {
      throw new BadRequestError('Request body must be valid JSON');
    }

    if (rawBody && typeof rawBody === 'object' && 'recipientId' in rawBody) {
      // Direct messaging flow
      const parseResult = createDirectChatSchema.safeParse(rawBody);
      if (!parseResult.success) {
        throw new ValidationError('Invalid direct chat parameters', parseResult.error.flatten());
      }

      const conversation = await ChatService.getOrCreateDirectChat(session, parseResult.data);
      return createdResponse(conversation, 'Direct conversation resolved successfully');
    } else if (rawBody && typeof rawBody === 'object' && 'name' in rawBody) {
      // Academic group creation flow
      const parseResult = createGroupChatSchema.safeParse(rawBody);
      if (!parseResult.success) {
        throw new ValidationError('Invalid academic group parameters', parseResult.error.flatten());
      }

      const group = await ChatService.createAcademicGroup(session, parseResult.data);
      return createdResponse(group, 'Academic group created successfully');
    } else {
      throw new BadRequestError(
        'Invalid conversation payload. Must provide either recipientId for direct chat or name for an academic group.'
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
