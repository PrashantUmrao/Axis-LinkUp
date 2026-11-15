import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { NoticeService } from '@/lib/services/notice.service';
import { createNoticeSchema, noticeQuerySchema } from '@/lib/validations/notice.schema';
import { createdResponse, paginatedResponse, createCursorPaginationMeta } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/notices
 * Retrieves a cursor-paginated feed of collegiate notices matching caller's audience.
 * Populates caller-specific read and acknowledgment states.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      category: searchParams.get('category') || undefined,
      priority: searchParams.get('priority') || undefined,
      status: searchParams.get('status') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      search: searchParams.get('search') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    const parseResult = noticeQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid query parameters', parseResult.error.flatten());
    }

    const { category, priority, status, departmentId, search, cursor, limit } = parseResult.data;

    const { notices, nextCursor, hasMore } = await NoticeService.getNoticeFeed(session, {
      category,
      priority,
      status,
      departmentId,
      search,
      cursor,
      limit,
    });

    const pagination = createCursorPaginationMeta(limit, nextCursor, hasMore);

    return paginatedResponse(notices, pagination, 'Notices feed retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/notices
 * Creates a new collegiate notice.
 * Enforces role-based publishing scopes and priority siren restrictions.
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

    const parseResult = createNoticeSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid notice payload', parseResult.error.flatten());
    }

    const notice = await NoticeService.createNotice(session, parseResult.data);

    return createdResponse(notice, 'Notice created successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

