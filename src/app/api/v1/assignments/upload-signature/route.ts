import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import {
  AssignmentService,
  ALLOWED_UPLOAD_SCOPES,
  type UploadScope,
} from '@/lib/services/assignment.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

const UPLOAD_SIGNATURE_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 60_000, // 30 signed uploads per minute per authenticated user
};

/**
 * GET /api/v1/assignments/upload-signature
 * Generates user-isolated, format-restricted, size-bounded signed parameters for direct-to-Cloudinary
 * attachment uploads across assignments, complaints, and service requests (AUD-H13).
 * Protected by per-user sliding-window rate limiting.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const rateLimit = checkRateLimit(
      `upload-signature:${session.userId}`,
      UPLOAD_SIGNATURE_RATE_LIMIT
    );
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const rawScope = req.nextUrl?.searchParams?.get('scope') ?? new URL(req.url).searchParams.get('scope');
    let scope: UploadScope = 'assignments';
    if (rawScope) {
      const normalized = rawScope.trim().toLowerCase();
      if (!ALLOWED_UPLOAD_SCOPES.includes(normalized as UploadScope)) {
        throw new ValidationError(
          `Invalid upload scope "${rawScope}". Allowed scopes: ${ALLOWED_UPLOAD_SCOPES.join(', ')}.`
        );
      }
      scope = normalized as UploadScope;
    }

    const signatureEnvelope = AssignmentService.getUploadSignature(session, scope);
    return successResponse(signatureEnvelope, 'Upload signature generated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
