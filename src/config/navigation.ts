/**
 * Centralized Navigation Configuration for Axis LinkUp.
 * Defines authorized navigation hierarchies, routes, icons, and permissions
 * for all collegiate personas (Student, Faculty, Administrator, Super Administrator).
 *
 * Conforms to DOC-AUTH-005 (RBAC Permission Matrix) and Phase 4 UI Architecture.
 */

import { PERMISSIONS, type Permission } from '@/lib/auth/permissions';
import type { UserRole } from '@/types/user';

export interface NavItem {
  id: string;
  title: string;
  href: string;
  iconName: string;
  roles: UserRole[];
  permission?: Permission;
  badge?: string;
  disabled?: boolean;
  category: 'primary' | 'modules' | 'account';
  description?: string;
}

export interface RolePortalMetadata {
  role: UserRole;
  portalTitle: string;
  portalSubtitle: string;
  badgeLabel: string;
  defaultDashboard: string;
  badgeVariant: 'success' | 'info' | 'warning' | 'destructive' | 'outline' | 'glass';
}

/**
 * Institutional Portal Metadata mapped by role.
 */
export const ROLE_PORTAL_METADATA: Record<UserRole, RolePortalMetadata> = {
  student: {
    role: 'student',
    portalTitle: 'Axis LinkUp',
    portalSubtitle: 'Student Portal',
    badgeLabel: 'Student',
    defaultDashboard: '/student/dashboard',
    badgeVariant: 'info',
  },
  faculty: {
    role: 'faculty',
    portalTitle: 'Axis LinkUp',
    portalSubtitle: 'Faculty Cockpit',
    badgeLabel: 'Faculty',
    defaultDashboard: '/faculty/dashboard',
    badgeVariant: 'success',
  },
  admin: {
    role: 'admin',
    portalTitle: 'Axis LinkUp',
    portalSubtitle: 'Department Console',
    badgeLabel: 'Administrator',
    defaultDashboard: '/admin/dashboard',
    badgeVariant: 'warning',
  },
  super_admin: {
    role: 'super_admin',
    portalTitle: 'Axis LinkUp',
    portalSubtitle: 'Central Executive Console',
    badgeLabel: 'Super Admin',
    defaultDashboard: '/super-admin/dashboard',
    badgeVariant: 'destructive',
  },
};

/**
 * Master Registry of all Navigation Items.
 * Only implemented features are marked active; planned feature modules
 * are configured with `disabled: true` and `badge: "Phase 5"` to avoid broken 404 links.
 */
export const MASTER_NAVIGATION_ITEMS: NavItem[] = [
  // ==================== PRIMARY WORKSPACES (LIVE) ====================
  {
    id: 'student-dashboard',
    title: 'Dashboard',
    href: '/student/dashboard',
    iconName: 'LayoutDashboard',
    roles: ['student'],
    permission: PERMISSIONS.STUDENT_DASH_VIEW,
    category: 'primary',
    description: 'Personalized student academic workspace and collegiate notices.',
  },
  {
    id: 'faculty-dashboard',
    title: 'Dashboard',
    href: '/faculty/dashboard',
    iconName: 'LayoutDashboard',
    roles: ['faculty'],
    permission: PERMISSIONS.FACULTY_DASH_VIEW,
    category: 'primary',
    description: 'Faculty classroom management, grading and course notices.',
  },
  {
    id: 'admin-dashboard',
    title: 'Dashboard',
    href: '/admin/dashboard',
    iconName: 'LayoutDashboard',
    roles: ['admin', 'super_admin'],
    permission: PERMISSIONS.ADMIN_DASH_VIEW,
    category: 'primary',
    description: 'Departmental administration and approval workflows.',
  },
  {
    id: 'super-admin-dashboard',
    title: 'Executive Console',
    href: '/super-admin/dashboard',
    iconName: 'ShieldAlert',
    roles: ['super_admin'],
    permission: PERMISSIONS.SUPER_ADMIN_VIEW_TELEMETRY,
    category: 'primary',
    description: 'Institution-wide system telemetry, security audit and governance.',
  },

  // ==================== STUDENT MODULES ====================
  {
    id: 'student-notices',
    title: 'Campus Notices',
    href: '/student/notices',
    iconName: 'Bell',
    roles: ['student'],
    permission: PERMISSIONS.NOTICES_READ,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Official collegiate bulletins and department circulars.',
  },
  {
    id: 'student-assignments',
    title: 'Assignments',
    href: '/student/assignments',
    iconName: 'FileCheck',
    roles: ['student'],
    permission: PERMISSIONS.ASSIGNMENTS_SUBMIT,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Coursework submission portal and grading tracking.',
  },
  {
    id: 'student-calendar',
    title: 'Academic Calendar',
    href: '/student/calendar',
    iconName: 'Calendar',
    roles: ['student'],
    permission: PERMISSIONS.CALENDAR_VIEW,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Semester lecture timetable and exam schedules.',
  },
  {
    id: 'student-passport',
    title: 'Skill Passport',
    href: '/student/passport',
    iconName: 'Award',
    roles: ['student'],
    permission: PERMISSIONS.PASSPORT_SUBMIT_PROOF,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Verified academic credentials and co-curricular achievements.',
  },

  // ==================== FACULTY MODULES ====================
  {
    id: 'faculty-notices',
    title: 'Course Notices',
    href: '/faculty/notices',
    iconName: 'Megaphone',
    roles: ['faculty'],
    permission: PERMISSIONS.NOTICES_PUBLISH_COURSE,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Broadcast course-specific announcements to enrolled batches.',
  },
  {
    id: 'faculty-grading',
    title: 'Grading & Submissions',
    href: '/faculty/assignments',
    iconName: 'ClipboardCheck',
    roles: ['faculty'],
    permission: PERMISSIONS.ASSIGNMENTS_CREATE_GRADE,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Evaluate student submissions and publish grading rubrics.',
  },
  {
    id: 'faculty-polls',
    title: 'Course Polls',
    href: '/faculty/polls',
    iconName: 'BarChart3',
    roles: ['faculty'],
    permission: PERMISSIONS.POLLS_CREATE_COURSE,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Instant student feedback and interactive classroom voting.',
  },

  // ==================== ADMINISTRATOR MODULES ====================
  {
    id: 'admin-notices',
    title: 'College Circulars',
    href: '/admin/notices',
    iconName: 'Megaphone',
    roles: ['admin', 'super_admin'],
    permission: PERMISSIONS.NOTICES_PUBLISH_COLLEGE,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Institution-wide official notices and emergency circulars.',
  },
  {
    id: 'admin-requests',
    title: 'Service Queues',
    href: '/admin/requests',
    iconName: 'Inbox',
    roles: ['admin', 'super_admin'],
    permission: PERMISSIONS.REQUESTS_APPROVE_REJECT,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Student leave applications, bonafide requests, and clearances.',
  },
  {
    id: 'admin-spaces',
    title: 'Facility Bookings',
    href: '/admin/spaces',
    iconName: 'Building2',
    roles: ['admin', 'super_admin'],
    permission: PERMISSIONS.SPACES_APPROVE,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Auditorium, laboratory, and seminar room reservations.',
  },

  // ==================== SUPER ADMIN MODULES ====================
  {
    id: 'super-admin-roles',
    title: 'IAM Governance',
    href: '/super-admin/roles',
    iconName: 'Users',
    roles: ['super_admin'],
    permission: PERMISSIONS.RBAC_MODIFY_ROLES,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Manage collegiate roles, permissions, and departmental assignments.',
  },
  {
    id: 'super-admin-audit',
    title: 'Security Audit Logs',
    href: '/super-admin/audit',
    iconName: 'FileText',
    roles: ['super_admin'],
    permission: PERMISSIONS.AUDIT_VIEW_LOGS,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Immutable authentication events and administrative action logs.',
  },
  {
    id: 'super-admin-emergency',
    title: 'Emergency Console',
    href: '/super-admin/emergency',
    iconName: 'AlertTriangle',
    roles: ['super_admin'],
    permission: PERMISSIONS.EMERGENCY_TRIGGER,
    badge: 'Phase 5',
    disabled: true,
    category: 'modules',
    description: 'Broadcast campus-wide high-priority alerts with SMS/Email failover.',
  },

  // ==================== SHARED ACCOUNT (LIVE) ====================
  {
    id: 'shared-profile',
    title: 'Profile & Settings',
    href: '/shared/profile',
    iconName: 'UserCircle',
    roles: ['student', 'faculty', 'admin', 'super_admin'],
    permission: PERMISSIONS.USERS_READ_OWN,
    category: 'account',
    description: 'Institutional identity, contact details, and account preferences.',
  },
];

/**
 * Returns the filtered list of navigation items for a verified user role.
 * Strictly respects role permissions and excludes items not granted to the role.
 */
export function getNavigationForRole(role: UserRole): {
  primary: NavItem[];
  modules: NavItem[];
  account: NavItem[];
} {
  const allowedItems = MASTER_NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));

  return {
    primary: allowedItems.filter((item) => item.category === 'primary'),
    modules: allowedItems.filter((item) => item.category === 'modules'),
    account: allowedItems.filter((item) => item.category === 'account'),
  };
}

/**
 * Resolves breadcrumb items based on current pathname and user role.
 */
export function getBreadcrumbsForPath(
  pathname: string,
  role: UserRole
): Array<{ label: string; href?: string }> {
  const meta = ROLE_PORTAL_METADATA[role] || ROLE_PORTAL_METADATA.student;
  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: meta.portalSubtitle, href: meta.defaultDashboard },
  ];

  if (pathname.includes('/dashboard')) {
    breadcrumbs.push({ label: 'Dashboard' });
  } else if (pathname.includes('/profile')) {
    breadcrumbs.push({ label: 'Profile & Settings' });
  } else if (pathname.includes('/notices')) {
    breadcrumbs.push({ label: 'Campus Notices' });
  } else if (pathname.includes('/assignments')) {
    breadcrumbs.push({ label: 'Assignments' });
  } else if (pathname.includes('/calendar')) {
    breadcrumbs.push({ label: 'Academic Calendar' });
  } else if (pathname.includes('/passport')) {
    breadcrumbs.push({ label: 'Skill Passport' });
  } else if (pathname.includes('/requests')) {
    breadcrumbs.push({ label: 'Service Queues' });
  } else if (pathname.includes('/spaces')) {
    breadcrumbs.push({ label: 'Facility Bookings' });
  } else if (pathname.includes('/roles')) {
    breadcrumbs.push({ label: 'IAM Governance' });
  } else if (pathname.includes('/audit')) {
    breadcrumbs.push({ label: 'Audit Logs' });
  } else if (pathname.includes('/emergency')) {
    breadcrumbs.push({ label: 'Emergency Console' });
  } else if (pathname.includes('/ui-preview')) {
    breadcrumbs.push({ label: 'UI Preview' });
  } else {
    // Dynamic fallback for any nested sub-path
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (
      last &&
      last !== 'student' &&
      last !== 'faculty' &&
      last !== 'admin' &&
      last !== 'super-admin'
    ) {
      breadcrumbs.push({
        label: last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' '),
      });
    }
  }

  return breadcrumbs;
}
