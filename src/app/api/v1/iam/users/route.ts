import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { IamGovernanceService } from '@/lib/services/iam-governance.service';
import { iamUserQuerySchema } from '@/lib/validations/governance.schema';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/iam/users
 * Returns paginated institutional user directory for Super Admin IAM Governance Console.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(
      'super_admin',
      'Only Super Administrators may access the IAM Governance Directory.'
    );

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('search')) rawQuery.search = searchParams.get('search');
    if (searchParams.get('role')) rawQuery.role = searchParams.get('role');
    if (searchParams.get('status')) rawQuery.status = searchParams.get('status');
    if (searchParams.get('department')) rawQuery.department = searchParams.get('department');
    if (searchParams.get('page')) rawQuery.page = searchParams.get('page');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');

    const parseResult = iamUserQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid IAM user filter parameters', parseResult.error.flatten());
    }

    const result = await IamGovernanceService.listGovernedUsers(session, parseResult.data);
    return successResponse(result, 'Governed user directory retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
