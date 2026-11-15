/**
 * Automated REST API Integration Test Suite for Profile Endpoints (Phase 5.3.4).
 * 
 * Verifies:
 * 1. GET /api/v1/profile/me (Authenticated Owner Profile & Unauthenticated Denial)
 * 2. PATCH /api/v1/profile/me (Self-Service Updates & Mass-Assignment Defense)
 * 3. GET /api/v1/users/[id]/profile (Privacy Projections, Faculty Phone Toggle & SysAdmin Audit)
 * 4. GET /api/v1/departments/[id]/roster (Scoping, Role Gates, Query Bounds & Cursor Pagination)
 * 5. PATCH /api/v1/admin/users/[id]/academic-profile (Admin/HOD Scoping, Director Denial, Program Rules)
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

describe('Phase 5.3.4 — 1. Current User Profile API (GET & PATCH /api/v1/profile/me)', () => {
  afterEach(() => {
    __setTestSession(undefined);
    mock.restoreAll();
  });

  const studentSession: UserSession = {
    userId: '6730a005f8b1a2001a000001',
    email: 'aarav.sharma@axiscolleges.in',
    role: 'student',
    status: 'active',
    departmentId: '6730a005f8b1a2001a000010',
  };

  const fakeStudentUser = {
    _id: new Types.ObjectId(studentSession.userId),
    email: studentSession.email,
    username: 'aarav.sharma',
    fullName: 'Aarav Sharma',
    role: 'student',
    status: 'active',
    isEmailVerified: true,
    isProfileComplete: true,
    departmentId: new Types.ObjectId(studentSession.departmentId),
    phoneNumber: '+919876543201',
    bio: 'Third-year CSE scholar',
    studentProfile: {
      rollNumber: '24BCSE101',
      enrollmentNumber: 'EN202401',
      program: 'BTECH_CSE',
      batchYear: 2026,
      currentSemester: 3,
      section: 'A',
      admissionType: 'regular',
    },
    createdAt: new Date('2024-08-01T00:00:00Z'),
    updatedAt: new Date('2024-08-01T00:00:00Z'),
  } as unknown as IUser;

  const fakeDept = {
    _id: new Types.ObjectId(studentSession.departmentId),
    name: 'Computer Science and Engineering',
    code: 'CSE',
  } as unknown as IDepartment;

  test('GET /api/v1/profile/me returns HTTP 200 with full OwnerProfileDTO for authenticated user', async () => {
    __setTestSession(studentSession);
    mock.method(UserRepository, 'findById', async () => fakeStudentUser);
    mock.method(DepartmentRepository, 'findById', async () => fakeDept);

    const res = await getOwnProfileRoute();
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, studentSession.userId);
    assert.strictEqual(json.data.fullName, 'Aarav Sharma');
    assert.strictEqual(json.data.email, 'aarav.sharma@axiscolleges.in');
    assert.strictEqual(json.data.departmentCode, 'CSE');
    assert.strictEqual(json.data.studentProfile?.rollNumber, '24BCSE101');
    assert.strictEqual(json.data.studentProfile?.enrollmentNumber, 'EN202401');
  });

  test('GET /api/v1/profile/me returns HTTP 401 when unauthenticated', async () => {
    __setTestSession(null);

    const res = await getOwnProfileRoute();
    const json = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'UNAUTHORIZED');
  });

  test('GET /api/v1/profile/me returns HTTP 403 when user account is suspended', async () => {
    __setTestSession({ ...studentSession, status: 'suspended' });

    const res = await getOwnProfileRoute();
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('PATCH /api/v1/profile/me successfully updates whitelisted bio and phoneNumber', async () => {
    __setTestSession(studentSession);

    mock.method(UserRepository, 'findById', async () => fakeStudentUser);
    mock.method(DepartmentRepository, 'findById', async () => fakeDept);
    mock.method(UserRepository, 'updateProfile', async (_id: string, updateData: UpdateUserProfileInput) => ({
      ...fakeStudentUser,
      ...updateData,
      updatedAt: new Date(),
    } as unknown as IUser));

    const req = new NextRequest('http://localhost:3000/api/v1/profile/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bio: 'Updated bio for student',
        phoneNumber: '+919876543299',
      }),
    });

    const res = await updateOwnProfileRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.phoneNumber, '+919876543299');
  });

  test('PATCH /api/v1/profile/me strips mass-assignment attempts (role, department, section)', async () => {
    __setTestSession(studentSession);

    let capturedUpdate: UpdateUserProfileInput | null = null;
    mock.method(UserRepository, 'findById', async () => fakeStudentUser);
    mock.method(DepartmentRepository, 'findById', async () => fakeDept);
    mock.method(UserRepository, 'updateProfile', async (_id: string, updateData: UpdateUserProfileInput) => {
      capturedUpdate = updateData;
      return { ...fakeStudentUser, ...updateData, updatedAt: new Date() } as unknown as IUser;
    });

    const req = new NextRequest('http://localhost:3000/api/v1/profile/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Aarav Sharma Updated',
        role: 'super_admin', // Malicious privilege escalation
        departmentId: '6730a005f8b1a2001a000099', // Malicious department change
        studentProfile: { section: 'Z' }, // Malicious section change
      }),
    });

    const res = await updateOwnProfileRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    const rawCaptured = capturedUpdate as (UpdateUserProfileInput & Record<string, unknown>) | null;
    assert.strictEqual(rawCaptured?.fullName, 'Aarav Sharma Updated');
    assert.strictEqual(rawCaptured?.role, undefined);
    assert.strictEqual(rawCaptured?.departmentId, undefined);
    assert.strictEqual(rawCaptured?.studentProfile, undefined);
  });
});

describe('Phase 5.3.4 — 2. Individual User Profile API (GET /api/v1/users/[id]/profile)', () => {
  afterEach(() => {
    __setTestSession(undefined);
    mock.restoreAll();
  });

  const studentCaller: UserSession = {
    userId: '6730a005f8b1a2001a000001',
    email: 'aarav.sharma@axiscolleges.in',
    role: 'student',
    status: 'active',
    departmentId: '6730a005f8b1a2001a000010',
  };

  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'admin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
    status: 'active',
  };

  const targetFacultyId = '6730a005f8b1a2001a000002';
  const fakeFacultyUser = {
    _id: new Types.ObjectId(targetFacultyId),
    email: 'ananya.sen@axiscolleges.in',
    username: 'ananya.sen',
    fullName: 'Dr. Ananya Sen',
    role: 'faculty',
    status: 'active',
    phoneNumber: '+919876543202',
    departmentId: new Types.ObjectId('6730a005f8b1a2001a000010'),
    facultyProfile: {
      employeeId: 'EMP1001',
      designation: 'Associate Professor',
      sharePhoneWithStudents: false,
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  } as unknown as IUser;

  test('GET /api/v1/users/[id]/profile returns HTTP 400 for malformed ObjectId', async () => {
    __setTestSession(studentCaller);

    const req = new NextRequest('http://localhost:3000/api/v1/users/invalid-id/profile');
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: 'invalid-id' }) });
    const json = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  test('GET /api/v1/users/[id]/profile returns HTTP 404 when target user is not found', async () => {
    __setTestSession(studentCaller);
    mock.method(UserRepository, 'findById', async () => null);

    const validNonExistentId = '6730a005f8b1a2001a000044';
    const req = new NextRequest(`http://localhost:3000/api/v1/users/${validNonExistentId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: validNonExistentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 404);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'NOT_FOUND');
  });

  test('GET /api/v1/users/[id]/profile hides faculty phone from student when sharePhoneWithStudents is false', async () => {
    __setTestSession(studentCaller);
    mock.method(UserRepository, 'findById', async () => fakeFacultyUser);
    mock.method(DepartmentRepository, 'findById', async () => ({
      _id: fakeFacultyUser.departmentId,
      name: 'Computer Science and Engineering',
      code: 'CSE',
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/users/${targetFacultyId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: targetFacultyId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.fullName, 'Dr. Ananya Sen');
    assert.strictEqual(json.data.phoneNumber, null); // Privacy enforced
  });

  test('GET /api/v1/users/[id]/profile shows faculty phone to student when sharePhoneWithStudents is true', async () => {
    __setTestSession(studentCaller);
    const facultyWithPhoneSharing = {
      ...fakeFacultyUser,
      facultyProfile: {
        ...fakeFacultyUser.facultyProfile,
        sharePhoneWithStudents: true,
      },
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => facultyWithPhoneSharing);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const req = new NextRequest(`http://localhost:3000/api/v1/users/${targetFacultyId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: targetFacultyId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.phoneNumber, '+919876543202');
  });

  test('GET /api/v1/users/[id]/profile hides faculty phone from cross-department student even when sharePhoneWithStudents is true', async () => {
    const crossDeptStudentCaller: UserSession = {
      ...studentCaller,
      departmentId: '6730a005f8b1a2001a000099', // Different department
    };
    __setTestSession(crossDeptStudentCaller);

    const facultyWithPhoneSharing = {
      ...fakeFacultyUser,
      facultyProfile: {
        ...fakeFacultyUser.facultyProfile,
        sharePhoneWithStudents: true,
      },
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => facultyWithPhoneSharing);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const req = new NextRequest(`http://localhost:3000/api/v1/users/${targetFacultyId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: targetFacultyId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.phoneNumber, null); // Privacy enforced for cross-department student
  });

  test('GET /api/v1/users/[id]/profile returns AdminProfileDTO with audit fields to System Administrator', async () => {
    __setTestSession(sysAdminCaller);
    const facultyWithAudit = {
      ...fakeFacultyUser,
      provisionedBy: new Types.ObjectId(sysAdminCaller.userId),
      activatedAt: new Date('2024-02-01T10:00:00Z'),
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => facultyWithAudit);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const req = new NextRequest(`http://localhost:3000/api/v1/users/${targetFacultyId}/profile`);
    const res = await getUserProfileRoute(req, { params: Promise.resolve({ id: targetFacultyId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.provisionedBy, sysAdminCaller.userId);
    assert.strictEqual(json.data.activatedAt, new Date('2024-02-01T10:00:00Z').toISOString());
    assert.strictEqual(json.data.phoneNumber, '+919876543202');
  });
});

describe('Phase 5.3.4 — 3. Department Academic Roster API (GET /api/v1/departments/[id]/roster)', () => {
  afterEach(() => {
    __setTestSession(undefined);
    mock.restoreAll();
  });

  const cseDeptId = '6730a005f8b1a2001a000010';
  const eceDeptId = '6730a005f8b1a2001a000020';

  const fakeDept = {
    _id: new Types.ObjectId(cseDeptId),
    name: 'Computer Science and Engineering',
    code: 'CSE',
  } as unknown as IDepartment;

  const fakeRosterStudents = [
    {
      _id: new Types.ObjectId('6730a005f8b1a2001a000001'),
      fullName: 'Aarav Sharma',
      username: 'aarav.sharma',
      role: 'student',
      status: 'active',
      departmentId: new Types.ObjectId(cseDeptId),
      studentProfile: {
        rollNumber: '24BCSE101',
        enrollmentNumber: 'EN202401',
        program: 'BTECH_CSE',
        batchYear: 2026,
        currentSemester: 3,
        section: 'A',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as unknown as IUser[];

  test('GET /api/v1/departments/[id]/roster returns HTTP 403 Forbidden when called by a student', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000001',
      email: 'aarav.sharma@axiscolleges.in',
      role: 'student',
      status: 'active',
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${cseDeptId}/roster`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: cseDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('GET /api/v1/departments/[id]/roster returns HTTP 403 when HOD queries another department', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000080',
      email: 'hod.ece@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      status: 'active',
      departmentId: eceDeptId,
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${cseDeptId}/roster`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: cseDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('GET /api/v1/departments/[id]/roster returns HTTP 200 with RosterStudentDTOs for authorized HOD', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000081',
      email: 'hod.cse@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      status: 'active',
      departmentId: cseDeptId,
    });

    mock.method(DepartmentRepository, 'findById', async () => fakeDept);
    mock.method(UserRepository, 'findDepartmentRoster', async () => ({
      students: fakeRosterStudents,
      totalCount: 1,
      nextCursor: null,
      hasMore: false,
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${cseDeptId}/roster?program=BTECH_CSE&batchYear=2026&currentSemester=3&section=A`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: cseDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.department.code, 'CSE');
    assert.strictEqual(json.data.totalStudents, 1);
    assert.strictEqual(json.data.students[0].rollNumber, '24BCSE101');
    assert.strictEqual(json.data.students[0].enrollmentNumber, 'EN202401');
  });

  test('GET /api/v1/departments/[id]/roster returns HTTP 200 for Director across departments (institutional oversight)', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000090',
      email: 'director@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'director',
      status: 'active',
    });

    mock.method(DepartmentRepository, 'findById', async () => fakeDept);
    mock.method(UserRepository, 'findDepartmentRoster', async () => ({
      students: fakeRosterStudents,
      totalCount: 1,
      nextCursor: null,
      hasMore: false,
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${cseDeptId}/roster`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: cseDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.department.code, 'CSE');
  });

  test('GET /api/v1/departments/[id]/roster returns HTTP 400 for invalid query parameters (limit > 100)', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000099',
      email: 'admin@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'sys_admin',
      status: 'active',
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${cseDeptId}/roster?limit=250`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: cseDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  test('GET /api/v1/departments/[id]/roster supports cursor-based pagination parameters', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000099',
      email: 'admin@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'sys_admin',
      status: 'active',
    });

    mock.method(DepartmentRepository, 'findById', async () => fakeDept);
    mock.method(UserRepository, 'findDepartmentRoster', async () => ({
      students: fakeRosterStudents,
      totalCount: 50,
      nextCursor: '6730a005f8b1a2001a000001',
      hasMore: true,
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/departments/${cseDeptId}/roster?cursor=6730a005f8b1a2001a000000&limit=10`);
    const res = await getDepartmentRosterRoute(req, { params: Promise.resolve({ id: cseDeptId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.nextCursor, '6730a005f8b1a2001a000001');
    assert.strictEqual(json.data.hasMore, true);
  });
});

describe('Phase 5.3.4 — 4. Administrative Academic Profile Update API (PATCH /api/v1/admin/users/[id]/academic-profile)', () => {
  afterEach(() => {
    __setTestSession(undefined);
    mock.restoreAll();
  });

  const cseDeptId = '6730a005f8b1a2001a000010';
  const eceDeptId = '6730a005f8b1a2001a000020';
  const targetStudentId = '6730a005f8b1a2001a000001';

  const fakeStudent = {
    _id: new Types.ObjectId(targetStudentId),
    role: 'student',
    fullName: 'Aarav Sharma',
    departmentId: new Types.ObjectId(cseDeptId),
    studentProfile: {
      rollNumber: '24BCSE101',
      enrollmentNumber: 'EN202401',
      program: 'BTECH_CSE',
      batchYear: 2026,
      currentSemester: 3,
      section: 'A',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as IUser;

  const fakeCseDept = {
    _id: new Types.ObjectId(cseDeptId),
    name: 'Computer Science and Engineering',
    code: 'CSE',
    isActive: true,
  } as unknown as IDepartment;

  test('PATCH /api/v1/admin/users/[id]/academic-profile returns HTTP 403 when called by student or non-HOD faculty', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000001',
      email: 'student@axiscolleges.in',
      role: 'student',
      status: 'active',
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${targetStudentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section: 'B' }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: targetStudentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('PATCH /api/v1/admin/users/[id]/academic-profile returns HTTP 403 when called by Director (policy restriction)', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000090',
      email: 'director@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'director',
      status: 'active',
    });

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${targetStudentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section: 'B' }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: targetStudentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('PATCH /api/v1/admin/users/[id]/academic-profile returns HTTP 403 when HOD tries to update student in another department', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000080',
      email: 'hod.ece@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      status: 'active',
      departmentId: eceDeptId,
    });

    mock.method(UserRepository, 'findById', async () => fakeStudent);

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${targetStudentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section: 'B' }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: targetStudentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('PATCH /api/v1/admin/users/[id]/academic-profile allows authorized HOD to update section for student in own department', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000081',
      email: 'hod.cse@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      status: 'active',
      departmentId: cseDeptId,
    });

    mock.method(UserRepository, 'findById', async () => fakeStudent);
    mock.method(UserRepository, 'updateAcademicProfile', async (_id: string, updateData: AdminAcademicUpdateInput) => ({
      ...fakeStudent,
      studentProfile: {
        ...fakeStudent.studentProfile,
        ...updateData,
      },
      updatedAt: new Date(),
    } as unknown as IUser));
    mock.method(DepartmentRepository, 'findById', async () => fakeCseDept);

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${targetStudentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section: 'B', currentSemester: 4 }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: targetStudentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.studentProfile?.section, 'B');
    assert.strictEqual(json.data.studentProfile?.currentSemester, 4);
  });

  test('PATCH /api/v1/admin/users/[id]/academic-profile returns HTTP 400 when assigning inactive/pending program (BCA)', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000099',
      email: 'admin@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'sys_admin',
      status: 'active',
    });

    mock.method(UserRepository, 'findById', async () => fakeStudent);
    mock.method(DepartmentRepository, 'findById', async () => fakeCseDept);
    mock.method(DepartmentRepository, 'isProgramApprovedForDepartment', async () => ({
      valid: false,
      reason: 'Program "BCA" is not active or approved for Department "CSE".',
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${targetStudentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ program: 'BCA' }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: targetStudentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    assert.ok(json.message.includes('not active or approved'));
  });

  test('PATCH /api/v1/admin/users/[id]/academic-profile returns HTTP 400 when attempting to assign program to ASH', async () => {
    __setTestSession({
      userId: '6730a005f8b1a2001a000099',
      email: 'admin@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'sys_admin',
      status: 'active',
    });

    const ashDeptId = '6730a005f8b1a2001a000070';
    mock.method(UserRepository, 'findById', async () => fakeStudent);
    mock.method(DepartmentRepository, 'findById', async () => ({
      _id: new Types.ObjectId(ashDeptId),
      name: 'Applied Sciences & Humanities',
      code: 'ASH',
      isActive: false,
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/admin/users/${targetStudentId}/academic-profile`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ departmentId: ashDeptId, program: 'DIPLOMA' }),
    });

    const res = await updateAcademicProfileRoute(req, { params: Promise.resolve({ id: targetStudentId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });
});

