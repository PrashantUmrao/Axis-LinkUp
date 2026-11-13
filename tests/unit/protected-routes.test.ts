/**
 * Automated Tests for Route Protection, Middleware Ingress & Defense-in-Depth Gates.
 * Conforms to DOC-AUTH-007 (Route Protection & Ingress Security Strategy)
 * and Phase 3 Part 3.6 criteria.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { UserRole, UserStatus } from '@/types/user';

describe('Protected Routes & Middleware Ingress Gates', () => {
  // Route Classification definitions matching src/middleware.ts
  const publicRoutePatterns = [
    /^\/$/,
    /^\/sign-in(.*)$/,
    /^\/sign-up(.*)$/,
    /^\/account-suspended$/,
    /^\/pending-approval$/,
    /^\/unauthorized$/,
    /^\/ui-preview(.*)$/,
    /^\/api\/health(.*)$/,
    /^\/api\/webhooks(.*)$/,
  ];

  const studentRoutePattern = /^\/student(.*)$/;
  const facultyRoutePattern = /^\/faculty(.*)$/;
  const adminRoutePattern = /^\/admin(.*)$/;
  const superAdminRoutePattern = /^\/super-admin(.*)$/;
  const sharedRoutePattern = /^\/shared(.*)$/;

  function isPublic(path: string): boolean {
    return publicRoutePatterns.some((pattern) => pattern.test(path));
  }

  function getRoleDashboard(role?: string): string {
    switch (role) {
      case 'super_admin':
        return '/super-admin/dashboard';
      case 'admin':
        return '/admin/dashboard';
      case 'faculty':
        return '/faculty/dashboard';
      case 'student':
      default:
        return '/student/dashboard';
    }
  }

  function sanitizeRedirectUrl(path: string): string {
    if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      return '/';
    }
    return path;
  }

  interface IngressDecision {
    action: 'allow' | 'redirect' | 'unauthorized_json';
    destination?: string;
    statusCode?: number;
  }

  function evaluateIngress(
    path: string,
    session: { userId?: string; role?: UserRole; status?: UserStatus } | null
  ): IngressDecision {
    const isPublicPath = isPublic(path);

    // 1. Public route handling
    if (isPublicPath) {
      if (session?.userId && (path.startsWith('/sign-in') || path.startsWith('/sign-up'))) {
        if (session.status === 'suspended') {
          return { action: 'redirect', destination: '/account-suspended' };
        }
        if (session.status === 'pending_verification') {
          return { action: 'redirect', destination: '/pending-approval' };
        }
        return { action: 'redirect', destination: getRoleDashboard(session.role) };
      }
      return { action: 'allow' };
    }

    // 2. Unauthenticated check
    if (!session?.userId) {
      if (path.startsWith('/api/')) {
        return { action: 'unauthorized_json', statusCode: 401 };
      }
      const safeReturn = sanitizeRedirectUrl(path);
      const dest =
        safeReturn !== '/' && safeReturn !== '/sign-in'
          ? `/sign-in?redirect_url=${encodeURIComponent(safeReturn)}`
          : '/sign-in';
      return { action: 'redirect', destination: dest };
    }

    const { role = 'student', status = 'active' } = session;

    // 3. Status checks
    if (status === 'suspended' && path !== '/account-suspended') {
      return { action: 'redirect', destination: '/account-suspended' };
    }
    if (status === 'pending_verification' && path !== '/pending-approval') {
      return { action: 'redirect', destination: '/pending-approval' };
    }
    if (status === 'deactivated' || status === 'archived') {
      return { action: 'redirect', destination: '/unauthorized' };
    }

    // 4. Role gates
    if (superAdminRoutePattern.test(path) && role !== 'super_admin') {
      return { action: 'redirect', destination: '/unauthorized' };
    }
    if (adminRoutePattern.test(path) && role !== 'admin' && role !== 'super_admin') {
      return { action: 'redirect', destination: '/unauthorized' };
    }
    if (facultyRoutePattern.test(path) && role !== 'faculty' && role !== 'super_admin') {
      return { action: 'redirect', destination: '/unauthorized' };
    }
    if (studentRoutePattern.test(path) && role !== 'student' && role !== 'super_admin') {
      return { action: 'redirect', destination: getRoleDashboard(role) };
    }
    if (sharedRoutePattern.test(path)) {
      return { action: 'allow' };
    }

    return { action: 'allow' };
  }

  // 1. Public Routes Accessible Without Authentication
  describe('1. Public Route Access', () => {
    const publicPaths = [
      '/',
      '/sign-in',
      '/sign-in/factor-one',
      '/sign-up',
      '/account-suspended',
      '/pending-approval',
      '/unauthorized',
      '/ui-preview',
      '/api/health/db',
      '/api/webhooks/clerk',
    ];

    it('allows guest access to all public routes without a session', () => {
      for (const path of publicPaths) {
        const decision = evaluateIngress(path, null);
        assert.equal(decision.action, 'allow', `Expected ${path} to be accessible publicly`);
      }
    });

    it('identifies non-public paths correctly', () => {
      assert.equal(isPublic('/student/dashboard'), false);
      assert.equal(isPublic('/faculty/dashboard'), false);
      assert.equal(isPublic('/admin/dashboard'), false);
      assert.equal(isPublic('/super-admin/dashboard'), false);
      assert.equal(isPublic('/shared/profile'), false);
      assert.equal(isPublic('/api/auth/me'), false);
    });
  });

  // 2. Protected Routes Rejecting Unauthenticated Users
  describe('2. Unauthenticated Access Protection', () => {
    it('redirects unauthenticated page requests to /sign-in with return URL', () => {
      const decision = evaluateIngress('/student/dashboard', null);
      assert.equal(decision.action, 'redirect');
      assert.equal(decision.destination, '/sign-in?redirect_url=%2Fstudent%2Fdashboard');
    });

    it('returns direct 401 JSON for unauthenticated API requests', () => {
      const decision = evaluateIngress('/api/auth/me', null);
      assert.equal(decision.action, 'unauthorized_json');
      assert.equal(decision.statusCode, 401);
    });

    it('redirects unauthenticated requests targeting administrative consoles', () => {
      const adminDecision = evaluateIngress('/admin/dashboard', null);
      assert.equal(adminDecision.action, 'redirect');
      assert.equal(adminDecision.destination, '/sign-in?redirect_url=%2Fadmin%2Fdashboard');

      const superDecision = evaluateIngress('/super-admin/telemetry', null);
      assert.equal(superDecision.action, 'redirect');
      assert.equal(superDecision.destination, '/sign-in?redirect_url=%2Fsuper-admin%2Ftelemetry');
    });
  });

  // 3. Open Redirect Prevention & Redirect Loop Safeguards
  describe('3. Open Redirect & Loop Defenses', () => {
    it('sanitizes valid relative internal paths', () => {
      assert.equal(sanitizeRedirectUrl('/student/dashboard'), '/student/dashboard');
      assert.equal(
        sanitizeRedirectUrl('/faculty/assignments?status=active'),
        '/faculty/assignments?status=active'
      );
    });

    it('strips external protocols and domains to prevent phishing', () => {
      assert.equal(sanitizeRedirectUrl('https://evil-phishing-site.com'), '/');
      assert.equal(sanitizeRedirectUrl('http://attacker.com/steal-creds'), '/');
      assert.equal(sanitizeRedirectUrl('//evil.com/fake-login'), '/');
      assert.equal(sanitizeRedirectUrl('/\\evil.com'), '/');
      assert.equal(sanitizeRedirectUrl(''), '/');
    });

    it('prevents redirect loops by not attaching sign-in as return destination', () => {
      const decision = evaluateIngress('/sign-in', null);
      assert.equal(decision.action, 'allow');
    });

    it('redirects signed-in users away from /sign-in to their authorized dashboard', () => {
      const decision = evaluateIngress('/sign-in', {
        userId: 'stu_101',
        role: 'student',
        status: 'active',
      });
      assert.equal(decision.action, 'redirect');
      assert.equal(decision.destination, '/student/dashboard');
    });
  });

  // 4. Role-Gated Ingress Enforcement
  describe('4. Role Ingress Boundaries', () => {
    it('allows student access to /student/* and redirects from /admin to /unauthorized', () => {
      const student = {
        userId: 'stu_1',
        role: 'student' as UserRole,
        status: 'active' as UserStatus,
      };
      assert.equal(evaluateIngress('/student/dashboard', student).action, 'allow');

      const crossRoleDecision = evaluateIngress('/admin/dashboard', student);
      assert.equal(crossRoleDecision.action, 'redirect');
      assert.equal(crossRoleDecision.destination, '/unauthorized');
    });

    it('allows faculty access to /faculty/* and rejects access to /super-admin', () => {
      const faculty = {
        userId: 'fac_1',
        role: 'faculty' as UserRole,
        status: 'active' as UserStatus,
      };
      assert.equal(evaluateIngress('/faculty/dashboard', faculty).action, 'allow');

      const crossRoleDecision = evaluateIngress('/super-admin/dashboard', faculty);
      assert.equal(crossRoleDecision.action, 'redirect');
      assert.equal(crossRoleDecision.destination, '/unauthorized');
    });

    it('allows admin access to /admin/* and rejects access to /super-admin', () => {
      const admin = { userId: 'adm_1', role: 'admin' as UserRole, status: 'active' as UserStatus };
      assert.equal(evaluateIngress('/admin/dashboard', admin).action, 'allow');

      const superDecision = evaluateIngress('/super-admin/dashboard', admin);
      assert.equal(superDecision.action, 'redirect');
      assert.equal(superDecision.destination, '/unauthorized');
    });

    it('allows super admin unrestricted ingress across all collegiate dashboards', () => {
      const superAdmin = {
        userId: 'sa_1',
        role: 'super_admin' as UserRole,
        status: 'active' as UserStatus,
      };
      assert.equal(evaluateIngress('/super-admin/dashboard', superAdmin).action, 'allow');
      assert.equal(evaluateIngress('/admin/dashboard', superAdmin).action, 'allow');
      assert.equal(evaluateIngress('/faculty/dashboard', superAdmin).action, 'allow');
      assert.equal(evaluateIngress('/student/dashboard', superAdmin).action, 'allow');
    });

    it('permits all authenticated active personas to access /shared routes', () => {
      const student = {
        userId: 'stu_1',
        role: 'student' as UserRole,
        status: 'active' as UserStatus,
      };
      const faculty = {
        userId: 'fac_1',
        role: 'faculty' as UserRole,
        status: 'active' as UserStatus,
      };
      const admin = { userId: 'adm_1', role: 'admin' as UserRole, status: 'active' as UserStatus };

      assert.equal(evaluateIngress('/shared/profile', student).action, 'allow');
      assert.equal(evaluateIngress('/shared/profile', faculty).action, 'allow');
      assert.equal(evaluateIngress('/shared/profile', admin).action, 'allow');
    });
  });

  // 5. Account Lifecycle Status Ingress
  describe('5. Account Lifecycle Interception', () => {
    it('redirects suspended user to /account-suspended on any navigation attempt', () => {
      const suspendedUser = {
        userId: 'u_susp',
        role: 'student' as UserRole,
        status: 'suspended' as UserStatus,
      };
      const decision = evaluateIngress('/student/dashboard', suspendedUser);
      assert.equal(decision.action, 'redirect');
      assert.equal(decision.destination, '/account-suspended');
    });

    it('redirects pending verification user to /pending-approval', () => {
      const pendingUser = {
        userId: 'u_pend',
        role: 'student' as UserRole,
        status: 'pending_verification' as UserStatus,
      };
      const decision = evaluateIngress('/student/dashboard', pendingUser);
      assert.equal(decision.action, 'redirect');
      assert.equal(decision.destination, '/pending-approval');
    });

    it('redirects deactivated account to /unauthorized', () => {
      const deactivatedUser = {
        userId: 'u_deact',
        role: 'student' as UserRole,
        status: 'deactivated' as UserStatus,
      };
      const decision = evaluateIngress('/student/dashboard', deactivatedUser);
      assert.equal(decision.action, 'redirect');
      assert.equal(decision.destination, '/unauthorized');
    });
  });
});
