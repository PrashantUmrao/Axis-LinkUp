import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { NotificationService } from '@/lib/services/notification.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/notifications/preferences
 * Retrieves the authenticated user's notification category and channel preferences.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requireAuth();
    const preferences = await NotificationService.getPreferences(session);
    return successResponse(preferences, 'Notification preferences retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/notifications/preferences
 * Updates the authenticated user's notification preferences.
 * Emergency notifications remain permanently locked ON.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const updated = await NotificationService.updatePreferences(session, rawBody);
    return successResponse(updated, 'Notification preferences updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
