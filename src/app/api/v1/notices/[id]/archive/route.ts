import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAuth } from '@/lib/auth/server';
import { NoticeService } from '@/lib/services/notice.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/notices/[id]/archive
 * Retires a published notice into archival state.
 * Enforces indefinite institutional retention (no TTL deletion).
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid notice identifier format.');
    }

    const archived = await NoticeService.archiveNotice(id, session);

    return successResponse(archived, 'Notice archived successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

