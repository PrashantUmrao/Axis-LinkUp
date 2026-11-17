import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { NotificationService } from '@/lib/services/notification.service';
import { notificationQuerySchema } from '@/lib/validations/notification.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/notifications
 * Returns the authenticated user's paginated personal notification inbox.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('category')) rawQuery.category = searchParams.get('category');
    if (searchParams.get('isRead')) rawQuery.isRead = searchParams.get('isRead');
    if (searchParams.get('priority')) rawQuery.priority = searchParams.get('priority');
    if (searchParams.get('page')) rawQuery.page = searchParams.get('page');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');

    const parseResult = notificationQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError(
        'Invalid notification inbox filter parameters',
        parseResult.error.flatten()
      );
    }

    const result = await NotificationService.listUserNotifications(session, parseResult.data);
    return successResponse(result, 'Notifications retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
