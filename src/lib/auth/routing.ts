/**
 * Collegiate Route & Persona Ingress Coordinator.
 * Centralized, authoritative role-to-dashboard mappings, portal compatibility validators,
 * and route-access boundary enforcement for Axis LinkUp.
 */

export type PortalDoor = 'student' | 'faculty' | 'admin';

/**
 * Maps a verified collegiate persona (role + optional admin sub-role) to their authorized dashboard route.
 * Strictly implements the approved institutional routing hierarchy:
 * - Student -> /student/dashboard
 * - Faculty -> /faculty/dashboard
 * - HOD (admin + hod sub-role) -> /admin/dashboard
 * - Director (super_admin + director sub-role) -> /admin/dashboard
 * - System Administrator (super_admin + sys_admin sub-role) -> /admin/dashboard
 */
export function getRoleDashboard(role?: string | null, _adminSubRole?: string | null): string {
  switch (role) {
    case 'super_admin':
      return '/admin/dashboard';

    case 'admin':
      return '/admin/dashboard';

    case 'faculty':
      return '/faculty/dashboard';

    case 'student':
      return '/student/dashboard';

    default:
      return '/student/dashboard';
  }
}

/**
 * Validates whether an authenticated user's role is compatible with the selected portal door.
 * Zero-trust server-side validation:
 * - Student Portal: strictly students (or super_admin for institutional oversight)
 * - Faculty Portal: strictly faculty (or super_admin for institutional oversight)
 * - Admin Portal: department HODs, Directorate leadership, and System Administrators
 */
export function isValidPortalForRole(
  portal: string,
  role: string,
  _adminSubRole?: string | null
): boolean {
  switch (portal) {
    case 'student':
      return role === 'student' || role === 'super_admin';

    case 'faculty':
      return role === 'faculty' || role === 'super_admin';

    case 'admin':
      return role === 'admin' || role === 'super_admin';

    default:
      return false;
  }
}

/**
 * Checks whether an authenticated role is authorized to access a given URL pathname.
 */
export function isAuthorizedRouteForRole(
  pathname: string,
  role: string,
  _adminSubRole?: string | null
): boolean {
  // Super admin has systemic access across the platform
  if (role === 'super_admin') {
    return true;
  }

  // Super Admin console is strictly super_admin only
  if (pathname.startsWith('/super-admin')) {
    return role === 'super_admin';
  }

  // Admin console is strictly admin or super_admin
  if (pathname.startsWith('/admin')) {
    return role === 'admin' || role === 'super_admin';
  }

  // Faculty workspace is strictly faculty or super_admin
  if (pathname.startsWith('/faculty')) {
    return role === 'faculty' || role === 'super_admin';
  }

  // Student workspace is strictly student or super_admin
  if (pathname.startsWith('/student')) {
    return role === 'student' || role === 'super_admin';
  }

  // Shared routes (e.g. /shared/profile) are open to all active authenticated users
  if (pathname.startsWith('/shared')) {
    return true;
  }

  return true;
}

/**
 * Sanitizes a redirect destination to prevent open-redirect vulnerabilities.
 * Strictly permits only relative paths starting with a single forward slash.
 */
export function sanitizeRedirectUrl(path?: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return '/';
  }
  return path;
}
