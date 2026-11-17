import { requireAuth } from '@/lib/auth/server';
import { EmergencyService } from '@/lib/services/emergency.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/emergency/active
 * Returns the active campus emergency applicable to the caller alongside their acknowledgment state.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const result = await EmergencyService.getActiveAlertForUser(session);
    return successResponse(result, 'Active emergency status retrieved');
  } catch (error) {
    return handleApiError(error);
  }
}
