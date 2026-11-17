/**
 * Mongoose EmergencyAlert Model Definition (MOD-16 / Phase 5.11).
 * Persists campus-wide emergency directives, severity levels, safety checklists,
 * and deactivation records.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import {
  EMERGENCY_SEVERITIES,
  EMERGENCY_CATEGORIES,
  EMERGENCY_SCOPES,
  type IEmergencyAlert,
  type EmergencyAlertDTO,
  type IEmergencyActorSnapshot,
  type EmergencySeverity,
  type EmergencyCategory,
  type EmergencyAffectedScope,
} from '@/types/emergency';

const EmergencyActorSnapshotSchema = new Schema<IEmergencyActorSnapshot>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, required: true, trim: true },
  },
  { _id: false }
);

export const EmergencyAlertSchema = new Schema<IEmergencyAlert>(
  {
    alertCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 140,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 15,
      maxlength: 2000,
    },
    severity: {
      type: String,
      required: true,
      enum: [...EMERGENCY_SEVERITIES],
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: [...EMERGENCY_CATEGORIES],
    },
    instructions: {
      type: [String],
      default: [],
    },
    affectedScope: {
      type: String,
      required: true,
      enum: [...EMERGENCY_SCOPES],
      default: 'all_campus',
    },
    targetDepartments: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    triggeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    triggeredBySnapshot: {
      type: EmergencyActorSnapshotSchema,
      required: true,
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deactivatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deactivatedBySnapshot: {
      type: EmergencyActorSnapshotSchema,
      default: null,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivationNotes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    acknowledgmentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'emergency_alerts',
  }
);

EmergencyAlertSchema.index({ isActive: 1, triggeredAt: -1 });
EmergencyAlertSchema.index({ severity: 1, triggeredAt: -1 });

export const EmergencyAlertModel: Model<IEmergencyAlert> =
  (mongoose.models.EmergencyAlert as Model<IEmergencyAlert>) ||
  mongoose.model<IEmergencyAlert>('EmergencyAlert', EmergencyAlertSchema);

/**
 * Serializes a Mongoose EmergencyAlert document (or lean object) into a client-safe DTO.
 */
export function toEmergencyAlertDTO(
  doc: IEmergencyAlert | (Record<string, unknown> & { _id: unknown })
): EmergencyAlertDTO {
  const raw =
    typeof (doc as IEmergencyAlert).toObject === 'function'
      ? (doc as IEmergencyAlert).toObject()
      : (doc as Record<string, unknown>);

  const trigSnap = (raw.triggeredBySnapshot || {}) as Partial<IEmergencyActorSnapshot>;
  const deactSnap = raw.deactivatedBySnapshot as Partial<IEmergencyActorSnapshot> | null | undefined;

  return {
    id: String(raw._id),
    alertCode: String(raw.alertCode || ''),
    title: String(raw.title || ''),
    message: String(raw.message || ''),
    severity: (raw.severity as EmergencySeverity) || 'amber',
    category: (raw.category as EmergencyCategory) || 'other',
    instructions: Array.isArray(raw.instructions) ? raw.instructions.map(String) : [],
    affectedScope: (raw.affectedScope as EmergencyAffectedScope) || 'all_campus',
    targetDepartments: Array.isArray(raw.targetDepartments)
      ? raw.targetDepartments.map(String)
      : [],
    isActive: Boolean(raw.isActive),
    triggeredBy: raw.triggeredBy ? String(raw.triggeredBy) : '',
    triggeredBySnapshot: {
      fullName: String(trigSnap.fullName || 'Super Administrator'),
      email: String(trigSnap.email || ''),
      role: String(trigSnap.role || 'super_admin'),
    },
    triggeredAt:
      raw.triggeredAt instanceof Date
        ? raw.triggeredAt.toISOString()
        : String(raw.triggeredAt || new Date().toISOString()),
    deactivatedBy: raw.deactivatedBy ? String(raw.deactivatedBy) : null,
    deactivatedBySnapshot: deactSnap
      ? {
          fullName: String(deactSnap.fullName || 'Super Administrator'),
          email: String(deactSnap.email || ''),
          role: String(deactSnap.role || 'super_admin'),
        }
      : null,
    deactivatedAt:
      raw.deactivatedAt instanceof Date
        ? raw.deactivatedAt.toISOString()
        : raw.deactivatedAt
          ? String(raw.deactivatedAt)
          : null,
    deactivationNotes: raw.deactivationNotes ? String(raw.deactivationNotes) : null,
    acknowledgmentCount: Number(raw.acknowledgmentCount ?? 0),
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
