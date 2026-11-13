import type { NextRequest } from 'next/server';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { successResponse, errorResponse } from '@/lib/api/api-response';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';
import { logger } from '@/lib/logging/logger';
import type { CreateUserInput, UserRole, UserStatus } from '@/types/user';

export async function POST(req: NextRequest) {
  // 1. Extract Svix cryptographic headers
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn('[Clerk Webhook] Inbound request missing required Svix headers');
    return errorResponse(
      'Missing required Svix webhook verification headers',
      ERROR_CODES.UNAUTHORIZED,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // 2. Validate webhook secret presence
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('[Clerk Webhook] CLERK_WEBHOOK_SECRET is not configured on the server');
    return errorResponse(
      'Webhook server configuration error',
      ERROR_CODES.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  // 3. Cryptographic signature assertion via Svix
  const payload = await req.text();
  const wh = new Webhook(webhookSecret);
  let evt: WebhookEvent;

  try {
    wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
    evt = JSON.parse(payload) as WebhookEvent;
  } catch (err) {
    logger.warn('[Clerk Webhook] Cryptographic signature verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse(
      'Invalid webhook signature',
      ERROR_CODES.UNAUTHORIZED,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // 4. Ensure MongoDB connection
  await connectToDatabase();

  const eventType = evt.type;
  logger.info(`[Clerk Webhook] Processing event: ${eventType} (${evt.data.id ?? 'unknown'})`);

  try {
    // 5. Handle event types
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, first_name, last_name, image_url, public_metadata } = evt.data;
        const primaryEmail = email_addresses?.[0]?.email_address;

        if (!primaryEmail) {
          logger.warn(`[Clerk Webhook] User created event missing primary email: ${id}`);
          return errorResponse(
            'User email is required for database identity mapping',
            ERROR_CODES.VALIDATION_ERROR,
            HTTP_STATUS.BAD_REQUEST
          );
        }

        const fullName =
          `${first_name ?? ''} ${last_name ?? ''}`.trim() || 'Axis Collegiate Member';
        const metadata = (public_metadata as Record<string, unknown>) ?? {};
        const role = (metadata.role as UserRole) || 'student';
        const status = (metadata.status as UserStatus) || 'active';

        // Check if pre-provisioned or existing user exists
        let user = await UserRepository.findByAuthProviderId(id);
        if (!user) {
          user = await UserRepository.findByEmail(primaryEmail);
        }

        if (user) {
          await UserRepository.linkAuthProviderId(primaryEmail, id);
          await UserRepository.syncExternalProfile(id, {
            fullName,
            avatarUrl: image_url || undefined,
            email: primaryEmail,
          });
          logger.info(
            `[Clerk Webhook] Linked external auth identity to existing user: ${primaryEmail} (${id})`
          );
        } else {
          // Construct new user document
          const createInput: CreateUserInput = {
            authProviderId: id,
            email: primaryEmail,
            fullName,
            role,
            status,
            avatarUrl: image_url || undefined,
          };

          if (role === 'student') {
            createInput.studentProfile = {
              rollNumber:
                (metadata.rollNumber as string)?.toUpperCase() ||
                `STU-${Date.now().toString().slice(-6)}`,
              batchYear:
                typeof metadata.batchYear === 'number'
                  ? metadata.batchYear
                  : new Date().getFullYear(),
              currentSemester:
                typeof metadata.currentSemester === 'number' ? metadata.currentSemester : 1,
              section: (metadata.section as string) || 'A',
              admissionType: 'regular',
            };
          } else if (role === 'faculty') {
            createInput.facultyProfile = {
              employeeId:
                (metadata.employeeId as string)?.toUpperCase() ||
                `FAC-${Date.now().toString().slice(-6)}`,
              designation: (metadata.designation as string) || 'Assistant Professor',
              qualifications: Array.isArray(metadata.qualifications)
                ? (metadata.qualifications as string[])
                : ['B.Tech', 'M.Tech'],
              assignedCourses: [],
            };
          } else if (role === 'admin' || role === 'super_admin') {
            createInput.adminProfile = {
              adminStaffId:
                (metadata.adminStaffId as string)?.toUpperCase() ||
                `ADM-${Date.now().toString().slice(-6)}`,
              administrativeDomain:
                (metadata.administrativeDomain as string) ||
                (role === 'super_admin' ? 'Central IT Administration' : 'Academic Affairs'),
              assignedQueueScopes: ['all'],
              emergencyOverridePermitted: role === 'super_admin',
            };
          }

          await UserRepository.create(createInput);
          logger.info(
            `[Clerk Webhook] Created new collegiate user record: ${primaryEmail} [role: ${role}]`
          );
        }
        break;
      }

      case 'user.updated': {
        const { id, first_name, last_name, image_url, email_addresses } = evt.data;
        const fullName = `${first_name ?? ''} ${last_name ?? ''}`.trim() || undefined;
        const primaryEmail = email_addresses?.[0]?.email_address;

        await UserRepository.syncExternalProfile(id, {
          fullName,
          avatarUrl: image_url || undefined,
          email: primaryEmail,
        });
        logger.info(`[Clerk Webhook] Synchronized user profile changes: ${id}`);
        break;
      }

      case 'user.deleted': {
        const userId = evt.data.id;
        if (userId) {
          const user = await UserRepository.findByAuthProviderId(userId);
          if (user) {
            await UserRepository.updateStatus(user._id.toString(), 'deactivated');
            logger.info(`[Clerk Webhook] Soft-deactivated deleted user: ${userId}`);
          }
        }
        break;
      }

      default:
        logger.info(`[Clerk Webhook] Unhandled or informative event acknowledged: ${eventType}`);
        break;
    }

    return successResponse(
      { received: true, event: eventType },
      'Webhook processed successfully',
      HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error(`[Clerk Webhook] Error processing webhook event ${eventType}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(
      'Failed to process webhook payload',
      ERROR_CODES.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
