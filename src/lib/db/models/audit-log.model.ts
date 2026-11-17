/**
 * Mongoose AuditLog Model Definition (MOD-19 / Phase 5.10).
 * Strictly append-only, tamper-evident security and governance audit trail
 * with SHA-256 cryptographic hash chaining and Mongoose immutability pre-hooks.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import {
  AUDIT_MODULES,
  AUDIT_SEVERITIES,
  type IAuditLog,
  type AuditLogDTO,
  type IAuditActorSnapshot,
  type AuditModule,
  type AuditSeverity,
} from '@/types/governance';

export const AUDIT_LOG_IMMUTABILITY_ERROR =
  'AuditLog records are strictly append-only and immutable. Update and delete operations are prohibited.';

const AuditActorSnapshotSchema = new Schema<IAuditActorSnapshot>(
  {
    fullName: { type: String, required: true, trim: true, immutable: true },
    email: { type: String, required: true, trim: true, lowercase: true, immutable: true },
    role: { type: String, required: true, trim: true, immutable: true },
    department: { type: String, trim: true, default: null, immutable: true },
  },
  { _id: false }
);

export const AuditLogSchema = new Schema<IAuditLog>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
      immutable: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      immutable: true,
    },
    actorSnapshot: {
      type: AuditActorSnapshotSchema,
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
      immutable: true,
    },
    module: {
      type: String,
      required: true,
      enum: [...AUDIT_MODULES],
      index: true,
      immutable: true,
    },
    severity: {
      type: String,
      required: true,
      enum: [...AUDIT_SEVERITIES],
      default: 'info',
      index: true,
      immutable: true,
    },
    targetEntityType: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    targetEntityId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      immutable: true,
    },
    targetLabel: {
      type: String,
      trim: true,
      default: null,
      immutable: true,
    },
    department: {
      type: String,
      trim: true,
      default: null,
      index: true,
      immutable: true,
    },
    oldState: {
      type: Schema.Types.Mixed,
      default: null,
      immutable: true,
    },
    newState: {
      type: Schema.Types.Mixed,
      default: null,
      immutable: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
      immutable: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null,
      immutable: true,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
      immutable: true,
    },
    previousHash: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    entryHash: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: false, // Strictly append-only; no updatedAt field
    collection: 'audit_logs',
  }
);

// Compound Indexing Strategy
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ module: 1, severity: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ department: 1, createdAt: -1 });
AuditLogSchema.index({ targetEntityId: 1, createdAt: -1 });
AuditLogSchema.index({ eventId: 1 }, { unique: true });
AuditLogSchema.index({ entryHash: 1 }, { unique: true });

// Strictly reject any update or delete query middleware
export const BLOCKED_AUDIT_MUTATION_HOOKS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
  'findOneAndReplace',
] as const;

for (const hook of BLOCKED_AUDIT_MUTATION_HOOKS) {
  AuditLogSchema.pre(hook, function () {
    throw new Error(AUDIT_LOG_IMMUTABILITY_ERROR);
  });
}

// Block re-saving an already persisted audit document
AuditLogSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error(AUDIT_LOG_IMMUTABILITY_ERROR);
  }
});

export const AuditLogModel: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog>) ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

/**
 * Serializes a Mongoose AuditLog document (or lean object) into a client-safe AuditLogDTO.
 */
export function toAuditLogDTO(
  doc: IAuditLog | (Record<string, unknown> & { _id: unknown })
): AuditLogDTO {
  const raw =
    typeof (doc as IAuditLog).toObject === 'function'
      ? (doc as IAuditLog).toObject()
      : (doc as Record<string, unknown>);

  const actorSnap = (raw.actorSnapshot || {}) as Partial<IAuditActorSnapshot>;

  return {
    id: String(raw._id),
    eventId: String(raw.eventId || ''),
    actorId: raw.actorId ? String(raw.actorId) : '',
    actorSnapshot: {
      fullName: String(actorSnap.fullName || 'System Actor'),
      email: String(actorSnap.email || ''),
      role: String(actorSnap.role || 'super_admin'),
      department: actorSnap.department ? String(actorSnap.department) : null,
    },
    action: String(raw.action || ''),
    module: (raw.module as AuditModule) || 'SYSTEM',
    severity: (raw.severity as AuditSeverity) || 'info',
    targetEntityType: String(raw.targetEntityType || ''),
    targetEntityId: String(raw.targetEntityId || ''),
    targetLabel: raw.targetLabel ? String(raw.targetLabel) : null,
    department: raw.department ? String(raw.department) : null,
    oldState:
      raw.oldState && typeof raw.oldState === 'object'
        ? (raw.oldState as Record<string, unknown>)
        : null,
    newState:
      raw.newState && typeof raw.newState === 'object'
        ? (raw.newState as Record<string, unknown>)
        : null,
    reason: raw.reason ? String(raw.reason) : null,
    ipAddress: raw.ipAddress ? String(raw.ipAddress) : null,
    userAgent: raw.userAgent ? String(raw.userAgent) : null,
    previousHash: String(raw.previousHash || 'GENESIS'),
    entryHash: String(raw.entryHash || ''),
    createdAt:
      raw.createdAt instanceof Date
        ? raw.createdAt.toISOString()
        : String(raw.createdAt || new Date().toISOString()),
  };
}
