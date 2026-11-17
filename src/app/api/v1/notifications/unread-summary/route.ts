import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { NotificationService } from '@/lib/services/notification.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/notifications/unread-summary
 * Fast Topbar bell summary returning total unread count, category breakdown, and latest 5 unread items.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requireAuth();
    const summary = await NotificationService.getUnreadSummary(session);
    return successResponse(summary, 'Unread notification summary retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
