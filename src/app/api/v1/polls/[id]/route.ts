import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAuth } from '@/lib/auth/server';
import { PollService } from '@/lib/services/poll.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/polls/[id]
 * Retrieves poll details, voter's personal submission state, and masked/unmasked vote counts.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid poll identifier format.');
    }

    const poll = await PollService.getPollById(id, session);

    return successResponse(poll, 'Poll retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/polls/[id]
 * Soft-deletes a poll. Preserves audit history.
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid poll identifier format.');
    }

    await PollService.deletePoll(id, session);

    return successResponse({ id, deleted: true }, 'Poll deleted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

