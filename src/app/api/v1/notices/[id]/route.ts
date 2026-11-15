import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAuth } from '@/lib/auth/server';
import { NoticeService } from '@/lib/services/notice.service';
import { updateNoticeSchema } from '@/lib/validations/notice.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/notices/[id]
 * Retrieves notice details, verifies audience eligibility, and marks notice as viewed.
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid notice identifier format.');
    }

    const notice = await NoticeService.getNoticeById(id, session);

    return successResponse(notice, 'Notice retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/notices/[id]
 * Updates an existing collegiate notice.
 * Restricted to notice author, assigned department HOD, or System Administrator.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid notice identifier format.');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = updateNoticeSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid update notice payload', parseResult.error.flatten());
    }

    const updated = await NoticeService.updateNotice(id, session, parseResult.data);

    return successResponse(updated, 'Notice updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/v1/notices/[id]
 * Soft-deletes a notice. Preserves audit history.
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!id || !Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid notice identifier format.');
    }

    await NoticeService.deleteNotice(id, session);

    return successResponse({ id, deleted: true }, 'Notice deleted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

