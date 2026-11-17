/**
 * Mongoose Facility Model Definition (MOD-14 / Phase 5.9).
 * Represents campus spaces: Auditoriums, Computer Laboratories, Seminar Halls,
 * Smart Classrooms, Conference Rooms, and Workshops.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type { IFacility, FacilityDTO, FacilityType, FacilityStatus } from '@/types/facility';

export const FacilitySchema = new Schema<IFacility>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    building: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    floor: {
      type: Number,
      required: true,
      min: 0,
      max: 20,
    },
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
      index: true,
    },
    department: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 2000,
    },
    amenities: {
      type: [String],
      default: [],
    },
    pcCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
    },
    status: {
      type: String,
      required: true,
      enum: ['available', 'maintenance', 'inactive'],
      default: 'available',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'facilities',
  }
);

// Compound directory indexing strategy
FacilitySchema.index({ code: 1 }, { unique: true });
FacilitySchema.index({ building: 1, type: 1, status: 1 });

export const FacilityModel: Model<IFacility> =
  (mongoose.models.Facility as Model<IFacility>) ||
  mongoose.model<IFacility>('Facility', FacilitySchema);

/**
 * Serializes a Mongoose Facility document (or lean object) into a client-safe FacilityDTO.
 */
export function toFacilityDTO(
  doc: IFacility | (Record<string, unknown> & { _id: unknown })
): FacilityDTO {
  const raw =
    typeof (doc as IFacility).toObject === 'function'
      ? (doc as IFacility).toObject()
      : (doc as Record<string, unknown>);

  return {
    id: String(raw._id),
    code: String(raw.code || ''),
    name: String(raw.name || ''),
    building: String(raw.building || ''),
    floor: Number(raw.floor ?? 0),
    type: raw.type as FacilityType,
    department: raw.department ? String(raw.department) : null,
    capacity: Number(raw.capacity ?? 1),
    amenities: Array.isArray(raw.amenities) ? raw.amenities.map(String) : [],
    pcCount: Number(raw.pcCount ?? 0),
    status: (raw.status as FacilityStatus) || 'available',
    description: raw.description ? String(raw.description) : null,
    createdBy: raw.createdBy ? String(raw.createdBy) : '',
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
