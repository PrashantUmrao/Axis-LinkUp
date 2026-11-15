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
 * GET /api/v1/polls/[id]/results
 * Retrieves aggregate poll choices and percentage breakdown.
 * Subject to results visibility policy (always, after_vote, after_close, creator_only).
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid poll identifier format.');
    }

    const results = await PollService.getPollResults(id, session);

    return successResponse(results, 'Poll results retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

