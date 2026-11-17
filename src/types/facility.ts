/**
 * Domain Type Definitions for Campus Facility Directory & Space Reservations (MOD-14 / Phase 5.9).
 * Shared across Mongoose Models, Zod Validations, Repositories, Services, APIs, and UI.
 */

import type { Document, Types } from 'mongoose';

export type FacilityType =
  | 'auditorium'
  | 'computer_lab'
  | 'seminar_hall'
  | 'classroom'
  | 'conference_room'
  | 'workshop';

export type FacilityStatus = 'available' | 'maintenance' | 'inactive';

export type FacilityBookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export const FACILITY_TYPES: readonly FacilityType[] = [
  'auditorium',
  'computer_lab',
  'seminar_hall',
  'classroom',
  'conference_room',
  'workshop',
] as const;

export const FACILITY_STATUSES: readonly FacilityStatus[] = [
  'available',
  'maintenance',
  'inactive',
] as const;

export const FACILITY_BOOKING_STATUSES: readonly FacilityBookingStatus[] = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'completed',
] as const;

export const FACILITY_AMENITIES = [
  'projector',
  'ac',
  'smart_board',
  'audio_system',
  'high_speed_lan',
  'pcs',
] as const;

export type FacilityAmenity = (typeof FACILITY_AMENITIES)[number];

/**
 * Mongoose Document interface for a Campus Facility (Space / Lab / Hall).
 */
export interface IFacility extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  building: string;
  floor: number;
  type: FacilityType;
  department?: string | null;
  capacity: number;
  amenities: string[];
  pcCount: number;
  status: FacilityStatus;
  description?: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client-safe Facility Data Transfer Object.
 */
export interface FacilityDTO {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: number;
  type: FacilityType;
  department: string | null;
  capacity: number;
  amenities: string[];
  pcCount: number;
  status: FacilityStatus;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Embedded immutable snapshot of the facility at booking creation time.
 */
export interface IFacilitySnapshot {
  code: string;
  name: string;
  building: string;
  type: FacilityType;
  capacity: number;
}

/**
 * Embedded immutable snapshot of the requesting user at booking creation time.
 */
export interface IRequesterSnapshot {
  fullName: string;
  email: string;
  role: string;
  department: string | null;
  employeeId: string | null;
}

/**
 * Mongoose Document interface for a Facility Space Reservation.
 */
export interface IFacilityBooking extends Document {
  _id: Types.ObjectId;
  bookingCode: string;
  facilityId: Types.ObjectId;
  facilitySnapshot: IFacilitySnapshot;
  requestedBy: Types.ObjectId;
  requesterSnapshot: IRequesterSnapshot;
  title: string;
  purpose: string;
  expectedAttendees: number;
  startTime: Date;
  endTime: Date;
  status: FacilityBookingStatus;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewRemarks?: string | null;
  cancellationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client-safe Facility Booking Data Transfer Object.
 */
export interface FacilityBookingDTO {
  id: string;
  bookingCode: string;
  facilityId: string;
  facilitySnapshot: IFacilitySnapshot;
  requestedBy: string;
  requesterSnapshot: IRequesterSnapshot;
  title: string;
  purpose: string;
  expectedAttendees: number;
  startTime: string;
  endTime: string;
  status: FacilityBookingStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewRemarks: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Facility Detail DTO combining space metadata and upcoming approved slots.
 */
export interface FacilityDetailDTO {
  facility: FacilityDTO;
  upcomingBookings: FacilityBookingDTO[];
}

/**
 * Paginated Facility List DTO.
 */
export interface PaginatedFacilitiesDTO {
  facilities: FacilityDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Paginated Facility Bookings List DTO.
 */
export interface PaginatedFacilityBookingsDTO {
  bookings: FacilityBookingDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Aggregated metrics for Facility Directory & Booking Queues.
 */
export interface FacilityStatsDTO {
  totalSpaces: number;
  availableSpaces: number;
  maintenanceSpaces: number;
  inactiveSpaces: number;
  pendingBookings: number;
  approvedToday: number;
  totalBookings: number;
}
