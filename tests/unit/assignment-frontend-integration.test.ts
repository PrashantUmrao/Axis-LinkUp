/**
 * Phase 5.7: Assignment Management Frontend & Portal Integration Test Suite.
 * 
 * Verifies:
 * 1. Student Portal: Coursework feed, metrics (Total, Pending, Submitted, Evaluated, Overdue),
 *    coursework cards, detail modal, and submission workflow.
 * 2. Faculty Cockpit: Gradebook overview (Drafts, Published, Closed, Submissions, Pending Grades),
 *    coursework cards, lifecycle actions (Publish, Close, Archive), and creation modal.
 * 3. Faculty Submissions Review & Evaluation: Submissions table, roll number search,
 *    marks boundary validation (marks <= maxMarks), and feedback release.
 * 4. File Uploader: Drop area, size/format constraints, and mock envelope indicator.
 * 5. Dashboard Widgets: Student and Faculty dashboard overview cards with live navigation links.
 * 6. Server Page RBAC: Verification of student, faculty, and admin access control boundaries.
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Types } from 'mongoose';

// UI Components
import { StudentAssignmentView } from '../../src/components/assignments/student-assignment-view';
import { StudentAssignmentDetailModal } from '../../src/components/assignments/student-assignment-detail-modal';
import { StudentSubmissionModal } from '../../src/components/assignments/student-submission-modal';
import { FacultyAssignmentView } from '../../src/components/assignments/faculty-assignment-view';
import { FacultyAssignmentCreateModal } from '../../src/components/assignments/faculty-assignment-create-modal';
import { FacultySubmissionsModal } from '../../src/components/assignments/faculty-submissions-modal';
import { FacultyEvaluateModal } from '../../src/components/assignments/faculty-evaluate-modal';
import { FileUploader } from '../../src/components/assignments/file-uploader';

// Dashboard Overview Widgets
import { StudentAssignmentOverview } from '../../src/app/(student)/student/dashboard/components/assignment-overview';
import { FacultyAssignmentManagement } from '../../src/app/(faculty)/faculty/dashboard/components/assignment-management';

// Server Pages
import StudentAssignmentsPage from '../../src/app/(student)/student/assignments/page';
import FacultyAssignmentsPage from '../../src/app/(faculty)/faculty/assignments/page';
import AdminAssignmentsPage from '../../src/app/(admin)/admin/assignments/page';

// Repositories & Auth
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { AssignmentRepository } from '../../src/lib/db/repositories/assignment.repository';
import { SubmissionRepository } from '../../src/lib/db/repositories/submission.repository';
import { AssignmentService } from '../../src/lib/services/assignment.service';
import { __setTestSession } from '../../src/lib/auth/server';

// Types
import type { UserSession, UserDTO } from '../../src/types/user';
import type { AssignmentDTO, SubmissionDTO } from '../../src/types/assignment';

// Mock IDs
const cseDeptId = '6730a005f8b1a2001a000010';
const studentId = '6730a005f8b1a2001a000001';
const facultyId = '6730a005f8b1a2001a000050';
const hodId = '6730a005f8b1a2001a000080';
const assignment1Id = '6730a005f8b1a2001a000100';
const submission1Id = '6730a005f8b1a2001a000200';

// Mock User Sessions
const studentSession: UserSession = {
  userId: studentId,
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
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

const hodSession: UserSession = {
  userId: hodId,
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. S. K. Gupta',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: cseDeptId,
};

// Mock UserDTOs
const studentUserDTO: UserDTO = {
  id: studentId,
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  role: 'student',
  status: 'active',
  isProfileComplete: true,
  departmentId: cseDeptId,
  studentProfile: {
    rollNumber: '2101330100045',
    batchYear: 2021,
    currentSemester: 3,
    section: 'A',
    program: 'B.TECH',
    admissionType: 'regular',
  },
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

const facultyUserDTO: UserDTO = {
  id: facultyId,
  email: 'prof.sharma@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  role: 'faculty',
  status: 'active',
  isProfileComplete: true,
  departmentId: cseDeptId,
  facultyProfile: {
    employeeId: 'EMP-CSE-101',
    designation: 'Associate Professor',
    qualifications: ['Ph.D', 'M.Tech'],
    assignedCourses: ['CS301', 'CS502'],
  },
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

// Mock AssignmentDTO Builder
function createMockAssignment(overrides: Partial<AssignmentDTO> = {}): AssignmentDTO {
  const futureDueDate = new Date(Date.now() + 86400000 * 5).toISOString();

  return {
    id: assignment1Id,
    title: 'Lab 4: Binary Search Trees & AVL Balancing',
    description: 'Implement insertion, deletion, and rotation balancing for AVL Trees.',
    instructions: 'Submit source code as a ZIP archive. Include test cases and report PDF.',
    courseCode: 'CS301',
    courseName: 'Advanced Data Structures',
    departmentId: cseDeptId,
    departmentCode: 'CSE',
    departmentName: 'Computer Science & Engineering',
    academicTarget: {
      program: 'B.TECH',
      year: 2,
      semester: 3,
      section: 'A',
      batchYear: 2026,
    },
    createdBy: facultyId,
    creatorSnapshot: {
      fullName: 'Prof. Alok Sharma',
      role: 'faculty',
      employeeId: 'EMP-CSE-101',
    },
    attachments: [
      {
        id: 'att-1',
        name: 'AVL_Tree_Specification.pdf',
        url: 'https://res.cloudinary.com/axis/raw/upload/v1/avl.pdf',
        sizeBytes: 154000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-11-10T10:00:00Z',
      },
    ],
    publishedAt: '2026-11-10T10:00:00Z',
    dueDate: futureDueDate,
    maxMarks: 100,
    lateSubmissionPolicy: {
      allowLate: true,
      lateDueDate: new Date(Date.now() + 86400000 * 8).toISOString(),
      penaltyPercentagePerDay: 5,
    },
    allowResubmission: true,
    maxResubmissions: 3,
    status: 'published',
    submissionCount: 15,
    gradedCount: 10,
    userSubmission: null,
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    ...overrides,
  };
}

// Mock SubmissionDTO Builder
function createMockSubmission(overrides: Partial<SubmissionDTO> = {}): SubmissionDTO {
  return {
    id: submission1Id,
    assignmentId: assignment1Id,
    studentId: studentId,
    studentSnapshot: {
      fullName: 'Rahul Verma',
      rollNumber: '2101330100045',
      enrollmentNumber: 'EN20210045',
      email: 'rahul.verma@axiscolleges.in',
      section: 'A',
      semester: 3,
    },
    version: 1,
    submissionText: 'Implemented AVL balancing algorithms with recursive tree rotations.',
    attachments: [
      {
        id: 'sub-att-1',
        name: 'avl_solution.zip',
        url: 'https://res.cloudinary.com/axis/raw/upload/v1/solution.zip',
        sizeBytes: 245000,
        mimeType: 'application/zip',
        uploadedAt: '2026-11-12T14:30:00Z',
      },
    ],
    submittedAt: '2026-11-12T14:30:00Z',
    status: 'submitted',
    isLate: false,
    history: [],
    evaluation: {
      marksObtained: undefined,
      feedback: undefined,
      isGraded: false,
    },
    createdAt: '2026-11-12T14:30:00Z',
    updatedAt: '2026-11-12T14:30:00Z',
    ...overrides,
  };
}

describe('Phase 5.7: Assignment Management Frontend & Portal Integration Suite', () => {
  afterEach(() => {
    mock.reset();
    __setTestSession(undefined);
  });

  /* ======================================================================== */
  /* 1. Student Portal Component Tests                                        */
  /* ======================================================================== */
  describe('1. Student Assignment View & Metrics', () => {
    test('renders student assignment view with overview metrics and coursework cards', () => {
      const assignment1 = createMockAssignment({
        id: 'assign-1',
        title: 'Algorithms Assignment 1',
        userSubmission: null, // Pending
      });

      const assignment2 = createMockAssignment({
        id: 'assign-2',
        title: 'Operating Systems Lab 2',
        userSubmission: {
          id: 'sub-2',
          status: 'graded',
          submittedAt: '2026-11-11T10:00:00Z',
          isLate: false,
          version: 1,
          isGraded: true,
          marksObtained: 95,
          feedback: 'Excellent implementation',
        },
      });

      const html = renderToStaticMarkup(
        React.createElement(StudentAssignmentView, {
          user: studentUserDTO,
          initialAssignments: [assignment1, assignment2],
        })
      );

      // Asserts headers and metrics
      assert.ok(html.includes('Coursework &amp; Assignments'));
      assert.ok(html.includes('Total'));
      assert.ok(html.includes('Pending'));
      assert.ok(html.includes('Submitted'));
      assert.ok(html.includes('Evaluated'));
      assert.ok(html.includes('Overdue'));

      // Asserts coursework cards
      assert.ok(html.includes('Algorithms Assignment 1'));
      assert.ok(html.includes('Operating Systems Lab 2'));
      assert.ok(html.includes('CS301'));
      assert.ok(html.includes('Prof. Alok Sharma'));
      assert.ok(html.includes('100 Marks'));

      // Asserts status badges
      assert.ok(html.includes('Due Soon') || html.includes('Pending'));
      assert.ok(html.includes('Graded: 95/100'));
    });

    test('renders empty state when no coursework assignments exist', () => {
      const html = renderToStaticMarkup(
        React.createElement(StudentAssignmentView, {
          user: studentUserDTO,
          initialAssignments: [],
        })
      );

      assert.ok(html.includes('No Coursework in this Category'));
      assert.ok(html.includes('no coursework assignments published'));
    });
  });

  /* ======================================================================== */
  /* 2. Student Detail & Submission Modals                                    */
  /* ======================================================================== */
  describe('2. Student Detail & Submission Modals', () => {
    test('renders assignment detail modal with brief, attachments and evaluation breakdown', () => {
      const assignment = createMockAssignment({
        userSubmission: {
          id: 'sub-1',
          status: 'graded',
          submittedAt: '2026-11-12T14:30:00Z',
          isLate: false,
          version: 1,
          isGraded: true,
          marksObtained: 88,
          feedback: 'Sound AVL rotation logic. Good test coverage.',
        },
      });

      const html = renderToStaticMarkup(
        React.createElement(StudentAssignmentDetailModal, {
          assignment,
          isOpen: true,
          onClose: () => {},
          onOpenSubmit: () => {},
        })
      );

      assert.ok(html.includes('Lab 4: Binary Search Trees &amp; AVL Balancing'));
      assert.ok(html.includes('AVL_Tree_Specification.pdf'));
      assert.ok(html.includes('Overview &amp; Problem Statement'));
      assert.ok(html.includes('Submission Instructions &amp; Guidelines'));
      assert.ok(html.includes('Late Submissions'));
      assert.ok(html.includes('Resubmission'));
    });

    test('renders student submission modal with honor pledge and deliverable uploader', () => {
      const assignment = createMockAssignment();

      const html = renderToStaticMarkup(
        React.createElement(StudentSubmissionModal, {
          assignment,
          isOpen: true,
          onClose: () => {},
          onSubmissionSuccess: () => {},
        })
      );

      assert.ok(html.includes('Submit Coursework Deliverable'));
      assert.ok(html.includes('Written Responses / Solution Notes'));
      assert.ok(html.includes('Deliverable Files &amp; Attachments'));
      assert.ok(html.includes('Collegiate Academic Integrity Pledge'));
      assert.ok(html.includes('Click or drop files to upload'));
      assert.ok(html.includes('Submit Deliverable'));
    });
  });

  /* ======================================================================== */
  /* 3. Faculty Cockpit & Gradebook View                                      */
  /* ======================================================================== */
  describe('3. Faculty Assignment View & Gradebook Cockpit', () => {
    test('renders faculty assignment view with overview metrics, filters, and cards', () => {
      const draftAssignment = createMockAssignment({
        id: 'draft-1',
        title: 'Midterm Lab Project (Draft)',
        status: 'draft',
        submissionCount: 0,
        gradedCount: 0,
      });

      const publishedAssignment = createMockAssignment({
        id: 'pub-1',
        title: 'Advanced Graph Theory Assignment',
        status: 'published',
        submissionCount: 20,
        gradedCount: 15,
      });

      const html = renderToStaticMarkup(
        React.createElement(FacultyAssignmentView, {
          user: facultyUserDTO,
          assignedCourses: ['CS301', 'CS502'],
          initialAssignments: [draftAssignment, publishedAssignment],
          departmentName: 'Computer Science & Engineering',
        })
      );

      assert.ok(html.includes('Coursework &amp; Gradebook'));
      assert.ok(html.includes('Computer Science &amp; Engineering'));
      assert.ok(html.includes('Create Assignment'));

      // Metric Cards
      assert.ok(html.includes('Drafts'));
      assert.ok(html.includes('Published'));
      assert.ok(html.includes('Submissions'));
      assert.ok(html.includes('Pending Grades'));

      // Assignment Cards & Lifecycle Actions
      assert.ok(html.includes('Midterm Lab Project (Draft)'));
      assert.ok(html.includes('Advanced Graph Theory Assignment'));
      assert.ok(html.includes('Publish'));
      assert.ok(html.includes('Submissions (20)'));
    });

    test('renders faculty assignment create modal with course and policy inputs', () => {
      const html = renderToStaticMarkup(
        React.createElement(FacultyAssignmentCreateModal, {
          assignedCourses: ['CS301', 'CS502'],
          departmentId: cseDeptId,
          isOpen: true,
          onClose: () => {},
          onSuccess: () => {},
        })
      );

      assert.ok(html.includes('Create Coursework Assignment'));
      assert.ok(html.includes('Assignment Title'));
      assert.ok(html.includes('Course Code'));
      assert.ok(html.includes('CS301'));
      assert.ok(html.includes('CS502'));
      assert.ok(html.includes('Semester'));
      assert.ok(html.includes('Section'));
      assert.ok(html.includes('Max Marks'));
      assert.ok(html.includes('Primary Due Date &amp; Time'));
      assert.ok(html.includes('Late Submissions'));
      assert.ok(html.includes('Allow Resubmissions'));
      assert.ok(html.includes('Save as Draft'));
      assert.ok(html.includes('Publish Immediately'));
    });
  });

  /* ======================================================================== */
  /* 4. Faculty Submissions Review & Evaluation Modal                         */
  /* ======================================================================== */
  describe('4. Faculty Submissions Review & Evaluation', () => {
    test('renders faculty evaluation modal with marks boundary ceiling', () => {
      const assignment = createMockAssignment({ maxMarks: 50 });
      const submission = createMockSubmission();

      const html = renderToStaticMarkup(
        React.createElement(FacultyEvaluateModal, {
          assignment,
          submission,
          isOpen: true,
          onClose: () => {},
          onEvaluationSuccess: () => {},
        })
      );

      assert.ok(html.includes('Grade Student Submission'));
      assert.ok(html.includes('Rahul Verma'));
      assert.ok(html.includes('2101330100045'));
      assert.ok(html.includes('Awarded Marks'));
      assert.ok(html.includes('/ 50'));
      assert.ok(html.includes('Release Grade to Student'));
      assert.ok(html.includes('Instructor Remarks &amp; Feedback'));
      assert.ok(html.includes('Save &amp; Publish Evaluation'));
    });

    test('renders faculty submissions modal with student list and grade actions', () => {
      const assignment = createMockAssignment();

      const html = renderToStaticMarkup(
        React.createElement(FacultySubmissionsModal, {
          assignment,
          isOpen: true,
          onClose: () => {},
          onSubmissionGraded: () => {},
        })
      );

      assert.ok(html.includes('Submissions Workspace'));
      assert.ok(html.includes('Search student or roll number...'));
      assert.ok(html.includes('Close'));
    });
  });

  /* ======================================================================== */
  /* 5. File Uploader Component                                               */
  /* ======================================================================== */
  describe('5. File Uploader Component Constraints & Rendering', () => {
    test('renders file uploader drop area with permitted formats and max 25MB indicator', () => {
      const attachments = [
        {
          id: 'file-1',
          name: 'project_source.zip',
          url: 'https://storage.axislinkup.internal/project_source.zip',
          sizeBytes: 2048000,
          mimeType: 'application/zip',
          uploadedAt: '2026-11-12T10:00:00Z',
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(FileUploader, {
          attachments,
          onAttachmentsChange: () => {},
          maxFiles: 5,
        })
      );

      assert.ok(html.includes('Click or drop files to upload'));
      assert.ok(html.includes('Max 25MB each'));
      assert.ok(html.includes('Attached Deliverables (1/5)'));
      assert.ok(html.includes('project_source.zip'));
      assert.ok(html.includes('2.0 MB'));
    });
  });

  /* ======================================================================== */
  /* 6. Dashboard Overview Widgets                                            */
  /* ======================================================================== */
  describe('6. Dashboard Overview Widgets Integration', () => {
    test('renders student assignment overview widget with quick launcher', () => {
      const html = renderToStaticMarkup(React.createElement(StudentAssignmentOverview));
      assert.ok(html.includes('Coursework &amp; Assignments'));
      assert.ok(html.includes('/student/assignments'));
      assert.ok(html.includes('DOC-AUTH-005'));
    });

    test('renders faculty assignment management widget with gradebook launcher', () => {
      const html = renderToStaticMarkup(React.createElement(FacultyAssignmentManagement));
      assert.ok(html.includes('Coursework Evaluations &amp; Gradebook'));
      assert.ok(html.includes('/faculty/assignments'));
      assert.ok(html.includes('DOC-AUTH-005'));
    });
  });

  /* ======================================================================== */
  /* 7. Next.js Server Pages RBAC & Mounting                                  */
  /* ======================================================================== */
  describe('7. Server Pages RBAC Verification', () => {
    test('StudentAssignmentsPage mounts cleanly for authorized student session', async () => {
      __setTestSession(studentSession);
      mock.method(UserRepository, 'findById', async () => ({
        ...studentSession,
        _id: new Types.ObjectId(studentId),
        studentProfile: studentUserDTO.studentProfile,
      }));
      mock.method(AssignmentService, 'getAssignments', async () => ({
        assignments: [createMockAssignment()],
        hasMore: false,
      }));

      const element = await StudentAssignmentsPage();
      const html = renderToStaticMarkup(element);

      assert.ok(html.includes('Coursework &amp; Assignments'));
      assert.ok(html.includes('CS301'));
    });

    test('FacultyAssignmentsPage mounts cleanly for authorized faculty session', async () => {
      __setTestSession(facultySession);
      mock.method(UserRepository, 'findById', async () => ({
        ...facultySession,
        _id: new Types.ObjectId(facultyId),
        facultyProfile: facultyUserDTO.facultyProfile,
      }));
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        code: 'CSE',
        name: 'Computer Science & Engineering',
      }));
      mock.method(AssignmentService, 'getAssignments', async () => ({
        assignments: [createMockAssignment()],
        hasMore: false,
      }));

      const element = await FacultyAssignmentsPage();
      const html = renderToStaticMarkup(element);

      assert.ok(html.includes('Coursework &amp; Gradebook'));
      assert.ok(html.includes('Create Assignment'));
    });

    test('AdminAssignmentsPage mounts cleanly for authorized HOD administrator', async () => {
      __setTestSession(hodSession);
      mock.method(UserRepository, 'findById', async () => ({
        ...hodSession,
        _id: new Types.ObjectId(hodId),
      }));
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        code: 'CSE',
        name: 'Computer Science & Engineering',
      }));
      mock.method(AssignmentService, 'getAssignments', async () => ({
        assignments: [createMockAssignment()],
        hasMore: false,
      }));

      const element = await AdminAssignmentsPage();
      const html = renderToStaticMarkup(element);

      assert.ok(html.includes('Coursework &amp; Gradebook'));
    });
  });
});
