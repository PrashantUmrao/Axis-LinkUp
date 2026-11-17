/**
 * Mongoose EmergencyAcknowledgment Model Definition (MOD-16 / Phase 5.11).
 * Tracks idempotent per-user acknowledgment receipts for active campus emergencies.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type {
  IEmergencyAcknowledgment,
  EmergencyAcknowledgmentDTO,
  IEmergencyAckUserSnapshot,
} from '@/types/emergency';

const EmergencyAckUserSnapshotSchema = new Schema<IEmergencyAckUserSnapshot>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: null },
  },
  { _id: false }
);

export const EmergencyAcknowledgmentSchema = new Schema<IEmergencyAcknowledgment>(
  {
    alertId: {
      type: Schema.Types.ObjectId,
      ref: 'EmergencyAlert',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userSnapshot: {
      type: EmergencyAckUserSnapshotSchema,
      required: true,
    },
    acknowledgedAt: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: false,
    collection: 'emergency_acknowledgments',
  }
);

// Compound unique index guarantees idempotent single acknowledgment per user per alert
EmergencyAcknowledgmentSchema.index({ alertId: 1, userId: 1 }, { unique: true });

export const EmergencyAcknowledgmentModel: Model<IEmergencyAcknowledgment> =
  (mongoose.models.EmergencyAcknowledgment as Model<IEmergencyAcknowledgment>) ||
  mongoose.model<IEmergencyAcknowledgment>(
    'EmergencyAcknowledgment',
    EmergencyAcknowledgmentSchema
  );

/**
 * Serializes a Mongoose EmergencyAcknowledgment document into a client-safe DTO.
 */
export function toEmergencyAcknowledgmentDTO(
  doc: IEmergencyAcknowledgment | (Record<string, unknown> & { _id: unknown })
): EmergencyAcknowledgmentDTO {
  const raw =
    typeof (doc as IEmergencyAcknowledgment).toObject === 'function'
      ? (doc as IEmergencyAcknowledgment).toObject()
      : (doc as Record<string, unknown>);

  const snap = (raw.userSnapshot || {}) as Partial<IEmergencyAckUserSnapshot>;

  return {
    id: String(raw._id),
    alertId: raw.alertId ? String(raw.alertId) : '',
    userId: raw.userId ? String(raw.userId) : '',
    userSnapshot: {
      fullName: String(snap.fullName || 'Institutional User'),
      email: String(snap.email || ''),
      role: String(snap.role || 'student'),
      department: snap.department ? String(snap.department) : null,
    },
    acknowledgedAt:
      raw.acknowledgedAt instanceof Date
        ? raw.acknowledgedAt.toISOString()
        : String(raw.acknowledgedAt || new Date().toISOString()),
    ipAddress: raw.ipAddress ? String(raw.ipAddress) : null,
    userAgent: raw.userAgent ? String(raw.userAgent) : null,
  };
}
