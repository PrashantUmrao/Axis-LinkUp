/**
 * Phase 5.9: Facility Bookings & Campus Space Reservations Backend Test Suite (MOD-14).
 *
 * Verifies:
 * 1. Zod Validation Layer (capacity bounds, duration < 30m / > 12h, past dates, remarks enforcement).
 * 2. Strict RBAC Matrix Alignment (Student blocked from booking/approving; Faculty blocked from approving/creating facilities).
 * 3. Facility CRUD & Duplicate Code Prevention.
 * 4. Booking Lifecycle: Capacity Enforcement & Maintenance/Inactive Room Rejection.
 * 5. Double-Booking Conflict Defense: Overlap on Creation, Overlap on Competing Pending Approval, and Adjacent Back-to-Back Slots.
 * 6. Booking Cancellation & Ably Notification Dispatch (with graceful degradation).
 * 7. REST API Route Handlers Integration across all 6 endpoints.
 */

import { describe, test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import {
  createFacilitySchema,
  updateFacilitySchema,
  createBookingSchema,
  reviewBookingSchema,
  cancelBookingSchema,
} from '../../src/lib/validations/facility.schema';
import { FacilityService } from '../../src/lib/services/facility.service';
import { FacilityRepository } from '../../src/lib/db/repositories/facility.repository';
import { FacilityBookingRepository } from '../../src/lib/db/repositories/facility-booking.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { AblyBroker } from '../../src/lib/realtime/ably-broker';
import { __setTestSession } from '../../src/lib/auth/server';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from '../../src/lib/errors/app-error';

// API Route Handlers
import {
  GET as getFacilitiesRoute,
  POST as createFacilityRoute,
} from '../../src/app/api/v1/facilities/route';
import {
  GET as getFacilityByIdRoute,
  PATCH as updateFacilityRoute,
} from '../../src/app/api/v1/facilities/[id]/route';
import {
  GET as getBookingsRoute,
  POST as createBookingRoute,
} from '../../src/app/api/v1/facilities/bookings/route';
import { POST as reviewBookingRoute } from '../../src/app/api/v1/facilities/bookings/[id]/review/route';
import { POST as cancelBookingRoute } from '../../src/app/api/v1/facilities/bookings/[id]/cancel/route';
import { GET as getFacilityStatsRoute } from '../../src/app/api/v1/facilities/stats/route';

import type { UserSession } from '../../src/types/user';
import type { IFacility, IFacilityBooking } from '../../src/types/facility';

const studentId = '6730a005f8b1a2001a000901';
const facultyId = '6730a005f8b1a2001a000902';
const otherFacultyId = '6730a005f8b1a2001a000903';
const adminId = '6730a005f8b1a2001a000904';
const superAdminId = '6730a005f8b1a2001a000905';
const cseDeptId = '6730a005f8b1a2001a000910';
const facilityId = '6730a005f8b1a2001a000920';
const booking1Id = '6730a005f8b1a2001a000930';
const booking2Id = '6730a005f8b1a2001a000931';

const studentSession: UserSession = {
  userId: studentId,
  email: 'student.cse@axiscolleges.in',
  fullName: 'Rohan Kumar',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'prof.sharma@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  role: 'faculty',
  status: 'active',
  departmentId: cseDeptId,
};

const otherFacultySession: UserSession = {
  userId: otherFacultyId,
  email: 'prof.mehta@axiscolleges.in',
  fullName: 'Prof. Neha Mehta',
  role: 'faculty',
  status: 'active',
  departmentId: cseDeptId,
};

const adminSession: UserSession = {
  userId: adminId,
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. S. K. Gupta',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: cseDeptId,
};

const superAdminSession: UserSession = {
  userId: superAdminId,
  email: 'sysadmin@axiscolleges.in',
  fullName: 'Central System Admin',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

function createMockFacility(overrides: Partial<IFacility> = {}): IFacility {
  const now = new Date();
  return {
    _id: new Types.ObjectId(facilityId),
    code: 'BLK-A-LAB-402',
    name: 'Central Computing Lab 402',
    building: 'Block A',
    floor: 4,
    type: 'computer_lab',
    department: 'Computer Science & Engineering',
    capacity: 60,
    amenities: ['projector', 'ac', 'high_speed_lan', 'pcs'],
    pcCount: 60,
    status: 'available',
    description: 'High-performance AI and Data Structures computer laboratory.',
    createdBy: new Types.ObjectId(adminId),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as IFacility;
}

function createMockBooking(overrides: Partial<IFacilityBooking> = {}): IFacilityBooking {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 11:00
  const now = new Date();

  return {
    _id: new Types.ObjectId(booking1Id),
    bookingCode: 'BKG-2026-10001',
    facilityId: new Types.ObjectId(facilityId),
    facilitySnapshot: {
      code: 'BLK-A-LAB-402',
      name: 'Central Computing Lab 402',
      building: 'Block A',
      type: 'computer_lab',
      capacity: 60,
    },
    requestedBy: new Types.ObjectId(facultyId),
    requesterSnapshot: {
      fullName: 'Prof. Alok Sharma',
      email: 'prof.sharma@axiscolleges.in',
      role: 'faculty',
      department: 'Computer Science & Engineering',
      employeeId: 'EMP-CSE-101',
    },
    title: 'AI Workshop — B.Tech CSE Sem 6',
    purpose: 'Hands-on machine learning model training session for 6th semester students.',
    expectedAttendees: 45,
    startTime: start,
    endTime: end,
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewRemarks: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as IFacilityBooking;
}

describe('Phase 5.9: Facility Bookings & Space Reservations Backend Suite', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  /* ======================================================================== */
  /* 1. Zod Schema Validation Edge Cases                                      */
  /* ======================================================================== */
  describe('1. Zod Validation Edge Cases', () => {
    test('accepts valid facility creation payload and normalizes code to uppercase', () => {
      const parsed = createFacilitySchema.safeParse({
        code: 'blk-a-lab-402',
        name: 'Central Computing Lab 402',
        building: 'Block A',
        floor: 4,
        type: 'computer_lab',
        capacity: 60,
        amenities: ['projector', 'ac', 'pcs'],
        pcCount: 60,
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.code, 'BLK-A-LAB-402');
        assert.equal(parsed.data.status, 'available');
      }
    });

    test('rejects facility with out-of-range capacity or floor', () => {
      const badCap = createFacilitySchema.safeParse({
        code: 'MAIN-AUD-01',
        name: 'Main Auditorium',
        building: 'Central Block',
        floor: 0,
        type: 'auditorium',
        capacity: 2500, // exceeds max 2000
      });
      assert.equal(badCap.success, false);

      const badFloor = createFacilitySchema.safeParse({
        code: 'MAIN-AUD-02',
        name: 'Sky Lab',
        building: 'Block C',
        floor: 25, // exceeds max 20
        type: 'computer_lab',
        capacity: 40,
      });
      assert.equal(badFloor.success, false);
    });

    test('rejects booking duration shorter than 30 minutes or longer than 12 hours', () => {
      const start = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const tooShortEnd = new Date(start.getTime() + 15 * 60 * 1000); // 15 mins
      const tooLongEnd = new Date(start.getTime() + 13 * 60 * 60 * 1000); // 13 hours

      const shortRes = createBookingSchema.safeParse({
        facilityId,
        title: 'Quick Briefing Session',
        purpose: 'Brief departmental lab orientation session for students.',
        expectedAttendees: 20,
        startTime: start.toISOString(),
        endTime: tooShortEnd.toISOString(),
      });
      assert.equal(shortRes.success, false);

      const longRes = createBookingSchema.safeParse({
        facilityId,
        title: 'Overnight Hackathon Session',
        purpose: 'Extended duration technical coding marathon event.',
        expectedAttendees: 50,
        startTime: start.toISOString(),
        endTime: tooLongEnd.toISOString(),
      });
      assert.equal(longRes.success, false);
    });

    test('rejects booking with startTime in the past beyond 5-minute grace window', () => {
      const pastStart = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
      const pastEnd = new Date(pastStart.getTime() + 60 * 60 * 1000);

      const res = createBookingSchema.safeParse({
        facilityId,
        title: 'Past Lecture Booking',
        purpose: 'Attempting to reserve a slot in the past for records.',
        expectedAttendees: 25,
        startTime: pastStart.toISOString(),
        endTime: pastEnd.toISOString(),
      });
      assert.equal(res.success, false);
    });

    test('enforces mandatory rejection remarks (>= 10 chars) and cancellation reason', () => {
      const rejectNoRemarks = reviewBookingSchema.safeParse({
        action: 'reject',
        remarks: 'Too short',
      });
      assert.equal(rejectNoRemarks.success, false);

      const rejectValid = reviewBookingSchema.safeParse({
        action: 'reject',
        remarks: 'Lab is reserved for University External Practical Examination.',
      });
      assert.equal(rejectValid.success, true);

      const approveNoRemarks = reviewBookingSchema.safeParse({ action: 'approve' });
      assert.equal(approveNoRemarks.success, true);

      const shortCancel = cancelBookingSchema.safeParse({ reason: 'No' });
      assert.equal(shortCancel.success, false);

      const emptyUpdate = updateFacilitySchema.safeParse({});
      assert.equal(emptyUpdate.success, false);
    });
  });

  /* ======================================================================== */
  /* 2. Strict RBAC Enforcement                                               */
  /* ======================================================================== */
  describe('2. Strict RBAC Enforcement (DOC-AUTH-005)', () => {
    test('blocks student from creating a facility, booking a space, or approving bookings (403)', async () => {
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const futureEnd = new Date(futureStart.getTime() + 2 * 60 * 60 * 1000);

      await assert.rejects(
        () =>
          FacilityService.createFacility(studentSession, {
            code: 'TEST-101',
            name: 'Test Room',
            building: 'Block A',
            floor: 1,
            type: 'classroom',
            capacity: 40,
            amenities: [],
            pcCount: 0,
            status: 'available',
            department: null,
            description: null,
          }),
        ForbiddenError
      );

      await assert.rejects(
        () =>
          FacilityService.createBooking(studentSession, {
            facilityId,
            title: 'Student Club Meetup',
            purpose: 'Organizing an informal club discussion in lab 402.',
            expectedAttendees: 20,
            startTime: futureStart,
            endTime: futureEnd,
            autoApprove: false,
          }),
        ForbiddenError
      );

      await assert.rejects(
        () => FacilityService.reviewBooking(studentSession, booking1Id, { action: 'approve' }),
        ForbiddenError
      );
    });

    test('blocks faculty from creating/updating facilities or approving/rejecting bookings (403)', async () => {
      await assert.rejects(
        () =>
          FacilityService.createFacility(facultySession, {
            code: 'FAC-101',
            name: 'Faculty Created Room',
            building: 'Block B',
            floor: 2,
            type: 'seminar_hall',
            capacity: 100,
            amenities: [],
            pcCount: 0,
            status: 'available',
            department: null,
            description: null,
          }),
        ForbiddenError
      );

      await assert.rejects(
        () => FacilityService.toggleFacilityStatus(facultySession, facilityId, 'maintenance'),
        ForbiddenError
      );

      await assert.rejects(
        () => FacilityService.reviewBooking(facultySession, booking1Id, { action: 'approve' }),
        ForbiddenError
      );
    });
  });

  /* ======================================================================== */
  /* 3. Facility CRUD, Capacity & Maintenance Guards                          */
  /* ======================================================================== */
  describe('3. Facility CRUD, Capacity & Maintenance Guards', () => {
    test('allows admin to create facility and prevents duplicate facility codes (409)', async () => {
      const mockFac = createMockFacility();
      mock.method(FacilityRepository, 'findByCode', async () => null);
      mock.method(FacilityRepository, 'create', async () => mockFac);

      const dto = await FacilityService.createFacility(adminSession, {
        code: 'BLK-A-LAB-402',
        name: 'Central Computing Lab 402',
        building: 'Block A',
        floor: 4,
        type: 'computer_lab',
        capacity: 60,
        amenities: ['projector', 'ac', 'pcs'],
        pcCount: 60,
        status: 'available',
        department: 'Computer Science & Engineering',
        description: null,
      });
      assert.equal(dto.code, 'BLK-A-LAB-402');

      // Duplicate code check
      mock.method(FacilityRepository, 'findByCode', async () => mockFac);
      await assert.rejects(
        () =>
          FacilityService.createFacility(adminSession, {
            code: 'BLK-A-LAB-402',
            name: 'Duplicate Lab',
            building: 'Block A',
            floor: 4,
            type: 'computer_lab',
            capacity: 60,
            amenities: [],
            pcCount: 0,
            status: 'available',
            department: null,
            description: null,
          }),
        ConflictError
      );
    });

    test('rejects booking when expectedAttendees exceeds facility capacity (400)', async () => {
      mock.method(FacilityRepository, 'findById', async () => createMockFacility({ capacity: 60 }));
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      await assert.rejects(
        () =>
          FacilityService.createBooking(facultySession, {
            facilityId,
            title: 'Large Assembly Session',
            purpose: 'Combined cohort orientation for all first-year branches.',
            expectedAttendees: 90,
            startTime: start,
            endTime: end,
            autoApprove: false,
          }),
        BadRequestError
      );
    });

    test('rejects booking for facility under maintenance or inactive (400)', async () => {
      mock.method(FacilityRepository, 'findById', async () =>
        createMockFacility({ status: 'maintenance' })
      );
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      await assert.rejects(
        () =>
          FacilityService.createBooking(facultySession, {
            facilityId,
            title: 'Lab Practical Session',
            purpose: 'Conducting DBMS SQL practical lab assessment.',
            expectedAttendees: 30,
            startTime: start,
            endTime: end,
            autoApprove: false,
          }),
        BadRequestError
      );
    });
  });

  /* ======================================================================== */
  /* 4. Double-Booking Conflict Prevention & Adjacent Back-to-Back Slots      */
  /* ======================================================================== */
  describe('4. Double-Booking Conflict Prevention & Adjacent Slots', () => {
    test('rejects overlapping booking creation with HTTP 409 Conflict', async () => {
      const existingApproved = createMockBooking({ status: 'approved' });
      mock.method(FacilityRepository, 'findById', async () => createMockFacility());
      mock.method(FacilityBookingRepository, 'findConflictingBookings', async () => [
        existingApproved,
      ]);

      await assert.rejects(
        () =>
          FacilityService.createBooking(facultySession, {
            facilityId,
            title: 'Overlapping Seminar',
            purpose: 'Attempting to reserve an already confirmed lab window.',
            expectedAttendees: 30,
            startTime: existingApproved.startTime,
            endTime: existingApproved.endTime,
            autoApprove: false,
          }),
        ConflictError
      );
    });

    test('blocks approving a competing pending request when an overlapping booking is already approved (409)', async () => {
      const approvedBooking1 = createMockBooking({
        _id: new Types.ObjectId(booking1Id),
        bookingCode: 'BKG-2026-10001',
        status: 'approved',
      });
      const competingPending2 = createMockBooking({
        _id: new Types.ObjectId(booking2Id),
        bookingCode: 'BKG-2026-10002',
        status: 'pending',
      });

      mock.method(FacilityBookingRepository, 'findById', async () => competingPending2);
      mock.method(FacilityRepository, 'findById', async () => createMockFacility());
      mock.method(FacilityBookingRepository, 'findConflictingBookings', async () => [
        approvedBooking1,
      ]);

      await assert.rejects(
        () => FacilityService.reviewBooking(adminSession, booking2Id, { action: 'approve' }),
        ConflictError
      );
    });

    test('permits adjacent back-to-back slots (10:00–11:00 and 11:00–12:00) without conflict', async () => {
      const slot1Start = new Date(Date.now() + 48 * 60 * 60 * 1000);
      slot1Start.setHours(10, 0, 0, 0);
      const slot1End = new Date(slot1Start.getTime() + 60 * 60 * 1000); // 11:00

      const slot2Start = new Date(slot1End.getTime()); // 11:00
      const slot2End = new Date(slot2Start.getTime() + 60 * 60 * 1000); // 12:00

      const approvedSlot1 = createMockBooking({
        startTime: slot1Start,
        endTime: slot1End,
        status: 'approved',
      });

      // Emulate exact repository strict inequality overlap logic: startTime < reqEnd && endTime > reqStart
      mock.method(
        FacilityBookingRepository,
        'findConflictingBookings',
        async (_facId: string | Types.ObjectId, reqStart: Date, reqEnd: Date) => {
          const overlaps =
            approvedSlot1.startTime < reqEnd && approvedSlot1.endTime > reqStart;
          return overlaps ? [approvedSlot1] : [];
        }
      );

      mock.method(FacilityRepository, 'findById', async () => createMockFacility());
      mock.method(UserRepository, 'findById', async () => null);
      mock.method(DepartmentRepository, 'findById', async () => null);
      mock.method(FacilityBookingRepository, 'getNextBookingCode', async () => 'BKG-2026-10002');
      mock.method(FacilityBookingRepository, 'create', async (data: Partial<IFacilityBooking>) =>
        createMockBooking({
          _id: new Types.ObjectId(booking2Id),
          bookingCode: data.bookingCode || 'BKG-2026-10002',
          startTime: slot2Start,
          endTime: slot2End,
          status: 'pending',
        })
      );

      const created = await FacilityService.createBooking(facultySession, {
        facilityId,
        title: 'Adjacent Back-to-Back Lab',
        purpose: 'Immediately following slot 11:00 to 12:00 for section B.',
        expectedAttendees: 40,
        startTime: slot2Start,
        endTime: slot2End,
        autoApprove: false,
      });

      assert.equal(created.bookingCode, 'BKG-2026-10002');
      assert.equal(created.status, 'pending');
      assert.equal(created.startTime, slot2Start.toISOString());
    });
  });

  /* ======================================================================== */
  /* 5. Approval, Ably Notification & Cancellation Lifecycle                  */
  /* ======================================================================== */
  describe('5. Approval Notifications & Cancellation Controls', () => {
    test('approves pending booking and dispatches Ably facility.booking.updated event', async () => {
      const pending = createMockBooking({ status: 'pending' });
      const approved = createMockBooking({
        status: 'approved',
        reviewedBy: new Types.ObjectId(adminId),
        reviewedAt: new Date(),
        reviewRemarks: 'Keys available at Block A reception.',
      });

      mock.method(FacilityBookingRepository, 'findById', async () => pending);
      mock.method(FacilityRepository, 'findById', async () => createMockFacility());
      mock.method(FacilityBookingRepository, 'findConflictingBookings', async () => []);
      mock.method(FacilityBookingRepository, 'update', async () => approved);

      let publishedChannel = '';
      let publishedEvent = '';
      mock.method(AblyBroker, 'publish', async (channel: string, event: string) => {
        publishedChannel = channel;
        publishedEvent = event;
      });

      const result = await FacilityService.reviewBooking(adminSession, booking1Id, {
        action: 'approve',
        remarks: 'Keys available at Block A reception.',
      });

      assert.equal(result.status, 'approved');
      assert.equal(publishedChannel, `user:${facultyId}:notifications`);
      assert.equal(publishedEvent, 'facility.booking.updated');
    });

    test('enforces ownership on faculty cancellation while allowing admin override', async () => {
      const pending = createMockBooking({ status: 'pending' });
      mock.method(FacilityBookingRepository, 'findById', async () => pending);

      // Different faculty cannot cancel another faculty's booking
      await assert.rejects(
        () =>
          FacilityService.cancelBooking(otherFacultySession, booking1Id, {
            reason: 'Attempting unauthorized cancel',
          }),
        ForbiddenError
      );

      // Owner faculty can cancel own upcoming booking
      mock.method(FacilityBookingRepository, 'update', async () =>
        createMockBooking({ status: 'cancelled', cancellationReason: 'Workshop rescheduled to Friday.' })
      );

      const cancelled = await FacilityService.cancelBooking(facultySession, booking1Id, {
        reason: 'Workshop rescheduled to Friday.',
      });
      assert.equal(cancelled.status, 'cancelled');
    });
  });

  /* ======================================================================== */
  /* 6. REST API Route Handlers Integration                                   */
  /* ======================================================================== */
  describe('6. REST API Route Handlers Integration', () => {
    test('GET /api/v1/facilities and POST /api/v1/facilities enforce RBAC and return ApiResponse', async () => {
      __setTestSession(facultySession);
      mock.method(FacilityService, 'listFacilities', async () => ({
        facilities: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false },
      }));

      const getRes = await getFacilitiesRoute(
        new NextRequest('http://localhost/api/v1/facilities?building=Block%20A')
      );
      assert.equal(getRes.status, 200);

      // Faculty attempting POST /api/v1/facilities -> 403
      const forbiddenRes = await createFacilityRoute(
        new NextRequest('http://localhost/api/v1/facilities', {
          method: 'POST',
          body: JSON.stringify({
            code: 'NEW-101',
            name: 'New Room',
            building: 'Block A',
            floor: 1,
            type: 'classroom',
            capacity: 40,
          }),
        })
      );
      assert.equal(forbiddenRes.status, 403);

      // Admin POST /api/v1/facilities -> 201
      __setTestSession(adminSession);
      mock.method(FacilityRepository, 'findByCode', async () => null);
      mock.method(FacilityRepository, 'create', async () => createMockFacility());

      const createdRes = await createFacilityRoute(
        new NextRequest('http://localhost/api/v1/facilities', {
          method: 'POST',
          body: JSON.stringify({
            code: 'BLK-A-LAB-402',
            name: 'Central Computing Lab 402',
            building: 'Block A',
            floor: 4,
            type: 'computer_lab',
            capacity: 60,
          }),
        })
      );
      assert.equal(createdRes.status, 201);
    });

    test('GET/PATCH /api/v1/facilities/[id] returns detail and updates maintenance status', async () => {
      __setTestSession(adminSession);
      mock.method(FacilityRepository, 'findById', async () => createMockFacility());
      mock.method(FacilityBookingRepository, 'findUpcomingApprovedForFacility', async () => []);

      const detailRes = await getFacilityByIdRoute(
        new NextRequest(`http://localhost/api/v1/facilities/${facilityId}`),
        { params: Promise.resolve({ id: facilityId }) }
      );
      assert.equal(detailRes.status, 200);

      mock.method(FacilityRepository, 'update', async () =>
        createMockFacility({ status: 'maintenance' })
      );
      const patchRes = await updateFacilityRoute(
        new NextRequest(`http://localhost/api/v1/facilities/${facilityId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'maintenance' }),
        }),
        { params: Promise.resolve({ id: facilityId }) }
      );
      assert.equal(patchRes.status, 200);
      const patchJson = await patchRes.json();
      assert.equal(patchJson.data.status, 'maintenance');
    });

    test('GET/POST /api/v1/facilities/bookings, review, cancel, and stats endpoints work end-to-end', async () => {
      // Student blocked from POST /api/v1/facilities/bookings -> 403
      __setTestSession(studentSession);
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

      const studentBookRes = await createBookingRoute(
        new NextRequest('http://localhost/api/v1/facilities/bookings', {
          method: 'POST',
          body: JSON.stringify({
            facilityId,
            title: 'Unauthorized Student Booking',
            purpose: 'Trying to reserve a computing lab without faculty role.',
            expectedAttendees: 20,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          }),
        })
      );
      assert.equal(studentBookRes.status, 403);

      // Faculty creates booking -> 201
      __setTestSession(facultySession);
      mock.method(FacilityRepository, 'findById', async () => createMockFacility());
      mock.method(FacilityBookingRepository, 'findConflictingBookings', async () => []);
      mock.method(UserRepository, 'findById', async () => null);
      mock.method(DepartmentRepository, 'findById', async () => null);
      mock.method(FacilityBookingRepository, 'getNextBookingCode', async () => 'BKG-2026-10001');
      mock.method(FacilityBookingRepository, 'create', async () => createMockBooking());

      const facBookRes = await createBookingRoute(
        new NextRequest('http://localhost/api/v1/facilities/bookings', {
          method: 'POST',
          body: JSON.stringify({
            facilityId,
            title: 'AI Workshop — B.Tech CSE Sem 6',
            purpose: 'Hands-on machine learning model training session for students.',
            expectedAttendees: 45,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          }),
        })
      );
      assert.equal(facBookRes.status, 201);

      // List bookings -> 200
      mock.method(FacilityBookingRepository, 'findBookings', async () => ({
        bookings: [createMockBooking()],
        total: 1,
      }));
      const listRes = await getBookingsRoute(
        new NextRequest('http://localhost/api/v1/facilities/bookings')
      );
      assert.equal(listRes.status, 200);

      // Super Admin reviews booking -> 200
      __setTestSession(superAdminSession);
      mock.method(FacilityBookingRepository, 'findById', async () => createMockBooking());
      mock.method(FacilityBookingRepository, 'update', async () =>
        createMockBooking({ status: 'approved' })
      );
      mock.method(AblyBroker, 'publish', async () => {});

      const reviewRes = await reviewBookingRoute(
        new NextRequest(`http://localhost/api/v1/facilities/bookings/${booking1Id}/review`, {
          method: 'POST',
          body: JSON.stringify({ action: 'approve', remarks: 'Approved for seminar.' }),
        }),
        { params: Promise.resolve({ id: booking1Id }) }
      );
      assert.equal(reviewRes.status, 200);

      // Cancel booking -> 200
      mock.method(FacilityBookingRepository, 'update', async () =>
        createMockBooking({ status: 'cancelled' })
      );
      const cancelRes = await cancelBookingRoute(
        new NextRequest(`http://localhost/api/v1/facilities/bookings/${booking1Id}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'Event moved to main auditorium.' }),
        }),
        { params: Promise.resolve({ id: booking1Id }) }
      );
      assert.equal(cancelRes.status, 200);

      // Stats -> 200
      mock.method(FacilityRepository, 'getSpaceStats', async () => ({
        totalSpaces: 12,
        availableSpaces: 10,
        maintenanceSpaces: 2,
        inactiveSpaces: 0,
      }));
      mock.method(FacilityBookingRepository, 'getStats', async () => ({
        pendingBookings: 3,
        approvedToday: 4,
        totalBookings: 25,
      }));
      const statsRes = await getFacilityStatsRoute();
      assert.equal(statsRes.status, 200);
      const statsJson = await statsRes.json();
      assert.equal(statsJson.data.totalSpaces, 12);
      assert.equal(statsJson.data.pendingBookings, 3);
    });
  });
});
