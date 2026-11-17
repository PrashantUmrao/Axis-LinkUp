/**
 * Mongoose Notification Model Definition (MOD-17 / Phase 5.13).
 * Unified persistent in-app notification inbox with 60-second deduplication support
 * and 90-day automatic MongoDB TTL retention.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  type INotification,
  type NotificationDTO,
  type NotificationCategory,
  type NotificationPriority,
} from '@/types/notification';

export const NOTIFICATION_RETENTION_DAYS = 90;
export const NOTIFICATION_RETENTION_MS = NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function defaultExpiresAt(): Date {
  return new Date(Date.now() + NOTIFICATION_RETENTION_MS);
}

export const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 600,
    },
    category: {
      type: String,
      required: true,
      enum: [...NOTIFICATION_CATEGORIES],
      index: true,
    },
    priority: {
      type: String,
      required: true,
      enum: [...NOTIFICATION_PRIORITIES],
      default: 'normal',
      index: true,
    },
    linkUrl: {
      type: String,
      trim: true,
      default: null,
    },
    dedupeKey: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: defaultExpiresAt,
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
  }
);

// Compound inbox & deduplication indexes
NotificationSchema.index({ userId: 1, isArchived: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, dedupeKey: 1, createdAt: -1 });
// Automatic 90-day MongoDB TTL retention index
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const NotificationModel: Model<INotification> =
  (mongoose.models.Notification as Model<INotification>) ||
  mongoose.model<INotification>('Notification', NotificationSchema);

/**
 * Serializes a Mongoose Notification document into a client-safe NotificationDTO.
 */
export function toNotificationDTO(
  doc: INotification | (Record<string, unknown> & { _id: unknown })
): NotificationDTO {
  const raw =
    typeof (doc as INotification).toObject === 'function'
      ? (doc as INotification).toObject()
      : (doc as Record<string, unknown>);

  return {
    id: String(raw._id),
    userId: raw.userId ? String(raw.userId) : '',
    title: String(raw.title || ''),
    message: String(raw.message || ''),
    category: (raw.category as NotificationCategory) || 'system',
    priority: (raw.priority as NotificationPriority) || 'normal',
    linkUrl: raw.linkUrl ? String(raw.linkUrl) : null,
    dedupeKey: raw.dedupeKey ? String(raw.dedupeKey) : null,
    metadata:
      raw.metadata && typeof raw.metadata === 'object'
        ? (raw.metadata as Record<string, unknown>)
        : null,
    isRead: Boolean(raw.isRead),
    readAt:
      raw.readAt instanceof Date
        ? raw.readAt.toISOString()
        : raw.readAt
          ? String(raw.readAt)
          : null,
    isArchived: Boolean(raw.isArchived),
    expiresAt:
      raw.expiresAt instanceof Date
        ? raw.expiresAt.toISOString()
        : String(raw.expiresAt || defaultExpiresAt().toISOString()),
    createdAt:
      raw.createdAt instanceof Date
        ? raw.createdAt.toISOString()
        : String(raw.createdAt || new Date().toISOString()),
    updatedAt:
      raw.updatedAt instanceof Date
        ? raw.updatedAt.toISOString()
        : String(raw.updatedAt || new Date().toISOString()),
  };
}
