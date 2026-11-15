/**
 * Automated Tests for Global Application Navigation & Role-Based Shell Routing.
 * Conforms to DOC-AUTH-005, Phase 4 UI Architecture and Part 4.2 requirements.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_PORTAL_METADATA,
  MASTER_NAVIGATION_ITEMS,
  getNavigationForRole,
  getBreadcrumbsForPath,
} from '@/config/navigation';
import { ROLE_PERMISSIONS_MATRIX } from '@/lib/auth/permissions';
import type { UserRole } from '@/types/user';

describe('Global Application Layout & Role-Based Navigation', () => {
  const ROLES: UserRole[] = ['student', 'faculty', 'admin', 'super_admin'];

  // Approved, currently implemented application routes
  const IMPLEMENTED_ROUTES = new Set([
    '/',
    '/student/dashboard',
    '/faculty/dashboard',
    '/admin/dashboard',
    '/super-admin/dashboard',
    '/shared/profile',
    '/ui-preview',
    '/student/messages',
    '/faculty/messages',
    '/admin/messages',
    '/student/complaints',
    '/faculty/complaints',
    '/admin/complaints',
    '/student/notices',
    '/student/polls',
    '/faculty/notices',
    '/faculty/polls',
    '/admin/notices',
    '/admin/polls',
  ]);

  describe('1. Institutional Portal Metadata', () => {
    it('defines complete metadata for all four collegiate personas', () => {
      for (const role of ROLES) {
        const meta = ROLE_PORTAL_METADATA[role];
        assert.ok(meta, `Metadata missing for role: ${role}`);
        assert.equal(meta.role, role);
        assert.equal(meta.portalTitle, 'Axis LinkUp');
        assert.ok(meta.portalSubtitle.length > 0);
        assert.ok(meta.badgeLabel.length > 0);
        assert.ok(meta.defaultDashboard.startsWith('/'));
      }
    });

    it('maps default dashboards to implemented routes', () => {
      for (const role of ROLES) {
        const meta = ROLE_PORTAL_METADATA[role];
        assert.ok(
          IMPLEMENTED_ROUTES.has(meta.defaultDashboard),
          `Default dashboard ${meta.defaultDashboard} for ${role} must be an implemented route`
        );
      }
    });
  });

  describe('2. Navigation Item Security & Approved Routes', () => {
    it('ensures all active (non-disabled) navigation items point to implemented routes', () => {
      const activeItems = MASTER_NAVIGATION_ITEMS.filter((item) => !item.disabled);
      assert.ok(activeItems.length > 0, 'There must be active navigation items');

      for (const item of activeItems) {
        assert.ok(
          IMPLEMENTED_ROUTES.has(item.href),
          `Active navigation item "${item.title}" (${item.href}) must point to an implemented route`
        );
      }
    });

    it('ensures all unimplemented modules are explicitly marked disabled with Phase 5 badge', () => {
      const disabledItems = MASTER_NAVIGATION_ITEMS.filter((item) => item.disabled);
      assert.ok(disabledItems.length > 0, 'There must be registered upcoming modules');

      for (const item of disabledItems) {
        assert.equal(item.disabled, true);
        assert.equal(item.badge, 'Phase 5');
        assert.ok(item.description && item.description.length > 0);
      }
    });
  });

  describe('3. Role-Based Navigation Filtering', () => {
    it('strictly isolates student navigation from administrative and faculty modules', () => {
      const studentNav = getNavigationForRole('student');

      // Student must have access to student dashboard
      assert.ok(studentNav.primary.some((item) => item.href === '/student/dashboard'));
      // Student must NOT have access to faculty or admin dashboards
      assert.ok(!studentNav.primary.some((item) => item.href === '/faculty/dashboard'));
      assert.ok(!studentNav.primary.some((item) => item.href === '/admin/dashboard'));
      assert.ok(!studentNav.primary.some((item) => item.href === '/super-admin/dashboard'));

      // Modules check
      assert.ok(studentNav.modules.every((item) => item.roles.includes('student')));
      assert.ok(!studentNav.modules.some((item) => item.id.startsWith('super-admin')));
    });

    it('strictly isolates faculty navigation from student-specific and administrative modules', () => {
      const facultyNav = getNavigationForRole('faculty');

      // Faculty must have access to faculty dashboard
      assert.ok(facultyNav.primary.some((item) => item.href === '/faculty/dashboard'));
      // Faculty must NOT have access to student or admin dashboards
      assert.ok(!facultyNav.primary.some((item) => item.href === '/student/dashboard'));
      assert.ok(!facultyNav.primary.some((item) => item.href === '/admin/dashboard'));
      assert.ok(!facultyNav.primary.some((item) => item.href === '/super-admin/dashboard'));

      // Modules check
      assert.ok(facultyNav.modules.every((item) => item.roles.includes('faculty')));
    });

    it('strictly isolates administrator navigation to administrative domains', () => {
      const adminNav = getNavigationForRole('admin');

      // Admin must have access to admin dashboard
      assert.ok(adminNav.primary.some((item) => item.href === '/admin/dashboard'));
      // Admin must NOT have access to student or faculty dashboards
      assert.ok(!adminNav.primary.some((item) => item.href === '/student/dashboard'));
      assert.ok(!adminNav.primary.some((item) => item.href === '/faculty/dashboard'));
      // Admin must NOT have access to super admin executive console
      assert.ok(!adminNav.primary.some((item) => item.href === '/super-admin/dashboard'));

      // Modules check
      assert.ok(adminNav.modules.every((item) => item.roles.includes('admin')));
      assert.ok(!adminNav.modules.some((item) => item.id === 'super-admin-emergency'));
    });

    it('grants super admin governance across executive console and supervision', () => {
      const superAdminNav = getNavigationForRole('super_admin');

      // Super admin has executive console
      assert.ok(superAdminNav.primary.some((item) => item.href === '/super-admin/dashboard'));
      // Super admin has governance modules
      assert.ok(superAdminNav.modules.some((item) => item.id === 'super-admin-audit'));
      assert.ok(superAdminNav.modules.some((item) => item.id === 'super-admin-emergency'));
    });

    it('guarantees shared profile access across all collegiate personas', () => {
      for (const role of ROLES) {
        const nav = getNavigationForRole(role);
        assert.ok(
          nav.account.some((item) => item.href === '/shared/profile'),
          `Role ${role} must have access to /shared/profile in account category`
        );
      }
    });
  });

  describe('4. RBAC Permission Consistency', () => {
    it('verifies every item with a permission is permitted in the RBAC matrix', () => {
      for (const item of MASTER_NAVIGATION_ITEMS) {
        if (!item.permission) continue;

        for (const role of item.roles) {
          const roleMapping = ROLE_PERMISSIONS_MATRIX[role];
          assert.ok(roleMapping, `No matrix mapping for role: ${role}`);
          const scope = roleMapping[item.permission];
          assert.notEqual(
            scope,
            'DENY',
            `Navigation item "${item.title}" with permission "${item.permission}" is DENIED for role "${role}" in RBAC matrix`
          );
        }
      }
    });
  });

  describe('5. Breadcrumb Generation', () => {
    it('generates accurate breadcrumbs for student dashboard', () => {
      const crumbs = getBreadcrumbsForPath('/student/dashboard', 'student');
      assert.equal(crumbs.length, 2);
      assert.equal(crumbs[0]?.label, 'Student Portal');
      assert.equal(crumbs[0]?.href, '/student/dashboard');
      assert.equal(crumbs[1]?.label, 'Dashboard');
    });

    it('generates accurate breadcrumbs for shared profile', () => {
      const crumbs = getBreadcrumbsForPath('/shared/profile', 'faculty');
      assert.equal(crumbs.length, 2);
      assert.equal(crumbs[0]?.label, 'Faculty Cockpit');
      assert.equal(crumbs[1]?.label, 'Profile & Settings');
    });

    it('handles nested future paths gracefully', () => {
      const crumbs = getBreadcrumbsForPath('/student/notices', 'student');
      assert.equal(crumbs.length, 2);
      assert.equal(crumbs[0]?.label, 'Student Portal');
      assert.equal(crumbs[1]?.label, 'Campus Notices');
    });
  });
});
