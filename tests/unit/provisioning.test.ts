/**
 * Automated Unit Test Suite for Single-Account Provisioning (Phase 5.2.3).
 * Verifies System Administrator authorization, HOD/Director denial,
 * input validation, pre-flight uniqueness, Clerk failure handling,
 * and compensating rollback transactions upon database failure.
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import { provisionUserSchema } from '../../src/lib/validations/provision.schema';
import { ProvisioningService } from '../../src/lib/services/provisioning.service';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { ForbiddenError, ConflictError, ValidationError, AppError } from '../../src/lib/errors/app-error';
import type { UserSession, IUser } from '../../src/types/user';
import type { IDepartment } from '../../src/types/department';

describe('Phase 5.2.3 — 1. Provisioning Schema Validation', () => {
  test('validates complete student provisioning input and normalizes username', () => {
    const rawStudent = {
      fullName: '  Rohit Kumar ',
      username: '  Rohit.Kumar24 ',
      email: 'rohit.kumar@axiscolleges.in',
      role: 'student' as const,
      departmentId: 'CSE',
      studentProfile: {
        rollNumber: '24BCSE105',
        batchYear: 2026,
        currentSemester: 1,
        section: 'A',
      },
    };

    const parsed = provisionUserSchema.parse(rawStudent);
    assert.strictEqual(parsed.fullName, 'Rohit Kumar');
    assert.strictEqual(parsed.username, 'rohit.kumar24');
    assert.strictEqual(parsed.email, 'rohit.kumar@axiscolleges.in');
    assert.strictEqual(parsed.role, 'student');
    assert.strictEqual(parsed.studentProfile?.rollNumber, '24BCSE105');
  });

  test('validates complete faculty provisioning input', () => {
    const rawFaculty = {
      fullName: 'Dr. Ananya Sen',
      username: 'ananya.sen',
      email: 'ananya.sen@axiscolleges.in',
      role: 'faculty' as const,
      departmentId: 'ECE',
      facultyProfile: {
        employeeId: 'FAC-ECE-015',
        designation: 'Assistant Professor',
      },
    };

    const parsed = provisionUserSchema.parse(rawFaculty);
    assert.strictEqual(parsed.role, 'faculty');
    assert.strictEqual(parsed.facultyProfile?.employeeId, 'FAC-ECE-015');
    assert.strictEqual(parsed.facultyProfile?.designation, 'Assistant Professor');
  });

  test('rejects student provisioning lacking studentProfile', () => {
    const invalidStudent = {
      fullName: 'Aarav Sharma',
      username: 'aarav.sharma',
      email: 'aarav@axiscolleges.in',
      role: 'student',
      departmentId: 'CSE',
    };

    const result = provisionUserSchema.safeParse(invalidStudent);
    assert.strictEqual(result.success, false);
  });

  test('rejects faculty provisioning lacking facultyProfile', () => {
    const invalidFaculty = {
      fullName: 'Dr. Ramesh Verma',
      username: 'ramesh.verma',
      email: 'r.verma@axiscolleges.in',
      role: 'faculty',
      departmentId: 'CSE',
    };

    const result = provisionUserSchema.safeParse(invalidFaculty);
    assert.strictEqual(result.success, false);
  });

  test('rejects provisioning attempts with unauthorized roles (admin/super_admin)', () => {
    const invalidRole = {
      fullName: 'Malicious Admin',
      username: 'malicious.admin',
      email: 'admin@axiscolleges.in',
      role: 'admin',
      departmentId: 'CSE',
    };

    const result = provisionUserSchema.safeParse(invalidRole);
    assert.strictEqual(result.success, false);
  });
});

describe('Phase 5.2.3 — 2. Administrative Authorization & Separation of Powers', () => {
  const targetInput = {
    fullName: 'Aman Singh',
    username: 'aman.singh',
    email: 'aman.singh@axiscolleges.in',
    role: 'student' as const,
    departmentId: 'CSE',
    studentProfile: {
      rollNumber: '24BCSE108',
      batchYear: 2026,
      currentSemester: 1,
      section: 'A',
    },
  };

  test('rejects provisioning attempt when invoked by Department HOD', async () => {
    const hodCaller: UserSession = {
      userId: '6730a005f8b1a2001a000020',
      email: 'hod.cse@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
    };

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(targetInput, hodCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Only System Administrators'));
        return true;
      }
    );
  });

  test('rejects provisioning attempt when invoked by Executive Director', async () => {
    const directorCaller: UserSession = {
      userId: '6730a005f8b1a2001a000021',
      email: 'director@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'director',
    };

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(targetInput, directorCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Only System Administrators'));
        return true;
      }
    );
  });

  test('rejects provisioning attempt when invoked by Faculty or Student', async () => {
    const facultyCaller: UserSession = {
      userId: '6730a005f8b1a2001a000022',
      email: 'prof@axiscolleges.in',
      role: 'faculty',
    };

    const studentCaller: UserSession = {
      userId: '6730a005f8b1a2001a000023',
      email: 'stu@axiscolleges.in',
      role: 'student',
    };

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(targetInput, facultyCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(targetInput, studentCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );
  });
});

describe('Phase 5.2.3 — 3. Pre-Flight Uniqueness & Reference Checks', () => {
  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
  };

  const sampleStudent = {
    fullName: 'Preeti Verma',
    username: 'preeti.verma',
    email: 'preeti.verma@axiscolleges.in',
    role: 'student' as const,
    departmentId: 'CSE',
    studentProfile: {
      rollNumber: '24BCSE110',
      batchYear: 2026,
      currentSemester: 1,
      section: 'A',
    },
  };

  test('rejects provisioning when department is invalid or not found', async () => {
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => null);

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(sampleStudent, sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('invalid, inactive, or not found'));
        return true;
      }
    );

    mock.reset();
  });

  test('rejects provisioning on duplicate institutional email', async () => {
    const fakeDept = { _id: new Types.ObjectId(), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => ({ _id: new Types.ObjectId() } as IUser));

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(sampleStudent, sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok(err.message.includes('institutional email'));
        return true;
      }
    );

    mock.reset();
  });

  test('rejects provisioning on duplicate institutional username', async () => {
    const fakeDept = { _id: new Types.ObjectId(), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => ({ _id: new Types.ObjectId() } as IUser));

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(sampleStudent, sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok(err.message.includes('username'));
        return true;
      }
    );

    mock.reset();
  });

  test('rejects provisioning on duplicate student roll number', async () => {
    const fakeDept = { _id: new Types.ObjectId(), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => ({ _id: new Types.ObjectId() } as IUser));

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(sampleStudent, sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok(err.message.includes('roll number'));
        return true;
      }
    );

    mock.reset();
  });
});

describe('Phase 5.2.3 — 4. Clerk Failure Handling & Resilience', () => {
  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
  };

  const sampleStudent = {
    fullName: 'Kunal Joshi',
    username: 'kunal.joshi',
    email: 'kunal.joshi@axiscolleges.in',
    role: 'student' as const,
    departmentId: 'CSE',
    studentProfile: {
      rollNumber: '24BCSE112',
      batchYear: 2026,
      currentSemester: 1,
      section: 'B',
    },
  };

  test('maps Clerk identity already exists error to ConflictError', async () => {
    const fakeDept = { _id: new Types.ObjectId(), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);
    mock.method(UserRepository, 'setActivationToken', async () => null);

    const mockClerkClient = {
      users: {
        createUser: async () => {
          throw new Error('An account with this email already exists in Clerk');
        },
      },
    };
    mock.method(ProvisioningService, 'getClerkClient', async () => mockClerkClient as unknown as ReturnType<typeof ProvisioningService.getClerkClient>);

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(sampleStudent, sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok(err.message.includes('External authentication identity'));
        return true;
      }
    );

    mock.reset();
  });

  test('maps generic Clerk network failure to 502 AppError', async () => {
    const fakeDept = { _id: new Types.ObjectId(), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);
    mock.method(UserRepository, 'setActivationToken', async () => null);

    const mockClerkClient = {
      users: {
        createUser: async () => {
          throw new Error('Connection timeout to Clerk gateway');
        },
      },
    };
    mock.method(ProvisioningService, 'getClerkClient', async () => mockClerkClient as unknown as ReturnType<typeof ProvisioningService.getClerkClient>);

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(sampleStudent, sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual((err as AppError).statusCode, 502);
        return true;
      }
    );

    mock.reset();
  });
});

describe('Phase 5.2.3 — 5. Compensating Rollback Transaction on MongoDB Failure', () => {
  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
  };

  const sampleStudent = {
    fullName: 'Siddharth Rao',
    username: 'siddharth.rao',
    email: 'siddharth.rao@axiscolleges.in',
    role: 'student' as const,
    departmentId: 'CSE',
    studentProfile: {
      rollNumber: '24BCSE115',
      batchYear: 2026,
      currentSemester: 1,
      section: 'A',
    },
  };

  test('rolls back created Clerk user when MongoDB persistence fails', async () => {
    const fakeDept = { _id: new Types.ObjectId(), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);
    mock.method(UserRepository, 'setActivationToken', async () => null);

    let deleteUserCalled = false;
    let deletedUserId = '';

    const mockClerkClient = {
      users: {
        createUser: async () => ({ id: 'user_clerk_temp_999' }),
        deleteUser: async (id: string) => {
          deleteUserCalled = true;
          deletedUserId = id;
          return { id };
        },
      },
    };
    mock.method(ProvisioningService, 'getClerkClient', async () => mockClerkClient as unknown as ReturnType<typeof ProvisioningService.getClerkClient>);

    // Simulate MongoDB write failure
    mock.method(UserRepository, 'create', async () => {
      throw new Error('MongoDB connection pool exhausted');
    });

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(sampleStudent, sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok((err as Error).message.includes('MongoDB connection pool exhausted'));
        return true;
      }
    );

    // Verify compensating transaction executed!
    assert.strictEqual(deleteUserCalled, true);
    assert.strictEqual(deletedUserId, 'user_clerk_temp_999');

    mock.reset();
  });
});

describe('Phase 5.2.3 — 6. Successful Provisioning Pipeline & DTO Verification', () => {
  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
  };

  test('successfully provisions a student account with correct role, status and provisionedBy', async () => {
    const fakeDept = { _id: new Types.ObjectId('6730a005f8b1a2001a000050'), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);
    mock.method(UserRepository, 'setActivationToken', async () => null);

    const mockClerkClient = {
      users: {
        createUser: async () => ({ id: 'user_clerk_success_101' }),
      },
    };
    mock.method(ProvisioningService, 'getClerkClient', async () => mockClerkClient as unknown as ReturnType<typeof ProvisioningService.getClerkClient>);

    const studentDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000101'),
      authProviderId: 'user_clerk_success_101',
      email: 'divya.nair@axiscolleges.in',
      username: 'divya.nair',
      fullName: 'Divya Nair',
      role: 'student',
      status: 'pending_verification',
      isEmailVerified: false,
      departmentId: fakeDept._id,
      provisionedBy: new Types.ObjectId(sysAdminCaller.userId),
      studentProfile: {
        rollNumber: '24BCSE120',
        batchYear: 2026,
        currentSemester: 1,
        section: 'A',
        admissionType: 'regular',
      },
      createdAt: new Date('2026-11-15T00:00:00.000Z'),
      updatedAt: new Date('2026-11-15T00:00:00.000Z'),
    } as unknown as IUser;

    mock.method(UserRepository, 'create', async () => studentDoc);

    const result = await ProvisioningService.provisionSingleAccount(
      {
        fullName: 'Divya Nair',
        username: 'divya.nair',
        email: 'divya.nair@axiscolleges.in',
        role: 'student',
        departmentId: 'CSE',
        studentProfile: {
          rollNumber: '24BCSE120',
          batchYear: 2026,
          currentSemester: 1,
          section: 'A',
        },
      },
      sysAdminCaller
    );

    assert.strictEqual(result.id, '6730a005f8b1a2001a000101');
    assert.strictEqual(result.email, 'divya.nair@axiscolleges.in');
    assert.strictEqual(result.username, 'divya.nair');
    assert.strictEqual(result.role, 'student');
    assert.strictEqual(result.status, 'pending_verification');
    assert.strictEqual(result.isEmailVerified, false);
    assert.strictEqual(result.provisionedBy, sysAdminCaller.userId);
    assert.strictEqual(result.studentProfile?.rollNumber, '24BCSE120');

    mock.reset();
  });

  test('successfully provisions a faculty account with employeeId and designation', async () => {
    const fakeDept = { _id: new Types.ObjectId('6730a005f8b1a2001a000050'), code: 'ECE', name: 'Electronics' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByEmployeeId', async () => null);
    mock.method(UserRepository, 'setActivationToken', async () => null);

    const mockClerkClient = {
      users: {
        createUser: async () => ({ id: 'user_clerk_fac_202' }),
      },
    };
    mock.method(ProvisioningService, 'getClerkClient', async () => mockClerkClient as unknown as ReturnType<typeof ProvisioningService.getClerkClient>);

    const facultyDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000202'),
      authProviderId: 'user_clerk_fac_202',
      email: 'dr.shukla@axiscolleges.in',
      username: 'dr.shukla',
      fullName: 'Dr. Vivek Shukla',
      role: 'faculty',
      status: 'pending_verification',
      isEmailVerified: false,
      departmentId: fakeDept._id,
      provisionedBy: new Types.ObjectId(sysAdminCaller.userId),
      facultyProfile: {
        employeeId: 'FAC-ECE-030',
        designation: 'Professor',
        qualifications: ['Ph.D.'],
        assignedCourses: [],
      },
      createdAt: new Date('2026-11-15T00:00:00.000Z'),
      updatedAt: new Date('2026-11-15T00:00:00.000Z'),
    } as unknown as IUser;

    mock.method(UserRepository, 'create', async () => facultyDoc);

    const result = await ProvisioningService.provisionSingleAccount(
      {
        fullName: 'Dr. Vivek Shukla',
        username: 'dr.shukla',
        email: 'dr.shukla@axiscolleges.in',
        role: 'faculty',
        departmentId: 'ECE',
        facultyProfile: {
          employeeId: 'FAC-ECE-030',
          designation: 'Professor',
        },
      },
      sysAdminCaller
    );

    assert.strictEqual(result.id, '6730a005f8b1a2001a000202');
    assert.strictEqual(result.role, 'faculty');
    assert.strictEqual(result.facultyProfile?.employeeId, 'FAC-ECE-030');
    assert.strictEqual(result.facultyProfile?.designation, 'Professor');
    assert.strictEqual(result.status, 'pending_verification');

    mock.reset();
  });

  test('successfully provisions a student account with initial password directly as active', async () => {
    const fakeDept = { _id: new Types.ObjectId('6730a005f8b1a2001a000050'), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    let passedClerkPayload: Record<string, unknown> | null = null;
    const mockClerkClient = {
      users: {
        createUser: async (payload: unknown) => {
          passedClerkPayload = payload as Record<string, unknown>;
          return { id: 'user_clerk_pwd_102' };
        },
      },
    };
    mock.method(ProvisioningService, 'getClerkClient', async () => mockClerkClient as unknown as ReturnType<typeof ProvisioningService.getClerkClient>);

    const studentDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000102'),
      authProviderId: 'user_clerk_pwd_102',
      email: 'active.student@axiscolleges.in',
      username: 'active.student',
      fullName: 'Active Student',
      role: 'student',
      status: 'active',
      isEmailVerified: true,
      departmentId: fakeDept._id,
      provisionedBy: new Types.ObjectId(sysAdminCaller.userId),
      studentProfile: {
        rollNumber: '24BCSE122',
        batchYear: 2026,
        currentSemester: 1,
        section: 'A',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    mock.method(UserRepository, 'create', async () => studentDoc);

    const result = await ProvisioningService.provisionSingleAccount(
      {
        fullName: 'Active Student',
        username: 'active.student',
        email: 'active.student@axiscolleges.in',
        password: 'SecurePassword123!',
        role: 'student',
        departmentId: 'CSE',
        studentProfile: {
          rollNumber: '24BCSE122',
          batchYear: 2026,
          currentSemester: 1,
          section: 'A',
        },
      },
      sysAdminCaller
    );

    assert.strictEqual(result.status, 'active');
    assert.strictEqual(result.isEmailVerified, true);
    assert.strictEqual(passedClerkPayload?.password, 'SecurePassword123!');
    assert.strictEqual(passedClerkPayload?.skipPasswordRequirement, undefined);

    mock.reset();
  });

  test('successfully provisions an authorized HOD administrative account', async () => {
    const fakeDept = { _id: new Types.ObjectId('6730a005f8b1a2001a000050'), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByAdminStaffId', async () => null);
    mock.method(UserRepository, 'setActivationToken', async () => null);

    const mockClerkClient = {
      users: {
        createUser: async () => ({ id: 'user_clerk_hod_301' }),
      },
    };
    mock.method(ProvisioningService, 'getClerkClient', async () => mockClerkClient as unknown as ReturnType<typeof ProvisioningService.getClerkClient>);

    const hodDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000301'),
      authProviderId: 'user_clerk_hod_301',
      email: 'hod.cse@axiscolleges.in',
      username: 'hod.cse',
      fullName: 'Dr. HOD CSE',
      role: 'admin',
      adminSubRole: 'hod',
      status: 'pending_verification',
      isEmailVerified: false,
      departmentId: fakeDept._id,
      provisionedBy: new Types.ObjectId(sysAdminCaller.userId),
      adminProfile: {
        adminStaffId: 'ADM-HOD-01',
        administrativeDomain: 'Departmental Governance',
        assignedQueueScopes: ['all'],
        emergencyOverridePermitted: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    mock.method(UserRepository, 'create', async () => hodDoc);

    const result = await ProvisioningService.provisionAdminAccount(
      {
        fullName: 'Dr. HOD CSE',
        username: 'hod.cse',
        email: 'hod.cse@axiscolleges.in',
        role: 'admin',
        adminSubRole: 'hod',
        departmentId: 'CSE',
      },
      sysAdminCaller
    );

    assert.strictEqual(result.role, 'admin');
    assert.strictEqual(result.adminSubRole, 'hod');
    assert.strictEqual(result.status, 'pending_verification');

    mock.reset();
  });

  test('accurately maps Clerk structured 422 errors to ConflictError or ValidationError', async () => {
    const fakeDept = { _id: new Types.ObjectId('6730a005f8b1a2001a000050'), code: 'CSE', name: 'Computer Science' } as IDepartment;
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    // Test 1: form_identifier_exists
    const clerkConflictClient = {
      users: {
        createUser: async () => {
          const err = new Error('Unprocessable Entity') as Error & { status?: number; errors?: unknown[] };
          err.status = 422;
          err.errors = [
            {
              code: 'form_identifier_exists',
              message: 'That username is taken. Please try another.',
              meta: { paramName: 'username' },
            },
          ];
          throw err;
        },
        getUserList: async () => ({ data: [{ id: 'other_clerk_id', emailAddresses: [{ emailAddress: 'diff@axis.in' }], username: 'other' }] }),
      },
    };
    mock.method(ProvisioningService, 'getClerkClient', async () => clerkConflictClient as unknown as ReturnType<typeof ProvisioningService.getClerkClient>);
    mock.method(UserRepository, 'findByAuthProviderId', async () => ({ _id: new Types.ObjectId() } as unknown as IUser));

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(
          {
            fullName: 'Test Scholar',
            username: 'test.scholar',
            email: 'scholar@axiscolleges.in',
            role: 'student',
            departmentId: 'CSE',
            studentProfile: {
              rollNumber: '24BCSE999',
              batchYear: 2026,
              currentSemester: 1,
              section: 'A',
            },
          },
          sysAdminCaller
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.strictEqual((err as ConflictError).statusCode, 409);
        assert.ok(err.message.includes('already exists in the identity provider'));
        return true;
      }
    );

    // Test 2: form_username_invalid_character
    const clerkInvalidCharClient = {
      users: {
        createUser: async () => {
          const err = new Error('Unprocessable Entity') as Error & { status?: number; errors?: unknown[] };
          err.status = 422;
          err.errors = [
            {
              code: 'form_username_invalid_character',
              message: 'Username can only contain letters, numbers and - or _.',
              meta: { paramName: 'username' },
            },
          ];
          throw err;
        },
      },
    };
    mock.method(ProvisioningService, 'getClerkClient', async () => clerkInvalidCharClient as unknown as ReturnType<typeof ProvisioningService.getClerkClient>);

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(
          {
            fullName: 'Test Scholar',
            username: 'test.scholar',
            email: 'scholar@axiscolleges.in',
            role: 'student',
            departmentId: 'CSE',
            studentProfile: {
              rollNumber: '24BCSE999',
              batchYear: 2026,
              currentSemester: 1,
              section: 'A',
            },
          },
          sysAdminCaller
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.strictEqual((err as ValidationError).statusCode, 400);
        return true;
      }
    );

    mock.reset();
  });
});

