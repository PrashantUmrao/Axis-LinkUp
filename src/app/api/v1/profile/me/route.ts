import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { ProfileService } from '@/lib/services/profile.service';
import { successResponse } from '@/lib/api/api-response';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/profile/me
 * Retrieves the authenticated caller's full OwnerProfileDTO.
 * Guaranteed to mask Clerk secrets, hashed passwords, recovery tokens, and OTP secrets.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const profile = await ProfileService.getOwnProfile(session);

    return successResponse(profile, 'Profile retrieved successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/v1/profile/me
 * Updates permitted self-service profile fields for the authenticated caller.
 * Enforces mass-assignment protection via selfServiceProfileUpdateSchema.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const updatedProfile = await ProfileService.updateOwnProfile(session, body);

    return successResponse(updatedProfile, 'Profile updated successfully');
  } catch (error) {
    return handleApiError(error);
  }
}

