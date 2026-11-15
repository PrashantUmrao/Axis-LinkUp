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
 * GET /api/v1/notices/[id]/receipts
 * Retrieves receipt statistics and reader/acknowledger list for author/administrators.
 * Caller must be the notice author, assigned department HOD, Director, or System Administrator.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid notice identifier format.');
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const cursor = searchParams.get('cursor') || undefined;
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 50;

    const stats = await NoticeService.getNoticeReceipts(id, session, limit, cursor);

    return successResponse(stats, 'Notice receipts retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

