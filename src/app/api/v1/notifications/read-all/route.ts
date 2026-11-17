import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { NotificationService } from '@/lib/services/notification.service';
import { markAllReadSchema } from '@/lib/validations/notification.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/notifications/read-all
 * Marks all unread personal notifications (or a specific category) as read.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    let rawBody: Record<string, unknown> = {};
    const contentLength = req.headers.get('content-length');
    if (contentLength && contentLength !== '0') {
      try {
        const parsedJson = await req.json();
        if (parsedJson && typeof parsedJson === 'object') {
          rawBody = parsedJson as Record<string, unknown>;
        }
      } catch {
        throw new ValidationError('Malformed JSON payload');
      }
    } else {
      // Safely attempt to read body if content-length header is absent (e.g. unit tests)
      try {
        const text = await req.text();
        if (text.trim().length > 0) {
          rawBody = JSON.parse(text) as Record<string, unknown>;
        }
      } catch {
        throw new ValidationError('Malformed JSON payload');
      }
    }

    const parseResult = markAllReadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid mark-all-read parameters', parseResult.error.flatten());
    }

    const result = await NotificationService.markAllRead(session, parseResult.data.category);
    return successResponse(result, 'Notifications marked as read');
  } catch (error) {
    return handleApiError(error);
  }
}
