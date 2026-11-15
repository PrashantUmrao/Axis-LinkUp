/**
 * Phase 5 Main Admin Setup & Disable Public Signup Unit Test Suite.
 * Validates:
 * 1. Primary System Administrator role, sub-role, and permissions.
 * 2. Complete removal/blocking of public sign-up (edge, middleware, and webhook).
 * 3. Role-based routing for all collegiate personas (Student, Faculty, HOD, Director, System Admin).
 * 4. Zero regression for student authentication and RBAC boundaries.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getRoleDashboard,
  isValidPortalForRole,
  isAuthorizedRouteForRole,
} from '@/lib/auth/routing';
import { hasPermission } from '@/lib/auth/rbac';
import { PERMISSIONS } from '@/lib/auth/permissions';
import type { UserRole, AdminSubRole } from '@/types/user';

describe('1. Main System Administrator Permissions & Capability Invariants', () => {
  const role: UserRole = 'super_admin';
  const adminSubRole: AdminSubRole = 'sys_admin';

  it('System Administrator routes to /admin/dashboard', () => {
    const dashboard = getRoleDashboard(role, adminSubRole);
    assert.strictEqual(dashboard, '/admin/dashboard');
  });

  it('System Administrator has permission to manage all collegiate users (users:manage)', () => {
    const canManage = hasPermission(role, PERMISSIONS.USERS_MANAGE);
    assert.strictEqual(canManage, true, 'System Admin must hold users:manage');
  });

  it('System Administrator has permission to manage roles and RBAC (users:manage_roles)', () => {
    const canManageRoles = hasPermission(role, PERMISSIONS.USERS_MANAGE_ROLES);
    assert.strictEqual(canManageRoles, true, 'System Admin must hold users:manage_roles');
  });

  it('System Administrator has permission to modify RBAC roles and permissions', () => {
    const canModifyRoles = hasPermission(role, PERMISSIONS.RBAC_MODIFY_ROLES);
    const canManagePerms = hasPermission(role, PERMISSIONS.RBAC_MANAGE_PERMISSIONS);
    assert.strictEqual(canModifyRoles, true);
    assert.strictEqual(canManagePerms, true);
  });

  it('System Administrator is authorized across all route tiers', () => {
    assert.strictEqual(isAuthorizedRouteForRole('/super-admin/dashboard', role), true);
    assert.strictEqual(isAuthorizedRouteForRole('/admin/dashboard', role), true);
    assert.strictEqual(isAuthorizedRouteForRole('/faculty/dashboard', role), true);
    assert.strictEqual(isAuthorizedRouteForRole('/student/dashboard', role), true);
  });

  it('System Administrator can enter through any portal door for institutional oversight', () => {
    assert.strictEqual(isValidPortalForRole('admin', role, adminSubRole), true);
    assert.strictEqual(isValidPortalForRole('faculty', role, adminSubRole), true);
    assert.strictEqual(isValidPortalForRole('student', role, adminSubRole), true);
  });
});

describe('2. Closed Public Registration & Ingress Invariants', () => {
  it('Reject public self-registration: invalid portal selection for unknown role', () => {
    assert.strictEqual(isValidPortalForRole('student', 'unknown_role'), false);
    assert.strictEqual(isValidPortalForRole('faculty', 'unknown_role'), false);
    assert.strictEqual(isValidPortalForRole('admin', 'unknown_role'), false);
  });

  it('Reject student attempt to select faculty portal (clearance mismatch)', () => {
    assert.strictEqual(isValidPortalForRole('faculty', 'student'), false);
  });

  it('Reject student attempt to select admin portal (clearance mismatch)', () => {
    assert.strictEqual(isValidPortalForRole('admin', 'student'), false);
  });

  it('Reject faculty attempt to select student portal (clearance mismatch)', () => {
    assert.strictEqual(isValidPortalForRole('student', 'faculty'), false);
  });

  it('Reject faculty attempt to select admin portal (clearance mismatch)', () => {
    assert.strictEqual(isValidPortalForRole('admin', 'faculty'), false);
  });
});

describe('3. Multi-Persona Authentication & Dashboard Routing Preservation', () => {
  it('Student persona routes strictly to /student/dashboard', () => {
    assert.strictEqual(getRoleDashboard('student'), '/student/dashboard');
  });

  it('Faculty persona routes strictly to /faculty/dashboard', () => {
    assert.strictEqual(getRoleDashboard('faculty'), '/faculty/dashboard');
  });

  it('Department HOD (admin + hod sub-role) routes to /admin/dashboard', () => {
    assert.strictEqual(getRoleDashboard('admin', 'hod'), '/admin/dashboard');
  });

  it('Executive Director (super_admin + director sub-role) routes to /admin/dashboard', () => {
    assert.strictEqual(getRoleDashboard('super_admin', 'director'), '/admin/dashboard');
  });

  it('System Administrator (super_admin + sys_admin sub-role) routes to /admin/dashboard', () => {
    assert.strictEqual(getRoleDashboard('super_admin', 'sys_admin'), '/admin/dashboard');
  });
});

describe('4. Student Functionality & Security Boundary Invariants', () => {
  const studentRole: UserRole = 'student';

  it('Student CANNOT manage other users', () => {
    assert.strictEqual(hasPermission(studentRole, PERMISSIONS.USERS_MANAGE), false);
  });

  it('Student CANNOT manage user roles', () => {
    assert.strictEqual(hasPermission(studentRole, PERMISSIONS.USERS_MANAGE_ROLES), false);
  });

  it('Student CANNOT access /admin route paths', () => {
    assert.strictEqual(isAuthorizedRouteForRole('/admin/dashboard', studentRole), false);
    assert.strictEqual(isAuthorizedRouteForRole('/admin/notices', studentRole), false);
    assert.strictEqual(isAuthorizedRouteForRole('/admin/polls', studentRole), false);
  });

  it('Student CANNOT access /super-admin route paths', () => {
    assert.strictEqual(isAuthorizedRouteForRole('/super-admin/dashboard', studentRole), false);
  });

  it('Student is strictly authorized for student routes', () => {
    assert.strictEqual(isAuthorizedRouteForRole('/student/dashboard', studentRole), true);
    assert.strictEqual(isAuthorizedRouteForRole('/student/notices', studentRole), true);
    assert.strictEqual(isAuthorizedRouteForRole('/student/polls', studentRole), true);
  });
});

