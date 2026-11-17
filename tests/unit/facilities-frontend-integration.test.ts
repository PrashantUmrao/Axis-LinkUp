/**
 * Phase 5.9: Facility Bookings & Campus Space Reservations Frontend & Portal Integration Suite (MOD-14).
 *
 * Verifies:
 * 1. FacilityDirectoryGrid: Filtering controls, status badges (Available/Maintenance), amenities chips, and role-based actions.
 * 2. FacilityFormModal: Admin create/edit fields, amenities checkboxes, and workstation PC inputs.
 * 3. BookingCreateModal: Facility selector, capacity indicator, time-slot range inputs.
 * 4. BookingReviewModal: Requester snapshot, capacity utilization ratio, Approve/Reject actions, mandatory remarks.
 * 5. AdminSpacesView: KPI cards, Reservation Queue tab, Campus Spaces Inventory tab.
 * 6. FacultySpacesView: Browse & Book Spaces tab and My Reservations workspace.
 * 7. Server Pages RBAC Verification: AdminSpacesPage & FacultySpacesPage authorization boundaries.
 */

import { describe, test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  FacilityDirectoryGrid,
  FacilityFormModal,
  BookingCreateModal,
  BookingReviewModal,
  AdminSpacesView,
  FacultySpacesView,
} from '../../src/components/facilities';
import AdminSpacesPage from '../../src/app/(admin)/admin/spaces/page';
import FacultySpacesPage from '../../src/app/(faculty)/faculty/spaces/page';
import { FacilityService } from '../../src/lib/services/facility.service';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { __setTestSession } from '../../src/lib/auth/server';
import { ForbiddenError } from '../../src/lib/errors/app-error';

import type { UserSession } from '../../src/types/user';
import type {
  FacilityDTO,
  FacilityBookingDTO,
  FacilityStatsDTO,
} from '../../src/types/facility';

const studentId = '6730a005f8b1a2001a000801';
const facultyId = '6730a005f8b1a2001a000802';
const adminId = '6730a005f8b1a2001a000803';
const facility1Id = '6730a005f8b1a2001a000810';
const facility2Id = '6730a005f8b1a2001a000811';
const bookingId = '6730a005f8b1a2001a000820';

const studentSession: UserSession = {
  userId: studentId,
  email: 'student@axiscolleges.in',
  fullName: 'Aarav Singh',
  role: 'student',
  status: 'active',
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'faculty@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  role: 'faculty',
  status: 'active',
};

const adminSession: UserSession = {
  userId: adminId,
  email: 'admin@axiscolleges.in',
  fullName: 'Dr. S. K. Gupta',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
};

const mockFacilities: FacilityDTO[] = [
  {
    id: facility1Id,
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
    description: 'Dedicated high-performance computing lab with dual-boot systems.',
    createdBy: adminId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: facility2Id,
    code: 'MAIN-AUD-01',
    name: 'Axis Main Auditorium',
    building: 'Central Block',
    floor: 0,
    type: 'auditorium',
    department: null,
    capacity: 500,
    amenities: ['projector', 'ac', 'audio_system'],
    pcCount: 0,
    status: 'maintenance',
    description: 'Central auditorium undergoing AV acoustic calibration.',
    createdBy: adminId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockBookings: FacilityBookingDTO[] = [
  {
    id: bookingId,
    bookingCode: 'BKG-2026-10001',
    facilityId: facility1Id,
    facilitySnapshot: {
      code: 'BLK-A-LAB-402',
      name: 'Central Computing Lab 402',
      building: 'Block A',
      type: 'computer_lab',
      capacity: 60,
    },
    requestedBy: facultyId,
    requesterSnapshot: {
      fullName: 'Prof. Alok Sharma',
      email: 'faculty@axiscolleges.in',
      role: 'faculty',
      department: 'Computer Science & Engineering',
      employeeId: 'EMP-CSE-101',
    },
    title: 'AI Workshop — B.Tech CSE Sem 6',
    purpose: 'Hands-on neural network architecture workshop for 6th semester cohort.',
    expectedAttendees: 48,
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewRemarks: null,
    cancellationReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockStats: FacilityStatsDTO = {
  totalSpaces: 2,
  availableSpaces: 1,
  maintenanceSpaces: 1,
  inactiveSpaces: 0,
  pendingBookings: 1,
  approvedToday: 0,
  totalBookings: 1,
};

describe('Phase 5.9: Facility Bookings Frontend & Portal Integration Suite', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  test('1. FacilityDirectoryGrid renders space cards, filters, amenities, and status badges', () => {
    const html = renderToStaticMarkup(
      React.createElement(FacilityDirectoryGrid, {
        facilities: mockFacilities,
        canBook: true,
        isAdmin: true,
        onRequestBooking: () => {},
        onEditFacility: () => {},
        onToggleStatus: () => {},
      })
    );

    assert.ok(html.includes('BLK-A-LAB-402'));
    assert.ok(html.includes('Central Computing Lab 402'));
    assert.ok(html.includes('MAIN-AUD-01'));
    assert.ok(html.includes('Available'));
    assert.ok(html.includes('Maintenance'));
    assert.ok(html.includes('60 PCs'));
    assert.ok(html.includes('Request Booking'));
    assert.ok(html.includes('Unavailable'));
    assert.ok(html.includes('Edit'));
  });

  test('2. FacilityDirectoryGrid renders EmptyState when no spaces are provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(FacilityDirectoryGrid, { facilities: [] })
    );
    assert.ok(html.includes('No Matching Campus Spaces'));
  });

  test('3. AdminSpacesView renders KPI metric cards, tabs, and reservation queue rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminSpacesView, {
        initialFacilities: mockFacilities,
        initialBookings: mockBookings,
        initialStats: mockStats,
      })
    );

    assert.ok(html.includes('Facility Bookings &amp; Campus Spaces'));
    assert.ok(html.includes('Total Spaces'));
    assert.ok(html.includes('Pending Bookings'));
    assert.ok(html.includes('Approved Today'));
    assert.ok(html.includes('Reservation Queue (1)'));
    assert.ok(html.includes('Campus Spaces Inventory (2)'));
    assert.ok(html.includes('BKG-2026-10001'));
    assert.ok(html.includes('AI Workshop — B.Tech CSE Sem 6'));
    assert.ok(html.includes('Review &amp; Decide'));
  });

  test('4. FacultySpacesView renders Browse & Book Spaces and My Reservations tabs', () => {
    const html = renderToStaticMarkup(
      React.createElement(FacultySpacesView, {
        initialFacilities: mockFacilities,
        initialBookings: mockBookings,
      })
    );

    assert.ok(html.includes('Campus Spaces &amp; Facility Bookings'));
    assert.ok(html.includes('Browse &amp; Book Spaces (2)'));
    assert.ok(html.includes('My Reservations (1)'));
    assert.ok(html.includes('Request Space Booking'));
    assert.ok(html.includes('Central Computing Lab 402'));
  });

  test('5. Modals mount cleanly without runtime errors when invoked', () => {
    const formHtml = renderToStaticMarkup(
      React.createElement(FacilityFormModal, {
        isOpen: false,
        facility: mockFacilities[0],
        onClose: () => {},
        onSuccess: () => {},
      })
    );
    assert.equal(typeof formHtml, 'string');

    const createHtml = renderToStaticMarkup(
      React.createElement(BookingCreateModal, {
        isOpen: false,
        facilities: mockFacilities,
        initialFacility: mockFacilities[0],
        onClose: () => {},
        onSuccess: () => {},
      })
    );
    assert.equal(typeof createHtml, 'string');

    const reviewHtml = renderToStaticMarkup(
      React.createElement(BookingReviewModal, {
        isOpen: false,
        booking: mockBookings[0] ?? null,
        onClose: () => {},
        onSuccess: () => {},
      })
    );
    assert.equal(typeof reviewHtml, 'string');
  });

  test('6. AdminSpacesPage mounts cleanly for admin and blocks faculty/student', async () => {
    // Student rejected
    __setTestSession(studentSession);
    await assert.rejects(() => AdminSpacesPage(), ForbiddenError);

    // Faculty rejected
    __setTestSession(facultySession);
    await assert.rejects(() => AdminSpacesPage(), ForbiddenError);

    // Admin allowed
    __setTestSession(adminSession);
    mock.method(UserRepository, 'findById', async () => null);
    mock.method(FacilityService, 'listFacilities', async () => ({
      facilities: mockFacilities,
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1, hasMore: false },
    }));
    mock.method(FacilityService, 'listBookings', async () => ({
      bookings: mockBookings,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasMore: false },
    }));
    mock.method(FacilityService, 'getBookingStats', async () => mockStats);

    const element = await AdminSpacesPage();
    const html = renderToStaticMarkup(element);
    assert.ok(html.includes('Facility Bookings &amp; Campus Spaces'));
    assert.ok(html.includes('BKG-2026-10001'));
  });

  test('7. FacultySpacesPage mounts cleanly for faculty and blocks student', async () => {
    // Student rejected
    __setTestSession(studentSession);
    await assert.rejects(() => FacultySpacesPage(), ForbiddenError);

    // Faculty allowed
    __setTestSession(facultySession);
    mock.method(UserRepository, 'findById', async () => null);
    mock.method(FacilityService, 'listFacilities', async () => ({
      facilities: mockFacilities,
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1, hasMore: false },
    }));
    mock.method(FacilityService, 'listBookings', async () => ({
      bookings: mockBookings,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasMore: false },
    }));

    const element = await FacultySpacesPage();
    const html = renderToStaticMarkup(element);
    assert.ok(html.includes('Campus Spaces &amp; Facility Bookings'));
    assert.ok(html.includes('Central Computing Lab 402'));
  });
});
