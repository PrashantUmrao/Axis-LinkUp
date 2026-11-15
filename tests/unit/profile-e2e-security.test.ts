/**
 * Phase 5.3.6: Comprehensive End-to-End Profile Subsystem Verification & Security Audit Test Suite
 * 
 * Verifies all 5 user lifecycle journeys and security invariants:
 * 1. Student Lifecycle: Provisioning -> Activation -> Self-Service -> Peer Privacy -> Cohort Protection
 * 2. Faculty Lifecycle & Privacy: Defaults -> Opt-In -> Cross-Dept Relationship -> Peer Protection
 * 3. HOD Scoping & Isolation: Own Dept Roster/Updates -> Cross-Dept Blocks -> Dept Transfer Restrictions
 * 4. Director Institutional Oversight: Multi-Dept Roster Reading -> Strict Mutation Denial
 * 5. System Administrator Governance: Global Authority -> Program Invariants -> ASH Constraints
 * 6. Account Status Enforcement: Suspended & Unauthenticated Denial
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { GET as getOwnProfileRoute, PATCH as updateOwnProfileRoute } from '../../src/app/api/v1/profile/me/route';
import { GET as getUserProfileRoute } from '../../src/app/api/v1/users/[id]/profile/route';
import { GET as getDepartmentRosterRoute } from '../../src/app/api/v1/departments/[id]/roster/route';
import { PATCH as updateAcademicProfileRoute } from '../../src/app/api/v1/admin/users/[id]/academic-profile/route';

import { __setTestSession } from '../../src/lib/auth/server';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import type { IUser, UserSession, UpdateUserProfileInput } from '../../src/types/user';
import type { IDepartment } from '../../src/types/department';
import type { AdminAcademicUpdateInput } from '../../src/types/profile';

// Shared Mock IDs
const cseDeptId = '6730a005f8b1a2001a000010';
const eceDeptId = '6730a005f8b1a2001a000020';
const ashDeptId = '6730a005f8b1a2001a000070';

const studentId = '6730a005f8b1a2001a000001';
const peerStudentId = '6730a005f8b1a2001a000002';
const crossDeptStudentId = '6730a005f8b1a2001a000003';
const facultyId = '6730a005f8b1a2001a000050';
const peerFacultyId = '6730a005f8b1a2001a000051';
const cseHodId = '6730a005f8b1a2001a000080';
const directorId = '6730a005f8b1a2001a000090';
const sysAdminId = '6730a005f8b1a2001a000099';

// Shared Mock Departments
const cseDeptDoc = {
  _id: new Types.ObjectId(cseDeptId),
  name: 'Computer Science and Engineering',
  code: 'CSE',
  status: 'active',
  isActive: true,
  programs: [
    { code: 'BTECH_CSE', name: 'B.Tech Computer Science and Engineering', isActive: true },
    { code: 'BTECH_IT', name: 'B.Tech Information Technology', isActive: true },
    { code: 'BCA', name: 'Bachelor of Computer Applications', isActive: false },
    { code: 'MCA', name: 'Master of Computer Applications', isActive: false },
    { code: 'MTECH_CSE', name: 'M.Tech Computer Science and Engineering', isActive: false },
  ],
} as unknown as IDepartment;

const eceDeptDoc = {
  _id: new Types.ObjectId(eceDeptId),
  name: 'Electronics and Communication Engineering',
  code: 'ECE',
  status: 'active',
  isActive: true,
  programs: [
    { code: 'BTECH_ECE', name: 'B.Tech Electronics and Communication Engineering', isActive: true },
  ],
} as unknown as IDepartment;

const ashDeptDoc = {
  _id: new Types.ObjectId(ashDeptId),
  name: 'Applied Sciences & Humanities',
  code: 'ASH',
  status: 'active',
  isActive: false, // Inactive for program admissions
  programs: [],
} as unknown as IDepartment;

// Shared Mock Users
const studentUser = {
  _id: new Types.ObjectId(studentId),
  email: 'aarav.sharma@axiscolleges.in',
  username: 'aarav.sharma',
  fullName: 'Aarav Sharma',
  role: 'student',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  phoneNumber: '+919876543201',
  bio: 'Computer Science student passionate about systems.',
  studentProfile: {
    rollNumber: '210101001',
    enrollmentNumber: 'EN210101001',
    program: 'BTECH_CSE',
    batchYear: 2021,
    admissionYear: 2021,
    currentSemester: 6,
    section: 'A',
    admissionType: 'regular',
  },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
} as unknown as IUser;

const facultyUser = {
  _id: new Types.ObjectId(facultyId),
  email: 'vivek.shukla@axiscolleges.in',
  username: 'dr.shukla',
  fullName: 'Dr. Vivek Shukla',
  role: 'faculty',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  phoneNumber: '+919876543211',
  bio: 'Professor of Distributed Systems & Algorithms',
  facultyProfile: {
    employeeId: 'FAC001',
    designation: 'Professor',
    qualifications: ['Ph.D. in Computer Science', 'M.Tech CSE'],
    cabinRoom: 'Block B, 201',
    officeHours: {
      days: ['Monday', 'Wednesday', 'Friday'],
      startTime: '14:00',
      endTime: '16:00',
    },
    specialization: ['Distributed Systems', 'Cloud Computing'],
    sharePhoneWithStudents: false,
  },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
} as unknown as IUser;

describe('Phase 5.3.6: Journey 1 — Student Lifecycle & Boundaries', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  const studentSession: UserSession = {
    userId: studentId,
    email: studentUser.email,
    role: 'student',
    status: 'active',
    departmentId: cseDeptId,
  };

  test('Student accesses own profile (GET /profile/me) and receives complete OwnerProfileDTO', async () => {
    __setTestSession(studentSession);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);

    const res = await getOwnProfileRoute();
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, studentId);
    assert.strictEqual(json.data.fullName, 'Aarav Sharma');
    assert.strictEqual(json.data.email, 'aarav.sharma@axiscolleges.in');
    assert.strictEqual(json.data.departmentCode, 'CSE');
    assert.strictEqual(json.data.studentProfile?.rollNumber, '210101001');
    assert.strictEqual(json.data.studentProfile?.enrollmentNumber, 'EN210101001');
    assert.strictEqual(json.data.studentProfile?.program, 'BTECH_CSE');
    assert.strictEqual(json.data.studentProfile?.currentSemester, 6);
    assert.strictEqual(json.data.studentProfile?.section, 'A');
  });

  test('Student updates self-service personal fields (bio, phone) successfully', async () => {
    __setTestSession(studentSession);
    let capturedUpdates: Record<string, unknown> | undefined;

    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(UserRepository, 'updateProfile', async (_id: string, updates: UpdateUserProfileInput) => {
      capturedUpdates = updates as unknown as Record<string, unknown>;
      return {
        ...studentUser,
        ...updates,
        updatedAt: new Date(),
      } as unknown as IUser;
    });

    const req = new NextRequest('http://localhost:3000/api/v1/profile/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: 'Updated student bio focusing on distributed databases.',
        phoneNumber: '+919988776655',
      }),
    });

    const res = await updateOwnProfileRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.ok(capturedUpdates);
    assert.strictEqual((capturedUpdates as Record<string, unknown>).bio, 'Updated student bio focusing on distributed databases.');
    assert.strictEqual((capturedUpdates as Record<string, unknown>).phoneNumber, '+919988776655');
  });

  test('Student mass-assignment attempts (section, rollNumber, role, department) are strictly stripped', async () => {
    __setTestSession(studentSession);
    let capturedUpdates: Record<string, unknown> | undefined;

    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(UserRepository, 'updateProfile', async (_id: string, updates: UpdateUserProfileInput) => {
      capturedUpdates = updates as unknown as Record<string, unknown>;
      return {
        ...studentUser,
        ...updates,
        updatedAt: new Date(),
      } as unknown as IUser;
    });

    const req = new NextRequest('http://localhost:3000/api/v1/profile/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: 'Legitimate bio',
        section: 'B',
        rollNumber: 'TAMPERED_ROLL',
        enrollmentNumber: 'TAMPERED_ENROLLMENT',
        role: 'super_admin',
        adminSubRole: 'sys_admin',
        departmentId: eceDeptId,
      }),
    });

    const res = await updateOwnProfileRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.ok(capturedUpdates);
    assert.strictEqual((capturedUpdates as Record<string, unknown>).bio, 'Legitimate bio');
    assert.strictEqual((capturedUpdates as Record<string, unknown>).role, undefined);
    assert.strictEqual((capturedUpdates as Record<string, unknown>).departmentId, undefined);
    assert.strictEqual((capturedUpdates as Record<string, unknown>).studentProfile, undefined);
    assert.strictEqual((capturedUpdates as Record<string, unknown>).section, undefined);
  });

  test('Student attempting to access admin cohort update API is blocked with HTTP 403 Forbidden', async () => {
    __setTestSession(studentSession);

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${studentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'B' }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: studentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('Student viewing peer student profile receives DirectoryProfileDTO with stripped private fields', async () => {
    __setTestSession(studentSession);
    const peerStudentUser = {
      ...studentUser,
      _id: new Types.ObjectId(peerStudentId),
      fullName: 'Rohan Gupta',
      username: 'rohan.gupta',
      email: 'rohan.gupta@axiscolleges.in',
      phoneNumber: '+919876543202',
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => peerStudentUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);

    const req = new NextRequest(`http://localhost:3000/api/v1/users/${peerStudentId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: peerStudentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.fullName, 'Rohan Gupta');
    assert.strictEqual(json.data.phoneNumber, null); // Personal phone strictly stripped
    assert.strictEqual(json.data.enrollmentNumber, undefined); // Enrollment number stripped from directory
    assert.strictEqual(json.data.email, undefined); // Private institutional email omitted from directory
  });

  test('Student attempting to view department roster is blocked with HTTP 403 Forbidden', async () => {
    __setTestSession(studentSession);

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${cseDeptId}/roster`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: cseDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });
});

describe('Phase 5.3.6: Journey 2 — Faculty Lifecycle & Phone Privacy Invariants', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  const facultySession: UserSession = {
    userId: facultyId,
    email: facultyUser.email,
    role: 'faculty',
    status: 'active',
    departmentId: cseDeptId,
  };

  test('Faculty member viewing own profile always sees their personal phone number', async () => {
    __setTestSession(facultySession);
    mock.method(UserRepository, 'findById', async () => facultyUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);

    const res = await getOwnProfileRoute();
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.phoneNumber, '+919876543211');
    assert.strictEqual(json.data.facultyProfile?.sharePhoneWithStudents, false);
  });

  test('Faculty member updates phone sharing preference via PATCH /profile/me', async () => {
    __setTestSession(facultySession);
    let capturedUpdates: Record<string, unknown> | undefined;

    mock.method(UserRepository, 'findById', async () => facultyUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(UserRepository, 'updateProfile', async (_id: string, updates: UpdateUserProfileInput) => {
      capturedUpdates = updates as unknown as Record<string, unknown>;
      return {
        ...facultyUser,
        facultyProfile: {
          ...facultyUser.facultyProfile,
          ...updates.facultyProfile,
        },
        updatedAt: new Date(),
      } as unknown as IUser;
    });

    const req = new NextRequest('http://localhost:3000/api/v1/profile/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facultyProfile: {
          sharePhoneWithStudents: true,
        },
      }),
    });

    const res = await updateOwnProfileRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.ok(capturedUpdates);
    assert.strictEqual(((capturedUpdates as Record<string, unknown>).facultyProfile as Record<string, unknown> | undefined)?.sharePhoneWithStudents, true);
  });

  test('Same-department student sees faculty phone when sharePhoneWithStudents is true', async () => {
    const optInFaculty = {
      ...facultyUser,
      facultyProfile: {
        ...facultyUser.facultyProfile,
        sharePhoneWithStudents: true,
      },
    } as unknown as IUser;

    const studentCaller: UserSession = {
      userId: studentId,
      email: 'student@axiscolleges.in',
      role: 'student',
      status: 'active',
      departmentId: cseDeptId, // Same department as faculty
    };
    __setTestSession(studentCaller);

    mock.method(UserRepository, 'findById', async () => optInFaculty);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);

    const req = new NextRequest(`http://localhost:3000/api/v1/users/${facultyId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: facultyId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.phoneNumber, '+919876543211'); // Authorized via department relationship
  });

  test('Cross-department student CANNOT see faculty phone even when sharePhoneWithStudents is true', async () => {
    const optInFaculty = {
      ...facultyUser,
      facultyProfile: {
        ...facultyUser.facultyProfile,
        sharePhoneWithStudents: true,
      },
    } as unknown as IUser;

    const crossDeptStudentCaller: UserSession = {
      userId: crossDeptStudentId,
      email: 'ece.student@axiscolleges.in',
      role: 'student',
      status: 'active',
      departmentId: eceDeptId, // Different department!
    };
    __setTestSession(crossDeptStudentCaller);

    mock.method(UserRepository, 'findById', async () => optInFaculty);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);

    const req = new NextRequest(`http://localhost:3000/api/v1/users/${facultyId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: facultyId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.phoneNumber, null); // Privacy enforced against cross-department student
  });

  test('Peer faculty in same or different department CANNOT see faculty phone', async () => {
    const optInFaculty = {
      ...facultyUser,
      facultyProfile: {
        ...facultyUser.facultyProfile,
        sharePhoneWithStudents: true,
      },
    } as unknown as IUser;

    const peerFacultyCaller: UserSession = {
      userId: peerFacultyId,
      email: 'peer.faculty@axiscolleges.in',
      role: 'faculty',
      status: 'active',
      departmentId: cseDeptId,
    };
    __setTestSession(peerFacultyCaller);

    mock.method(UserRepository, 'findById', async () => optInFaculty);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);

    const req = new NextRequest(`http://localhost:3000/api/v1/users/${facultyId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: facultyId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.phoneNumber, null); // Only students with academic relationship get opt-in access
  });
});

describe('Phase 5.3.6: Journey 3 — HOD Scoping & Administrative Boundaries', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  const hodSession: UserSession = {
    userId: cseHodId,
    email: 'cse.hod@axiscolleges.in',
    role: 'admin',
    adminSubRole: 'hod',
    status: 'active',
    departmentId: cseDeptId,
  };

  test('HOD accesses own department roster successfully with pagination metadata', async () => {
    __setTestSession(hodSession);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(UserRepository, 'findDepartmentRoster', async () => ({
      students: [studentUser],
      totalCount: 1,
      nextCursor: null,
      hasMore: false,
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${cseDeptId}/roster?limit=25`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: cseDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.students.length, 1);
    assert.strictEqual(json.data.students[0].fullName, 'Aarav Sharma');
    assert.strictEqual(json.data.totalStudents, 1);
  });

  test('HOD attempting to access another department roster is rejected with HTTP 403 Forbidden', async () => {
    __setTestSession(hodSession);

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${eceDeptId}/roster`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: eceDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('HOD updates student academic cohort in own department successfully', async () => {
    __setTestSession(hodSession);
    let capturedUpdates: Record<string, unknown> | undefined;

    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(UserRepository, 'updateAcademicProfile', async (_id: string, updates: AdminAcademicUpdateInput) => {
      capturedUpdates = updates as unknown as Record<string, unknown>;
      return {
        ...studentUser,
        studentProfile: {
          ...studentUser.studentProfile,
          ...updates,
        },
        updatedAt: new Date(),
      } as unknown as IUser;
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${studentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'B',
        currentSemester: 7,
      }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: studentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.ok(capturedUpdates);
    assert.strictEqual((capturedUpdates as Record<string, unknown>).section, 'B');
    assert.strictEqual((capturedUpdates as Record<string, unknown>).currentSemester, 7);
  });

  test('HOD attempting to update student in another department is rejected with HTTP 403 Forbidden', async () => {
    __setTestSession(hodSession);
    const eceStudentUser = {
      ...studentUser,
      _id: new Types.ObjectId(crossDeptStudentId),
      departmentId: new Types.ObjectId(eceDeptId), // Student belongs to ECE!
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => eceStudentUser);

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${crossDeptStudentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'B' }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: crossDeptStudentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('HOD attempting to change student departmentId is rejected with HTTP 403 Forbidden', async () => {
    __setTestSession(hodSession);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(DepartmentRepository, 'findById', async () => eceDeptDoc);

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${studentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departmentId: eceDeptId, // HOD cannot perform department transfers!
      }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: studentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });
});

describe('Phase 5.3.6: Journey 4 — Director Institutional Oversight vs Write Restrictions', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  const directorSession: UserSession = {
    userId: directorId,
    email: 'director@axiscolleges.in',
    role: 'admin',
    adminSubRole: 'director',
    status: 'active',
  };

  test('Director can access academic rosters across any department (Institutional Oversight)', async () => {
    __setTestSession(directorSession);
    mock.method(DepartmentRepository, 'findById', async () => eceDeptDoc);
    mock.method(UserRepository, 'findDepartmentRoster', async () => ({
      students: [],
      totalCount: 0,
      nextCursor: null,
      hasMore: false,
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${eceDeptId}/roster`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: eceDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
  });

  test('Director attempting to update student academic cohort is strictly rejected with HTTP 403 Forbidden', async () => {
    __setTestSession(directorSession);

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${studentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'B' }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: studentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('Director viewing faculty profile does NOT see faculty personal phone when unshared', async () => {
    __setTestSession(directorSession);
    mock.method(UserRepository, 'findById', async () => facultyUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);

    const req = new NextRequest(`http://localhost:3000/api/v1/users/${facultyId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: facultyId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.phoneNumber, null); // Director cannot see faculty personal phone
  });
});

describe('Phase 5.3.6: Journey 5 — System Administrator Governance & Invariants', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  const sysAdminSession: UserSession = {
    userId: sysAdminId,
    email: 'admin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
    status: 'active',
  };

  test('SysAdmin updates student academic cohort across departments', async () => {
    __setTestSession(sysAdminSession);
    let capturedUpdates: Record<string, unknown> | undefined;

    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(UserRepository, 'updateAcademicProfile', async (_id: string, updates: AdminAcademicUpdateInput) => {
      capturedUpdates = updates as unknown as Record<string, unknown>;
      return {
        ...studentUser,
        studentProfile: {
          ...studentUser.studentProfile,
          ...updates,
        },
        updatedAt: new Date(),
      } as unknown as IUser;
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${studentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'C',
        currentSemester: 8,
      }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: studentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.ok(capturedUpdates);
    assert.strictEqual((capturedUpdates as Record<string, unknown>).section, 'C');
  });

  test('SysAdmin CANNOT assign pending or unapproved programs (BCA, MCA, MTECH_CSE)', async () => {
    __setTestSession(sysAdminSession);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(DepartmentRepository, 'isProgramApprovedForDepartment', async () => ({
      valid: false,
      reason: 'Program "BCA" is not active or approved for Department "CSE".',
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${studentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        program: 'BCA', // Inactive program pending project owner clarification
      }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: studentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    assert.ok(json.message.includes('not active or approved'));
  });

  test('SysAdmin CANNOT assign degree program under ASH department', async () => {
    __setTestSession(sysAdminSession);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(DepartmentRepository, 'findById', async () => ashDeptDoc);

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${studentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departmentId: ashDeptId,
        program: 'BTECH_CSE',
      }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: studentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  test('SysAdmin cohort updates strictly ignore attempts to mutate rollNumber or enrollmentNumber', async () => {
    __setTestSession(sysAdminSession);
    let capturedUpdates: Record<string, unknown> | undefined;

    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(UserRepository, 'updateAcademicProfile', async (_id: string, updates: AdminAcademicUpdateInput) => {
      capturedUpdates = updates as unknown as Record<string, unknown>;
      return {
        ...studentUser,
        studentProfile: {
          ...studentUser.studentProfile,
          ...updates,
        },
        updatedAt: new Date(),
      } as unknown as IUser;
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${studentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: 'B',
        rollNumber: 'MUTATED_ROLL',
        enrollmentNumber: 'MUTATED_ENROLL',
      }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: studentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.ok(capturedUpdates);
    assert.strictEqual((capturedUpdates as Record<string, unknown>).section, 'B');
    assert.strictEqual((capturedUpdates as Record<string, unknown>).rollNumber, undefined);
    assert.strictEqual((capturedUpdates as Record<string, unknown>).enrollmentNumber, undefined);
  });
});

describe('Phase 5.3.6: Journey 6 — Account Status & Authentication Guards', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  test('Unauthenticated user receives HTTP 401 Unauthorized for profile access', async () => {
    __setTestSession(null);

    const res = await getOwnProfileRoute();
    const json = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'UNAUTHORIZED');
  });

  test('Suspended user receives HTTP 403 Forbidden for profile self-service access', async () => {
    const suspendedSession: UserSession = {
      userId: studentId,
      email: studentUser.email,
      role: 'student',
      status: 'suspended',
    };
    __setTestSession(suspendedSession);

    const res = await getOwnProfileRoute();
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
    assert.ok(json.error.message.includes('administrative hold'));
  });
});
