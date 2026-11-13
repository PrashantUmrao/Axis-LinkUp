/**
 * Client-Side Authorization Utilities for UI Rendering.
 * Used exclusively for conditionally displaying/hiding navigation elements,
 * action buttons, and operational cards to improve collegiate UX.
 *
 * NOTE: Frontend hiding does NOT replace server-side security. All operations
 * must independently invoke requireAuth() and requirePermission() on the server.
 */

import { ROLE_PERMISSIONS_MATRIX, ROLE_HIERARCHY, type Permission } from './permissions';
import type { UserRole } from '@/types/user';

/**
 * Checks whether a given role holds baseline UI permission for a capability.
 * Returns true if the matrix allows or conditionally scopes ('ALLOW', 'OWN', 'DEPT').
 * Returns false if 'DENY'.
 */
export function hasClientPermission(role: UserRole, permission: Permission): boolean {
  const roleMapping = ROLE_PERMISSIONS_MATRIX[role];
  if (!roleMapping) return false;
  const scope = roleMapping[permission];
  return scope !== 'DENY';
}

/**
 * Evaluates whether a navigation item should be rendered for the current role.
 */
export function canViewNavItem(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (!userRole || !Array.isArray(allowedRoles)) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Evaluates whether a user's role meets a minimum hierarchy threshold.
 */
export function isRoleAtLeastClient(userRole: UserRole, minimumRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const minLevel = ROLE_HIERARCHY[minimumRole] ?? 999;
  return userLevel >= minLevel;
}

/**
 * Returns authorized top-level navigation routes for a collegiate persona.
 */
export function getAuthorizedNavRoutes(role: UserRole): Array<{ label: string; href: string }> {
  switch (role) {
    case 'super_admin':
      return [
        { label: 'System Overview', href: '/super-admin/dashboard' },
        { label: 'Role Governance', href: '/super-admin/roles' },
        { label: 'Audit Logs', href: '/super-admin/audit' },
        { label: 'Emergency Console', href: '/super-admin/emergency' },
      ];
    case 'admin':
      return [
        { label: 'Department Console', href: '/admin/dashboard' },
        { label: 'Notice Board', href: '/admin/notices' },
        { label: 'Service Queues', href: '/admin/requests' },
        { label: 'Facility Bookings', href: '/admin/spaces' },
      ];
    case 'faculty':
      return [
        { label: 'Faculty Dashboard', href: '/faculty/dashboard' },
        { label: 'Course Notices', href: '/faculty/notices' },
        { label: 'Grading & Submissions', href: '/faculty/assignments' },
        { label: 'Course Polls', href: '/faculty/polls' },
      ];
    case 'student':
    default:
      return [
        { label: 'Student Dashboard', href: '/student/dashboard' },
        { label: 'Assignments', href: '/student/assignments' },
        { label: 'Academic Calendar', href: '/student/calendar' },
        { label: 'Skill Passport', href: '/student/passport' },
      ];
  }
}
