/**
 * Automated Unit Test Suite for Profile Service Layer & Context-Aware Access Control (Phase 5.3.3).
 * 
 * Tests:
 * 1. Self-Service Profile Retrieval (getOwnProfile) & Graceful Department Population.
 * 2. Context-Aware Profile Viewing (getProfileById) & Directory DTO Security.
 * 3. Faculty Phone Privacy Rules & Legacy Preference Invariants.
 * 4. Academic Roster Retrieval & Department Scoping (getDepartmentRoster).
 * 5. Self-Service Profile Updates & Mass-Assignment Defense (updateOwnProfile).
 * 6. Administrative Academic Updates & Department-Program Validation (updateAcademicProfile).
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import { ProfileService } from '../../src/lib/services/profile.service';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/lib/errors/app-error';
import type { IUser, UserSession, UpdateUserProfileInput } from '../../src/types/user';
import type { IDepartment } from '../../src/types/department';
import type { AdminProfileDTO } from '../../src/types/profile';

describe('Phase 5.3.3 — 1. Self-Service Profile Retrieval & Department Population', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const studentSession: UserSession = {
    userId: '6730a005f8b1a2001a000001',
    email: 'aarav.sharma@axiscolleges.in',
    role: 'student',
    status: 'active',
  };

  test('getOwnProfile returns full OwnerProfileDTO with populated department metadata', async () => {
    const fakeDeptId = new Types.ObjectId('6730a005f8b1a2001a000010');
    const fakeUser = {
      _id: new Types.ObjectId(studentSession.userId),
      email: studentSession.email,
      username: 'aarav.sharma',
      fullName: 'Aarav Sharma',
      role: 'student',
      status: 'active',
      isEmailVerified: true,
      isProfileComplete: true,
      phoneNumber: '+919876543210',
      avatarUrl: 'https://cdn.axiscolleges.in/avatar.png',
      departmentId: fakeDeptId,
      studentProfile: {
        rollNumber: '24BCSE104',
        enrollmentNumber: 'EN2024CSE0104',
        program: 'BTECH_CSE',
        batchYear: 2028,
        admissionYear: 2024,
        currentSemester: 3,
        section: 'A',
        admissionType: 'regular',
      },
      createdAt: new Date('2024-08-01T00:00:00Z'),
      updatedAt: new Date('2024-08-01T00:00:00Z'),
    } as unknown as IUser;

    const fakeDept = {
      _id: fakeDeptId,
      name: 'Computer Science & Engineering',
      code: 'CSE',
      isActive: true,
    } as unknown as IDepartment;

    mock.method(UserRepository, 'findById', async () => fakeUser);
    mock.method(DepartmentRepository, 'findById', async () => fakeDept);

    const profile = await ProfileService.getOwnProfile(studentSession);

    assert.strictEqual(profile.id, studentSession.userId);
    assert.strictEqual(profile.fullName, 'Aarav Sharma');
    assert.strictEqual(profile.phoneNumber, '+919876543210');
    assert.strictEqual(profile.departmentName, 'Computer Science & Engineering');
    assert.strictEqual(profile.departmentCode, 'CSE');
    assert.strictEqual(profile.studentProfile?.rollNumber, '24BCSE104');
    assert.strictEqual(profile.studentProfile?.program, 'BTECH_CSE');
  });

  test('getOwnProfile gracefully handles missing or deleted department reference without throwing', async () => {
    const missingDeptId = new Types.ObjectId('6730a005f8b1a2001a000099');
    const fakeUser = {
      _id: new Types.ObjectId(studentSession.userId),
      email: studentSession.email,
      fullName: 'Aarav Sharma',
      role: 'student',
      status: 'active',
      departmentId: missingDeptId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => fakeUser);
    mock.method(DepartmentRepository, 'findById', async () => null); // Dept deleted or missing

    const profile = await ProfileService.getOwnProfile(studentSession);

    assert.strictEqual(profile.departmentId, missingDeptId.toString());
    assert.strictEqual(profile.departmentName, null);
    assert.strictEqual(profile.departmentCode, null);
  });

  test('getOwnProfile throws NotFoundError if authenticated user document does not exist', async () => {
    mock.method(UserRepository, 'findById', async () => null);

    await assert.rejects(
      async () => {
        await ProfileService.getOwnProfile(studentSession);
      },
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        return true;
      }
    );
  });
});

describe('Phase 5.3.3 — 2. Context-Aware Profile Viewing & Directory DTO Security', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const studentCaller: UserSession = {
    userId: '6730a005f8b1a2001a000001',
    email: 'student1@axiscolleges.in',
    role: 'student',
    status: 'active',
  };

  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'admin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
    status: 'active',
  };

  test('Student viewing another student receives Public Directory DTO without private identifiers or phone', async () => {
    const targetStudentId = '6730a005f8b1a2001a000002';
    const targetStudent = {
      _id: new Types.ObjectId(targetStudentId),
      fullName: 'Rohan Gupta',
      username: 'rohan.gupta',
      role: 'student',
      phoneNumber: '+919876543299',
      avatarUrl: 'https://cdn.axiscolleges.in/rohan.png',
      departmentId: new Types.ObjectId('6730a005f8b1a2001a000010'),
      studentProfile: {
        rollNumber: '24BCSE105',
        enrollmentNumber: 'EN2024CSE0105',
        program: 'BTECH_CSE',
        currentSemester: 3,
        section: 'B',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => targetStudent);
    mock.method(DepartmentRepository, 'findById', async () => ({
      _id: new Types.ObjectId('6730a005f8b1a2001a000010'),
      name: 'Computer Science & Engineering',
      code: 'CSE',
    } as unknown as IDepartment));

    const result = await ProfileService.getProfileById(targetStudentId, studentCaller);

    // Allowed directory fields
    assert.strictEqual(result.fullName, 'Rohan Gupta');
    assert.strictEqual(result.username, 'rohan.gupta');
    const rawResult = result as unknown as Record<string, unknown>;
    assert.strictEqual(rawResult.program, 'BTECH_CSE');
    assert.strictEqual(rawResult.section, 'B');

    // Forbidden fields MUST be stripped
    assert.strictEqual(result.phoneNumber, null);
    assert.strictEqual(rawResult.rollNumber, undefined);
    assert.strictEqual(rawResult.enrollmentNumber, undefined);
    assert.strictEqual(rawResult.studentProfile, undefined);
  });

  test('System Administrator receives full AdminProfileDTO with audit metadata', async () => {
    const targetId = '6730a005f8b1a2001a000002';
    const targetStudent = {
      _id: new Types.ObjectId(targetId),
      email: 'rohan.gupta@axiscolleges.in',
      fullName: 'Rohan Gupta',
      role: 'student',
      status: 'active',
      phoneNumber: '+919876543299',
      provisionedBy: new Types.ObjectId('6730a005f8b1a2001a000099'),
      activatedAt: new Date('2024-08-05T10:00:00Z'),
      studentProfile: {
        rollNumber: '24BCSE105',
        enrollmentNumber: 'EN2024CSE0105',
        batchYear: 2028,
        currentSemester: 3,
        section: 'B',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => targetStudent);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const result = (await ProfileService.getProfileById(targetId, sysAdminCaller)) as AdminProfileDTO;

    assert.strictEqual(result.fullName, 'Rohan Gupta');
    assert.strictEqual(result.phoneNumber, '+919876543299');
    assert.strictEqual(result.provisionedBy, '6730a005f8b1a2001a000099');
    assert.strictEqual(result.activatedAt, new Date('2024-08-05T10:00:00Z').toISOString());
    assert.strictEqual(result.studentProfile?.rollNumber, '24BCSE105');
  });
});

describe('Phase 5.3.3 — 3. Faculty Phone Privacy Rules & Legacy Invariants', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const facultyId = '6730a005f8b1a2001a000050';
  const cseDeptId = '6730a005f8b1a2001a000010';
  const eceDeptId = '6730a005f8b1a2001a000020';

  const baseFacultyDoc = {
    _id: new Types.ObjectId(facultyId),
    fullName: 'Dr. Vivek Shukla',
    username: 'dr.shukla',
    role: 'faculty',
    status: 'active',
    phoneNumber: '+919876543211',
    departmentId: new Types.ObjectId(cseDeptId),
    facultyProfile: {
      employeeId: 'FAC001',
      designation: 'Professor',
      cabinRoom: 'Block B, 201',
      specialization: ['Distributed Systems'],
      sharePhoneWithStudents: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as IUser;

  test('Faculty phone is hidden by default from students when sharePhoneWithStudents is false', async () => {
    mock.method(UserRepository, 'findById', async () => baseFacultyDoc);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const studentCaller: UserSession = {
      userId: '6730a005f8b1a2001a000001',
      email: 'student@axiscolleges.in',
      role: 'student',
    };

    const profile = await ProfileService.getProfileById(facultyId, studentCaller);
    assert.strictEqual(profile.phoneNumber, null);
    assert.strictEqual(profile.fullName, 'Dr. Vivek Shukla');
  });

  test('Faculty phone is visible to students when sharePhoneWithStudents is explicitly true and in same department', async () => {
    const optInFacultyDoc = {
      ...baseFacultyDoc,
      facultyProfile: {
        ...baseFacultyDoc.facultyProfile,
        sharePhoneWithStudents: true,
      },
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => optInFacultyDoc);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const studentCaller: UserSession = {
      userId: '6730a005f8b1a2001a000001',
      email: 'student@axiscolleges.in',
      role: 'student',
      departmentId: cseDeptId,
    };

    const profile = await ProfileService.getProfileById(facultyId, studentCaller);
    assert.strictEqual(profile.phoneNumber, '+919876543211');
  });

  test('Faculty phone is hidden from cross-department students even when sharePhoneWithStudents is true', async () => {
    const optInFacultyDoc = {
      ...baseFacultyDoc,
      facultyProfile: {
        ...baseFacultyDoc.facultyProfile,
        sharePhoneWithStudents: true,
      },
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => optInFacultyDoc);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const crossDeptStudentCaller: UserSession = {
      userId: '6730a005f8b1a2001a000002',
      email: 'ece.student@axiscolleges.in',
      role: 'student',
      departmentId: eceDeptId,
    };

    const profile = await ProfileService.getProfileById(facultyId, crossDeptStudentCaller);
    assert.strictEqual(profile.phoneNumber, null);
  });

  test('Legacy faculty records missing sharePhoneWithStudents safely evaluate as false', async () => {
    const legacyFacultyDoc = {
      ...baseFacultyDoc,
      facultyProfile: {
        employeeId: 'FAC001',
        designation: 'Professor',
        // sharePhoneWithStudents omitted (undefined)
      },
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => legacyFacultyDoc);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const studentCaller: UserSession = {
      userId: '6730a005f8b1a2001a000001',
      email: 'student@axiscolleges.in',
      role: 'student',
    };

    const profile = await ProfileService.getProfileById(facultyId, studentCaller);
    assert.strictEqual(profile.phoneNumber, null);
  });

  test('HOD can view faculty phone only within their assigned department scope', async () => {
    mock.method(UserRepository, 'findById', async () => baseFacultyDoc);
    mock.method(DepartmentRepository, 'findById', async () => null);

    // 1. Same-department HOD (CSE HOD viewing CSE faculty)
    const cseHodCaller: UserSession = {
      userId: '6730a005f8b1a2001a000088',
      email: 'cse.hod@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      departmentId: cseDeptId,
    };

    const sameDeptProfile = await ProfileService.getProfileById(facultyId, cseHodCaller);
    assert.strictEqual(sameDeptProfile.phoneNumber, '+919876543211');

    // 2. Cross-department HOD (ECE HOD viewing CSE faculty)
    const eceHodCaller: UserSession = {
      userId: '6730a005f8b1a2001a000089',
      email: 'ece.hod@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      departmentId: eceDeptId,
    };

    const crossDeptProfile = await ProfileService.getProfileById(facultyId, eceHodCaller);
    assert.strictEqual(crossDeptProfile.phoneNumber, null); // Masked to null!
  });

  test('Faculty member viewing their own profile always sees their own phone number', async () => {
    mock.method(UserRepository, 'findById', async () => baseFacultyDoc);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const facultyCaller: UserSession = {
      userId: facultyId,
      email: 'dr.shukla@axiscolleges.in',
      role: 'faculty',
    };

    const ownProfile = await ProfileService.getProfileById(facultyId, facultyCaller);
    assert.strictEqual(ownProfile.phoneNumber, '+919876543211');
  });
});

describe('Phase 5.3.3 — 4. Academic Roster Retrieval & Department Scoping', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const cseDeptId = '6730a005f8b1a2001a000010';
  const eceDeptId = '6730a005f8b1a2001a000020';

  const fakeDept = {
    _id: new Types.ObjectId(cseDeptId),
    name: 'Computer Science & Engineering',
    code: 'CSE',
    isActive: true,
  } as unknown as IDepartment;

  const fakeRosterStudents = [
    {
      _id: new Types.ObjectId('6730a005f8b1a2001a000001'),
      fullName: 'Aarav Sharma',
      username: 'aarav.sharma',
      role: 'student',
      studentProfile: {
        rollNumber: '24BCSE101',
        enrollmentNumber: 'EN202401',
        program: 'BTECH_CSE',
        batchYear: 2028,
        currentSemester: 3,
        section: 'A',
      },
    },
    {
      _id: new Types.ObjectId('6730a005f8b1a2001a000002'),
      fullName: 'Bhavna Sen',
      username: 'bhavna.sen',
      role: 'student',
      studentProfile: {
        rollNumber: '24BCSE102',
        enrollmentNumber: 'EN202402',
        program: 'BTECH_CSE',
        batchYear: 2028,
        currentSemester: 3,
        section: 'A',
      },
    },
  ] as unknown as IUser[];

  test('Student attempting to access academic roster is rejected with HTTP 403 Forbidden', async () => {
    const studentCaller: UserSession = {
      userId: '6730a005f8b1a2001a000001',
      email: 'student@axiscolleges.in',
      role: 'student',
    };

    await assert.rejects(
      async () => {
        await ProfileService.getDepartmentRoster(cseDeptId, studentCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.match(err.message, /Students are not authorized to access department academic rosters/);
        return true;
      }
    );
  });

  test('Faculty attempting to access another department roster is rejected with HTTP 403 Forbidden', async () => {
    const eceFacultyCaller: UserSession = {
      userId: '6730a005f8b1a2001a000055',
      email: 'ece.fac@axiscolleges.in',
      role: 'faculty',
      departmentId: eceDeptId, // ECE faculty
    };

    await assert.rejects(
      async () => {
        await ProfileService.getDepartmentRoster(cseDeptId, eceFacultyCaller); // Attempting to access CSE
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.match(err.message, /Faculty members can only access academic rosters within their assigned department/);
        return true;
      }
    );
  });

  test('HOD attempting to access another department roster is rejected with HTTP 403 Forbidden', async () => {
    const eceHodCaller: UserSession = {
      userId: '6730a005f8b1a2001a000088',
      email: 'ece.hod@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      departmentId: eceDeptId, // ECE HOD
    };

    await assert.rejects(
      async () => {
        await ProfileService.getDepartmentRoster(cseDeptId, eceHodCaller); // Attempting to access CSE
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.match(err.message, /HODs are only authorized to access rosters within their own department/);
        return true;
      }
    );
  });

  test('HOD can access their own department roster successfully', async () => {
    const cseHodCaller: UserSession = {
      userId: '6730a005f8b1a2001a000089',
      email: 'cse.hod@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      departmentId: cseDeptId,
    };

    mock.method(DepartmentRepository, 'findById', async () => fakeDept);
    mock.method(UserRepository, 'findDepartmentRoster', async () => ({
      students: fakeRosterStudents,
      totalCount: 2,
    }));

    const roster = await ProfileService.getDepartmentRoster(cseDeptId, cseHodCaller);

    assert.strictEqual(roster.department.code, 'CSE');
    assert.strictEqual(roster.totalStudents, 2);
    assert.strictEqual(roster.students.length, 2);
    assert.strictEqual(roster.students[0]?.rollNumber, '24BCSE101');
    assert.strictEqual(roster.students[0]?.enrollmentNumber, 'EN202401');
  });

  test('Director can access academic rosters across any department (institutional oversight)', async () => {
    const directorCaller: UserSession = {
      userId: '6730a005f8b1a2001a000090',
      email: 'director@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'director',
    };

    mock.method(DepartmentRepository, 'findById', async () => fakeDept);
    mock.method(UserRepository, 'findDepartmentRoster', async () => ({
      students: fakeRosterStudents,
      totalCount: 2,
    }));

    const roster = await ProfileService.getDepartmentRoster(cseDeptId, directorCaller);
    assert.strictEqual(roster.department.code, 'CSE');
    assert.strictEqual(roster.totalStudents, 2);
  });

  test('System Administrator can access academic rosters across any department', async () => {
    const sysAdminCaller: UserSession = {
      userId: '6730a005f8b1a2001a000099',
      email: 'admin@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'sys_admin',
    };

    mock.method(DepartmentRepository, 'findById', async () => fakeDept);
    mock.method(UserRepository, 'findDepartmentRoster', async () => ({
      students: fakeRosterStudents,
      totalCount: 2,
    }));

    const roster = await ProfileService.getDepartmentRoster(cseDeptId, sysAdminCaller);
    assert.strictEqual(roster.department.code, 'CSE');
    assert.strictEqual(roster.totalStudents, 2);
  });
});

describe('Phase 5.3.3 — 5. Self-Service Profile Updates & Mass-Assignment Defense', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const studentSession: UserSession = {
    userId: '6730a005f8b1a2001a000001',
    email: 'aarav.sharma@axiscolleges.in',
    role: 'student',
  };

  test('Student self-service update modifies permitted fields (bio, phoneNumber, avatarUrl)', async () => {
    const existingStudent = {
      _id: new Types.ObjectId(studentSession.userId),
      role: 'student',
      fullName: 'Aarav Sharma',
      departmentId: new Types.ObjectId('6730a005f8b1a2001a000010'),
    } as unknown as IUser;

    const updatedStudent = {
      ...existingStudent,
      fullName: 'Aarav Sharma Updated',
      phoneNumber: '+919876543299',
      bio: 'Aspiring Full Stack Engineer',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => existingStudent);
    mock.method(UserRepository, 'updateProfile', async () => updatedStudent);
    mock.method(DepartmentRepository, 'findById', async () => null);

    const result = await ProfileService.updateOwnProfile(studentSession, {
      fullName: 'Aarav Sharma Updated',
      phoneNumber: '+919876543299',
      bio: 'Aspiring Full Stack Engineer',
    });

    assert.strictEqual(result.fullName, 'Aarav Sharma Updated');
    assert.strictEqual(result.phoneNumber, '+919876543299');
  });

  test('Student attempting mass-assignment of section, role, or department has malicious fields stripped', async () => {
    const existingStudent = {
      _id: new Types.ObjectId(studentSession.userId),
      role: 'student',
      fullName: 'Aarav Sharma',
      departmentId: new Types.ObjectId('6730a005f8b1a2001a000010'),
    } as unknown as IUser;

    let interceptedUpdateData: UpdateUserProfileInput | null = null;
    mock.method(UserRepository, 'findById', async () => existingStudent);
    mock.method(UserRepository, 'updateProfile', async (_id: string, updateData: UpdateUserProfileInput) => {
      interceptedUpdateData = updateData;
      return { ...existingStudent, ...updateData, createdAt: new Date(), updatedAt: new Date() } as unknown as IUser;
    });
    mock.method(DepartmentRepository, 'findById', async () => null);

    await ProfileService.updateOwnProfile(studentSession, {
      fullName: 'Aarav Sharma Permitted',
      role: 'super_admin', // Privilege escalation attempt
      departmentId: '6730a005f8b1a2001a000099', // Department tampering attempt
      studentProfile: {
        section: 'Z', // Section self-change attempt
        program: 'BTECH_ECE',
      },
    });

    const captured = interceptedUpdateData as (UpdateUserProfileInput & Record<string, unknown>) | null;
    assert.strictEqual(captured?.fullName, 'Aarav Sharma Permitted');
    assert.strictEqual(captured?.role, undefined);
    assert.strictEqual(captured?.departmentId, undefined);
    assert.strictEqual(captured?.studentProfile, undefined);
  });
});

describe('Phase 5.3.3 — 6. Administrative Academic Updates & Program Validation', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const cseDeptId = '6730a005f8b1a2001a000010';
  const eceDeptId = '6730a005f8b1a2001a000020';
  const targetStudentId = '6730a005f8b1a2001a000001';

  const targetStudent = {
    _id: new Types.ObjectId(targetStudentId),
    role: 'student',
    fullName: 'Aarav Sharma',
    departmentId: new Types.ObjectId(cseDeptId),
    studentProfile: {
      rollNumber: '24BCSE101',
      section: 'A',
      program: 'BTECH_CSE',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as IUser;

  const cseDept = {
    _id: new Types.ObjectId(cseDeptId),
    code: 'CSE',
    name: 'Computer Science & Engineering',
    isActive: true,
    programs: [
      { code: 'BTECH_CSE', name: 'B.Tech CSE', isActive: true },
      { code: 'BTECH_AIML', name: 'B.Tech AIML', isActive: true },
      { code: 'BCA', name: 'BCA (Pending)', isActive: false },
      { code: 'MCA', name: 'MCA (Pending)', isActive: false },
      { code: 'MTECH_CSE', name: 'M.Tech CSE (Unconfirmed)', isActive: false },
    ],
  } as unknown as IDepartment;

  test('Student attempting administrative academic update is rejected with HTTP 403 Forbidden', async () => {
    const studentCaller: UserSession = {
      userId: targetStudentId,
      email: 'student@axiscolleges.in',
      role: 'student',
    };

    await assert.rejects(
      async () => {
        await ProfileService.updateAcademicProfile(targetStudentId, { section: 'B' }, studentCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.match(err.message, /Only System Administrators and Department HODs are authorized/);
        return true;
      }
    );
  });

  test('Faculty attempting administrative academic update is rejected with HTTP 403 Forbidden', async () => {
    const facultyCaller: UserSession = {
      userId: '6730a005f8b1a2001a000050',
      email: 'faculty@axiscolleges.in',
      role: 'faculty',
    };

    await assert.rejects(
      async () => {
        await ProfileService.updateAcademicProfile(targetStudentId, { section: 'B' }, facultyCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );
  });

  test('HOD attempting to update student in another department is rejected with HTTP 403 Forbidden', async () => {
    const eceHodCaller: UserSession = {
      userId: '6730a005f8b1a2001a000088',
      email: 'ece.hod@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      departmentId: eceDeptId, // ECE HOD attempting to update CSE student
    };

    mock.method(UserRepository, 'findById', async () => targetStudent);

    await assert.rejects(
      async () => {
        await ProfileService.updateAcademicProfile(targetStudentId, { section: 'B' }, eceHodCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.match(err.message, /HODs cannot modify academic fields for students belonging to another department/);
        return true;
      }
    );
  });

  test('HOD attempting to transfer student to another department is rejected with HTTP 403 Forbidden', async () => {
    const cseHodCaller: UserSession = {
      userId: '6730a005f8b1a2001a000089',
      email: 'cse.hod@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      departmentId: cseDeptId,
    };

    mock.method(UserRepository, 'findById', async () => targetStudent);

    await assert.rejects(
      async () => {
        await ProfileService.updateAcademicProfile(
          targetStudentId,
          { departmentId: eceDeptId }, // HOD attempting cross-department transfer
          cseHodCaller
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.match(err.message, /HODs cannot transfer students across departments/);
        return true;
      }
    );
  });

  test('HOD can update section and valid program for student within their department scope', async () => {
    const cseHodCaller: UserSession = {
      userId: '6730a005f8b1a2001a000089',
      email: 'cse.hod@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
      departmentId: cseDeptId,
    };

    const updatedStudent = {
      ...targetStudent,
      studentProfile: {
        ...targetStudent.studentProfile,
        section: 'B',
        program: 'BTECH_AIML',
      },
    } as unknown as IUser;

    mock.method(UserRepository, 'findById', async () => targetStudent);
    mock.method(DepartmentRepository, 'findById', async () => cseDept);
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => cseDept);
    mock.method(UserRepository, 'updateAcademicProfile', async () => updatedStudent);

    const result = await ProfileService.updateAcademicProfile(
      targetStudentId,
      { section: 'B', program: 'BTECH_AIML' },
      cseHodCaller
    );

    assert.strictEqual(result.studentProfile?.section, 'B');
    assert.strictEqual(result.studentProfile?.program, 'BTECH_AIML');
  });

  test('System Administrator cannot assign pending programs (BCA, MCA) for new student assignments', async () => {
    const sysAdminCaller: UserSession = {
      userId: '6730a005f8b1a2001a000099',
      email: 'admin@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'sys_admin',
    };

    mock.method(UserRepository, 'findById', async () => targetStudent);
    mock.method(DepartmentRepository, 'findById', async () => cseDept);
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => cseDept);

    // Attempt assigning BCA (pending resolution, isActive: false)
    await assert.rejects(
      async () => {
        await ProfileService.updateAcademicProfile(
          targetStudentId,
          { program: 'BCA' },
          sysAdminCaller
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /is currently inactive in Department "CSE"/);
        return true;
      }
    );

    // Attempt assigning MCA (pending resolution, isActive: false)
    await assert.rejects(
      async () => {
        await ProfileService.updateAcademicProfile(
          targetStudentId,
          { program: 'MCA' },
          sysAdminCaller
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /is currently inactive in Department "CSE"/);
        return true;
      }
    );

    // Attempt assigning M.Tech CSE (unconfirmed, isActive: false)
    await assert.rejects(
      async () => {
        await ProfileService.updateAcademicProfile(
          targetStudentId,
          { program: 'MTECH_CSE' },
          sysAdminCaller
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /is currently inactive in Department "CSE"/);
        return true;
      }
    );
  });

  test('Applied Sciences & Humanities (ASH) cannot be assigned as a degree program owner', async () => {
    const sysAdminCaller: UserSession = {
      userId: '6730a005f8b1a2001a000099',
      email: 'admin@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'sys_admin',
    };

    const ashDeptId = '6730a005f8b1a2001a000077';
    const ashDept = {
      _id: new Types.ObjectId(ashDeptId),
      code: 'ASH',
      name: 'Applied Sciences & Humanities',
      isActive: true,
      programs: [],
    } as unknown as IDepartment;

    mock.method(UserRepository, 'findById', async () => targetStudent);
    mock.method(DepartmentRepository, 'findById', async () => ashDept);

    await assert.rejects(
      async () => {
        await ProfileService.updateAcademicProfile(
          targetStudentId,
          { departmentId: ashDeptId, program: 'DIPLOMA' },
          sysAdminCaller
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /Applied Sciences & Humanities \(ASH\) is a foundational service department/);
        return true;
      }
    );
  });
});
