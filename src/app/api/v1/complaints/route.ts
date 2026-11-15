import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ComplaintService } from '@/lib/services/complaint.service';
import {
  createComplaintSchema,
  complaintQuerySchema,
} from '@/lib/validations/complaint.schema';
import {
  createdResponse,
  paginatedResponse,
  createOffsetPaginationMeta,
} from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/complaints
 * Retrieves a paginated list of complaints scoped strictly to caller's role and department.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      status: searchParams.get('status') || undefined,
      category: searchParams.get('category') || undefined,
      priority: searchParams.get('priority') || undefined,
      recipientRole: searchParams.get('recipientRole') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      isEscalated: searchParams.get('isEscalated') || undefined,
      isBreached: searchParams.get('isBreached') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    };

    const parseResult = complaintQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid complaint query parameters', parseResult.error.flatten());
    }

    const { complaints, total, page, limit } = await ComplaintService.getComplaints(
      session,
      parseResult.data
    );

    const pagination = createOffsetPaginationMeta(page, limit, total);

    return paginatedResponse(complaints, pagination, 'Complaints feed retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/complaints
 * Lodges a formal statutory grievance petition (Student only).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const parseResult = createComplaintSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid complaint petition payload', parseResult.error.flatten());
    }

    const complaint = await ComplaintService.submitComplaint(session, parseResult.data);

    return createdResponse(complaint, 'Grievance petition lodged successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

