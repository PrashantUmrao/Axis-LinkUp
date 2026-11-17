/**
 * Mongoose NotificationPreference Model Definition (MOD-17 / Phase 5.13).
 * Stores per-user notification delivery and category toggles.
 * Safety Invariant: 'emergency' notifications can NEVER be disabled.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type {
  INotificationPreference,
  NotificationPreferenceDTO,
} from '@/types/notification';

const CategoryPreferencesSchema = new Schema(
  {
    assignment: { type: Boolean, default: true },
    service_request: { type: Boolean, default: true },
    facility_booking: { type: Boolean, default: true },
    passport: { type: Boolean, default: true },
    complaint: { type: Boolean, default: true },
    notice: { type: Boolean, default: true },
    poll: { type: Boolean, default: true },
    chat: { type: Boolean, default: true },
    system: { type: Boolean, default: true },
  },
  { _id: false }
);

export const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    inAppEnabled: {
      type: Boolean,
      default: true,
    },
    emailEnabled: {
      type: Boolean,
      default: true,
    },
    soundEnabled: {
      type: Boolean,
      default: false,
    },
    categories: {
      type: CategoryPreferencesSchema,
      default: () => ({
        assignment: true,
        service_request: true,
        facility_booking: true,
        passport: true,
        complaint: true,
        notice: true,
        poll: true,
        chat: true,
        system: true,
      }),
    },
  },
  {
    timestamps: true,
    collection: 'notification_preferences',
  }
);

export const NotificationPreferenceModel: Model<INotificationPreference> =
  (mongoose.models.NotificationPreference as Model<INotificationPreference>) ||
  mongoose.model<INotificationPreference>(
    'NotificationPreference',
    NotificationPreferenceSchema
  );

/**
 * Serializes a NotificationPreference document (or defaults) into a client-safe DTO.
 * Always enforces categories.emergency = true.
 */
export function toNotificationPreferenceDTO(
  doc: INotificationPreference | (Record<string, unknown> & { _id: unknown })
): NotificationPreferenceDTO {
  const raw =
    typeof (doc as INotificationPreference).toObject === 'function'
      ? (doc as INotificationPreference).toObject()
      : (doc as Record<string, unknown>);

  const cats = (raw.categories || {}) as Record<string, unknown>;

  return {
    id: String(raw._id),
    userId: raw.userId ? String(raw.userId) : '',
    inAppEnabled: raw.inAppEnabled !== false,
    emailEnabled: raw.emailEnabled !== false,
    soundEnabled: Boolean(raw.soundEnabled),
    categories: {
      assignment: cats.assignment !== false,
      service_request: cats.service_request !== false,
      facility_booking: cats.facility_booking !== false,
      passport: cats.passport !== false,
      complaint: cats.complaint !== false,
      notice: cats.notice !== false,
      poll: cats.poll !== false,
      chat: cats.chat !== false,
      system: cats.system !== false,
      emergency: true, // Permanently locked ON
    },
    updatedAt:
      raw.updatedAt instanceof Date
        ? raw.updatedAt.toISOString()
        : String(raw.updatedAt || new Date().toISOString()),
  };
}
