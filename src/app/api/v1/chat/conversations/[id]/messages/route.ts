import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ChatService } from '@/lib/services/chat.service';
import {
  sendMessageSchema,
  messagePaginationQuerySchema,
} from '@/lib/validations/chat.schema';
import { successResponse, createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError, BadRequestError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/chat/conversations/[id]/messages
 * Retrieves paginated message history and marks messages as read.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      limit: searchParams.get('limit') || undefined,
      before: searchParams.get('before') || searchParams.get('cursor') || undefined,
      after: searchParams.get('after') || undefined,
    };

    const parseResult = messagePaginationQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid message query parameters', parseResult.error.flatten());
    }

    const paginated = await ChatService.getConversationMessages(session, id, parseResult.data);
    return successResponse(paginated, 'Messages retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/chat/conversations/[id]/messages
 * Dispatches a new message into the conversation (MongoDB + stateless Ably broadcast).
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

    const parseResult = sendMessageSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid message payload', parseResult.error.flatten());
    }

    const message = await ChatService.sendMessage(session, id, parseResult.data);
    return createdResponse(message, 'Message dispatched successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
