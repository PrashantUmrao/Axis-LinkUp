import type { NextRequest } from 'next/server';
import { PassportService } from '@/lib/services/passport.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import {
  checkRateLimit,
  createRateLimitErrorResponse,
  getClientIp,
} from '@/lib/security/rate-limiter';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ shareToken: string }>;
}

/**
 * GET /api/v1/passport/public/[shareToken]
 * Token-gated public recruiter endpoint exposing ONLY verified achievements and safe profile headers.
 * Rate-limited to protect share tokens against brute-force enumeration (NFR-SEC-06).
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(`passport-pub:${ip}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rateCheck.allowed) {
      return createRateLimitErrorResponse(rateCheck);
    }

    const { shareToken } = await params;
    const portfolio = await PassportService.getPublicPassportByToken(shareToken);
    return successResponse(portfolio, 'Verified public Skill Passport retrieved');
  } catch (error) {
    return handleApiError(error);
  }
}
