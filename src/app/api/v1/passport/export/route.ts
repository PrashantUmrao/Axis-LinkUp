import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/server';
import { PassportService } from '@/lib/services/passport.service';
import { achievementQuerySchema } from '@/lib/validations/passport.schema';
import { handleApiError } from '@/lib/api/api-error-handler';
import { ValidationError } from '@/lib/errors/app-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/passport/export
 * Downloads formula-safe CSV of verified student achievements for NAAC/NIRF accreditation.
 * Restricted strictly to admin (DEPT) and super_admin (ALLOW).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole(
      ['admin', 'super_admin'],
      'Only Administrators and Super Administrators may export NAAC/NIRF accreditation datasets.'
    );

    const { searchParams } = new URL(req.url);
    const rawQuery: Record<string, unknown> = {};

    if (searchParams.get('category')) rawQuery.category = searchParams.get('category');
    if (searchParams.get('department')) rawQuery.department = searchParams.get('department');
    if (searchParams.get('search')) rawQuery.search = searchParams.get('search');

    const parseResult = achievementQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      throw new ValidationError('Invalid export filter parameters', parseResult.error.flatten());
    }

    const exported = await PassportService.exportVerifiedAchievementsCsv(session, parseResult.data);

    return new NextResponse(exported.body, {
      status: 200,
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename="${exported.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
