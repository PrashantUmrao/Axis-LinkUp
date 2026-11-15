/**
 * Automated Unit Test Suite for User Model, Schemas & Security Rules.
 * Validates schema validation, mass-assignment protection, and role guards.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import {
  createUserSchema,
  updateUserProfileSchema,
  adminUpdateUserSchema,
  studentProfileSchema,
  facultyProfileSchema,
  adminProfileSchema,
} from '../../src/lib/validations/user.schema';
import { usernameSchema, adminSubRoleSchema } from '../../src/lib/validations/common-schemas';
import { toUserDTO } from '../../src/lib/db/models/user.model';
import { UserService } from '../../src/lib/services/user.service';
import { ForbiddenError } from '../../src/lib/errors/app-error';
import type { IUser, UserSession } from '../../src/types/user';

describe('1. User Creation Schema Validation', () => {
  test('validates a complete student user payload', () => {
    const studentInput = {
      email: 'aarav.sharma@axiscolleges.in',
      fullName: 'Aarav Sharma',
      role: 'student',
      status: 'pending_verification',
      studentProfile: {
        rollNumber: '24BCSE104',
        batchYear: 2026,
        currentSemester: 5,
        section: 'A',
        admissionType: 'regular',
      },
    };

    const parsed = createUserSchema.parse(studentInput);
    assert.strictEqual(parsed.email, 'aarav.sharma@axiscolleges.in');
    assert.strictEqual(parsed.fullName, 'Aarav Sharma');
    assert.strictEqual(parsed.role, 'student');
    assert.strictEqual(parsed.studentProfile?.rollNumber, '24BCSE104');
    assert.strictEqual(parsed.studentProfile?.currentSemester, 5);
  });

  test('validates a complete faculty user payload', () => {
    const facultyInput = {
      email: 'dr.verma@axiscolleges.in',
      fullName: 'Dr. Ramesh Verma',
      role: 'faculty',
      status: 'active',
      facultyProfile: {
        employeeId: 'FAC-CSE-012',
        designation: 'Associate Professor',
        qualifications: ['Ph.D. Computer Science', 'M.Tech'],
        cabinRoom: 'Block B, Room 304',
        officeHours: {
          start: '10:00',
          end: '12:00',
          isAcceptingDMs: true,
        },
      },
    };

    const parsed = createUserSchema.parse(facultyInput);
    assert.strictEqual(parsed.email, 'dr.verma@axiscolleges.in');
    assert.strictEqual(parsed.role, 'faculty');
    assert.strictEqual(parsed.facultyProfile?.employeeId, 'FAC-CSE-012');
    assert.strictEqual(parsed.facultyProfile?.officeHours?.isAcceptingDMs, true);
  });

  test('validates a complete administrator user payload', () => {
    const adminInput = {
      email: 'registrar.officer@axiscolleges.in',
      fullName: 'Sunil Kumar',
      role: 'admin',
      status: 'active',
      adminProfile: {
        adminStaffId: 'ADM-REG-001',
        administrativeDomain: 'Registrar Office',
        assignedQueueScopes: ['BONAFIDE', 'LEAVE_APPLICATION'],
        emergencyOverridePermitted: false,
      },
    };

    const parsed = createUserSchema.parse(adminInput);
    assert.strictEqual(parsed.role, 'admin');
    assert.strictEqual(parsed.adminProfile?.adminStaffId, 'ADM-REG-001');
    assert.strictEqual(parsed.adminProfile?.emergencyOverridePermitted, false);
  });

  test('rejects malformed email addresses', () => {
    const invalidInput = {
      email: 'not-an-email-address',
      fullName: 'Test User',
      role: 'student',
    };
    assert.strictEqual(createUserSchema.safeParse(invalidInput).success, false);
  });

  test('rejects unauthorized or arbitrary role values', () => {
    const invalidInput = {
      email: 'test@axiscolleges.in',
      fullName: 'Test User',
      role: 'superhero', // Invalid role
    };
    assert.strictEqual(createUserSchema.safeParse(invalidInput).success, false);
  });

  test('rejects out-of-range student academic values', () => {
    // Semester > 8
    assert.strictEqual(
      studentProfileSchema.safeParse({
        rollNumber: '24BCSE104',
        batchYear: 2026,
        currentSemester: 9,
        section: 'A',
      }).success,
      false
    );

    // Batch year < 2020
    assert.strictEqual(
      studentProfileSchema.safeParse({
        rollNumber: '24BCSE104',
        batchYear: 2015,
        currentSemester: 4,
        section: 'A',
      }).success,
      false
    );

    // Faculty employee ID too short (< 3 chars)
    assert.strictEqual(
      facultyProfileSchema.safeParse({
        employeeId: 'AB',
        designation: 'Professor',
      }).success,
      false
    );

    // Admin staff ID too short (< 3 chars)
    assert.strictEqual(
      adminProfileSchema.safeParse({
        adminStaffId: 'A',
        administrativeDomain: 'IT',
      }).success,
      false
    );
  });
});

describe('2. Security & Mass-Assignment Protection', () => {
  test('admin update schema permits role and status mutations', () => {
    const adminUpdate = adminUpdateUserSchema.parse({
      role: 'faculty',
      status: 'active',
      isProfileComplete: true,
    });
    assert.strictEqual(adminUpdate.role, 'faculty');
    assert.strictEqual(adminUpdate.status, 'active');
    assert.strictEqual(adminUpdate.isProfileComplete, true);
  });
  test('self-service update schema strips role, status and internal identifiers', () => {
    // A malicious student attempts to elevate themselves to admin and change their status
    const maliciousPayload = {
      fullName: 'Aarav Sharma Updated',
      phoneNumber: '+919876543210',
      role: 'super_admin', // Attempted privilege escalation
      status: 'active', // Attempted unverified activation
      authProviderId: 'clerk_fake_id',
      departmentId: '6730a005f8b1a2001a000050',
    };

    const sanitized = updateUserProfileSchema.parse(maliciousPayload) as Record<string, unknown>;

    // Allowed fields are preserved
    assert.strictEqual(sanitized.fullName, 'Aarav Sharma Updated');
    assert.strictEqual(sanitized.phoneNumber, '+919876543210');

    // Forbidden privilege fields are completely stripped
    assert.strictEqual(sanitized.role, undefined);
    assert.strictEqual(sanitized.status, undefined);
    assert.strictEqual(sanitized.authProviderId, undefined);
    assert.strictEqual(sanitized.departmentId, undefined);
  });

  test('rejects profile update attempts across different user IDs', async () => {
    const callerStudent: UserSession = {
      userId: '6730a005f8b1a2001a000001',
      email: 'student1@axiscolleges.in',
      role: 'student',
    };

    const targetUserId = '6730a005f8b1a2001a000002'; // Different user

    await assert.rejects(
      async () => {
        await UserService.updateUserProfile(
          targetUserId,
          { fullName: 'Tampered Name' },
          callerStudent
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('permission to modify another user’s profile'));
        return true;
      }
    );
  });

  test('rejects role mutation attempts by non-super-admin users', async () => {
    const callerFaculty: UserSession = {
      userId: '6730a005f8b1a2001a000003',
      email: 'faculty@axiscolleges.in',
      role: 'faculty',
    };

    await assert.rejects(
      async () => {
        await UserService.updateUserRole('6730a005f8b1a2001a000004', 'admin', callerFaculty);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Only Super Administrators'));
        return true;
      }
    );
  });
});

describe('3. DTO Formatting & Serialization', () => {
  test('toUserDTO transforms document without leaking internal __v', () => {
    const fakeDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000050'),
      email: 'student@axiscolleges.in',
      fullName: 'Pooja Patel',
      role: 'student',
      status: 'active',
      isProfileComplete: true,
      departmentId: new Types.ObjectId('6730a005f8b1a2001a000099'),
      phoneNumber: '+919123456789',
      avatarUrl: null,
      studentProfile: {
        rollNumber: '24BECE015',
        batchYear: 2026,
        currentSemester: 4,
        section: 'B',
        admissionType: 'regular' as const,
      },
      createdAt: new Date('2026-11-12T10:00:00.000Z'),
      updatedAt: new Date('2026-11-12T10:30:00.000Z'),
    } as unknown as IUser;

    const dto = toUserDTO(fakeDoc);

    assert.strictEqual(dto.id, '6730a005f8b1a2001a000050');
    assert.strictEqual(dto.email, 'student@axiscolleges.in');
    assert.strictEqual(dto.departmentId, '6730a005f8b1a2001a000099');
    assert.strictEqual(dto.studentProfile?.rollNumber, '24BECE015');
    assert.strictEqual(dto.createdAt, '2026-11-12T10:00:00.000Z');
    assert.strictEqual((dto as unknown as Record<string, unknown>).__v, undefined);
  });
});

describe('4. Username Validation, Normalization & Invariant Rules', () => {
  test('validates valid usernames according to institutional criteria', () => {
    const validUsernames = ['johndoe', 'john_doe', 'john.doe-1', 'a123', 'user_99.test', 'admin1'];
    for (const u of validUsernames) {
      const parsed = usernameSchema.parse(u);
      assert.strictEqual(parsed, u);
    }
  });

  test('normalizes usernames by trimming and converting to lowercase', () => {
    assert.strictEqual(usernameSchema.parse('  AaravSharma  '), 'aaravsharma');
    assert.strictEqual(usernameSchema.parse('John_Doe  '), 'john_doe');
    assert.strictEqual(usernameSchema.parse('  DR.VERMA-2026'), 'dr.verma-2026');
  });

  test('rejects usernames violating length constraints', () => {
    // Length < 3
    assert.strictEqual(usernameSchema.safeParse('ab').success, false);
    assert.strictEqual(usernameSchema.safeParse('a').success, false);
    assert.strictEqual(usernameSchema.safeParse('').success, false);

    // Length > 30
    assert.strictEqual(usernameSchema.safeParse('a'.repeat(31)).success, false);
  });

  test('rejects usernames with leading or trailing special characters', () => {
    assert.strictEqual(usernameSchema.safeParse('-johndoe').success, false);
    assert.strictEqual(usernameSchema.safeParse('_johndoe').success, false);
    assert.strictEqual(usernameSchema.safeParse('.johndoe').success, false);
    assert.strictEqual(usernameSchema.safeParse('johndoe-').success, false);
    assert.strictEqual(usernameSchema.safeParse('johndoe_').success, false);
    assert.strictEqual(usernameSchema.safeParse('johndoe.').success, false);
  });

  test('rejects usernames with disallowed characters and symbols', () => {
    const disallowed = ['john@doe', 'john doe', 'john#doe', 'user$test', 'hello!world', 'user%name'];
    for (const d of disallowed) {
      assert.strictEqual(usernameSchema.safeParse(d).success, false);
    }
  });

  test('validates username integration within createUserSchema', () => {
    const userInput = {
      email: 'rohit.sharma@axiscolleges.in',
      username: '  Rohit.Sharma_24  ',
      fullName: 'Rohit Sharma',
      role: 'student',
    };
    const parsed = createUserSchema.parse(userInput);
    assert.strictEqual(parsed.username, 'rohit.sharma_24');
  });
});

describe('5. Legacy Record Compatibility & Optional Support', () => {
  test('permits creation and parsing of legacy records lacking a username', () => {
    const legacyInput = {
      email: 'legacy.student@axiscolleges.in',
      fullName: 'Legacy Student',
      role: 'student',
    };
    const parsed = createUserSchema.parse(legacyInput);
    assert.strictEqual(parsed.username, undefined);
    assert.strictEqual(parsed.adminSubRole, undefined);
    assert.strictEqual(parsed.provisionedBy, undefined);
    assert.strictEqual(parsed.activatedAt, undefined);
    assert.strictEqual(parsed.isEmailVerified, false);
  });

  test('permits legacy records with null or undefined in adminUpdateUserSchema', () => {
    const updateInput = {
      role: 'student',
      adminSubRole: null,
      activatedAt: null,
      isEmailVerified: true,
    };
    const parsed = adminUpdateUserSchema.parse(updateInput);
    assert.strictEqual(parsed.adminSubRole, null);
    assert.strictEqual(parsed.activatedAt, null);
    assert.strictEqual(parsed.isEmailVerified, true);
  });
});

describe('6. Administrative Sub-Roles Validation & Access Control', () => {
  test('validates permitted administrative sub-roles', () => {
    const validSubRoles = ['sys_admin', 'hod', 'director'] as const;
    for (const subRole of validSubRoles) {
      assert.strictEqual(adminSubRoleSchema.parse(subRole), subRole);
    }
  });

  test('rejects arbitrary or unauthorized administrative sub-roles', () => {
    const invalidSubRoles = ['dean', 'principal', 'super_admin', 'root', 'staff', 'manager'];
    for (const invalid of invalidSubRoles) {
      assert.strictEqual(adminSubRoleSchema.safeParse(invalid).success, false);
    }
  });

  test('rejects updateAdminSubRole when invoked by non-super-admin caller', async () => {
    const callerAdmin: UserSession = {
      userId: '6730a005f8b1a2001a000010',
      email: 'admin@axiscolleges.in',
      role: 'admin', // Regular admin, not super_admin
    };

    await assert.rejects(
      async () => {
        await UserService.updateAdminSubRole('6730a005f8b1a2001a000011', 'hod', callerAdmin);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Only Super Administrators'));
        return true;
      }
    );
  });
});

describe('7. Provisioning, Verification & RSC Flight DTO Serialization', () => {
  test('toUserDTO correctly maps username, adminSubRole, isEmailVerified, provisionedBy and activatedAt', () => {
    const adminObjectId = new Types.ObjectId('6730a005f8b1a2001a000099');
    const activationDate = new Date('2026-11-14T12:00:00.000Z');

    const provisionedUserDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000055'),
      email: 'hod.cse@axiscolleges.in',
      username: 'hod_cse',
      fullName: 'Dr. Alok Nath',
      role: 'admin',
      adminSubRole: 'hod',
      status: 'active',
      isEmailVerified: true,
      isProfileComplete: true,
      departmentId: new Types.ObjectId('6730a005f8b1a2001a000001'),
      provisionedBy: adminObjectId,
      activatedAt: activationDate,
      phoneNumber: '+919876543210',
      avatarUrl: 'https://cdn.axiscolleges.in/avatars/hod.png',
      adminProfile: {
        adminStaffId: 'ADM-HOD-001',
        administrativeDomain: 'Computer Science Department',
        assignedQueueScopes: ['ACADEMIC', 'FACULTY_LEAVE'],
        emergencyOverridePermitted: true,
      },
      createdAt: new Date('2026-11-14T10:00:00.000Z'),
      updatedAt: new Date('2026-11-14T12:00:00.000Z'),
    } as unknown as IUser;

    const dto = toUserDTO(provisionedUserDoc);

    assert.strictEqual(dto.id, '6730a005f8b1a2001a000055');
    assert.strictEqual(dto.username, 'hod_cse');
    assert.strictEqual(dto.adminSubRole, 'hod');
    assert.strictEqual(dto.isEmailVerified, true);
    assert.strictEqual(dto.provisionedBy, '6730a005f8b1a2001a000099');
    assert.strictEqual(dto.activatedAt, '2026-11-14T12:00:00.000Z');
    assert.strictEqual(dto.adminProfile?.adminStaffId, 'ADM-HOD-001');
    assert.strictEqual(dto.adminProfile?.emergencyOverridePermitted, true);
  });

  test('toUserDTO safely handles legacy documents with missing or null fields', () => {
    const legacyDoc = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000060'),
      email: 'old.student@axiscolleges.in',
      fullName: 'Old Student',
      role: 'student',
      status: 'pending_verification',
      isProfileComplete: false,
      createdAt: new Date('2026-11-10T10:00:00.000Z'),
      updatedAt: new Date('2026-11-10T10:00:00.000Z'),
    } as unknown as IUser;

    const dto = toUserDTO(legacyDoc);

    assert.strictEqual(dto.id, '6730a005f8b1a2001a000060');
    assert.strictEqual(dto.username, null);
    assert.strictEqual(dto.adminSubRole, null);
    assert.strictEqual(dto.isEmailVerified, false);
    assert.strictEqual(dto.provisionedBy, null);
    assert.strictEqual(dto.activatedAt, null);
    assert.strictEqual(dto.studentProfile, null);
    assert.strictEqual(dto.facultyProfile, null);
    assert.strictEqual(dto.adminProfile, null);
  });
});
