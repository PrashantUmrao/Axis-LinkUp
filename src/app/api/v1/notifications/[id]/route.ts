import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { NotificationService } from '@/lib/services/notification.service';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/v1/notifications/[id]
 * Archives/dismisses a single personal notification. Strictly enforces ownership.
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    const idCheck = objectIdSchema.safeParse(id);
    if (!idCheck.success) {
      throw new ValidationError('Invalid notification ID format');
    }

    const result = await NotificationService.archiveNotification(session, idCheck.data);
    return successResponse(result, 'Notification archived successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
