/**
 * Phase 5.8: Student Request Tracker Frontend & Portal Integration Test Suite (MOD-13).
 *
 * Verifies:
 * 1. RequestStatusStepper: Workflow stages, visual progress, action required & rejection alerts, audit history.
 * 2. StudentRequestComposeModal: Category cards, contextual fields, attachment dropzone.
 * 3. StudentRequestDetailModal: Applicant snapshot, category specifics, attachments, fulfillment & rejection cards.
 * 4. StudentRequestsView: Dashboard metric cards, category filter tabs, requisitions feed, empty state.
 * 5. AdminRequestsQueueView: Departmental scope indicator, triage metrics, queue table, search & filters.
 * 6. AdminRequestReviewModal: Permitted actions per status, remarks validation, fulfillment inputs.
 * 7. Server Pages RBAC & Mounting: StudentRequestsPage and AdminRequestsPage session authorization.
 *
 * Conforms to Node.js built-in test runner (node:test + node:assert/strict).
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// UI Components
import { RequestStatusStepper } from '../../src/components/requests/request-status-stepper';
import { StudentRequestComposeModal } from '../../src/components/requests/student-request-compose-modal';
import { StudentRequestDetailModal } from '../../src/components/requests/student-request-detail-modal';
import { StudentRequestsView } from '../../src/components/requests/student-requests-view';
import { AdminRequestsQueueView } from '../../src/components/requests/admin-requests-queue-view';
import { AdminRequestReviewModal } from '../../src/components/requests/admin-request-review-modal';

// Server Pages
import StudentRequestsPage from '../../src/app/(student)/student/requests/page';
import AdminRequestsPage from '../../src/app/(admin)/admin/requests/page';

// Repositories & Services
import { ServiceRequestService } from '../../src/lib/services/service-request.service';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { __setTestSession } from '../../src/lib/auth/server';

// Types
import type { UserSession, UserDTO } from '../../src/types/user';
import type { ServiceRequestDTO, ServiceRequestStatsDTO } from '../../src/types/service-request';

const studentId = '6730a005f8b1a2001a000001';
const adminId = '6730a005f8b1a2001a000080';
const cseDeptId = '6730a005f8b1a2001a000010';

const studentSession: UserSession = {
  userId: studentId,
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  role: 'student',
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

const mockUserDTO: UserDTO = {
  id: studentId,
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  role: 'student',
  status: 'active',
  isProfileComplete: true,
  departmentId: cseDeptId,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockRequestDTO: ServiceRequestDTO = {
  id: '6730a005f8b1a2001a000300',
  ticketNumber: 'REQ-2026-00042',
  studentId,
  studentSnapshot: {
    fullName: 'Rahul Verma',
    enrollmentNo: 'ENR-2021-0045',
    department: 'Computer Science and Engineering',
    branch: 'B.Tech CSE',
    section: 'A',
    semester: 6,
    email: 'rahul.verma@axiscolleges.in',
  },
  category: 'bonafide',
  subject: 'Bonafide Certificate for National Scholarship Portal',
  details: {
    purpose: 'scholarship',
  },
  attachments: [
    {
      name: 'Fee_Receipt_2026.pdf',
      url: 'https://res.cloudinary.com/axis/fee.pdf',
      fileType: 'application/pdf',
      size: 204800,
    },
  ],
  status: 'submitted',
  priority: 'standard',
  reviewHistory: [
    {
      action: 'submitted',
      actorId: studentId,
      actorRole: 'student',
      actorName: 'Rahul Verma',
      remarks: 'Application submitted by student.',
      timestamp: '2026-11-18T10:00:00.000Z',
    },
  ],
  fulfillmentDocument: null,
  rejectionReason: null,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

const mockStats: ServiceRequestStatsDTO = {
  total: 6,
  submitted: 2,
  underReview: 1,
  actionRequired: 1,
  approved: 1,
  rejected: 1,
  fulfilled: 0,
};

describe('Phase 5.8: Student Request Tracker Frontend Integration Suite', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(null);
  });

  /* ======================================================================== */
  /* 1. RequestStatusStepper                                                   */
  /* ======================================================================== */
  describe('1. RequestStatusStepper', () => {
    test('renders standard workflow steps and review history', () => {
      const html = renderToStaticMarkup(
        React.createElement(RequestStatusStepper, {
          status: 'under_review',
          reviewHistory: mockRequestDTO.reviewHistory,
        })
      );

      assert.ok(html.includes('Submitted'));
      assert.ok(html.includes('Under Review'));
      assert.ok(html.includes('Approved'));
      assert.ok(html.includes('Fulfilled'));
      assert.ok(html.includes('Review Audit Trail'));
      assert.ok(html.includes('Application submitted by student.'));
    });

    test('renders action required alert banner', () => {
      const html = renderToStaticMarkup(
        React.createElement(RequestStatusStepper, {
          status: 'action_required',
          reviewHistory: mockRequestDTO.reviewHistory,
        })
      );

      assert.ok(html.includes('Action Required from Student'));
      assert.ok(html.includes('requested clarification or additional documentation'));
    });

    test('renders rejection alert banner when rejected', () => {
      const html = renderToStaticMarkup(
        React.createElement(RequestStatusStepper, {
          status: 'rejected',
          reviewHistory: mockRequestDTO.reviewHistory,
        })
      );

      assert.ok(html.includes('Application Rejected'));
      assert.ok(html.includes('This request was rejected during administrative evaluation'));
    });
  });

  /* ======================================================================== */
  /* 2. StudentRequestComposeModal                                             */
  /* ======================================================================== */
  describe('2. StudentRequestComposeModal', () => {
    test('renders requisition categories and contextual input elements', () => {
      const html = renderToStaticMarkup(
        React.createElement(StudentRequestComposeModal, {
          isOpen: true,
          onClose: () => {},
          onSuccess: () => {},
        })
      );

      assert.ok(html.includes('Submit Administrative Service Request'));
      assert.ok(html.includes('Bonafide Certificate'));
      assert.ok(html.includes('Leave Application'));
      assert.ok(html.includes('ID Replacement'));
      assert.ok(html.includes('Special Lab Access'));
      assert.ok(html.includes('General Inquiry'));
      assert.ok(html.includes('Subject / Purpose Summary'));
      assert.ok(html.includes('Supporting Evidence / Attachments'));
    });
  });

  /* ======================================================================== */
  /* 3. StudentRequestDetailModal                                              */
  /* ======================================================================== */
  describe('3. StudentRequestDetailModal', () => {
    test('renders applicant snapshot and attachment links', () => {
      const html = renderToStaticMarkup(
        React.createElement(StudentRequestDetailModal, {
          request: mockRequestDTO,
          isOpen: true,
          onClose: () => {},
        })
      );

      assert.ok(html.includes('REQ-2026-00042'));
      assert.ok(html.includes('Rahul Verma'));
      assert.ok(html.includes('ENR-2021-0045'));
      assert.ok(html.includes('Computer Science and Engineering'));
      assert.ok(html.includes('Fee_Receipt_2026.pdf'));
    });

    test('renders digital fulfillment document card when fulfilled', () => {
      const fulfilledReq: ServiceRequestDTO = {
        ...mockRequestDTO,
        status: 'fulfilled',
        fulfillmentDocument: {
          name: 'Verified Bonafide Certificate.pdf',
          url: 'https://res.cloudinary.com/axis/cert.pdf',
          issuedAt: '2026-11-18T12:00:00.000Z',
          referenceId: 'AXIS/CERT/2026/089',
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(StudentRequestDetailModal, {
          request: fulfilledReq,
          isOpen: true,
          onClose: () => {},
        })
      );

      assert.ok(html.includes('Digital Document Issued'));
      assert.ok(html.includes('Verified Bonafide Certificate.pdf'));
      assert.ok(html.includes('AXIS/CERT/2026/089'));
      assert.ok(html.includes('Download'));
    });

    test('renders rejection reason when rejected', () => {
      const rejectedReq: ServiceRequestDTO = {
        ...mockRequestDTO,
        status: 'rejected',
        rejectionReason: 'Academic fee dues outstanding for Semester 6.',
      };

      const html = renderToStaticMarkup(
        React.createElement(StudentRequestDetailModal, {
          request: rejectedReq,
          isOpen: true,
          onClose: () => {},
        })
      );

      assert.ok(html.includes('Official Rejection Remarks'));
      assert.ok(html.includes('Academic fee dues outstanding for Semester 6.'));
    });
  });

  /* ======================================================================== */
  /* 4. StudentRequestsView                                                    */
  /* ======================================================================== */
  describe('4. StudentRequestsView', () => {
    test('renders metric cards, filter pills, and request cards', () => {
      const html = renderToStaticMarkup(
        React.createElement(StudentRequestsView, {
          user: mockUserDTO,
          initialRequests: [mockRequestDTO],
          initialStats: mockStats,
        })
      );

      assert.ok(html.includes('Service Request Tracker'));
      assert.ok(html.includes('Total Applications'));
      assert.ok(html.includes('Under Review'));
      assert.ok(html.includes('Action Required'));
      assert.ok(html.includes('Fulfilled / Approved'));
      assert.ok(html.includes('REQ-2026-00042'));
      assert.ok(html.includes('Bonafide Certificate for National Scholarship Portal'));
    });

    test('renders empty state when no requests exist', () => {
      const html = renderToStaticMarkup(
        React.createElement(StudentRequestsView, {
          user: mockUserDTO,
          initialRequests: [],
          initialStats: null,
        })
      );

      assert.ok(html.includes('No Service Requests Found'));
      assert.ok(html.includes('Submit Application'));
    });
  });

  /* ======================================================================== */
  /* 5. AdminRequestsQueueView                                                 */
  /* ======================================================================== */
  describe('5. AdminRequestsQueueView', () => {
    test('renders administrative queue table with department badge', () => {
      const html = renderToStaticMarkup(
        React.createElement(AdminRequestsQueueView, {
          user: { ...mockUserDTO, role: 'admin' },
          initialRequests: [mockRequestDTO],
          initialStats: mockStats,
          departmentScope: 'Computer Science and Engineering',
        })
      );

      assert.ok(html.includes('Administrative Service Queue'));
      assert.ok(html.includes('Dept: Computer Science and Engineering'));
      assert.ok(html.includes('Total In Queue'));
      assert.ok(html.includes('Pending Triage'));
      assert.ok(html.includes('REQ-2026-00042'));
      assert.ok(html.includes('Review'));
    });
  });

  /* ======================================================================== */
  /* 6. AdminRequestReviewModal                                                */
  /* ======================================================================== */
  describe('6. AdminRequestReviewModal', () => {
    test('renders permitted administrative review actions and remarks field', () => {
      const html = renderToStaticMarkup(
        React.createElement(AdminRequestReviewModal, {
          request: mockRequestDTO,
          isOpen: true,
          onClose: () => {},
          onSuccess: () => {},
        })
      );

      assert.ok(html.includes('Reviewing student requisition'));
      assert.ok(html.includes('Administrative Action &amp; Triage'));
      assert.ok(html.includes('Mark Under Review'));
      assert.ok(html.includes('Approve Application'));
      assert.ok(html.includes('Reject Application'));
      assert.ok(html.includes('Confirm Action'));
    });
  });

  /* ======================================================================== */
  /* 7. Server Pages RBAC & Mounting                                          */
  /* ======================================================================== */
  describe('7. Server Pages RBAC & Mounting', () => {
    test('StudentRequestsPage mounts successfully for authenticated student', async () => {
      __setTestSession(studentSession);
      mock.method(UserRepository, 'findById', async () => null);
      mock.method(ServiceRequestService, 'listStudentRequests', async () => ({
        requests: [mockRequestDTO],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1, hasMore: false },
      }));
      mock.method(ServiceRequestService, 'getRequestStats', async () => mockStats);

      const pageJSX = await StudentRequestsPage();
      const html = renderToStaticMarkup(pageJSX);

      assert.ok(html.includes('Service Request Tracker'));
      assert.ok(html.includes('REQ-2026-00042'));
    });

    test('AdminRequestsPage mounts successfully for authenticated admin', async () => {
      __setTestSession(adminSession);
      mock.method(UserRepository, 'findById', async () => null);
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: '6730a005f8b1a2001a000010',
        name: 'Computer Science and Engineering',
      }));
      mock.method(ServiceRequestService, 'listAdminQueue', async () => ({
        requests: [mockRequestDTO],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1, hasMore: false },
      }));
      mock.method(ServiceRequestService, 'getRequestStats', async () => mockStats);

      const pageJSX = await AdminRequestsPage();
      const html = renderToStaticMarkup(pageJSX);

      assert.ok(html.includes('Administrative Service Queue'));
      assert.ok(html.includes('REQ-2026-00042'));
    });

    test('StudentRequestsPage rejects unauthorized faculty access', async () => {
      __setTestSession({
        userId: '6730a005f8b1a2001a000050',
        email: 'faculty@axiscolleges.in',
        fullName: 'Faculty Member',
        role: 'faculty',
        status: 'active',
      });

      await assert.rejects(
        async () => {
          await StudentRequestsPage();
        },
        {
          name: 'ForbiddenError',
        }
      );
    });

    test('AdminRequestsPage rejects unauthorized student access', async () => {
      __setTestSession(studentSession);

      await assert.rejects(
        async () => {
          await AdminRequestsPage();
        },
        {
          name: 'ForbiddenError',
        }
      );
    });
  });
});
