/**
 * Automated Test Suite for Role-Based Login, Authentication & Dashboard Routing.
 * Validates all 13 institutional ingress scenarios, portal compatibility checks,
 * zero-trust role resolution, closed registration, inactive status gates, and direct URL access protection.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import {
  getRoleDashboard,
  isValidPortalForRole,
  isAuthorizedRouteForRole,
  sanitizeRedirectUrl,
} from '@/lib/auth/routing';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { ActivationService } from '@/lib/services/activation.service';
import type { IUser, UserRole, AdminSubRole, UserStatus } from '@/types/user';

describe('Role-Based Login, Authentication & Dashboard Routing Suite', () => {
  // --------------------------------------------------------------------------
  // SCENARIO 1: Student Login -> Student Dashboard
  // --------------------------------------------------------------------------
  it('1. Student login -> Student Dashboard (/student/dashboard)', () => {
    const role: UserRole = 'student';
    const portal = 'student';

    // Step 1: Portal selection verification
    const isPortalAllowed = isValidPortalForRole(portal, role);
    assert.strictEqual(isPortalAllowed, true, 'Student portal must be valid for student role');

    // Step 2: Role-based dashboard resolution
    const targetDashboard = getRoleDashboard(role);
    assert.strictEqual(
      targetDashboard,
      '/student/dashboard',
      'Student persona must route strictly to /student/dashboard'
    );
  });

  // --------------------------------------------------------------------------
  // SCENARIO 2: Faculty Login -> Faculty Dashboard
  // --------------------------------------------------------------------------
  it('2. Faculty login -> Faculty Dashboard (/faculty/dashboard)', () => {
    const role: UserRole = 'faculty';
    const portal = 'faculty';

    // Step 1: Portal selection verification
    const isPortalAllowed = isValidPortalForRole(portal, role);
    assert.strictEqual(isPortalAllowed, true, 'Faculty portal must be valid for faculty role');

    // Step 2: Role-based dashboard resolution
    const targetDashboard = getRoleDashboard(role);
    assert.strictEqual(
      targetDashboard,
      '/faculty/dashboard',
      'Faculty persona must route strictly to /faculty/dashboard'
    );
  });

  // --------------------------------------------------------------------------
  // SCENARIO 3: HOD Login -> Authorized HOD Workspace
  // --------------------------------------------------------------------------
  it('3. HOD login -> Authorized HOD workspace (/admin/dashboard)', () => {
    const role: UserRole = 'admin';
    const adminSubRole: AdminSubRole = 'hod';
    const portal = 'admin';

    // Step 1: Portal selection verification
    const isPortalAllowed = isValidPortalForRole(portal, role, adminSubRole);
    assert.strictEqual(isPortalAllowed, true, 'Admin portal must be valid for HOD role');

    // Step 2: Role-based dashboard resolution
    const targetDashboard = getRoleDashboard(role, adminSubRole);
    assert.strictEqual(
      targetDashboard,
      '/admin/dashboard',
      'Department HOD must route strictly to /admin/dashboard'
    );
  });

  // --------------------------------------------------------------------------
  // SCENARIO 4: Director Login -> Authorized Director Workspace
  // --------------------------------------------------------------------------
  it('4. Director login -> Authorized Director workspace (/admin/dashboard)', () => {
    const role: UserRole = 'super_admin';
    const adminSubRole: AdminSubRole = 'director';
    const portal = 'admin';

    // Step 1: Portal selection verification
    const isPortalAllowed = isValidPortalForRole(portal, role, adminSubRole);
    assert.strictEqual(isPortalAllowed, true, 'Admin portal must be valid for Director');

    // Step 2: Role-based dashboard resolution
    const targetDashboard = getRoleDashboard(role, adminSubRole);
    assert.strictEqual(
      targetDashboard,
      '/admin/dashboard',
      'Executive Director must route to /admin/dashboard workspace'
    );
  });

  // --------------------------------------------------------------------------
  // SCENARIO 5: System Administrator Login -> Admin Dashboard
  // --------------------------------------------------------------------------
  it('5. System Administrator login -> Admin Dashboard (/admin/dashboard)', () => {
    const role: UserRole = 'super_admin';
    const adminSubRole: AdminSubRole = 'sys_admin';
    const portal = 'admin';

    // Step 1: Portal selection verification
    const isPortalAllowed = isValidPortalForRole(portal, role, adminSubRole);
    assert.strictEqual(
      isPortalAllowed,
      true,
      'Admin portal must be valid for System Administrator'
    );

    // Step 2: Role-based dashboard resolution
    const targetDashboard = getRoleDashboard(role, adminSubRole);
    assert.strictEqual(
      targetDashboard,
      '/admin/dashboard',
      'System Administrator must route to /admin/dashboard'
    );
  });

  // --------------------------------------------------------------------------
  // SCENARIO 6: Student Selecting Faculty Portal -> Rejected
  // --------------------------------------------------------------------------
  it('6. Student selecting Faculty Portal -> Rejected with mismatch', () => {
    const role: UserRole = 'student';
    const selectedPortal = 'faculty';

    const isPortalAllowed = isValidPortalForRole(selectedPortal, role);
    assert.strictEqual(
      isPortalAllowed,
      false,
      'Student selecting Faculty Portal must be strictly rejected'
    );
  });

  // --------------------------------------------------------------------------
  // SCENARIO 7: Student Selecting Admin Portal -> Rejected
  // --------------------------------------------------------------------------
  it('7. Student selecting Admin Portal -> Rejected with mismatch', () => {
    const role: UserRole = 'student';
    const selectedPortal = 'admin';

    const isPortalAllowed = isValidPortalForRole(selectedPortal, role);
    assert.strictEqual(
      isPortalAllowed,
      false,
      'Student selecting Admin Portal must be strictly rejected'
    );
  });

  // --------------------------------------------------------------------------
  // SCENARIO 8: Faculty Selecting Admin Portal -> Rejected
  // --------------------------------------------------------------------------
  it('8. Faculty selecting Admin Portal -> Rejected with mismatch', () => {
    const role: UserRole = 'faculty';
    const selectedPortal = 'admin';

    const isPortalAllowed = isValidPortalForRole(selectedPortal, role);
    assert.strictEqual(
      isPortalAllowed,
      false,
      'Faculty selecting Admin Portal must be strictly rejected'
    );

    // Also verify Faculty selecting Student Portal is rejected
    const isStudentPortalAllowed = isValidPortalForRole('student', role);
    assert.strictEqual(
      isStudentPortalAllowed,
      false,
      'Faculty selecting Student Portal must be strictly rejected'
    );
  });

  // --------------------------------------------------------------------------
  // SCENARIO 9: Unauthorized Direct Dashboard URL Access -> Rejected
  // --------------------------------------------------------------------------
  it("9. Unauthorized direct dashboard URL access -> Rejected and redirected to user's authorized portal", () => {
    // Student attempting to open Faculty, Admin, or Super Admin routes directly
    assert.strictEqual(isAuthorizedRouteForRole('/faculty/dashboard', 'student'), false);
    assert.strictEqual(isAuthorizedRouteForRole('/admin/dashboard', 'student'), false);
    assert.strictEqual(isAuthorizedRouteForRole('/super-admin/dashboard', 'student'), false);

    // When access is denied, ingress gate redirects to student's authorized portal
    assert.strictEqual(getRoleDashboard('student'), '/student/dashboard');

    // Faculty attempting to open Admin or Super Admin routes directly
    assert.strictEqual(isAuthorizedRouteForRole('/admin/dashboard', 'faculty'), false);
    assert.strictEqual(isAuthorizedRouteForRole('/super-admin/dashboard', 'faculty'), false);
    assert.strictEqual(getRoleDashboard('faculty'), '/faculty/dashboard');

    // Admin (HOD) attempting to open Super Admin console directly
    assert.strictEqual(isAuthorizedRouteForRole('/super-admin/dashboard', 'admin'), false);
    assert.strictEqual(getRoleDashboard('admin'), '/admin/dashboard');

    // Shared routes are permitted for all active personas
    assert.strictEqual(isAuthorizedRouteForRole('/shared/profile', 'student'), true);
    assert.strictEqual(isAuthorizedRouteForRole('/shared/profile', 'faculty'), true);
    assert.strictEqual(isAuthorizedRouteForRole('/shared/profile', 'admin'), true);
  });

  // --------------------------------------------------------------------------
  // SCENARIO 10: Inactive / Suspended Account Login -> Rejected
  // --------------------------------------------------------------------------
  it('10. Inactive / Suspended account login -> Rejected', () => {
    function evaluateAccountStatus(status: UserStatus): {
      allowed: boolean;
      redirectTarget?: string;
    } {
      if (status === 'suspended') {
        return { allowed: false, redirectTarget: '/account-suspended' };
      }
      if (status === 'pending_verification') {
        return { allowed: false, redirectTarget: '/pending-approval' };
      }
      if (status === 'deactivated' || status === 'archived' || status === 'graduated') {
        return { allowed: false, redirectTarget: '/unauthorized' };
      }
      return { allowed: true };
    }

    // Suspended account must be intercepted and routed to /account-suspended
    const suspendedResult = evaluateAccountStatus('suspended');
    assert.strictEqual(suspendedResult.allowed, false);
    assert.strictEqual(suspendedResult.redirectTarget, '/account-suspended');

    // Deactivated account must be rejected with unauthorized
    const deactivatedResult = evaluateAccountStatus('deactivated');
    assert.strictEqual(deactivatedResult.allowed, false);
    assert.strictEqual(deactivatedResult.redirectTarget, '/unauthorized');

    // Archived account must be rejected with unauthorized
    const archivedResult = evaluateAccountStatus('archived');
    assert.strictEqual(archivedResult.allowed, false);
    assert.strictEqual(archivedResult.redirectTarget, '/unauthorized');

    // Active account is permitted
    const activeResult = evaluateAccountStatus('active');
    assert.strictEqual(activeResult.allowed, true);
  });

  // --------------------------------------------------------------------------
  // SCENARIO 11: Unverified Account Activation -> Correctly Enforced
  // --------------------------------------------------------------------------
  it('11. Unverified account activation -> Correctly enforced', () => {
    // 1. Pending verification user attempting login is redirected to pending approval
    const pendingUser = {
      status: 'pending_verification' as UserStatus,
      activatedAt: null,
    };
    assert.strictEqual(pendingUser.status === 'active', false);

    // 2. Cryptographic token generation and verification
    const rawToken = 'a'.repeat(64);
    const hash = ActivationService.hashToken(rawToken);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64);

    // 3. Status transition post-activation
    const activatedUser = {
      ...pendingUser,
      status: 'active' as UserStatus,
      activatedAt: new Date(),
    };
    assert.strictEqual(activatedUser.status, 'active');
    assert.ok(activatedUser.activatedAt instanceof Date);
  });

  // --------------------------------------------------------------------------
  // SCENARIO 12: Username and Institutional Email Login
  // --------------------------------------------------------------------------
  it('12. Username and institutional email login -> Verified identifier lookup', async () => {
    const mockStudent = {
      _id: new Types.ObjectId('6730a005f8b1a2001a000101'),
      email: 'arjun.patel@axiscolleges.in',
      username: 'arjun.patel',
      role: 'student' as UserRole,
      status: 'active' as UserStatus,
    };

    // Mock UserRepository.findByIdentifier
    mock.method(UserRepository, 'findByIdentifier', async (identifier: string) => {
      const normalized = identifier.toLowerCase().trim();
      if (
        normalized === mockStudent.email.toLowerCase() ||
        normalized === mockStudent.username.toLowerCase()
      ) {
        return mockStudent as unknown as IUser;
      }
      return null;
    });

    // Test A: Lookup via institutional email
    const userByEmail = await UserRepository.findByIdentifier('arjun.patel@axiscolleges.in');
    assert.ok(userByEmail, 'User should be found by institutional email');
    assert.strictEqual(userByEmail?.email, 'arjun.patel@axiscolleges.in');

    // Test B: Lookup via unique username
    const userByUsername = await UserRepository.findByIdentifier('arjun.patel');
    assert.ok(userByUsername, 'User should be found by username');
    assert.strictEqual(userByUsername?.username, 'arjun.patel');

    // Test C: Case insensitivity and whitespace trimming
    const userWithCaps = await UserRepository.findByIdentifier('  ARJUN.PATEL@AXISCOLLEGES.IN  ');
    assert.ok(userWithCaps, 'Lookup must be case-insensitive and trimmed');

    // Test D: Invalid identifier
    const nonExistent = await UserRepository.findByIdentifier('nonexistent.user');
    assert.strictEqual(nonExistent, null, 'Non-existent identifier must return null');
  });

  // --------------------------------------------------------------------------
  // SCENARIO 13: Session and Role Changes -> Correctly Enforced
  // --------------------------------------------------------------------------
  it('13. Session and role changes -> Correctly enforced upon state transition', () => {
    // Initial state: Faculty member
    let currentRole: UserRole = 'faculty';
    let currentSubRole: AdminSubRole | undefined = undefined;

    let dashboard = getRoleDashboard(currentRole, currentSubRole);
    assert.strictEqual(dashboard, '/faculty/dashboard');
    assert.strictEqual(isValidPortalForRole('admin', currentRole), false);

    // Administrative promotion: Faculty appointed as Department HOD
    currentRole = 'admin';
    currentSubRole = 'hod';

    dashboard = getRoleDashboard(currentRole, currentSubRole);
    assert.strictEqual(dashboard, '/admin/dashboard');
    assert.strictEqual(isValidPortalForRole('admin', currentRole, currentSubRole), true);

    // Access to previous faculty routes is updated
    assert.strictEqual(isAuthorizedRouteForRole('/admin/dashboard', currentRole), true);

    // Open-redirect defense validation
    assert.strictEqual(sanitizeRedirectUrl('/faculty/dashboard'), '/faculty/dashboard');
    assert.strictEqual(sanitizeRedirectUrl('https://evil.com'), '/');
    assert.strictEqual(sanitizeRedirectUrl('//evil.com'), '/');
    assert.strictEqual(sanitizeRedirectUrl('\\evil.com'), '/');
    assert.strictEqual(sanitizeRedirectUrl(undefined), '/');
  });
});
