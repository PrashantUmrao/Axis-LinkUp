import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { IamGovernanceService } from '@/lib/services/iam-governance.service';
import { iamUpdateStatusSchema } from '@/lib/validations/governance.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/iam/users/[id]/status
 * Transitions a user's account status (active / suspended / deactivated)
 * with mandatory justification and immutable AuditLog recording.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      'super_admin',
      'Only Super Administrators may execute executive IAM account status transitions.'
    );

    const { id } = await params;
    const idValidation = objectIdSchema.safeParse(id);
    if (!idValidation.success) {
      throw new ValidationError('Invalid user ID format');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = iamUpdateStatusSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid IAM status update payload', parseResult.error.flatten());
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;
    const userAgent = req.headers.get('user-agent') || null;

    const result = await IamGovernanceService.changeUserStatus(session, id, parseResult.data, {
      ipAddress,
      userAgent,
    });

    return successResponse(result, 'Account status updated and recorded in immutable audit trail');
  } catch (error) {
    return handleApiError(error);
  }
}
