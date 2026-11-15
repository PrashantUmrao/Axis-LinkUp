import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { PollService } from '@/lib/services/poll.service';
import { createPollSchema, pollQuerySchema } from '@/lib/validations/poll.schema';
import { createdResponse, paginatedResponse, createCursorPaginationMeta } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/polls
 * Retrieves a cursor-paginated feed of polls matching the caller's target audience.
 * Enforces result visibility policy masks based on ballot submission and closure state.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      status: searchParams.get('status') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      search: searchParams.get('search') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const parseResult = pollQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid query parameters', parseResult.error.flatten());
    }

    const { status, departmentId, search, cursor, limit } = parseResult.data;

    const { polls, nextCursor, hasMore } = await PollService.getPollFeed(session, {
      status,
      departmentId,
      search,
      cursor,
      limit,
    });

    const pagination = createCursorPaginationMeta(limit, nextCursor, hasMore);

    return paginatedResponse(polls, pagination, 'Polls feed retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/polls
 * Creates a new campus poll.
 * Enforces:
 * - Students strictly prohibited from poll creation (Policy 3).
 * - Faculty course/department boundaries.
 * - 2-10 distinct choices and maxSelections invariants.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = createPollSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid poll creation payload', parseResult.error.flatten());
    }

    const poll = await PollService.createPoll(session, parseResult.data);

    return createdResponse(poll, 'Poll created successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

