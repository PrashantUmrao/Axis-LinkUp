import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ForbiddenError } from '@/lib/errors/app-error';
import type { UserRole } from '@/types/user';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/users/search
 * Public collegiate user directory search endpoint.
 *
 * Conforms to Zero-Trust architecture:
 * - Requires authenticated session
 * - Restricts to active collegiate accounts
 * - Excludes currently authenticated user
 * - Returns only safe public directory DTO fields (no passwords, tokens, or private secrets)
 * - Supports searching by name, username (@handle), institutional email, roll number, or employee ID
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    if (session.status !== 'active') {
      throw new ForbiddenError('Only active collegiate accounts can access the user directory.');
    }

    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const roleParam = searchParams.get('role');
    const departmentId = searchParams.get('departmentId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const validRoles: UserRole[] = ['student', 'faculty', 'admin', 'super_admin'];
    const roles: UserRole[] | undefined =
      roleParam && validRoles.includes(roleParam as UserRole)
        ? [roleParam as UserRole]
        : undefined;

    const users = await UserRepository.searchDirectory({
      query: q,
      currentUserId: session.userId,
      roles,
      departmentId,
      limit,
    });

    return successResponse(users, 'Collegiate directory search results');
  } catch (error) {
    return handleApiError(error);
  }
}
