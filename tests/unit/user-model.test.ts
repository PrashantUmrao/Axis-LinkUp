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
