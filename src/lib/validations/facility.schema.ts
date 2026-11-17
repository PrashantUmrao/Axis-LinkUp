/**
 * Zod Validation Schemas for Campus Facility Directory & Space Reservations (MOD-14 / Phase 5.9).
 * Enforces strict time-window bounds, capacity validation, and review remark policies.
 */

import { z } from 'zod';
import { objectIdSchema } from './common-schemas';

export const FACILITY_BOOKING_MIN_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const FACILITY_BOOKING_MAX_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
export const FACILITY_BOOKING_CLOCK_SKEW_GRACE_MS = 5 * 60 * 1000; // 5 minutes

export const facilityTypeEnum = z.enum([
  'auditorium',
  'computer_lab',
  'seminar_hall',
  'classroom',
  'conference_room',
  'workshop',
]);

export const facilityStatusEnum = z.enum(['available', 'maintenance', 'inactive']);

export const facilityBookingStatusEnum = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'completed',
]);

/**
 * Schema for creating a new campus facility/space.
 */
export const createFacilitySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Facility code must be at least 2 characters')
    .max(30, 'Facility code cannot exceed 30 characters')
    .transform((val) => val.toUpperCase())
    .refine(
      (val) => /^[A-Z0-9-]+$/.test(val),
      'Facility code must contain only uppercase letters, numbers, and hyphens'
    ),
  name: z
    .string()
    .trim()
    .min(3, 'Facility name must be at least 3 characters')
    .max(120, 'Facility name cannot exceed 120 characters'),
  building: z
    .string()
    .trim()
    .min(2, 'Building name must be at least 2 characters')
    .max(80, 'Building name cannot exceed 80 characters'),
  floor: z.coerce
    .number()
    .int('Floor must be an integer')
    .min(0, 'Floor cannot be negative')
    .max(20, 'Floor cannot exceed 20'),
  type: facilityTypeEnum,
  department: z
    .string()
    .trim()
    .max(120, 'Department name cannot exceed 120 characters')
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  capacity: z.coerce
    .number()
    .int('Capacity must be a whole number')
    .min(1, 'Capacity must be at least 1')
    .max(2000, 'Capacity cannot exceed 2000'),
  amenities: z
    .array(z.string().trim().min(1).max(60))
    .max(25, 'Maximum 25 amenities allowed')
    .optional()
    .default([]),
  pcCount: z.coerce
    .number()
    .int('PC count must be a whole number')
    .min(0, 'PC count cannot be negative')
    .max(1000, 'PC count cannot exceed 1000')
    .optional()
    .default(0),
  status: facilityStatusEnum.optional().default('available'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;

/**
 * Schema for updating an existing campus facility/space.
 */
export const updateFacilitySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Facility code must be at least 2 characters')
      .max(30, 'Facility code cannot exceed 30 characters')
      .transform((val) => val.toUpperCase())
      .refine(
        (val) => /^[A-Z0-9-]+$/.test(val),
        'Facility code must contain only uppercase letters, numbers, and hyphens'
      )
      .optional(),
    name: z
      .string()
      .trim()
      .min(3, 'Facility name must be at least 3 characters')
      .max(120, 'Facility name cannot exceed 120 characters')
      .optional(),
    building: z
      .string()
      .trim()
      .min(2, 'Building name must be at least 2 characters')
      .max(80, 'Building name cannot exceed 80 characters')
      .optional(),
    floor: z.coerce
      .number()
      .int('Floor must be an integer')
      .min(0, 'Floor cannot be negative')
      .max(20, 'Floor cannot exceed 20')
      .optional(),
    type: facilityTypeEnum.optional(),
    department: z
      .string()
      .trim()
      .max(120, 'Department name cannot exceed 120 characters')
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
    capacity: z.coerce
      .number()
      .int('Capacity must be a whole number')
      .min(1, 'Capacity must be at least 1')
      .max(2000, 'Capacity cannot exceed 2000')
      .optional(),
    amenities: z
      .array(z.string().trim().min(1).max(60))
      .max(25, 'Maximum 25 amenities allowed')
      .optional(),
    pcCount: z.coerce
      .number()
      .int('PC count must be a whole number')
      .min(0, 'PC count cannot be negative')
      .max(1000, 'PC count cannot exceed 1000')
      .optional(),
    status: facilityStatusEnum.optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .optional()
      .nullable()
      .transform((val) => (val === undefined ? undefined : val && val.length > 0 ? val : null)),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type UpdateFacilityInput = z.infer<typeof updateFacilitySchema>;

/**
 * Schema for submitting a campus facility space booking request.
 */
export const createBookingSchema = z
  .object({
    facilityId: objectIdSchema,
    title: z
      .string()
      .trim()
      .min(5, 'Booking title must be at least 5 characters')
      .max(120, 'Booking title cannot exceed 120 characters'),
    purpose: z
      .string()
      .trim()
      .min(10, 'Purpose description must be at least 10 characters')
      .max(1000, 'Purpose description cannot exceed 1000 characters'),
    expectedAttendees: z.coerce
      .number()
      .int('Expected attendees must be a whole number')
      .min(1, 'Expected attendees must be at least 1')
      .max(2000, 'Expected attendees cannot exceed 2000'),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    autoApprove: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (Number.isNaN(data.startTime.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid start time',
        path: ['startTime'],
      });
      return;
    }

    if (Number.isNaN(data.endTime.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid end time',
        path: ['endTime'],
      });
      return;
    }

    const nowWithGrace = Date.now() - FACILITY_BOOKING_CLOCK_SKEW_GRACE_MS;
    if (data.startTime.getTime() < nowWithGrace) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start time cannot be in the past',
        path: ['startTime'],
      });
    }

    if (data.endTime.getTime() <= data.startTime.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be strictly after start time',
        path: ['endTime'],
      });
      return;
    }

    const durationMs = data.endTime.getTime() - data.startTime.getTime();
    if (durationMs < FACILITY_BOOKING_MIN_DURATION_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Booking duration must be at least 30 minutes',
        path: ['endTime'],
      });
    }

    if (durationMs > FACILITY_BOOKING_MAX_DURATION_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Booking duration cannot exceed 12 hours',
        path: ['endTime'],
      });
    }
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * Schema for administrative review (approve / reject) of a booking request.
 */
export const reviewBookingSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    remarks: z
      .string()
      .trim()
      .max(500, 'Review remarks cannot exceed 500 characters')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'reject' && (!data.remarks || data.remarks.trim().length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Rejection requires descriptive remarks of at least 10 characters',
        path: ['remarks'],
      });
    }
  });

export type ReviewBookingInput = z.infer<typeof reviewBookingSchema>;

/**
 * Schema for cancelling a pending or approved upcoming booking.
 */
export const cancelBookingSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Cancellation reason must be at least 5 characters')
    .max(500, 'Cancellation reason cannot exceed 500 characters'),
});

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

/**
 * Query parameters schema for listing and filtering campus facilities.
 */
export const facilityQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  building: z.string().trim().max(80).optional(),
  type: facilityTypeEnum.optional(),
  status: facilityStatusEnum.optional(),
  department: z.string().trim().max(120).optional(),
  minCapacity: z.coerce.number().int().min(1).max(2000).optional(),
  amenity: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type FacilityQueryParams = z.infer<typeof facilityQuerySchema>;

/**
 * Query parameters schema for listing and filtering facility bookings.
 */
export const bookingQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  facilityId: objectIdSchema.optional(),
  status: facilityBookingStatusEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  scope: z.enum(['mine', 'all', 'availability']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type BookingQueryParams = z.infer<typeof bookingQuerySchema>;
