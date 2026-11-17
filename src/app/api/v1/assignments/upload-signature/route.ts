import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { AssignmentService } from '@/lib/services/assignment.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/assignments/upload-signature
 * Generates signed parameters for direct-to-Cloudinary attachment uploads.
 * If Cloudinary is unconfigured, returns local fallback development metadata.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await requireAuth();

    const signatureEnvelope = AssignmentService.getUploadSignature(session);
    return successResponse(signatureEnvelope, 'Upload signature generated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
