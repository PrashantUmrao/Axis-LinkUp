import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ServiceRequestService } from '@/lib/services/service-request.service';
import {
  createServiceRequestSchema,
  serviceRequestQuerySchema,
} from '@/lib/validations/service-request.schema';
import { successResponse, createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError, ForbiddenError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/requests
 * Lists service requests with persona-aware filtering.
 * Students retrieve their own applications; Administrators access their departmental service queue.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('status')) rawQuery.status = searchParams.get('status');
    if (searchParams.get('category')) rawQuery.category = searchParams.get('category');
    if (searchParams.get('priority')) rawQuery.priority = searchParams.get('priority');
    if (searchParams.get('department')) rawQuery.department = searchParams.get('department');
    if (searchParams.get('search')) rawQuery.search = searchParams.get('search');
    if (searchParams.get('page')) rawQuery.page = searchParams.get('page');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');
    if (searchParams.get('sortBy')) rawQuery.sortBy = searchParams.get('sortBy');
    if (searchParams.get('sortOrder')) rawQuery.sortOrder = searchParams.get('sortOrder');

    const parseResult = serviceRequestQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid request filter parameters', parseResult.error.flatten());
    }

    if (session.role === 'student') {
      const result = await ServiceRequestService.listStudentRequests(session, parseResult.data);
      return successResponse(result, 'Student service requests retrieved successfully');
    }

    if (session.role === 'admin' || session.role === 'super_admin') {
      const result = await ServiceRequestService.listAdminQueue(session, parseResult.data);
      return successResponse(result, 'Administrative service queue retrieved successfully');
    }

    throw new ForbiddenError('You are not authorized to view service requests.');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/requests
 * Submits a new administrative service request (enrolled students only).
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

    const parseResult = createServiceRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError('Invalid service request payload', parseResult.error.flatten());
    }

    const created = await ServiceRequestService.submitRequest(session, parseResult.data);
    return createdResponse(created, 'Service request submitted successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

