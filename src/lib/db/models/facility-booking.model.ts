/**
 * Mongoose FacilityBooking Model Definition (MOD-14 / Phase 5.9).
 * Represents time-slotted campus facility reservations with immutable snapshots
 * and atomic overlap indexing. Strictly decoupled from any Academic Calendar.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type {
  IFacilityBooking,
  FacilityBookingDTO,
  IFacilitySnapshot,
  IRequesterSnapshot,
  FacilityBookingStatus,
  FacilityType,
} from '@/types/facility';

const FacilitySnapshotSchema = new Schema<IFacilitySnapshot>(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    building: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: [
        'auditorium',
        'computer_lab',
        'seminar_hall',
        'classroom',
        'conference_room',
        'workshop',
      ],
    },
    capacity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const RequesterSnapshotSchema = new Schema<IRequesterSnapshot>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: null },
    employeeId: { type: String, trim: true, default: null },
  },
  { _id: false }
);

export const FacilityBookingSchema = new Schema<IFacilityBooking>(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    facilityId: {
      type: Schema.Types.ObjectId,
      ref: 'Facility',
      required: true,
      index: true,
    },
    facilitySnapshot: {
      type: FacilitySnapshotSchema,
      required: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requesterSnapshot: {
      type: RequesterSnapshotSchema,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 120,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },
    expectedAttendees: {
      type: Number,
      required: true,
      min: 1,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewRemarks: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'facility_bookings',
  }
);

// Critical time-slot overlap & requester timeline indexes
FacilityBookingSchema.index({ facilityId: 1, status: 1, startTime: 1, endTime: 1 });
FacilityBookingSchema.index({ requestedBy: 1, startTime: -1 });
FacilityBookingSchema.index({ bookingCode: 1 }, { unique: true });

export const FacilityBookingModel: Model<IFacilityBooking> =
  (mongoose.models.FacilityBooking as Model<IFacilityBooking>) ||
  mongoose.model<IFacilityBooking>('FacilityBooking', FacilityBookingSchema);

/**
 * Serializes a Mongoose FacilityBooking document (or lean object) into a client-safe FacilityBookingDTO.
 */
export function toFacilityBookingDTO(
  doc: IFacilityBooking | (Record<string, unknown> & { _id: unknown })
): FacilityBookingDTO {
  const raw =
    typeof (doc as IFacilityBooking).toObject === 'function'
      ? (doc as IFacilityBooking).toObject()
      : (doc as Record<string, unknown>);

  const facSnap = (raw.facilitySnapshot || {}) as Partial<IFacilitySnapshot>;
  const reqSnap = (raw.requesterSnapshot || {}) as Partial<IRequesterSnapshot>;

  return {
    id: String(raw._id),
    bookingCode: String(raw.bookingCode || ''),
    facilityId: raw.facilityId ? String(raw.facilityId) : '',
    facilitySnapshot: {
      code: String(facSnap.code || ''),
      name: String(facSnap.name || ''),
      building: String(facSnap.building || ''),
      type: (facSnap.type as FacilityType) || 'classroom',
      capacity: Number(facSnap.capacity ?? 1),
    },
    requestedBy: raw.requestedBy ? String(raw.requestedBy) : '',
    requesterSnapshot: {
      fullName: String(reqSnap.fullName || ''),
      email: String(reqSnap.email || ''),
      role: String(reqSnap.role || 'faculty'),
      department: reqSnap.department ? String(reqSnap.department) : null,
      employeeId: reqSnap.employeeId ? String(reqSnap.employeeId) : null,
    },
    title: String(raw.title || ''),
    purpose: String(raw.purpose || ''),
    expectedAttendees: Number(raw.expectedAttendees ?? 1),
    startTime:
      raw.startTime instanceof Date
        ? raw.startTime.toISOString()
        : String(raw.startTime || new Date().toISOString()),
    endTime:
      raw.endTime instanceof Date
        ? raw.endTime.toISOString()
        : String(raw.endTime || new Date().toISOString()),
    status: (raw.status as FacilityBookingStatus) || 'pending',
    reviewedBy: raw.reviewedBy ? String(raw.reviewedBy) : null,
    reviewedAt:
      raw.reviewedAt instanceof Date
        ? raw.reviewedAt.toISOString()
        : raw.reviewedAt
          ? String(raw.reviewedAt)
          : null,
    reviewRemarks: raw.reviewRemarks ? String(raw.reviewRemarks) : null,
    cancellationReason: raw.cancellationReason ? String(raw.cancellationReason) : null,
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
