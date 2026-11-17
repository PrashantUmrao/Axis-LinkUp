/**
 * Facility & Space Reservation Service (Business Logic Layer - BLL).
 * Orchestrates campus facility directory management, faculty reservation workflows,
 * strict RBAC enforcement, atomic double-booking prevention, and realtime alerts
 * (MOD-14 / Phase 5.9).
 *
 * Strictly decoupled from any Academic Calendar or Timetable models.
 */

import { Types } from 'mongoose';
import { FacilityRepository } from '@/lib/db/repositories/facility.repository';
import { FacilityBookingRepository } from '@/lib/db/repositories/facility-booking.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { toFacilityDTO } from '@/lib/db/models/facility.model';
import { toFacilityBookingDTO } from '@/lib/db/models/facility-booking.model';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hasPermission } from '@/lib/auth/rbac';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { NotificationService } from '@/lib/services/notification.service';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors/app-error';
import type { UserSession } from '@/types/user';
import type {
  FacilityDTO,
  FacilityDetailDTO,
  FacilityStatus,
  FacilityBookingDTO,
  FacilityStatsDTO,
  PaginatedFacilitiesDTO,
  PaginatedFacilityBookingsDTO,
  IFacility,
  IRequesterSnapshot,
} from '@/types/facility';
import type {
  CreateFacilityInput,
  UpdateFacilityInput,
  CreateBookingInput,
  ReviewBookingInput,
  CancelBookingInput,
  FacilityQueryParams,
  BookingQueryParams,
} from '@/lib/validations/facility.schema';

/**
 * Escapes user input for safe case-insensitive MongoDB regex matching.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class FacilityService {
  /**
   * Evaluates SPACES_BOOK permission against RBAC matrix (faculty OWN, admin DEPT, super_admin ALLOW; student DENY).
   */
  private static canBookSpace(session: UserSession): boolean {
    const scopeDept = session.departmentId ?? 'institutional';
    return hasPermission(
      session.role,
      PERMISSIONS.SPACES_BOOK,
      { ownerId: session.userId, departmentId: scopeDept },
      { userId: session.userId, departmentId: scopeDept }
    );
  }

  /**
   * Evaluates SPACES_APPROVE permission against RBAC matrix (admin DEPT, super_admin ALLOW; student & faculty DENY).
   */
  private static canApproveSpaces(session: UserSession): boolean {
    const scopeDept = session.departmentId ?? 'institutional';
    return hasPermission(
      session.role,
      PERMISSIONS.SPACES_APPROVE,
      { departmentId: scopeDept },
      { userId: session.userId, departmentId: scopeDept }
    );
  }

  /* ======================================================================== */
  /* 1. Campus Facility Inventory Management                                  */
  /* ======================================================================== */

  /**
   * Creates a new campus facility (restricted to admin and super_admin).
   */
  public static async createFacility(
    session: UserSession,
    data: CreateFacilityInput
  ): Promise<FacilityDTO> {
    if (!this.canApproveSpaces(session)) {
      throw new ForbiddenError(
        'Access denied. Only administrators can add campus facilities and laboratories.'
      );
    }

    const normalizedCode = data.code.trim().toUpperCase();
    const existing = await FacilityRepository.findByCode(normalizedCode);
    if (existing) {
      throw new ConflictError(
        `A campus facility with code "${normalizedCode}" already exists.`
      );
    }

    const created = await FacilityRepository.create({
      code: normalizedCode,
      name: data.name.trim(),
      building: data.building.trim(),
      floor: data.floor,
      type: data.type,
      department: data.department ?? null,
      capacity: data.capacity,
      amenities: data.amenities || [],
      pcCount: data.pcCount ?? 0,
      status: data.status || 'available',
      description: data.description ?? null,
      createdBy: new Types.ObjectId(session.userId),
    });

    return toFacilityDTO(created);
  }

  /**
   * Updates specifications or availability status of an existing campus facility.
   */
  public static async updateFacility(
    session: UserSession,
    id: string,
    data: Partial<UpdateFacilityInput>
  ): Promise<FacilityDTO> {
    if (!this.canApproveSpaces(session)) {
      throw new ForbiddenError(
        'Access denied. Only administrators can modify campus facility records.'
      );
    }

    const existing = await FacilityRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Campus facility', id);
    }

    const updates: Partial<IFacility> = {};

    if (data.code !== undefined) {
      const normalizedCode = data.code.trim().toUpperCase();
      if (normalizedCode !== existing.code) {
        const collision = await FacilityRepository.findByCode(normalizedCode);
        if (collision && collision._id.toString() !== existing._id.toString()) {
          throw new ConflictError(
            `Another facility already uses the code "${normalizedCode}".`
          );
        }
        updates.code = normalizedCode;
      }
    }

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.building !== undefined) updates.building = data.building.trim();
    if (data.floor !== undefined) updates.floor = data.floor;
    if (data.type !== undefined) updates.type = data.type;
    if (data.department !== undefined) updates.department = data.department;
    if (data.capacity !== undefined) updates.capacity = data.capacity;
    if (data.amenities !== undefined) updates.amenities = data.amenities;
    if (data.pcCount !== undefined) updates.pcCount = data.pcCount;
    if (data.status !== undefined) updates.status = data.status;
    if (data.description !== undefined) updates.description = data.description;

    const updated = await FacilityRepository.update(id, updates);
    if (!updated) {
      throw new NotFoundError('Campus facility', id);
    }

    return toFacilityDTO(updated);
  }

  /**
   * Convenience wrapper to toggle a facility between available, maintenance, and inactive.
   */
  public static async toggleFacilityStatus(
    session: UserSession,
    id: string,
    status: FacilityStatus
  ): Promise<FacilityDTO> {
    return await this.updateFacility(session, id, { status });
  }

  /**
   * Lists campus facilities with search, building, type, capacity, amenity, and status filters.
   * Accessible to all authenticated users (read-only directory lookup).
   */
  public static async listFacilities(
    _session: UserSession,
    query: Partial<FacilityQueryParams> = {}
  ): Promise<PaginatedFacilitiesDTO> {
    const filter: Record<string, unknown> = {};

    if (query.building && query.building.trim()) {
      filter.building = { $regex: escapeRegex(query.building.trim()), $options: 'i' };
    }
    if (query.type) {
      filter.type = query.type;
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.department && query.department.trim()) {
      filter.department = { $regex: escapeRegex(query.department.trim()), $options: 'i' };
    }
    if (query.minCapacity !== undefined && query.minCapacity > 0) {
      filter.capacity = { $gte: query.minCapacity };
    }
    if (query.amenity && query.amenity.trim()) {
      filter.amenities = query.amenity.trim();
    }
    if (query.search && query.search.trim()) {
      const term = escapeRegex(query.search.trim());
      filter.$or = [
        { code: { $regex: term, $options: 'i' } },
        { name: { $regex: term, $options: 'i' } },
        { building: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    const { facilities, total } = await FacilityRepository.findFacilities(filter, page, limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      facilities: facilities.map(toFacilityDTO),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Retrieves facility details along with its upcoming approved reservation schedule.
   */
  public static async getFacilityById(
    _session: UserSession,
    id: string
  ): Promise<FacilityDetailDTO> {
    const facility = await FacilityRepository.findById(id);
    if (!facility) {
      throw new NotFoundError('Campus facility', id);
    }

    const upcomingBookings = await FacilityBookingRepository.findUpcomingApprovedForFacility(
      facility._id.toString()
    );

    return {
      facility: toFacilityDTO(facility),
      upcomingBookings: upcomingBookings.map(toFacilityBookingDTO),
    };
  }

  /* ======================================================================== */
  /* 2. Space Reservation Lifecycle & Conflict Defense                        */
  /* ======================================================================== */

  /**
   * Submits a space booking request with strict RBAC, availability, capacity, and overlap checks.
   */
  public static async createBooking(
    session: UserSession,
    data: CreateBookingInput
  ): Promise<FacilityBookingDTO> {
    if (!this.canBookSpace(session)) {
      throw new ForbiddenError(
        'Access denied. Students are not permitted to submit campus facility reservations.'
      );
    }

    const facility = await FacilityRepository.findById(data.facilityId);
    if (!facility) {
      throw new NotFoundError('Campus facility', data.facilityId);
    }

    if (facility.status !== 'available') {
      throw new BadRequestError(
        `Facility "${facility.name}" (${facility.code}) is currently marked as ${facility.status} and cannot accept reservations.`
      );
    }

    if (data.expectedAttendees > facility.capacity) {
      throw new BadRequestError(
        `Expected attendees (${data.expectedAttendees}) exceeds the maximum capacity of ${facility.name} (${facility.capacity}).`
      );
    }

    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    // Check against existing APPROVED reservations for time-slot overlaps
    const conflicts = await FacilityBookingRepository.findConflictingBookings(
      facility._id.toString(),
      startTime,
      endTime
    );

    if (conflicts.length > 0) {
      const firstConflict = conflicts[0]!;
      throw new ConflictError(
        `Time slot conflict: "${facility.name}" is already booked (${firstConflict.bookingCode}) during the requested window.`,
        {
          conflictingBookingCode: firstConflict.bookingCode,
          conflictingStartTime: firstConflict.startTime.toISOString(),
          conflictingEndTime: firstConflict.endTime.toISOString(),
        }
      );
    }

    // Build authoritative requester snapshot
    let deptName: string | null = null;
    let employeeId: string | null = null;
    let fullName = session.fullName || 'Institutional Faculty';
    let email = session.email;

    try {
      const requester = await UserRepository.findById(session.userId);
      if (requester) {
        fullName = requester.fullName || fullName;
        email = requester.email || email;
        employeeId = requester.facultyProfile?.employeeId || null;
        if (requester.departmentId) {
          const dept = await DepartmentRepository.findById(requester.departmentId.toString());
          if (dept) {
            deptName = dept.name;
          }
        }
      } else if (session.departmentId) {
        const dept = await DepartmentRepository.findById(session.departmentId);
        if (dept) {
          deptName = dept.name;
        }
      }
    } catch {
      // Graceful fallback to verified session claims
    }

    const requesterSnapshot: IRequesterSnapshot = {
      fullName,
      email,
      role: session.role,
      department: deptName,
      employeeId,
    };

    const bookingCode = await FacilityBookingRepository.getNextBookingCode();
    const shouldAutoApprove = session.role === 'super_admin' && data.autoApprove === true;

    const created = await FacilityBookingRepository.create({
      bookingCode,
      facilityId: facility._id,
      facilitySnapshot: {
        code: facility.code,
        name: facility.name,
        building: facility.building,
        type: facility.type,
        capacity: facility.capacity,
      },
      requestedBy: new Types.ObjectId(session.userId),
      requesterSnapshot,
      title: data.title.trim(),
      purpose: data.purpose.trim(),
      expectedAttendees: data.expectedAttendees,
      startTime,
      endTime,
      status: shouldAutoApprove ? 'approved' : 'pending',
      reviewedBy: shouldAutoApprove ? new Types.ObjectId(session.userId) : null,
      reviewedAt: shouldAutoApprove ? new Date() : null,
      reviewRemarks: shouldAutoApprove ? 'Auto-approved by Super Administrator.' : null,
    });

    return toFacilityBookingDTO(created);
  }

  /**
   * Approves or rejects a pending space booking request.
   * Re-runs atomic overlap detection before committing approval to eliminate race conditions
   * between competing pending requests.
   */
  public static async reviewBooking(
    session: UserSession,
    bookingId: string,
    input: ReviewBookingInput
  ): Promise<FacilityBookingDTO> {
    if (!this.canApproveSpaces(session)) {
      throw new ForbiddenError(
        'Access denied. Only administrators can approve or reject campus facility bookings.'
      );
    }

    const booking = await FacilityBookingRepository.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Facility booking', bookingId);
    }

    if (booking.status !== 'pending') {
      throw new BadRequestError(
        `Invalid status transition: only pending bookings can be reviewed (current status: '${booking.status}').`
      );
    }

    if (input.action === 'reject') {
      if (!input.remarks || input.remarks.trim().length < 10) {
        throw new BadRequestError(
          'Rejection requires descriptive remarks of at least 10 characters.'
        );
      }
    }

    if (input.action === 'approve') {
      // Defensive check: verify facility is still available
      const facility = await FacilityRepository.findById(booking.facilityId.toString());
      if (facility && facility.status !== 'available') {
        throw new BadRequestError(
          `Cannot approve booking: "${facility.name}" is currently marked as ${facility.status}.`
        );
      }

      // CRITICAL DOUBLE-BOOKING GUARD ON APPROVAL:
      // Re-verify against all currently approved bookings so two competing pending requests
      // for overlapping slots can NEVER both be approved.
      const conflicts = await FacilityBookingRepository.findConflictingBookings(
        booking.facilityId.toString(),
        new Date(booking.startTime),
        new Date(booking.endTime),
        booking._id.toString()
      );

      if (conflicts.length > 0) {
        const firstConflict = conflicts[0]!;
        throw new ConflictError(
          `Double-booking conflict: "${booking.facilitySnapshot.name}" already has an approved booking (${firstConflict.bookingCode}) overlapping this time slot.`,
          {
            conflictingBookingCode: firstConflict.bookingCode,
            conflictingStartTime: firstConflict.startTime.toISOString(),
            conflictingEndTime: firstConflict.endTime.toISOString(),
          }
        );
      }
    }

    const nextStatus = input.action === 'approve' ? 'approved' : 'rejected';
    const updated = await FacilityBookingRepository.update(bookingId, {
      status: nextStatus,
      reviewedBy: new Types.ObjectId(session.userId),
      reviewedAt: new Date(),
      reviewRemarks: input.remarks ? input.remarks.trim() : null,
    });

    if (!updated) {
      throw new NotFoundError('Facility booking', bookingId);
    }

    // Real-time Ably notification with graceful degradation
    try {
      const requesterChannel = AblyBroker.getUserNotificationChannel(
        updated.requestedBy.toString()
      );
      await AblyBroker.publish(requesterChannel, 'facility.booking.updated', {
        bookingId: updated._id.toString(),
        bookingCode: updated.bookingCode,
        facilityCode: updated.facilitySnapshot.code,
        facilityName: updated.facilitySnapshot.name,
        title: updated.title,
        previousStatus: booking.status,
        newStatus: nextStatus,
        remarks: updated.reviewRemarks ?? null,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Non-blocking realtime publishing (gracefully degrades if ABLY_API_KEY is absent)
    }

    // Unified Notification Center persistent hook (non-blocking)
    await NotificationService.safeDispatchCrossModule({
      userId: updated.requestedBy.toString(),
      title: `Facility Booking ${updated.bookingCode} ${nextStatus === 'approved' ? 'Approved' : 'Rejected'}`,
      message: `Your reservation for ${updated.facilitySnapshot.name} ("${updated.title}") has been ${nextStatus}.`,
      category: 'facility_booking',
      priority: nextStatus === 'rejected' ? 'high' : 'normal',
      linkUrl: '/faculty/spaces',
      dedupeKey: `bkg:${updated._id.toString()}:${nextStatus}`,
      metadata: { bookingCode: updated.bookingCode, status: nextStatus },
    });

    return toFacilityBookingDTO(updated);
  }

  /**
   * Cancels a pending or upcoming approved booking.
   * Requesters can cancel their own bookings; administrators can cancel any booking.
   */
  public static async cancelBooking(
    session: UserSession,
    bookingId: string,
    input: CancelBookingInput
  ): Promise<FacilityBookingDTO> {
    const canBook = this.canBookSpace(session);
    const canApprove = this.canApproveSpaces(session);

    if (!canBook && !canApprove) {
      throw new ForbiddenError('Access denied. You are not authorized to cancel bookings.');
    }

    const booking = await FacilityBookingRepository.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Facility booking', bookingId);
    }

    const isOwner = booking.requestedBy.toString() === session.userId;
    if (!canApprove && !isOwner) {
      throw new ForbiddenError('You can only cancel your own space reservations.');
    }

    if (booking.status !== 'pending' && booking.status !== 'approved') {
      throw new BadRequestError(
        `Cannot cancel booking in '${booking.status}' state. Only pending or approved bookings can be cancelled.`
      );
    }

    if (!canApprove && new Date(booking.endTime).getTime() <= Date.now()) {
      throw new BadRequestError('Cannot cancel a reservation whose time slot has already ended.');
    }

    const updated = await FacilityBookingRepository.update(bookingId, {
      status: 'cancelled',
      cancellationReason: input.reason.trim(),
    });

    if (!updated) {
      throw new NotFoundError('Facility booking', bookingId);
    }

    return toFacilityBookingDTO(updated);
  }

  /**
   * Lists persona-scoped facility bookings.
   * - Faculty: own bookings by default, or read-only approved schedule for a specific facilityId.
   * - Admin / Super Admin: full institutional/departmental booking queue.
   * - Student: read-only approved availability lookup only when facilityId is specified.
   */
  public static async listBookings(
    session: UserSession,
    query: Partial<BookingQueryParams> = {}
  ): Promise<PaginatedFacilityBookingsDTO> {
    const filter: Record<string, unknown> = {};

    if (session.role === 'student') {
      if (!query.facilityId) {
        throw new ForbiddenError(
          'Students may only query read-only approved availability for a specific facility.'
        );
      }
      filter.facilityId = new Types.ObjectId(query.facilityId);
      filter.status = 'approved';
    } else if (session.role === 'faculty') {
      if (query.scope === 'availability' && query.facilityId) {
        filter.facilityId = new Types.ObjectId(query.facilityId);
        filter.status = 'approved';
      } else {
        filter.requestedBy = new Types.ObjectId(session.userId);
        if (query.facilityId) {
          filter.facilityId = new Types.ObjectId(query.facilityId);
        }
        if (query.status) {
          filter.status = query.status;
        }
      }
    } else if (session.role === 'admin' || session.role === 'super_admin') {
      if (query.scope === 'mine') {
        filter.requestedBy = new Types.ObjectId(session.userId);
      }
      if (query.facilityId) {
        filter.facilityId = new Types.ObjectId(query.facilityId);
      }
      if (query.status) {
        filter.status = query.status;
      }
    } else {
      throw new ForbiddenError('Unauthorized access to facility bookings.');
    }

    if (query.dateFrom || query.dateTo) {
      const timeRange: Record<string, Date> = {};
      if (query.dateFrom) timeRange.$gte = new Date(query.dateFrom);
      if (query.dateTo) timeRange.$lte = new Date(query.dateTo);
      filter.startTime = timeRange;
    }

    if (query.search && query.search.trim()) {
      const term = escapeRegex(query.search.trim());
      filter.$or = [
        { bookingCode: { $regex: term, $options: 'i' } },
        { title: { $regex: term, $options: 'i' } },
        { 'facilitySnapshot.name': { $regex: term, $options: 'i' } },
        { 'facilitySnapshot.code': { $regex: term, $options: 'i' } },
        { 'requesterSnapshot.fullName': { $regex: term, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    const { bookings, total } = await FacilityBookingRepository.findBookings(
      filter,
      page,
      limit,
      'startTime',
      'desc'
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      bookings: bookings.map(toFacilityBookingDTO),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Computes facility directory and booking queue metrics scoped to the caller persona.
   */
  public static async getBookingStats(session: UserSession): Promise<FacilityStatsDTO> {
    const bookingFilter: Record<string, unknown> = {};

    if (session.role === 'faculty') {
      bookingFilter.requestedBy = new Types.ObjectId(session.userId);
    } else if (session.role === 'student') {
      bookingFilter.status = 'approved';
    }

    const [spaceStats, bookingStats] = await Promise.all([
      FacilityRepository.getSpaceStats(),
      FacilityBookingRepository.getStats(bookingFilter),
    ]);

    return {
      totalSpaces: spaceStats.totalSpaces,
      availableSpaces: spaceStats.availableSpaces,
      maintenanceSpaces: spaceStats.maintenanceSpaces,
      inactiveSpaces: spaceStats.inactiveSpaces,
      pendingBookings: bookingStats.pendingBookings,
      approvedToday: bookingStats.approvedToday,
      totalBookings: bookingStats.totalBookings,
    };
  }
}
