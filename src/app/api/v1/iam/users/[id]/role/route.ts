import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { IamGovernanceService } from '@/lib/services/iam-governance.service';
import { iamUpdateRoleSchema } from '@/lib/validations/governance.schema';
import { objectIdSchema } from '@/lib/validations/common-schemas';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/iam/users/[id]/role
 * Updates a user's institutional role, administrative sub-role, and/or department
 * with mandatory justification and immutable AuditLog recording.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireRole(
      'super_admin',
      'Only Super Administrators may modify institutional roles and administrative scopes.'
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

    const parseResult = iamUpdateRoleSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid IAM role update payload', parseResult.error.flatten());
    }

    const ipAddress =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;
    const userAgent = req.headers.get('user-agent') || null;

    const result = await IamGovernanceService.changeUserRole(session, id, parseResult.data, {
      ipAddress,
      userAgent,
    });

    return successResponse(result, 'User role updated and recorded in immutable audit trail');
  } catch (error) {
    return handleApiError(error);
  }
}
