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
 * POST /api/v1/polls/[id]/archive
 * Archives a closed poll.
 * Preserves survey data indefinitely without automated TTL purging (Policy 4).
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid poll identifier format.');
    }

    const archived = await PollService.archivePoll(id, session);

    return successResponse(archived, 'Poll archived successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

