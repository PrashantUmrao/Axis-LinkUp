import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAuth } from '@/lib/auth/server';
import { PollService } from '@/lib/services/poll.service';
import { castVoteSchema } from '@/lib/validations/poll.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/polls/[id]/vote
 * Casts an immutable ballot in a campus poll.
 * Enforces:
 * - Student votes are strictly immutable after submission (Policy 2).
 * - Cryptographic voter privacy (HMAC-SHA256 pseudonymous token when isAnonymous = true).
 * - Atomic single-choice or multiple-choice option validation and tally increments.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid poll identifier format.');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = castVoteSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid ballot payload', parseResult.error.flatten());
    }

    const voteResult = await PollService.castVote(
      id,
      session,
      parseResult.data.selectedOptionIds
    );

    return successResponse(voteResult, 'Ballot submitted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

