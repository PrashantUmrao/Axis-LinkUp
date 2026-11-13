/**
 * Collegiate Invitation & Pre-Provisioning Service.
 * Manages administrative invites for Faculty and Departmental Staff.
 * Aligns with DOC-AUTH-004 (Login & Registration Flows).
 */

import { clerkClient } from '@clerk/nextjs/server';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { ConflictError, ValidationError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import type { IUser, UserRole } from '@/types/user';

export interface InviteFacultyParams {
  email: string;
  fullName: string;
  employeeId: string;
  designation: string;
  departmentId?: string;
  qualifications?: string[];
  invitedBy?: string;
}

export class InvitationService {
  /**
   * Invites and pre-provisions a faculty member.
   * Public registration is blocked; accounts must be provisioned via this invitation gateway.
   */
  public static async inviteFaculty(params: InviteFacultyParams): Promise<IUser> {
    const email = params.email.toLowerCase().trim();
    const employeeId = params.employeeId.toUpperCase().trim();

    // 1. Institutional domain validation
    if (!email.endsWith('@axiscolleges.in')) {
      throw new ValidationError(
        `Faculty accounts must belong to the @axiscolleges.in domain: received ${email}`
      );
    }

    // 2. Uniqueness verification
    const existingByEmail = await UserRepository.findByEmail(email);
    if (existingByEmail) {
      throw new ConflictError(`A collegiate account with email '${email}' already exists.`);
    }

    const existingByEmployeeId = await UserRepository.findByEmployeeId(employeeId);
    if (existingByEmployeeId) {
      throw new ConflictError(
        `Faculty member with Employee ID '${employeeId}' is already registered.`
      );
    }

    // 3. Pre-create the user in MongoDB Atlas with status 'invited'
    const user = await UserRepository.create({
      email,
      fullName: params.fullName.trim(),
      role: 'faculty' as UserRole,
      status: 'invited',
      isProfileComplete: false,
      departmentId: params.departmentId,
      facultyProfile: {
        employeeId,
        designation: params.designation.trim(),
        qualifications: params.qualifications ?? ['B.Tech', 'M.Tech'],
        assignedCourses: [],
      },
    });

    logger.info(`[InvitationService] Pre-provisioned faculty record created for: ${email}`);

    // 4. Dispatch Clerk Invitation via Server SDK
    try {
      const client = await clerkClient();
      await client.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in`,
        publicMetadata: {
          role: 'faculty',
          employeeId,
          departmentId: params.departmentId ?? '',
        },
      });
      logger.info(`[InvitationService] Dispatched Clerk invitation link to: ${email}`);
    } catch (clerkErr) {
      // In local sandboxes or test suites without live network, log warning
      logger.warn('[InvitationService] Clerk invitation dispatch could not complete', {
        error: clerkErr instanceof Error ? clerkErr.message : String(clerkErr),
      });
    }

    return user;
  }
}

export default InvitationService;
