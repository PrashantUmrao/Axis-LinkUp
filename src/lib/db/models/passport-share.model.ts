/**
 * Mongoose PassportShare Model Definition (MOD-15 / Phase 5.12).
 * Manages revocable, rotatable public recruiter portfolio tokens (1 per student).
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type { IPassportShare, PassportShareDTO } from '@/types/passport';

export const PassportShareSchema = new Schema<IPassportShare>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    shareToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    headline: {
      type: String,
      trim: true,
      maxlength: 160,
      default: null,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRotatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'passport_shares',
  }
);

export const PassportShareModel: Model<IPassportShare> =
  (mongoose.models.PassportShare as Model<IPassportShare>) ||
  mongoose.model<IPassportShare>('PassportShare', PassportShareSchema);

/**
 * Serializes a Mongoose PassportShare document into a client-safe DTO.
 */
export function toPassportShareDTO(
  doc: IPassportShare | (Record<string, unknown> & { _id: unknown })
): PassportShareDTO {
  const raw =
    typeof (doc as IPassportShare).toObject === 'function'
      ? (doc as IPassportShare).toObject()
      : (doc as Record<string, unknown>);

  return {
    id: String(raw._id),
    studentId: raw.studentId ? String(raw.studentId) : '',
    shareToken: String(raw.shareToken || ''),
    isEnabled: Boolean(raw.isEnabled),
    headline: raw.headline ? String(raw.headline) : null,
    viewCount: Number(raw.viewCount ?? 0),
    lastRotatedAt:
      raw.lastRotatedAt instanceof Date
        ? raw.lastRotatedAt.toISOString()
        : String(raw.lastRotatedAt || new Date().toISOString()),
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
