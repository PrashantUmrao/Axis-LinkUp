import type { NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/server';
import { PassportService } from '@/lib/services/passport.service';
import { achievementQuerySchema } from '@/lib/validations/passport.schema';
import { successResponse, createdResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/passport
 * Students retrieve their own passport + stats + share config;
 * Faculty/Admin/Super Admin retrieve their verification queue.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('category')) rawQuery.category = searchParams.get('category');
    if (searchParams.get('verificationStatus')) {
      rawQuery.verificationStatus = searchParams.get('verificationStatus');
    }
    if (searchParams.get('department')) rawQuery.department = searchParams.get('department');
    if (searchParams.get('search')) rawQuery.search = searchParams.get('search');
    if (searchParams.get('page')) rawQuery.page = searchParams.get('page');
    if (searchParams.get('limit')) rawQuery.limit = searchParams.get('limit');

    const parseResult = achievementQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid passport filter parameters', parseResult.error.flatten());
    }

    if (session.role === 'student') {
      const passport = await PassportService.getStudentPassport(session, parseResult.data);
      return successResponse(passport, 'Student Skill Passport retrieved successfully');
    }

    const queue = await PassportService.listVerificationQueue(session, parseResult.data);
    return successResponse(queue, 'Passport verification queue retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/v1/passport
 * Submits a new co-curricular achievement claim (students only).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(
      'student',
      'Only enrolled students may submit Skill & Achievement Passport claims.'
    );

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const created = await PassportService.submitAchievement(session, rawBody);
    return createdResponse(created, 'Achievement claim submitted for faculty verification');
  } catch (error) {
    return handleApiError(error);
  }
}
