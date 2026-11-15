import { requireAuth } from '@/lib/auth/server';
import { NoticeService } from '@/lib/services/notice.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/notices/unread-count
 * Returns the unread published notice count targeted at the authenticated caller.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const unreadCount = await NoticeService.getUnreadCount(session);

    return successResponse({ unreadCount }, 'Unread notice count retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

