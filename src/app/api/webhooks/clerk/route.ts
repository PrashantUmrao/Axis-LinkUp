import type { NextRequest } from 'next/server';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { successResponse, errorResponse } from '@/lib/api/api-response';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';
import { logger } from '@/lib/logging/logger';

export const dynamic = 'force-dynamic';

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

  // 4. Ensure MongoDB connection (always enforced in production or when MONGODB_URI is configured)
  if (process.env.MONGODB_URI || process.env.NODE_ENV === 'production') {
    await connectToDatabase();
  }

  const eventType = evt.type;
  logger.info(`[Clerk Webhook] Processing event: ${eventType} (${evt.data.id ?? 'unknown'})`);

  try {
    // 5. Handle event types
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, first_name, last_name, image_url, username } = evt.data;
        const primaryEmail = email_addresses?.[0]?.email_address;
        const clerkUsername = username ? username.toLowerCase().trim() : undefined;
        const isEmailVerified = email_addresses?.[0]?.verification?.status === 'verified';

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

        // Check if pre-provisioned or existing user exists by authProviderId, email, or username
        let user = await UserRepository.findByAuthProviderId(id);
        if (!user) {
          user = await UserRepository.findByEmail(primaryEmail);
        }
        if (!user && clerkUsername) {
          user = await UserRepository.findByUsername(clerkUsername);
        }

        if (user) {
          await UserRepository.linkAuthProviderId(user.email, id);
          await UserRepository.syncExternalProfile(id, {
            fullName,
            avatarUrl: image_url || undefined,
            email: primaryEmail,
            username: clerkUsername,
            isEmailVerified: Boolean(isEmailVerified),
          });
          logger.info(
            `[Clerk Webhook] Linked external auth identity to existing user: ${user.email} (${id})`
          );
        } else {
          // Closed Registration Invariant: Public self-registration & runtime admin bootstrap are prohibited.
          // Acknowledge with HTTP 200 (ignored) to prevent infinite Svix webhook retry storms while creating no DB record.
          logger.warn(
            `[Clerk Webhook] Ignored unprovisioned user.created event (${id}). Closed registration policy active.`
          );
          return successResponse(
            {
              received: true,
              ignored: true,
              reason: 'closed_registration_unprovisioned',
            },
            'Unprovisioned user event ignored under closed registration policy',
            HTTP_STATUS.OK
          );
        }
        break;
      }

      case 'user.updated': {
        const { id, first_name, last_name, image_url, email_addresses, username, public_metadata } =
          evt.data;
        const fullName = `${first_name ?? ''} ${last_name ?? ''}`.trim() || undefined;
        const primaryEmail = email_addresses?.[0]?.email_address;
        const clerkUsername = username ? username.toLowerCase().trim() : undefined;
        const isEmailVerified = email_addresses?.[0]?.verification?.status === 'verified';
        const metadata = (public_metadata as Record<string, unknown>) ?? {};

        const existingUser =
          (await UserRepository.findByAuthProviderId(id)) ||
          (primaryEmail ? await UserRepository.findByEmail(primaryEmail) : null);

        if (!existingUser) {
          logger.warn(
            `[Clerk Webhook] Ignored unprovisioned user.updated event (${id}). Closed registration policy active.`
          );
          return successResponse(
            {
              received: true,
              ignored: true,
              reason: 'closed_registration_unprovisioned',
            },
            'Unprovisioned user event ignored under closed registration policy',
            HTTP_STATUS.OK
          );
        }

        await UserRepository.syncExternalProfile(id, {
          fullName,
          avatarUrl: image_url || undefined,
          email: primaryEmail,
          username: clerkUsername,
          isEmailVerified: email_addresses?.[0] ? Boolean(isEmailVerified) : undefined,
        });

        // Synchronize account activation lifecycle status from Clerk metadata
        if (metadata.status === 'active' && existingUser.status === 'pending_verification') {
          await UserRepository.completeAccountActivation(existingUser._id.toString(), new Date());
          logger.info(`[Clerk Webhook] Activated pending user via Clerk webhook: ${id}`);
        }

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
