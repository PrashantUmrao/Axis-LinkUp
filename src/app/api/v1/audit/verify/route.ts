import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { AuditService } from '@/lib/services/audit.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/audit/verify
 * Runs cryptographic SHA-256 hash-chain tamper verification across audit entries.
 * Strictly restricted to Super Administrators.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(
      'super_admin',
      'Only Super Administrators may run cryptographic audit hash-chain verification.'
    );

    const { searchParams } = new URL(req.url);
    const rawLimit = Number(searchParams.get('limit')) || 500;
    const clampedLimit = Math.max(1, Math.min(2000, rawLimit));

    const verification = await AuditService.verifyHashChain(session, clampedLimit);
    return successResponse(
      verification,
      verification.valid
        ? 'Audit hash chain integrity verified cleanly'
        : 'Audit hash chain integrity violation detected'
    );
  } catch (error) {
    return handleApiError(error);
  }
}
