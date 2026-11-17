import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { AssignmentService } from '@/lib/services/assignment.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/assignments/[id]/archive
 * Archives an assignment.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const archived = await AssignmentService.archiveAssignment(session, id);
    return successResponse(archived, 'Assignment archived successfully');
  } catch (error) {
    return handleApiError(error);
  }
}
