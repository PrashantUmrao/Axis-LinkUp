/**
 * Automated Unit Test Suite for Profile Model Enhancements & Academic Entity Integration (Phase 5.3.2).
 * 
 * Tests:
 * 1. Student profile validation, program association, and cohort fields.
 * 2. Faculty profile validation, designation enum, privacy toggle, and specialization.
 * 3. Department model and repository program approval helpers.
 * 4. Administrative profile designation and sub-role compatibility.
 * 5. Student section immutability in self-service vs administrative mutation.
 * 6. Bulk provisioning CSV mapping for new profile attributes.
 * 7. Mongoose schema index definitions and serialization integrity.
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import {
  createUserSchema,
  updateUserProfileSchema,
  adminUpdateUserSchema,
  studentProfileSchema,
  facultyProfileSchema,
  adminProfileSchema,
  facultyDesignationSchema,
} from '../../src/lib/validations/user.schema';
import {
  normalizeHeader,
  mapCsvRowToProvisionInput,
} from '../../src/lib/validations/bulk-provision.schema';
import { FACULTY_DESIGNATIONS } from '../../src/config/constants';
import { UserModel, toUserDTO } from '../../src/lib/db/models/user.model';
import { DepartmentModel, toDepartmentDTO } from '../../src/lib/db/models/department.model';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { ProvisioningService } from '../../src/lib/services/provisioning.service';
import { BulkProvisioningService } from '../../src/lib/services/bulk-provisioning.service';
import { ValidationError } from '../../src/lib/errors/app-error';
import type { IUser, UserSession } from '../../src/types/user';
import type { IDepartment } from '../../src/types/department';

describe('Phase 5.3.2 — 1. Student Profile Validation & Academic Cohort Constraints', () => {
  test('validates a complete student profile with program, admissionYear and enrollmentNumber', () => {
    const studentInput = {
      rollNumber: '24BCSE104',
      enrollmentNumber: 'EN2024CSE0104',
      batchYear: 2028,
      currentSemester: 3,
      section: 'A',
      program: 'BTECH_CSE',
      admissionYear: 2024,
      admissionType: 'regular',
    };

    const parsed = studentProfileSchema.parse(studentInput);
    assert.strictEqual(parsed.rollNumber, '24BCSE104');
    assert.strictEqual(parsed.enrollmentNumber, 'EN2024CSE0104');
    assert.strictEqual(parsed.program, 'BTECH_CSE');
    assert.strictEqual(parsed.admissionYear, 2024);
    assert.strictEqual(parsed.batchYear, 2028);
    assert.strictEqual(parsed.currentSemester, 3);
    assert.strictEqual(parsed.section, 'A');
  });

  test('normalizes program code to uppercase and trims whitespace', () => {
    const parsed = studentProfileSchema.parse({
      rollNumber: '24BCSE105',
      batchYear: 2028,
      currentSemester: 3,
      section: 'b',
      program: '  btech_it  ',
      admissionYear: 2024,
    });

    assert.strictEqual(parsed.program, 'BTECH_IT');
    assert.strictEqual(parsed.section, 'B');
  });

  test('transforms empty string enrollmentNumber to undefined to prevent unique index collisions', () => {
    const parsed = studentProfileSchema.parse({
      rollNumber: '24BCSE106',
      enrollmentNumber: '   ',
      batchYear: 2028,
      currentSemester: 3,
      section: 'A',
    });

    assert.strictEqual(parsed.enrollmentNumber, undefined);
  });

  test('permits legacy student records lacking program and admissionYear (backward compatibility)', () => {
    const legacyInput = {
      rollNumber: '21BCSE099',
      batchYear: 2025,
      currentSemester: 7,
      section: 'A',
    };

    const parsed = studentProfileSchema.parse(legacyInput);
    assert.strictEqual(parsed.program, undefined);
    assert.strictEqual(parsed.admissionYear, undefined);
    assert.strictEqual(parsed.enrollmentNumber, undefined);
    assert.strictEqual(parsed.rollNumber, '21BCSE099');
  });

  test('rejects invalid semester boundaries (< 1 or > 8)', () => {
    assert.throws(
      () =>
        studentProfileSchema.parse({
          rollNumber: '24BCSE104',
          batchYear: 2028,
          currentSemester: 0,
          section: 'A',
        }),
      /Minimum semester is 1/
    );

    assert.throws(
      () =>
        studentProfileSchema.parse({
          rollNumber: '24BCSE104',
          batchYear: 2028,
          currentSemester: 9,
          section: 'A',
        }),
      /Maximum semester is 8/
    );
  });

  test('rejects invalid admission year boundaries (< 2018 or > 2035)', () => {
    assert.throws(
      () =>
        studentProfileSchema.parse({
          rollNumber: '24BCSE104',
          batchYear: 2028,
          currentSemester: 3,
          section: 'A',
          admissionYear: 2015,
        }),
      /Admission year cannot be earlier than 2018/
    );

    assert.throws(
      () =>
        studentProfileSchema.parse({
          rollNumber: '24BCSE104',
          batchYear: 2028,
          currentSemester: 3,
          section: 'A',
          admissionYear: 2040,
        }),
      /Admission year cannot exceed 2035/
    );
  });

  test('toUserDTO preserves student program, admissionYear and enrollmentNumber', () => {
    const fakeDoc = {
      _id: new Types.ObjectId(),
      email: 'aarav.sharma@axiscolleges.in',
      username: 'aarav.sharma',
      fullName: 'Aarav Sharma',
      role: 'student',
      status: 'active',
      isEmailVerified: true,
      departmentId: new Types.ObjectId(),
      studentProfile: {
        rollNumber: '24BCSE104',
        enrollmentNumber: 'EN2024CSE0104',
        batchYear: 2028,
        currentSemester: 3,
        section: 'A',
        program: 'BTECH_CSE',
        admissionYear: 2024,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    const dto = toUserDTO(fakeDoc);
    assert.strictEqual(dto.studentProfile?.program, 'BTECH_CSE');
    assert.strictEqual(dto.studentProfile?.admissionYear, 2024);
    assert.strictEqual(dto.studentProfile?.enrollmentNumber, 'EN2024CSE0104');
    assert.strictEqual(dto.studentProfile?.section, 'A');
  });

  test('validates complete student user payload in createUserSchema with academic program', () => {
    const userInput = {
      email: 'aarav.sharma@axiscolleges.in',
      username: 'aarav.sharma',
      fullName: 'Aarav Sharma',
      role: 'student',
      status: 'pending_verification',
      studentProfile: {
        rollNumber: '24BCSE104',
        enrollmentNumber: 'EN2024CSE0104',
        batchYear: 2028,
        currentSemester: 3,
        section: 'A',
        program: 'BTECH_CSE',
        admissionYear: 2024,
      },
    };

    const parsed = createUserSchema.parse(userInput);
    assert.strictEqual(parsed.studentProfile?.program, 'BTECH_CSE');
    assert.strictEqual(parsed.studentProfile?.admissionYear, 2024);
  });
});

describe('Phase 5.3.2 — 2. Faculty Profile, Designation Enum & Privacy Preferences', () => {
  test('accepts all approved institutional designations from FACULTY_DESIGNATIONS enum', () => {
    for (const designation of FACULTY_DESIGNATIONS) {
      assert.strictEqual(facultyDesignationSchema.parse(designation), designation);

      const parsed = facultyProfileSchema.parse({
        employeeId: 'FAC001',
        designation,
      });
      assert.strictEqual(parsed.designation, designation);
    }
  });

  test('permits legacy designation string fallback without validation failure', () => {
    const parsed = facultyProfileSchema.parse({
      employeeId: 'FAC099',
      designation: 'Adjunct Lecturer',
    });
    assert.strictEqual(parsed.designation, 'Adjunct Lecturer');
  });

  test('enforces default privacy: sharePhoneWithStudents defaults to false', () => {
    const parsed = facultyProfileSchema.parse({
      employeeId: 'FAC001',
      designation: 'Assistant Professor',
    });
    assert.strictEqual(parsed.sharePhoneWithStudents, false);
    assert.deepStrictEqual(parsed.specialization, []);
  });

  test('permits faculty to explicitly toggle sharePhoneWithStudents: true', () => {
    const parsed = facultyProfileSchema.parse({
      employeeId: 'FAC001',
      designation: 'Professor',
      sharePhoneWithStudents: true,
      specialization: ['Distributed Systems', 'Cloud Computing'],
    });
    assert.strictEqual(parsed.sharePhoneWithStudents, true);
    assert.deepStrictEqual(parsed.specialization, ['Distributed Systems', 'Cloud Computing']);
  });

  test('enforces specialization constraints: max 10 items, trims items', () => {
    const specList = ['AI', 'ML', 'Data Science'];
    const parsed = facultyProfileSchema.parse({
      employeeId: 'FAC001',
      designation: 'Associate Professor',
      specialization: specList,
    });
    assert.deepStrictEqual(parsed.specialization, specList);

    const excessiveList = Array.from({ length: 11 }, (_, i) => `Domain ${i + 1}`);
    assert.throws(
      () =>
        facultyProfileSchema.parse({
          employeeId: 'FAC001',
          designation: 'Associate Professor',
          specialization: excessiveList,
        }),
      /Maximum 10 specializations allowed/
    );
  });

  test('toUserDTO serializes faculty specialization and privacy toggle cleanly', () => {
    const fakeDoc = {
      _id: new Types.ObjectId(),
      email: 'dr.shukla@axiscolleges.in',
      username: 'dr.shukla',
      fullName: 'Dr. Vivek Shukla',
      role: 'faculty',
      status: 'active',
      isEmailVerified: true,
      departmentId: new Types.ObjectId(),
      facultyProfile: {
        employeeId: 'FAC002',
        designation: 'Professor',
        specialization: ['Algorithms', 'Cryptography'],
        sharePhoneWithStudents: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    const dto = toUserDTO(fakeDoc);
    assert.deepStrictEqual(dto.facultyProfile?.specialization, ['Algorithms', 'Cryptography']);
    assert.strictEqual(dto.facultyProfile?.sharePhoneWithStudents, true);
  });

  test('toUserDTO safely treats missing sharePhoneWithStudents in legacy doc as false', () => {
    const legacyDoc = {
      _id: new Types.ObjectId(),
      email: 'legacy.fac@axiscolleges.in',
      role: 'faculty',
      status: 'active',
      facultyProfile: {
        employeeId: 'FAC003',
        designation: 'Lab Instructor',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    const dto = toUserDTO(legacyDoc);
    assert.strictEqual(dto.facultyProfile?.sharePhoneWithStudents, false);
    assert.deepStrictEqual(dto.facultyProfile?.specialization, []);
  });
});

describe('Phase 5.3.2 — 3. Department Programs Integration & Repository Helpers', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('toDepartmentDTO maps embedded programs array correctly', () => {
    const deptDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000001'),
      name: 'Computer Science & Engineering',
      code: 'CSE',
      description: 'Department of CSE',
      isActive: true,
      programs: [
        { code: 'BTECH_CSE', name: 'B.Tech in Computer Science & Engineering', isActive: true },
        { code: 'MCA', name: 'Master of Computer Applications', isActive: true },
        { code: 'OLD_DIPLOMA', name: 'Diploma CSE (Discontinued)', isActive: false },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IDepartment;

    const dto = toDepartmentDTO(deptDoc);
    assert.strictEqual(dto.code, 'CSE');
    assert.strictEqual(dto.programs.length, 3);
    assert.strictEqual(dto.programs[0]?.code, 'BTECH_CSE');
    assert.strictEqual(dto.programs[0]?.isActive, true);
    assert.strictEqual(dto.programs[2]?.code, 'OLD_DIPLOMA');
    assert.strictEqual(dto.programs[2]?.isActive, false);
  });

  test('isProgramApprovedForDepartment returns valid: true for approved active program', async () => {
    const fakeDept = {
      _id: new Types.ObjectId(),
      code: 'CSE',
      name: 'Computer Science',
      isActive: true,
      programs: [
        { code: 'BTECH_CSE', name: 'B.Tech CSE', isActive: true },
        { code: 'MCA', name: 'MCA', isActive: true },
      ],
    } as unknown as IDepartment;

    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);

    const result = await DepartmentRepository.isProgramApprovedForDepartment('CSE', 'BTECH_CSE');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.reason, undefined);

    // Case-insensitivity check
    const lowerResult = await DepartmentRepository.isProgramApprovedForDepartment('CSE', 'btech_cse');
    assert.strictEqual(lowerResult.valid, true);
  });

  test('isProgramApprovedForDepartment returns valid: false when program is unapproved for department', async () => {
    const fakeDept = {
      _id: new Types.ObjectId(),
      code: 'CSE',
      name: 'Computer Science',
      isActive: true,
      programs: [
        { code: 'BTECH_CSE', name: 'B.Tech CSE', isActive: true },
      ],
    } as unknown as IDepartment;

    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);

    const result = await DepartmentRepository.isProgramApprovedForDepartment('CSE', 'BTECH_MECH');
    assert.strictEqual(result.valid, false);
    assert.match(result.reason || '', /is not approved for Department "CSE"/);
  });

  test('isProgramApprovedForDepartment returns valid: false when program is marked inactive', async () => {
    const fakeDept = {
      _id: new Types.ObjectId(),
      code: 'CSE',
      name: 'Computer Science',
      isActive: true,
      programs: [
        { code: 'BTECH_CSE', name: 'B.Tech CSE', isActive: true },
        { code: 'LEGACY_MTECH', name: 'M.Tech CSE', isActive: false },
      ],
    } as unknown as IDepartment;

    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);

    const result = await DepartmentRepository.isProgramApprovedForDepartment('CSE', 'LEGACY_MTECH');
    assert.strictEqual(result.valid, false);
    assert.match(result.reason || '', /is currently inactive in Department "CSE"/);
  });

  test('isProgramApprovedForDepartment handles missing parameters or unknown department', async () => {
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => null);

    const noDept = await DepartmentRepository.isProgramApprovedForDepartment('UNKNOWN', 'BTECH_CSE');
    assert.strictEqual(noDept.valid, false);
    assert.match(noDept.reason || '', /was not found or is inactive/);

    const emptyDept = await DepartmentRepository.isProgramApprovedForDepartment('', 'BTECH_CSE');
    assert.strictEqual(emptyDept.valid, false);

    const emptyProg = await DepartmentRepository.isProgramApprovedForDepartment('CSE', '');
    assert.strictEqual(emptyProg.valid, false);
  });

  test('addProgramToDepartment adds new program and rejects duplicate program code', async () => {
    const fakeDept = {
      code: 'CSE',
      programs: [{ code: 'BTECH_CSE', name: 'B.Tech CSE', isActive: true }],
      save: async function () {
        return this as unknown as IDepartment;
      },
    };

    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept as unknown as IDepartment);

    // Duplicate rejection
    await assert.rejects(
      async () => {
        await DepartmentRepository.addProgramToDepartment('CSE', {
          code: 'BTECH_CSE',
          name: 'B.Tech Duplicate',
        });
      },
      /Program code "BTECH_CSE" is already configured in Department "CSE"/
    );

    // Successful addition
    const updated = await DepartmentRepository.addProgramToDepartment('CSE', {
      code: 'BTECH_AIML',
      name: 'B.Tech in Artificial Intelligence & Machine Learning',
    });
    assert.strictEqual(updated?.programs.length, 2);
    assert.strictEqual(updated?.programs[1]?.code, 'BTECH_AIML');
  });

  test('setProgramStatus updates program active flag', async () => {
    const fakeDept = {
      code: 'CSE',
      programs: [
        { code: 'BTECH_CSE', name: 'B.Tech CSE', isActive: true },
      ],
      save: async function () {
        return this as unknown as IDepartment;
      },
    };

    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept as unknown as IDepartment);

    const updated = await DepartmentRepository.setProgramStatus('CSE', 'BTECH_CSE', false);
    assert.strictEqual(updated?.programs[0]?.isActive, false);
  });
});

describe('Phase 5.3.2 — 4. Administrative Profile Designation & Sub-Role Support', () => {
  test('validates admin profile with optional designation', () => {
    const adminInput = {
      adminStaffId: 'ADM-SYS-001',
      administrativeDomain: 'IT Systems & Infrastructure',
      designation: 'Senior Systems Administrator',
      assignedQueueScopes: ['all'],
      emergencyOverridePermitted: true,
    };

    const parsed = adminProfileSchema.parse(adminInput);
    assert.strictEqual(parsed.adminStaffId, 'ADM-SYS-001');
    assert.strictEqual(parsed.designation, 'Senior Systems Administrator');
    assert.strictEqual(parsed.emergencyOverridePermitted, true);
  });

  test('toUserDTO serializes admin designation correctly', () => {
    const adminDoc = {
      _id: new Types.ObjectId(),
      email: 'admin.sharma@axiscolleges.in',
      username: 'admin.sharma',
      fullName: 'Vikram Sharma',
      role: 'admin',
      adminSubRole: 'sys_admin',
      status: 'active',
      isEmailVerified: true,
      adminProfile: {
        adminStaffId: 'ADM001',
        administrativeDomain: 'Academic Affairs',
        designation: 'Registrar',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IUser;

    const dto = toUserDTO(adminDoc);
    assert.strictEqual(dto.adminProfile?.designation, 'Registrar');
    assert.strictEqual(dto.adminSubRole, 'sys_admin');
  });
});

describe('Phase 5.3.2 — 5. Student Section Mutability & Role Permissions', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('self-service updateUserProfileSchema strictly strips studentProfile.section', () => {
    const maliciousPayload = {
      fullName: 'Aarav Sharma Updated',
      phoneNumber: '+919876543210',
      studentProfile: {
        section: 'Z', // Attempted unauthorized section self-change
      },
    };

    const parsed = updateUserProfileSchema.parse(maliciousPayload) as Record<string, unknown>;
    assert.strictEqual(parsed.fullName, 'Aarav Sharma Updated');
    assert.strictEqual(parsed.phoneNumber, '+919876543210');
    // studentProfile MUST be stripped entirely
    assert.strictEqual(parsed.studentProfile, undefined);
  });

  test('self-service updateUserProfileSchema permits faculty to update cabinRoom, specialization and sharePhoneWithStudents', () => {
    const facultyUpdate = {
      fullName: 'Dr. Vivek Shukla Updated',
      phoneNumber: '+919876543211',
      facultyProfile: {
        cabinRoom: 'Block B, 201',
        specialization: ['Distributed Systems', 'Cloud Computing'],
        sharePhoneWithStudents: true,
      },
    };

    const parsed = updateUserProfileSchema.parse(facultyUpdate);
    assert.strictEqual(parsed.facultyProfile?.cabinRoom, 'Block B, 201');
    assert.deepStrictEqual(parsed.facultyProfile?.specialization, [
      'Distributed Systems',
      'Cloud Computing',
    ]);
    assert.strictEqual(parsed.facultyProfile?.sharePhoneWithStudents, true);
  });

  test('adminUpdateUserSchema permits administrators and HODs to modify student section and program', () => {
    const adminUpdate = {
      studentProfile: {
        section: 'B',
        program: 'BTECH_IT',
        batchYear: 2028,
        currentSemester: 4,
      },
    };

    const parsed = adminUpdateUserSchema.parse(adminUpdate);
    assert.strictEqual(parsed.studentProfile?.section, 'B');
    assert.strictEqual(parsed.studentProfile?.program, 'BTECH_IT');
    assert.strictEqual(parsed.studentProfile?.currentSemester, 4);
  });

  test('UserRepository.updateStudentSection modifies section via administrative path', async () => {
    const dummyId = new Types.ObjectId().toString();
    const updatedUser = {
      _id: new Types.ObjectId(dummyId),
      studentProfile: {
        rollNumber: '24BCSE104',
        section: 'C',
      },
    } as unknown as IUser;

    mock.method(UserModel, 'findOneAndUpdate', () => ({
      exec: async () => updatedUser,
    }));

    const result = await UserRepository.updateStudentSection(dummyId, 'C');
    assert.strictEqual(result?.studentProfile?.section, 'C');
  });

  test('UserRepository.updateStudentProgram modifies program via administrative path', async () => {
    const dummyId = new Types.ObjectId().toString();
    const updatedUser = {
      _id: new Types.ObjectId(dummyId),
      studentProfile: {
        rollNumber: '24BCSE104',
        program: 'BTECH_IT',
      },
    } as unknown as IUser;

    mock.method(UserModel, 'findOneAndUpdate', () => ({
      exec: async () => updatedUser,
    }));

    const result = await UserRepository.updateStudentProgram(dummyId, 'BTECH_IT');
    assert.strictEqual(result?.studentProfile?.program, 'BTECH_IT');
  });
});

describe('Phase 5.3.2 — 6. Bulk Provisioning CSV Schema Mapping', () => {
  test('normalizes CSV headers for program, admissionYear and specialization', () => {
    assert.strictEqual(normalizeHeader('Program'), 'program');
    assert.strictEqual(normalizeHeader('prog'), 'program');
    assert.strictEqual(normalizeHeader('Course'), 'program');
    assert.strictEqual(normalizeHeader('academic_program'), 'program');

    assert.strictEqual(normalizeHeader('Admission Year'), 'admissionYear');
    assert.strictEqual(normalizeHeader('adm_year'), 'admissionYear');

    assert.strictEqual(normalizeHeader('Enrollment Number'), 'enrollmentNumber');
    assert.strictEqual(normalizeHeader('enrollment_id'), 'enrollmentNumber');

    assert.strictEqual(normalizeHeader('Specialization'), 'specialization');
    assert.strictEqual(normalizeHeader('specializations'), 'specialization');
    assert.strictEqual(normalizeHeader('spec'), 'specialization');
  });

  test('maps student CSV row with program, admissionYear and enrollmentNumber into valid payload', () => {
    const rowMap = {
      fullName: 'Aarav Sharma',
      username: 'aarav.sharma',
      institutionalEmail: 'aarav.sharma@axiscolleges.in',
      department: 'CSE',
      rollNumber: '24BCSE104',
      batchYear: '2028',
      currentSemester: '3',
      section: 'A',
      program: 'btech_cse',
      admissionYear: '2024',
      enrollmentNumber: 'EN2024CSE0104',
    };

    const { payload, errors } = mapCsvRowToProvisionInput(rowMap, 'student');
    assert.deepStrictEqual(errors, []);
    assert.ok(payload);
    assert.strictEqual(payload.studentProfile?.program, 'BTECH_CSE');
    assert.strictEqual(payload.studentProfile?.admissionYear, 2024);
    assert.strictEqual(payload.studentProfile?.enrollmentNumber, 'EN2024CSE0104');
    assert.strictEqual(payload.studentProfile?.section, 'A');
  });

  test('maps faculty CSV row with semicolon-separated specialization into string array', () => {
    const rowMap = {
      fullName: 'Dr. Vivek Shukla',
      username: 'dr.shukla',
      institutionalEmail: 'dr.shukla@axiscolleges.in',
      department: 'CSE',
      employeeId: 'FAC001',
      designation: 'Professor',
      specialization: 'Artificial Intelligence; Machine Learning; Deep Learning',
    };

    const { payload, errors } = mapCsvRowToProvisionInput(rowMap, 'faculty');
    assert.deepStrictEqual(errors, []);
    assert.ok(payload);
    assert.deepStrictEqual(payload.facultyProfile?.specialization, [
      'Artificial Intelligence',
      'Machine Learning',
      'Deep Learning',
    ]);
  });
});

describe('Phase 5.3.2 — 7. Mongoose Schema Index Definitions', () => {
  test('UserModel schema contains required indexes for enrollmentNumber, program cohort and faculty privacy', () => {
    const userIndexes = UserModel.schema.indexes();

    // Check enrollmentNumber unique partial index with string and non-empty filter
    const hasEnrollmentIndex = userIndexes.some(
      ([fields, options]) =>
        fields['studentProfile.enrollmentNumber'] === 1 &&
        options?.unique === true &&
        Boolean(options?.partialFilterExpression)
    );
    assert.ok(
      hasEnrollmentIndex,
      'UserModel must have unique partial index on studentProfile.enrollmentNumber'
    );

    // Check studentProfile.program compound index
    const hasProgramBatchIndex = userIndexes.some(
      ([fields]) =>
        fields['studentProfile.program'] === 1 &&
        fields['studentProfile.batchYear'] === 1
    );
    assert.ok(hasProgramBatchIndex, 'UserModel must have compound index on studentProfile.program and batchYear');

    // Check faculty privacy index
    const hasFacultyPrivacyIndex = userIndexes.some(
      ([fields]) => fields['facultyProfile.sharePhoneWithStudents'] === 1
    );
    assert.ok(hasFacultyPrivacyIndex, 'UserModel must have index on facultyProfile.sharePhoneWithStudents');
  });

  test('DepartmentModel schema contains index on programs.code', () => {
    const deptIndexes = DepartmentModel.schema.indexes();
    const hasProgramCodeIndex = deptIndexes.some(
      ([fields]) => fields['programs.code'] === 1
    );
    assert.ok(hasProgramCodeIndex, 'DepartmentModel must have index on programs.code');
  });
});

describe('Phase 5.3.2.1 — 8. Write Path Department-Program Validation Enforcement', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const callerAdmin: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'admin.sharma@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
    status: 'active',
  };

  test('ProvisioningService.provisionSingleAccount rejects student account when program is unapproved for department', async () => {
    const fakeDept = {
      _id: new Types.ObjectId(),
      code: 'CSE',
      name: 'Computer Science & Engineering',
      isActive: true,
      programs: [{ code: 'BTECH_CSE', name: 'B.Tech CSE', isActive: true }],
    } as unknown as IDepartment;

    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    const rawPayload = {
      fullName: 'Aarav Sharma',
      username: 'aarav.sharma',
      email: 'aarav.sharma@axiscolleges.in',
      role: 'student',
      departmentId: 'CSE',
      studentProfile: {
        rollNumber: '24BCSE104',
        batchYear: 2028,
        currentSemester: 3,
        section: 'A',
        program: 'BTECH_MECH', // Unapproved program for CSE!
      },
    };

    await assert.rejects(
      async () => {
        await ProvisioningService.provisionSingleAccount(rawPayload, callerAdmin);
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.match(
          err.message,
          /Program "BTECH_MECH" is not approved for Department "CSE"/
        );
        return true;
      }
    );
  });

  test('BulkProvisioningService.generatePreview flags row error when student program is unapproved for department', async () => {
    const fakeDept = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000001'),
      code: 'CSE',
      name: 'Computer Science & Engineering',
      isActive: true,
      programs: [{ code: 'BTECH_CSE', name: 'B.Tech CSE', isActive: true }],
    } as unknown as IDepartment;

    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    mock.method(DepartmentRepository, 'findActiveByIdOrCode', async () => fakeDept);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    const csvContent =
      'fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section,program\n' +
      'Aarav Sharma,aarav.sharma,aarav.sharma@axiscolleges.in,CSE,24BCSE104,2028,3,A,BTECH_CIVIL\n';

    const preview = await BulkProvisioningService.previewCsv(
      csvContent,
      'student',
      callerAdmin
    );

    assert.strictEqual(preview.totalRows, 1);
    assert.strictEqual(preview.invalidCount, 1);
    assert.strictEqual(preview.validCount, 0);
    assert.match(
      preview.rows[0]?.errors.join('; ') ?? '',
      /Program "BTECH_CIVIL" is not approved for Department "CSE"/
    );
  });
});
