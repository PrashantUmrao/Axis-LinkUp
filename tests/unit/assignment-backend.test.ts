/**
 * Phase 5.7: Assignment Management Backend Test Suite
 *
 * Verifies:
 * 1. Zod Validation Schemas (Creation, Update, Submission, Evaluation, Filters, Attachments, Late Policies).
 * 2. Faculty Teaching Scope & Course Authorization (faculty assigned course check, HOD dept authority, cross-dept prevention).
 * 3. Assignment Lifecycle (Draft, Publish, Close, Archive, Delete rules, maxMarks immutability when graded).
 * 4. Student Cohort Scoping & Target Visibility (Semester, Section, Program, Peer-Isolation).
 * 5. Student Coursework Submissions (Due date, late submission policy, late cutoff, resubmission limits, version history).
 * 6. Faculty Evaluation & Grading (Marks within maxMarks boundary, feedback, audit trail, grade release).
 * 7. Cloudinary Signed Upload Envelope (Secure signature generation and mock offline fallback).
 * 8. REST API Route Handlers Integration (CRUD, Publish, Close, Archive, Submissions, Evaluation, Signatures).
 *
 * Conforms to Node.js built-in test runner (node:test + node:assert/strict).
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { AssignmentService } from '../../src/lib/services/assignment.service';
import { AssignmentRepository } from '../../src/lib/db/repositories/assignment.repository';
import { SubmissionRepository } from '../../src/lib/db/repositories/submission.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { __setTestSession } from '../../src/lib/auth/server';

// Route Handlers
import { GET as getAssignmentsRoute, POST as createAssignmentRoute } from '../../src/app/api/v1/assignments/route';
import {
  GET as getAssignmentDetailRoute,
  PATCH as updateAssignmentRoute,
  DELETE as deleteAssignmentRoute,
} from '../../src/app/api/v1/assignments/[id]/route';
import { POST as publishAssignmentRoute } from '../../src/app/api/v1/assignments/[id]/publish/route';
import { POST as closeAssignmentRoute } from '../../src/app/api/v1/assignments/[id]/close/route';
import { POST as archiveAssignmentRoute } from '../../src/app/api/v1/assignments/[id]/archive/route';
import {
  GET as getSubmissionsRoute,
  POST as submitAssignmentRoute,
} from '../../src/app/api/v1/assignments/[id]/submissions/route';
import { GET as getMySubmissionRoute } from '../../src/app/api/v1/assignments/[id]/submissions/me/route';
import { POST as evaluateSubmissionRoute } from '../../src/app/api/v1/assignments/[id]/submissions/[submissionId]/evaluate/route';
import { GET as getUploadSignatureRoute } from '../../src/app/api/v1/assignments/upload-signature/route';

// Validation Schemas
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  submitAssignmentSchema,
  evaluateSubmissionSchema,
  assignmentFilterSchema,
  submissionFilterSchema,
} from '../../src/lib/validations/assignment.schema';

import type { UserSession, IUser } from '../../src/types/user';
import type { IAssignment, ISubmission } from '../../src/types/assignment';
import type { IDepartment } from '../../src/types/department';

// Mock ObjectIds
const cseDeptId = '6730a005f8b1a2001a000010';
const eceDeptId = '6730a005f8b1a2001a000020';

const studentId = '6730a005f8b1a2001a000001';
const student2Id = '6730a005f8b1a2001a000002';
const facultyId = '6730a005f8b1a2001a000050';
const otherFacultyId = '6730a005f8b1a2001a000055';
const hodId = '6730a005f8b1a2001a000080';
const directorId = '6730a005f8b1a2001a000090';
const sysAdminId = '6730a005f8b1a2001a000099';

const assignment1Id = '6730a005f8b1a2001a000100';
const submission1Id = '6730a005f8b1a2001a000200';

// Mock User Sessions
const studentSession: UserSession = {
  userId: studentId,
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  username: 'rahulv',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const student2Session: UserSession = {
  userId: student2Id,
  email: 'nisha.chaudhari@axiscolleges.in',
  fullName: 'Nisha Chaudhari',
  username: 'nishac',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'prof.sharma@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  username: 'aloksharma',
  role: 'faculty',
  status: 'active',
  departmentId: cseDeptId,
};

const otherFacultySession: UserSession = {
  userId: otherFacultyId,
  email: 'prof.singh@axiscolleges.in',
  fullName: 'Prof. Rajesh Singh',
  username: 'rajeshsingh',
  role: 'faculty',
  status: 'active',
  departmentId: cseDeptId,
};

const hodSession: UserSession = {
  userId: hodId,
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. S. K. Gupta',
  username: 'hodcse',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: cseDeptId,
};

const directorSession: UserSession = {
  userId: directorId,
  email: 'director@axiscolleges.in',
  fullName: 'Dr. P. K. Mishra',
  username: 'director',
  role: 'super_admin',
  adminSubRole: 'director',
  status: 'active',
};

const sysAdminSession: UserSession = {
  userId: sysAdminId,
  email: 'admin@axiscolleges.in',
  fullName: 'System Administrator',
  username: 'sysadmin',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

// Mock User Documents
const mockStudentUser: IUser = {
  _id: new Types.ObjectId(studentId),
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  role: 'student',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  studentProfile: {
    rollNumber: 'CS-2023-042',
    enrollmentNumber: 'EN20230042',
    program: 'B.TECH',
    batchYear: 2026,
    currentSemester: 3,
    section: 'A',
    admissionType: 'regular',
  },
} as unknown as IUser;

const mockFacultyUser: IUser = {
  _id: new Types.ObjectId(facultyId),
  email: 'prof.sharma@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  role: 'faculty',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  facultyProfile: {
    employeeId: 'EMP-CSE-101',
    designation: 'Associate Professor',
    qualifications: ['M.Tech', 'Ph.D'],
    assignedCourses: ['CS301', 'CS502'], // Authorized courses
  },
} as unknown as IUser;

const mockOtherFacultyUser: IUser = {
  _id: new Types.ObjectId(otherFacultyId),
  email: 'prof.singh@axiscolleges.in',
  fullName: 'Prof. Rajesh Singh',
  role: 'faculty',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  facultyProfile: {
    employeeId: 'EMP-CSE-102',
    designation: 'Assistant Professor',
    qualifications: ['M.Tech'],
    assignedCourses: ['CS401'], // Does not have CS301
  },
} as unknown as IUser;

const mockHodUser: IUser = {
  _id: new Types.ObjectId(hodId),
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. S. K. Gupta',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
} as unknown as IUser;

// Mock Department Document
const mockCseDepartment: IDepartment = {
  _id: new Types.ObjectId(cseDeptId),
  code: 'CSE',
  name: 'Computer Science & Engineering',
  hodId: new Types.ObjectId(hodId),
  establishedYear: 2010,
  isActive: true,
  programs: [
    { code: 'B.TECH', name: 'Bachelor of Technology (CSE)', isActive: true },
    { code: 'M.TECH', name: 'Master of Technology (CSE)', isActive: true },
  ],
} as unknown as IDepartment;

// Mock Assignment Document
const mockAssignment1: IAssignment = {
  _id: new Types.ObjectId(assignment1Id),
  title: 'Data Structures Lab 3: Red-Black Trees',
  description: 'Implement insertion and rebalancing operations for Red-Black Binary Search Trees.',
  instructions: 'Submit source code as a ZIP archive along with report PDF.',
  courseCode: 'CS301',
  courseName: 'Advanced Data Structures',
  departmentId: new Types.ObjectId(cseDeptId),
  academicTarget: {
    program: 'B.TECH',
    year: 2,
    semester: 3,
    section: 'A',
    batchYear: 2026,
  },
  createdBy: new Types.ObjectId(facultyId),
  creatorSnapshot: {
    fullName: 'Prof. Alok Sharma',
    role: 'faculty',
    employeeId: 'EMP-CSE-101',
  },
  attachments: [
    {
      _id: new Types.ObjectId('6730a005f8b1a2001a000999'),
      name: 'lab3-specification.pdf',
      url: 'https://res.cloudinary.com/axis/raw/upload/v1/lab3.pdf',
      sizeBytes: 250000,
      mimeType: 'application/pdf',
      uploadedAt: new Date('2026-11-10T10:00:00Z'),
    },
  ],
  publishedAt: new Date('2026-11-10T10:00:00Z'),
  dueDate: new Date(Date.now() + 86400000 * 5), // 5 days in future
  maxMarks: 100,
  lateSubmissionPolicy: {
    allowLate: true,
    lateDueDate: new Date(Date.now() + 86400000 * 7),
    penaltyPercentagePerDay: 5,
  },
  allowResubmission: true,
  maxResubmissions: 3,
  status: 'published',
  createdAt: new Date('2026-11-10T10:00:00Z'),
  updatedAt: new Date('2026-11-10T10:00:00Z'),
} as unknown as IAssignment;

// Mock Submission Document
const mockSubmission1: ISubmission = {
  _id: new Types.ObjectId(submission1Id),
  assignmentId: new Types.ObjectId(assignment1Id),
  studentId: new Types.ObjectId(studentId),
  studentSnapshot: {
    fullName: 'Rahul Verma',
    rollNumber: 'CS-2023-042',
    enrollmentNumber: 'EN20230042',
    email: 'rahul.verma@axiscolleges.in',
    section: 'A',
    semester: 3,
  },
  submissionText: 'Completed Red-Black Tree implementation with test suites.',
  attachments: [
    {
      _id: new Types.ObjectId('6730a005f8b1a2001a000888'),
      name: 'solution-rahul.zip',
      url: 'https://res.cloudinary.com/axis/raw/upload/v1/sol.zip',
      sizeBytes: 150000,
      mimeType: 'application/zip',
      uploadedAt: new Date('2026-11-12T14:00:00Z'),
    },
  ],
  submittedAt: new Date('2026-11-12T14:00:00Z'),
  status: 'submitted',
  isLate: false,
  version: 1,
  history: [],
  evaluation: {
    marksObtained: null,
    feedback: null,
    evaluatedBy: null,
    evaluatedByName: null,
    evaluatedAt: null,
    isGraded: false,
    releasedAt: null,
  },
  createdAt: new Date('2026-11-12T14:00:00Z'),
  updatedAt: new Date('2026-11-12T14:00:00Z'),
} as unknown as ISubmission;

describe('Phase 5.7: Assignment Management Backend Suite', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  /* ======================================================================== */
  /* 1. Validation Schemas Suite                                              */
  /* ======================================================================== */
  describe('1. Zod Validation Schemas', () => {
    test('createAssignmentSchema accepts valid payload', () => {
      const payload = {
        title: 'Algorithms Homework 1',
        description: 'Complete problem sets 1 through 5 on Asymptotic Notation.',
        courseCode: 'CS301',
        courseName: 'Advanced Data Structures',
        departmentId: cseDeptId,
        academicTarget: {
          program: 'B.TECH',
          semester: 3,
          section: 'A',
        },
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        maxMarks: 50,
        status: 'published',
      };

      const result = createAssignmentSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
    });

    test('createAssignmentSchema rejects short title and negative maxMarks', () => {
      const payload = {
        title: 'AB', // < 3 chars
        description: 'Valid description here',
        courseCode: 'CS301',
        courseName: 'Course',
        departmentId: cseDeptId,
        academicTarget: { semester: 3 },
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        maxMarks: -10, // Invalid
      };

      const result = createAssignmentSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        const issues = result.error.flatten().fieldErrors;
        assert.ok(issues.title);
        assert.ok(issues.maxMarks);
      }
    });

    test('createAssignmentSchema rejects lateDueDate earlier than primary dueDate', () => {
      const payload = {
        title: 'Operating Systems Lab 1',
        description: 'Process scheduling algorithms simulation.',
        courseCode: 'CS302',
        courseName: 'Operating Systems',
        departmentId: cseDeptId,
        academicTarget: { semester: 4 },
        dueDate: new Date('2026-11-20T17:00:00Z').toISOString(),
        lateSubmissionPolicy: {
          allowLate: true,
          lateDueDate: new Date('2026-11-18T17:00:00Z').toISOString(), // Earlier than dueDate!
        },
      };

      const result = createAssignmentSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });

    test('submitAssignmentSchema requires either text or attachment', () => {
      // Both empty -> Rejected
      const emptyResult = submitAssignmentSchema.safeParse({
        submissionText: '',
        attachments: [],
      });
      assert.strictEqual(emptyResult.success, false);

      // Text provided -> Accepted
      const textResult = submitAssignmentSchema.safeParse({
        submissionText: 'Answers typed directly.',
        attachments: [],
      });
      assert.strictEqual(textResult.success, true);

      // Attachment provided -> Accepted
      const fileResult = submitAssignmentSchema.safeParse({
        attachments: [
          {
            name: 'doc.pdf',
            url: 'https://example.com/doc.pdf',
            sizeBytes: 1024,
            mimeType: 'application/pdf',
          },
        ],
      });
      assert.strictEqual(fileResult.success, true);
    });

    test('evaluateSubmissionSchema rejects marks less than 0', () => {
      const result = evaluateSubmissionSchema.safeParse({
        marksObtained: -5,
        feedback: 'Poor work',
      });
      assert.strictEqual(result.success, false);
    });

    test('updateAssignmentSchema validates partial assignment updates', () => {
      const valid = updateAssignmentSchema.safeParse({
        title: 'Updated Title',
        maxMarks: 75,
      });
      assert.strictEqual(valid.success, true);
    });

    test('assignmentFilterSchema and submissionFilterSchema validate query constraints', () => {
      const assignFilter = assignmentFilterSchema.safeParse({
        semester: '3',
        status: 'published',
        limit: '25',
      });
      assert.strictEqual(assignFilter.success, true);

      const subFilter = submissionFilterSchema.safeParse({
        isLate: 'true',
        isGraded: 'false',
        limit: '10',
      });
      assert.strictEqual(subFilter.success, true);
    });
  });

  /* ======================================================================== */
  /* 2. Faculty Teaching Scope & Course Authorization                         */
  /* ======================================================================== */
  describe('2. Faculty Course Authorization & RBAC Boundaries', () => {
    test('permits faculty member to create assignment for authorized assigned course', async () => {
      mock.method(UserRepository, 'findById', async () => mockFacultyUser);
      mock.method(DepartmentRepository, 'findById', async () => mockCseDepartment);

      const auth = await AssignmentService.assertFacultyCourseAuthorization(
        facultySession,
        cseDeptId,
        'CS301'
      );

      assert.strictEqual(auth.authorUser.fullName, 'Prof. Alok Sharma');
      assert.strictEqual(auth.departmentCode, 'CSE');
    });

    test('rejects faculty member trying to create assignment for unassigned course with ForbiddenError', async () => {
      mock.method(UserRepository, 'findById', async () => mockOtherFacultyUser); // only assigned CS401
      mock.method(DepartmentRepository, 'findById', async () => mockCseDepartment);

      await assert.rejects(
        async () => {
          await AssignmentService.assertFacultyCourseAuthorization(
            otherFacultySession,
            cseDeptId,
            'CS301' // Not assigned!
          );
        },
        {
          name: 'ForbiddenError',
          message: 'You are not authorized to create assignments for course CS301. It is not in your assigned teaching roster.',
        }
      );
    });

    test('rejects student attempting to manage assignments with ForbiddenError', async () => {
      await assert.rejects(
        async () => {
          await AssignmentService.assertFacultyCourseAuthorization(
            studentSession,
            cseDeptId,
            'CS301'
          );
        },
        {
          name: 'ForbiddenError',
          message: 'Students are strictly unauthorized to create or manage coursework.',
        }
      );
    });

    test('rejects faculty creating assignment for another department with ForbiddenError', async () => {
      mock.method(UserRepository, 'findById', async () => mockFacultyUser);
      const foreignDept = {
        ...mockCseDepartment,
        _id: new Types.ObjectId(eceDeptId),
        code: 'ECE',
      } as unknown as IDepartment;
      mock.method(DepartmentRepository, 'findById', async () => foreignDept);

      await assert.rejects(
        async () => {
          await AssignmentService.assertFacultyCourseAuthorization(
            facultySession,
            eceDeptId,
            'CS301'
          );
        },
        {
          name: 'ForbiddenError',
          message: 'Faculty members cannot create assignments for another academic department.',
        }
      );
    });

    test('permits department HOD to manage assignments for their department', async () => {
      mock.method(UserRepository, 'findById', async () => mockHodUser);
      mock.method(DepartmentRepository, 'findById', async () => mockCseDepartment);

      const auth = await AssignmentService.assertFacultyCourseAuthorization(
        hodSession,
        cseDeptId,
        'CS301'
      );

      assert.strictEqual(auth.departmentCode, 'CSE');
    });

    test('permits system administrator and director oversight across departments', async () => {
      mock.method(UserRepository, 'findById', async () => mockFacultyUser);
      mock.method(DepartmentRepository, 'findById', async () => mockCseDepartment);

      const sysAuth = await AssignmentService.assertFacultyCourseAuthorization(
        sysAdminSession,
        cseDeptId,
        'CS301'
      );
      assert.strictEqual(sysAuth.departmentCode, 'CSE');

      const dirAuth = await AssignmentService.assertFacultyCourseAuthorization(
        directorSession,
        cseDeptId,
        'CS301'
      );
      assert.strictEqual(dirAuth.departmentCode, 'CSE');
    });
  });

  /* ======================================================================== */
  /* 3. Assignment Lifecycle: Draft, Publish, Close, Archive, Delete          */
  /* ======================================================================== */
  describe('3. Assignment Lifecycle & Mutation Invariants', () => {
    test('createAssignment creates and persists assignment in draft state', async () => {
      mock.method(UserRepository, 'findById', async () => mockFacultyUser);
      mock.method(DepartmentRepository, 'findById', async () => mockCseDepartment);
      mock.method(AssignmentRepository, 'create', async (data: Partial<IAssignment>) => ({
        ...mockAssignment1,
        ...data,
        _id: new Types.ObjectId(assignment1Id),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const result = await AssignmentService.createAssignment(facultySession, {
        title: 'Lab 4: Graph Traversals',
        description: 'BFS and DFS implementation with adjacency lists.',
        courseCode: 'CS301',
        courseName: 'Advanced Data Structures',
        departmentId: cseDeptId,
        academicTarget: { semester: 3, section: 'A' },
        dueDate: new Date(Date.now() + 86400000 * 4).toISOString(),
        maxMarks: 100,
        lateSubmissionPolicy: { allowLate: false, lateDueDate: null, penaltyPercentagePerDay: 0 },
        allowResubmission: false,
        maxResubmissions: 3,
        attachments: [],
        status: 'draft',
      });

      assert.strictEqual(result.title, 'Lab 4: Graph Traversals');
      assert.strictEqual(result.status, 'draft');
      assert.strictEqual(result.publishedAt, undefined);
    });

    test('publishAssignment transitions draft to published and stamps publishedAt', async () => {
      const draftAssignment: IAssignment = {
        ...mockAssignment1,
        status: 'draft',
        publishedAt: undefined,
      } as unknown as IAssignment;

      mock.method(AssignmentRepository, 'findById', async () => draftAssignment);
      mock.method(AssignmentRepository, 'update', async (_id: string, updates: Partial<IAssignment>) => ({
        ...draftAssignment,
        ...updates,
      }));

      const result = await AssignmentService.publishAssignment(facultySession, assignment1Id);
      assert.strictEqual(result.status, 'published');
      assert.ok(result.publishedAt);
    });

    test('closeAssignment transitions published assignment to closed state', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1);
      mock.method(AssignmentRepository, 'update', async (_id: string, updates: Partial<IAssignment>) => ({
        ...mockAssignment1,
        ...updates,
      }));
      mock.method(AssignmentRepository, 'countSubmissions', async () => 5);
      mock.method(AssignmentRepository, 'countGradedSubmissions', async () => 2);

      const result = await AssignmentService.closeAssignment(facultySession, assignment1Id);
      assert.strictEqual(result.status, 'closed');
      assert.strictEqual(result.submissionCount, 5);
    });

    test('deleteAssignment allows deleting draft with zero submissions', async () => {
      const draftAssignment = { ...mockAssignment1, status: 'draft' } as unknown as IAssignment;
      mock.method(AssignmentRepository, 'findById', async () => draftAssignment);
      mock.method(AssignmentRepository, 'countSubmissions', async () => 0);
      mock.method(AssignmentRepository, 'delete', async () => true);

      const result = await AssignmentService.deleteAssignment(facultySession, assignment1Id);
      assert.strictEqual(result.success, true);
    });

    test('deleteAssignment blocks deleting published assignments with BadRequestError', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1); // status: 'published'

      await assert.rejects(
        async () => {
          await AssignmentService.deleteAssignment(facultySession, assignment1Id);
        },
        {
          name: 'BadRequestError',
          message: 'Only draft assignments can be deleted. Use archive for published/closed coursework.',
        }
      );
    });

    test('updateAssignment rejects mutating maxMarks when submissions have already been graded', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1);
      mock.method(AssignmentRepository, 'countGradedSubmissions', async () => 3); // 3 already graded!

      await assert.rejects(
        async () => {
          await AssignmentService.updateAssignment(facultySession, assignment1Id, {
            maxMarks: 150, // attempted change
          });
        },
        {
          name: 'BadRequestError',
          message: 'Maximum marks cannot be modified because submissions have already been graded.',
        }
      );
    });
  });

  /* ======================================================================== */
  /* 4. Student Cohort Scoping & Target Visibility                            */
  /* ======================================================================== */
  describe('4. Student Cohort Scoping & Target Visibility', () => {
    test('permits student to view published assignment matching their cohort', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1);
      mock.method(DepartmentRepository, 'findById', async () => mockCseDepartment);
      mock.method(UserRepository, 'findById', async () => mockStudentUser);
      mock.method(SubmissionRepository, 'findByAssignmentAndStudent', async () => null);

      const assignment = await AssignmentService.getAssignmentById(studentSession, assignment1Id);
      assert.strictEqual(assignment.id, assignment1Id);
      assert.strictEqual(assignment.courseCode, 'CS301');
      assert.strictEqual(assignment.userSubmission, null);
    });

    test('rejects student attempting to access draft assignment with NotFoundError', async () => {
      const draftAssignment = { ...mockAssignment1, status: 'draft' } as unknown as IAssignment;
      mock.method(AssignmentRepository, 'findById', async () => draftAssignment);
      mock.method(DepartmentRepository, 'findById', async () => mockCseDepartment);

      await assert.rejects(
        async () => {
          await AssignmentService.getAssignmentById(studentSession, assignment1Id);
        },
        {
          name: 'NotFoundError',
        }
      );
    });

    test('rejects student attempting to access assignment of a different semester with ForbiddenError', async () => {
      const differentSemesterStudent: IUser = {
        ...mockStudentUser,
        studentProfile: {
          ...mockStudentUser.studentProfile!,
          currentSemester: 5, // Assignment is semester 3!
        },
      } as unknown as IUser;

      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1);
      mock.method(DepartmentRepository, 'findById', async () => mockCseDepartment);
      mock.method(UserRepository, 'findById', async () => differentSemesterStudent);

      await assert.rejects(
        async () => {
          await AssignmentService.getAssignmentById(studentSession, assignment1Id);
        },
        {
          name: 'ForbiddenError',
          message: 'You are not authorized to access this assignment.',
        }
      );
    });
  });

  /* ======================================================================== */
  /* 5. Student Coursework Submissions & Resubmissions                        */
  /* ======================================================================== */
  describe('5. Student Coursework Submissions, Deadlines & Resubmissions', () => {
    test('submits assignment within deadline and records version 1', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1);
      mock.method(UserRepository, 'findById', async () => mockStudentUser);
      mock.method(SubmissionRepository, 'findByAssignmentAndStudent', async () => null);
      mock.method(SubmissionRepository, 'create', async (data: Partial<ISubmission>) => ({
        ...mockSubmission1,
        ...data,
        _id: new Types.ObjectId(submission1Id),
      }));

      const submission = await AssignmentService.submitAssignment(studentSession, assignment1Id, {
        submissionText: 'Initial complete solution.',
        attachments: [],
      });

      assert.strictEqual(submission.version, 1);
      assert.strictEqual(submission.status, 'submitted');
      assert.strictEqual(submission.isLate, false);
    });

    test('rejects submission when assignment deadline has passed and late submissions disallowed', async () => {
      const strictAssignment: IAssignment = {
        ...mockAssignment1,
        dueDate: new Date(Date.now() - 3600000), // 1 hour ago
        lateSubmissionPolicy: {
          allowLate: false, // Disallowed!
        },
      } as unknown as IAssignment;

      mock.method(AssignmentRepository, 'findById', async () => strictAssignment);
      mock.method(UserRepository, 'findById', async () => mockStudentUser);

      await assert.rejects(
        async () => {
          await AssignmentService.submitAssignment(studentSession, assignment1Id, {
            submissionText: 'Late submission attempt',
            attachments: [],
          });
        },
        {
          name: 'BadRequestError',
          message: 'The submission deadline has passed and late submissions are disallowed.',
        }
      );
    });

    test('permits late submission with isLate flag when late policy allows it', async () => {
      const lateAllowedAssignment: IAssignment = {
        ...mockAssignment1,
        dueDate: new Date(Date.now() - 3600000), // 1 hour ago
        lateSubmissionPolicy: {
          allowLate: true,
          lateDueDate: new Date(Date.now() + 86400000), // Cutoff tomorrow
        },
      } as unknown as IAssignment;

      mock.method(AssignmentRepository, 'findById', async () => lateAllowedAssignment);
      mock.method(UserRepository, 'findById', async () => mockStudentUser);
      mock.method(SubmissionRepository, 'findByAssignmentAndStudent', async () => null);
      mock.method(SubmissionRepository, 'create', async (data: Partial<ISubmission>) => ({
        ...mockSubmission1,
        ...data,
        _id: new Types.ObjectId(submission1Id),
      }));

      const submission = await AssignmentService.submitAssignment(studentSession, assignment1Id, {
        submissionText: 'Submitted late with permission.',
        attachments: [],
      });

      assert.strictEqual(submission.isLate, true);
    });

    test('handles resubmission by recording prior version in history and bumping version to 2', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1); // allowResubmission: true
      mock.method(UserRepository, 'findById', async () => mockStudentUser);
      mock.method(SubmissionRepository, 'findByAssignmentAndStudent', async () => mockSubmission1);
      mock.method(SubmissionRepository, 'recordResubmission', async (_id: string, params: unknown) => {
        const p = params as { newVersion: number; submissionText: string; isLate: boolean };
        return {
          ...mockSubmission1,
          version: p.newVersion,
          submissionText: p.submissionText,
          status: 'resubmitted',
          history: [
            {
              version: 1,
              submissionText: mockSubmission1.submissionText,
              attachments: [],
              submittedAt: mockSubmission1.submittedAt,
              isLate: false,
            },
          ],
        } as unknown as ISubmission;
      });

      const resubmission = await AssignmentService.submitAssignment(studentSession, assignment1Id, {
        submissionText: 'Updated solution with bug fix.',
        attachments: [],
      });

      assert.strictEqual(resubmission.version, 2);
      assert.strictEqual(resubmission.status, 'resubmitted');
      assert.strictEqual(resubmission.history.length, 1);
      assert.strictEqual(resubmission.history[0]?.version, 1);
    });

    test('rejects resubmission when assignment has already been evaluated and graded', async () => {
      const gradedSubmission: ISubmission = {
        ...mockSubmission1,
        status: 'graded',
        evaluation: {
          marksObtained: 92,
          feedback: 'Excellent work',
          isGraded: true,
        },
      } as unknown as ISubmission;

      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1);
      mock.method(UserRepository, 'findById', async () => mockStudentUser);
      mock.method(SubmissionRepository, 'findByAssignmentAndStudent', async () => gradedSubmission);

      await assert.rejects(
        async () => {
          await AssignmentService.submitAssignment(studentSession, assignment1Id, {
            submissionText: 'Trying to resubmit after getting grade',
            attachments: [],
          });
        },
        {
          name: 'BadRequestError',
          message: 'This assignment has already been evaluated and graded. Further submissions are locked.',
        }
      );
    });

    test('enforces strict peer isolation on student submissions', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1);
      mock.method(SubmissionRepository, 'findByAssignmentAndStudent', async () => mockSubmission1);

      // Student 1 retrieves their submission
      const sub1 = await AssignmentService.getStudentSubmission(studentSession, assignment1Id);
      assert.strictEqual(sub1?.studentId, studentId);

      // Student 2 retrieves their own submission (null when not submitted)
      mock.method(SubmissionRepository, 'findByAssignmentAndStudent', async () => null);
      const sub2 = await AssignmentService.getStudentSubmission(student2Session, assignment1Id);
      assert.strictEqual(sub2, null);
    });
  });

  /* ======================================================================== */
  /* 6. Faculty Evaluation & Grading                                          */
  /* ======================================================================== */
  describe('6. Faculty Evaluation, Marks Boundary & Grade Release', () => {
    test('grades submission within maxMarks boundary and marks isGraded as true', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1); // maxMarks: 100
      mock.method(SubmissionRepository, 'findById', async () => mockSubmission1);
      mock.method(SubmissionRepository, 'updateEvaluation', async (_id: string, evalData: unknown) => ({
        ...mockSubmission1,
        evaluation: evalData,
        status: 'graded',
      }));

      const graded = await AssignmentService.evaluateSubmission(
        facultySession,
        assignment1Id,
        submission1Id,
        {
          marksObtained: 88,
          feedback: 'Well documented implementation. Rebalancing logic is sound.',
          releaseGrade: true,
        }
      );

      assert.strictEqual(graded.status, 'graded');
      assert.strictEqual(graded.evaluation?.marksObtained, 88);
      assert.strictEqual(graded.evaluation?.isGraded, true);
      assert.strictEqual(graded.evaluation?.evaluatedByName, 'Prof. Alok Sharma');
    });

    test('rejects marks exceeding assignment maximum marks with ValidationError', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1); // maxMarks: 100
      mock.method(SubmissionRepository, 'findById', async () => mockSubmission1);

      await assert.rejects(
        async () => {
          await AssignmentService.evaluateSubmission(
            facultySession,
            assignment1Id,
            submission1Id,
            {
              marksObtained: 105, // > 100
              feedback: 'Extra credit awarded',
              releaseGrade: true,
            }
          );
        },
        {
          name: 'ValidationError',
          message: 'Awarded marks (105) cannot exceed assignment maximum marks (100).',
        }
      );
    });

    test('rejects unauthorized peer faculty from evaluating another faculty assignment', async () => {
      mock.method(AssignmentRepository, 'findById', async () => mockAssignment1); // createdBy: facultyId

      await assert.rejects(
        async () => {
          await AssignmentService.evaluateSubmission(
            otherFacultySession, // otherFacultyId
            assignment1Id,
            submission1Id,
            { marksObtained: 75, releaseGrade: true }
          );
        },
        {
          name: 'ForbiddenError',
          message: 'You are not authorized to manage or modify this assignment.',
        }
      );
    });
  });

  /* ======================================================================== */
  /* 7. Cloudinary Upload Signature Envelope                                  */
  /* ======================================================================== */
  describe('7. Cloudinary Signed Upload Envelope & Fallback', () => {
    test('returns local development mock envelope when Cloudinary is unconfigured', () => {
      const origKey = process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_KEY;

      const envelope = AssignmentService.getUploadSignature(facultySession);
      assert.strictEqual(envelope.isMock, true);
      assert.strictEqual(envelope.folder, `axis-linkup/assignments/${facultySession.userId}`);
      assert.ok(envelope.allowedFormats.includes('pdf'));
      assert.strictEqual(envelope.maxFileSize, 25 * 1024 * 1024);
      assert.ok(envelope.timestamp);

      if (origKey) process.env.CLOUDINARY_API_KEY = origKey;
    });

    test('generates valid Cloudinary SHA-1 signature when credentials are configured', () => {
      process.env.CLOUDINARY_API_KEY = 'test_key_123';
      process.env.CLOUDINARY_API_SECRET = 'test_secret_abc';
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'axis_college';

      const envelope = AssignmentService.getUploadSignature(facultySession);
      assert.strictEqual(envelope.isMock, false);
      assert.strictEqual(envelope.apiKey, 'test_key_123');
      assert.strictEqual(envelope.cloudName, 'axis_college');
      assert.ok(envelope.signature);
      assert.strictEqual(envelope.signature.length, 40); // 40-hex SHA-1 hash

      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;
      delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    });
  });

  /* ======================================================================== */
  /* 8. REST API Route Handlers Integration                                    */
  /* ======================================================================== */
  describe('8. REST API Route Handlers Integration', () => {
    test('GET /api/v1/assignments returns 200 with assignment feed', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'getAssignments', async () => ({
        assignments: [],
        hasMore: false,
      }));

      const req = new NextRequest('http://localhost:3000/api/v1/assignments?status=published');
      const res = await getAssignmentsRoute(req);

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('POST /api/v1/assignments creates assignment with 201 Created', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'createAssignment', async () => ({
        id: assignment1Id,
        title: 'New Assignment',
      }));

      const payload = {
        title: 'New Assignment',
        description: 'Detailed problem description.',
        courseCode: 'CS301',
        courseName: 'Data Structures',
        departmentId: cseDeptId,
        academicTarget: { semester: 3 },
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        maxMarks: 100,
      };

      const req = new NextRequest('http://localhost:3000/api/v1/assignments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const res = await createAssignmentRoute(req);
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('GET /api/v1/assignments/[id] returns 200 with details', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'getAssignmentById', async () => ({
        id: assignment1Id,
        title: 'Assignment 1',
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/assignments/${assignment1Id}`);
      const res = await getAssignmentDetailRoute(req, {
        params: Promise.resolve({ id: assignment1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('PATCH /api/v1/assignments/[id] updates assignment with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'updateAssignment', async () => ({
        id: assignment1Id,
        title: 'Updated Title',
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/assignments/${assignment1Id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated Title' }),
      });

      const res = await updateAssignmentRoute(req, {
        params: Promise.resolve({ id: assignment1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('DELETE /api/v1/assignments/[id] deletes draft assignment with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'deleteAssignment', async () => ({
        success: true,
        message: 'Draft assignment deleted successfully.',
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/assignments/${assignment1Id}`, {
        method: 'DELETE',
      });

      const res = await deleteAssignmentRoute(req, {
        params: Promise.resolve({ id: assignment1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('POST /api/v1/assignments/[id]/publish publishes assignment with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'publishAssignment', async () => ({
        id: assignment1Id,
        status: 'published',
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/assignments/${assignment1Id}/publish`, {
        method: 'POST',
      });

      const res = await publishAssignmentRoute(req, {
        params: Promise.resolve({ id: assignment1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('POST /api/v1/assignments/[id]/close closes assignment with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'closeAssignment', async () => ({
        id: assignment1Id,
        status: 'closed',
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/assignments/${assignment1Id}/close`, {
        method: 'POST',
      });

      const res = await closeAssignmentRoute(req, {
        params: Promise.resolve({ id: assignment1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('POST /api/v1/assignments/[id]/archive archives assignment with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'archiveAssignment', async () => ({
        id: assignment1Id,
        status: 'archived',
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/assignments/${assignment1Id}/archive`, {
        method: 'POST',
      });

      const res = await archiveAssignmentRoute(req, {
        params: Promise.resolve({ id: assignment1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('POST /api/v1/assignments/[id]/submissions submits coursework with 201 Created', async () => {
      __setTestSession(studentSession);
      mock.method(AssignmentService, 'submitAssignment', async () => ({
        id: submission1Id,
        status: 'submitted',
        version: 1,
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/assignments/${assignment1Id}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ submissionText: 'Here is my coursework solution.' }),
      });

      const res = await submitAssignmentRoute(req, {
        params: Promise.resolve({ id: assignment1Id }),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('GET /api/v1/assignments/[id]/submissions lists submissions with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'getAssignmentSubmissions', async () => ({
        submissions: [],
        hasMore: false,
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/assignments/${assignment1Id}/submissions`);
      const res = await getSubmissionsRoute(req, {
        params: Promise.resolve({ id: assignment1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('GET /api/v1/assignments/[id]/submissions/me returns student own submission with 200 OK', async () => {
      __setTestSession(studentSession);
      mock.method(AssignmentService, 'getStudentSubmission', async () => ({
        id: submission1Id,
        status: 'submitted',
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/assignments/${assignment1Id}/submissions/me`);
      const res = await getMySubmissionRoute(req, {
        params: Promise.resolve({ id: assignment1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('POST /api/v1/assignments/[id]/submissions/[submissionId]/evaluate grades submission with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(AssignmentService, 'evaluateSubmission', async () => ({
        id: submission1Id,
        status: 'graded',
        evaluation: { marksObtained: 95, isGraded: true },
      }));

      const req = new NextRequest(
        `http://localhost:3000/api/v1/assignments/${assignment1Id}/submissions/${submission1Id}/evaluate`,
        {
          method: 'POST',
          body: JSON.stringify({ marksObtained: 95, feedback: 'Great job!' }),
        }
      );

      const res = await evaluateSubmissionRoute(req, {
        params: Promise.resolve({ id: assignment1Id, submissionId: submission1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('GET /api/v1/assignments/upload-signature returns 200 with signature envelope', async () => {
      __setTestSession(facultySession);
      const req = new NextRequest('http://localhost:3000/api/v1/assignments/upload-signature');
      const res = await getUploadSignatureRoute(req);

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.timestamp);
    });
  });
});
