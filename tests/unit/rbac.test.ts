/**
 * Comprehensive Unit Tests for Axis LinkUp Role-Based Access Control (RBAC).
 * Conforms to DOC-AUTH-005 (RBAC & Permission Matrix) and Phase 3 Part 3.5 criteria.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  PERMISSIONS,
  ROLE_HIERARCHY,
  getPermissionScope,
  hasPermission,
  canAccessResource,
  isRoleAtLeast,
  assertRole,
  assertPermission,
  assertResourceOwnership,
  assertDepartmentScope,
  hasClientPermission,
  canViewNavItem,
  getAuthorizedNavRoutes,
} from '@/lib/auth';
import { ForbiddenError } from '@/lib/errors/app-error';
import type { UserRole, UserSession, UserStatus } from '@/types/user';

describe('Role-Based Access Control (RBAC) & Authorization Engine', () => {
  // Test mock sessions
  const studentSession: UserSession = {
    userId: 'student_obj_id_101',
    email: 'student@axiscolleges.in',
    role: 'student',
    status: 'active',
    departmentId: 'dept_cse_001',
  };

  const facultySession: UserSession = {
    userId: 'faculty_obj_id_201',
    email: 'faculty@axiscolleges.in',
    role: 'faculty',
    status: 'active',
    departmentId: 'dept_cse_001',
  };

  const adminSession: UserSession = {
    userId: 'admin_obj_id_301',
    email: 'admin.exam@axiscolleges.in',
    role: 'admin',
    status: 'active',
    departmentId: 'dept_cse_001',
  };

  const superAdminSession: UserSession = {
    userId: 'super_admin_obj_id_401',
    email: 'director@axiscolleges.in',
    role: 'super_admin',
    status: 'active',
  };

  // 1. Authorized Role Can Perform Allowed Action
  describe('1. Authorized Role Permissions', () => {
    it('allows student to view student dashboard and academic calendar', () => {
      assert.equal(hasPermission('student', PERMISSIONS.STUDENT_DASH_VIEW), true);
      assert.equal(hasPermission('student', PERMISSIONS.CALENDAR_VIEW), true);
      assert.equal(hasPermission('student', PERMISSIONS.NOTES_DOWNLOAD), true);
      assert.equal(hasPermission('student', PERMISSIONS.NOTICES_READ), true);
    });

    it('allows faculty to view faculty dashboard and read notices', () => {
      assert.equal(hasPermission('faculty', PERMISSIONS.FACULTY_DASH_VIEW), true);
      assert.equal(hasPermission('faculty', PERMISSIONS.NOTICES_READ), true);
      assert.equal(hasPermission('faculty', PERMISSIONS.NOTES_DOWNLOAD), true);
    });

    it('allows admin to view admin console and edit academic calendar', () => {
      assert.equal(hasPermission('admin', PERMISSIONS.ADMIN_DASH_VIEW), true);
      assert.equal(hasPermission('admin', PERMISSIONS.CALENDAR_EDIT), true);
    });

    it('allows super admin to trigger emergency mode and manage RBAC roles', () => {
      assert.equal(hasPermission('super_admin', PERMISSIONS.EMERGENCY_TRIGGER), true);
      assert.equal(hasPermission('super_admin', PERMISSIONS.RBAC_MODIFY_ROLES), true);
      assert.equal(hasPermission('super_admin', PERMISSIONS.RBAC_MANAGE_PERMISSIONS), true);
      assert.equal(hasPermission('super_admin', PERMISSIONS.SUPER_ADMIN_VIEW_TELEMETRY), true);
    });
  });

  // 2. Unauthorized Role is Denied
  describe('2. Unauthorized Role Denials (Deny-by-Default)', () => {
    it('denies students from accessing faculty or administrative dashboards', () => {
      assert.equal(hasPermission('student', PERMISSIONS.FACULTY_DASH_VIEW), false);
      assert.equal(hasPermission('student', PERMISSIONS.ADMIN_DASH_VIEW), false);
      assert.equal(hasPermission('student', PERMISSIONS.SUPER_ADMIN_VIEW_TELEMETRY), false);
    });

    it('denies faculty and students from triggering campus emergency alerts', () => {
      assert.equal(hasPermission('student', PERMISSIONS.EMERGENCY_TRIGGER), false);
      assert.equal(hasPermission('faculty', PERMISSIONS.EMERGENCY_TRIGGER), false);
      assert.equal(hasPermission('admin', PERMISSIONS.EMERGENCY_TRIGGER), false);
    });

    it('strictly denies all roles from viewing peer assignment submissions', () => {
      assert.equal(hasPermission('student', PERMISSIONS.ASSIGNMENTS_VIEW_PEER_SUBMISSIONS), false);
      assert.equal(hasPermission('faculty', PERMISSIONS.ASSIGNMENTS_VIEW_PEER_SUBMISSIONS), false);
      assert.equal(hasPermission('admin', PERMISSIONS.ASSIGNMENTS_VIEW_PEER_SUBMISSIONS), false);
      assert.equal(
        hasPermission('super_admin', PERMISSIONS.ASSIGNMENTS_VIEW_PEER_SUBMISSIONS),
        false
      );
    });

    it('denies faculty and admin from submitting assignments (student only)', () => {
      assert.equal(hasPermission('faculty', PERMISSIONS.ASSIGNMENTS_SUBMIT), false);
      assert.equal(hasPermission('admin', PERMISSIONS.ASSIGNMENTS_SUBMIT), false);
    });
  });

  // 3. Missing Authentication is Denied
  describe('3. Missing Authentication Protection', () => {
    it('denies access when user session is null or undefined', () => {
      assert.equal(
        canAccessResource(null as unknown as UserSession, PERMISSIONS.CALENDAR_VIEW),
        false
      );
      assert.equal(
        canAccessResource(undefined as unknown as UserSession, PERMISSIONS.NOTICES_READ),
        false
      );
    });

    it('denies access when user role is missing from session', () => {
      const invalidSession = { userId: 'u1', email: 'test@axiscolleges.in' } as UserSession;
      assert.equal(canAccessResource(invalidSession, PERMISSIONS.CALENDAR_VIEW), false);
    });
  });

  // 4. Missing or Invalid Role is Denied
  describe('4. Invalid & Unrecognized Role Handling', () => {
    it('denies access for arbitrary or attacker-forged role names', () => {
      const forgedRole = 'super_user' as UserRole;
      assert.equal(getPermissionScope(forgedRole, PERMISSIONS.CALENDAR_VIEW), 'DENY');
      assert.equal(hasPermission(forgedRole, PERMISSIONS.CALENDAR_VIEW), false);
    });

    it('throws ForbiddenError when assertRole fails', () => {
      assert.throws(
        () => {
          assertRole('student', ['faculty', 'admin']);
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as ForbiddenError).message, /Access denied/);
          return true;
        }
      );
    });
  });

  // 5. Disabled and Suspended Account Handling
  describe('5. Account Lifecycle Status Checks', () => {
    function assertActiveAccount(status?: UserStatus): void {
      if (!status || status !== 'active') {
        throw new ForbiddenError(`Account status is '${status}'. Active account required.`);
      }
    }

    it('allows active accounts to proceed', () => {
      assert.doesNotThrow(() => assertActiveAccount('active'));
    });

    it('denies suspended accounts with ForbiddenError', () => {
      assert.throws(
        () => assertActiveAccount('suspended'),
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as ForbiddenError).message, /suspended/);
          return true;
        }
      );
    });

    it('denies deactivated accounts with ForbiddenError', () => {
      assert.throws(
        () => assertActiveAccount('deactivated'),
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as ForbiddenError).message, /deactivated/);
          return true;
        }
      );
    });

    it('denies pending_verification accounts with ForbiddenError', () => {
      assert.throws(
        () => assertActiveAccount('pending_verification'),
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as ForbiddenError).message, /pending_verification/);
          return true;
        }
      );
    });
  });

  // 6. Resource Ownership Restrictions (ABAC)
  describe('6. Resource Ownership (ABAC) Enforcement', () => {
    it('permits student to update their own profile; rejects updating another user', () => {
      // Owner matches caller
      const ownContext = { ownerId: studentSession.userId };
      assert.equal(
        canAccessResource(studentSession, PERMISSIONS.USERS_UPDATE_OWN, ownContext),
        true
      );

      // Caller is NOT owner
      const otherUserContext = { ownerId: 'other_student_999' };
      assert.equal(
        canAccessResource(studentSession, PERMISSIONS.USERS_UPDATE_OWN, otherUserContext),
        false
      );
    });

    it('permits faculty to grade submissions for courses they instruct; rejects unassigned courses', () => {
      // Faculty is in instructorIds
      const assignedCourseContext = {
        instructorIds: [facultySession.userId, 'other_instructor'],
      };
      assert.equal(
        canAccessResource(
          facultySession,
          PERMISSIONS.ASSIGNMENTS_CREATE_GRADE,
          assignedCourseContext
        ),
        true
      );

      // Faculty is NOT in instructorIds
      const unassignedCourseContext = { instructorIds: ['someone_else_only'] };
      assert.equal(
        canAccessResource(
          facultySession,
          PERMISSIONS.ASSIGNMENTS_CREATE_GRADE,
          unassignedCourseContext
        ),
        false
      );
    });

    it('throws ForbiddenError when assertResourceOwnership fails', () => {
      assert.throws(
        () => {
          assertResourceOwnership('user_101', 'user_202');
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as ForbiddenError).message, /own resources/);
          return true;
        }
      );
    });

    it('succeeds when assertResourceOwnership matches', () => {
      assert.doesNotThrow(() => {
        assertResourceOwnership('user_101', 'user_101');
      });
    });
  });

  // 7. Departmental Scoping
  describe('7. Departmental Isolation (ABAC)', () => {
    it('allows departmental admin to manage resources in their own department', () => {
      const sameDeptContext = { departmentId: 'dept_cse_001' };
      assert.equal(
        canAccessResource(adminSession, PERMISSIONS.USERS_MANAGE, sameDeptContext),
        true
      );
    });

    it('denies departmental admin from managing resources in another department', () => {
      const otherDeptContext = { departmentId: 'dept_ece_002' };
      assert.equal(
        canAccessResource(adminSession, PERMISSIONS.USERS_MANAGE, otherDeptContext),
        false
      );
    });

    it('permits super admin to operate across all departments', () => {
      const anyDeptContext = { departmentId: 'dept_ece_002' };
      assert.equal(
        canAccessResource(superAdminSession, PERMISSIONS.USERS_MANAGE, anyDeptContext),
        true
      );
    });

    it('assertDepartmentScope throws on department mismatch for non-super-admin', () => {
      assert.throws(
        () => {
          assertDepartmentScope('dept_cse_001', 'dept_ece_002', 'admin');
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          return true;
        }
      );
    });

    it('assertDepartmentScope allows super_admin across any department', () => {
      assert.doesNotThrow(() => {
        assertDepartmentScope(undefined, 'dept_ece_002', 'super_admin');
      });
    });
  });

  // 8. Privilege Escalation Prevention
  describe('8. Privilege Escalation Safeguards', () => {
    it('strictly prohibits non-super-admins from modifying roles', () => {
      assert.equal(hasPermission('student', PERMISSIONS.USERS_MANAGE_ROLES), false);
      assert.equal(hasPermission('faculty', PERMISSIONS.USERS_MANAGE_ROLES), false);
      assert.equal(hasPermission('admin', PERMISSIONS.USERS_MANAGE_ROLES), false);
      assert.equal(hasPermission('super_admin', PERMISSIONS.USERS_MANAGE_ROLES), true);
    });

    it('assertPermission throws on role escalation attempt', () => {
      assert.throws(
        () => {
          assertPermission(adminSession, PERMISSIONS.USERS_MANAGE_ROLES);
        },
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.match((err as ForbiddenError).message, /Insufficient permissions/);
          return true;
        }
      );
    });
  });

  // 9. Role Hierarchy & Client UI Utilities
  describe('9. Role Hierarchy & Client UI Helpers', () => {
    it('evaluates role hierarchy correctly', () => {
      assert.equal(ROLES.STUDENT, 'student');
      assert.equal(ROLES.SUPER_ADMIN, 'super_admin');
      assert.equal(ROLE_HIERARCHY.student, 1);
      assert.equal(ROLE_HIERARCHY.super_admin, 4);
      assert.equal(isRoleAtLeast('student', 'student'), true);
      assert.equal(isRoleAtLeast('faculty', 'student'), true);
      assert.equal(isRoleAtLeast('admin', 'faculty'), true);
      assert.equal(isRoleAtLeast('super_admin', 'admin'), true);
      assert.equal(isRoleAtLeast('student', 'faculty'), false);
      assert.equal(isRoleAtLeast('faculty', 'admin'), false);
      assert.equal(isRoleAtLeast('admin', 'super_admin'), false);
    });

    it('canViewNavItem accurately filters navigation per role', () => {
      assert.equal(canViewNavItem('student', ['student']), true);
      assert.equal(canViewNavItem('student', ['faculty', 'admin']), false);
      assert.equal(canViewNavItem('super_admin', ['admin', 'super_admin']), true);
    });

    it('hasClientPermission evaluates baseline UI capability', () => {
      assert.equal(hasClientPermission('student', PERMISSIONS.STUDENT_DASH_VIEW), true);
      assert.equal(hasClientPermission('student', PERMISSIONS.ADMIN_DASH_VIEW), false);
      assert.equal(hasClientPermission('faculty', PERMISSIONS.NOTICES_PUBLISH_COURSE), true);
      assert.equal(hasClientPermission('student', PERMISSIONS.NOTICES_PUBLISH_COURSE), false);
    });

    it('returns persona-tailored navigation items', () => {
      const studentRoutes = getAuthorizedNavRoutes('student');
      assert.ok(studentRoutes.some((r) => r.href.includes('/student')));

      const facultyRoutes = getAuthorizedNavRoutes('faculty');
      assert.ok(facultyRoutes.some((r) => r.href.includes('/faculty')));

      const adminRoutes = getAuthorizedNavRoutes('admin');
      assert.ok(adminRoutes.some((r) => r.href.includes('/admin')));

      const superAdminRoutes = getAuthorizedNavRoutes('super_admin');
      assert.ok(superAdminRoutes.some((r) => r.href.includes('/super-admin')));
    });
  });
});
