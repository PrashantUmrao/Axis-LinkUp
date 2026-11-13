/**
 * Master Role & Permission Definitions.
 * Single source of truth for Role-Based Access Control (RBAC).
 * Conforms to DOC-AUTH-005 (RBAC & Permission Matrix).
 */

import type { UserRole } from '@/types/user';

/**
 * Approved institutional user roles.
 */
export const ROLES = {
  STUDENT: 'student',
  FACULTY: 'faculty',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const satisfies Record<string, UserRole>;

/**
 * Role hierarchy levels for coarse-grained boundary checks.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  student: 1,
  faculty: 2,
  admin: 3,
  super_admin: 4,
};

/**
 * Canonical permissions across all 19 Axis LinkUp functional modules.
 */
export const PERMISSIONS = {
  // 01. Users
  USERS_READ_OWN: 'users:read_own',
  USERS_UPDATE_OWN: 'users:update_own',
  USERS_MANAGE: 'users:manage',
  USERS_MANAGE_ROLES: 'users:manage_roles',

  // 02. RBAC Management
  RBAC_MODIFY_ROLES: 'rbac:modify_roles',
  RBAC_MANAGE_PERMISSIONS: 'rbac:manage_permissions',

  // 03-06. Persona Dashboards
  STUDENT_DASH_VIEW: 'student_dash:view',
  FACULTY_DASH_VIEW: 'faculty_dash:view',
  ADMIN_DASH_VIEW: 'admin_dash:view',
  SUPER_ADMIN_VIEW_TELEMETRY: 'super_admin:view_telemetry',

  // 07. Notices
  NOTICES_READ: 'notices:read',
  NOTICES_PUBLISH_COURSE: 'notices:publish_course',
  NOTICES_PUBLISH_COLLEGE: 'notices:publish_college',
  NOTICES_BROADCAST_URGENT: 'notices:broadcast_urgent',

  // 08. Chat & Discussions
  CHAT_SEND_COURSE_MESSAGE: 'chat:send_course_message',
  CHAT_MODERATE_MESSAGES: 'chat:moderate_messages',

  // 09. Polls
  POLLS_CREATE_COURSE: 'polls:create_course',
  POLLS_VOTE: 'polls:vote',
  POLLS_VIEW_RESULTS: 'polls:view_results',

  // 10. Academic Calendar
  CALENDAR_VIEW: 'calendar:view',
  CALENDAR_EDIT: 'calendar:edit',

  // 11. Assignments
  ASSIGNMENTS_SUBMIT: 'assignments:submit',
  ASSIGNMENTS_CREATE_GRADE: 'assignments:create_grade',
  ASSIGNMENTS_VIEW_PEER_SUBMISSIONS: 'assignments:view_peer_submissions',

  // 12. Notes & Course Materials
  NOTES_UPLOAD: 'notes:upload',
  NOTES_DOWNLOAD: 'notes:download',

  // 13. Service Requests & Leave Tickets
  REQUESTS_SUBMIT: 'requests:submit',
  REQUESTS_APPROVE_REJECT: 'requests:approve_reject',

  // 14. Space & Facility Booking
  SPACES_BOOK: 'spaces:book',
  SPACES_APPROVE: 'spaces:approve',

  // 15. Skill Passport
  PASSPORT_SUBMIT_PROOF: 'passport:submit_proof',
  PASSPORT_VERIFY_CLAIM: 'passport:verify_claim',

  // 16. Campus Emergency Broadcasts
  EMERGENCY_TRIGGER: 'emergency:trigger',
  EMERGENCY_ACKNOWLEDGE: 'emergency:acknowledge',

  // 17. Broadcast Alerts
  ALERTS_DISPATCH: 'alerts:dispatch',

  // 18. Analytics & Reporting
  ANALYTICS_VIEW_REPORTS: 'analytics:view_reports',

  // 19. Audit Logs
  AUDIT_VIEW_LOGS: 'audit:view_logs',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Access scope returned by the RBAC matrix:
 * - ALLOW: Unrestricted access within user scope.
 * - OWN: Permitted strictly if user owns or is assigned to the target resource (ABAC).
 * - DEPT: Permitted within user's assigned department.
 * - DENY: Prohibited unconditionally.
 */
export type PermissionScope = 'ALLOW' | 'OWN' | 'DEPT' | 'DENY';

/**
 * Resource context passed to ABAC evaluation rules.
 */
export interface ResourceContext {
  ownerId?: string;
  departmentId?: string;
  instructorIds?: string[];
  isAssignedCourse?: boolean;
  mentorId?: string;
}

/**
 * Single Source of Truth: Role-to-Permission Mapping Matrix.
 * Directly translates DOC-AUTH-005. Default-Deny applies to any missing key.
 */
export const ROLE_PERMISSIONS_MATRIX: Record<UserRole, Record<Permission, PermissionScope>> = {
  student: {
    // 01. Users
    'users:read_own': 'ALLOW',
    'users:update_own': 'OWN',
    'users:manage': 'DENY',
    'users:manage_roles': 'DENY',

    // 02. RBAC
    'rbac:modify_roles': 'DENY',
    'rbac:manage_permissions': 'DENY',

    // 03-06. Dashboards
    'student_dash:view': 'ALLOW',
    'faculty_dash:view': 'DENY',
    'admin_dash:view': 'DENY',
    'super_admin:view_telemetry': 'DENY',

    // 07. Notices
    'notices:read': 'ALLOW',
    'notices:publish_course': 'DENY',
    'notices:publish_college': 'DENY',
    'notices:broadcast_urgent': 'DENY',

    // 08. Chat
    'chat:send_course_message': 'OWN',
    'chat:moderate_messages': 'DENY',

    // 09. Polls
    'polls:create_course': 'DENY',
    'polls:vote': 'OWN',
    'polls:view_results': 'ALLOW',

    // 10. Calendar
    'calendar:view': 'ALLOW',
    'calendar:edit': 'DENY',

    // 11. Assignments
    'assignments:submit': 'OWN',
    'assignments:create_grade': 'DENY',
    'assignments:view_peer_submissions': 'DENY',

    // 12. Notes
    'notes:upload': 'DENY',
    'notes:download': 'ALLOW',

    // 13. Requests
    'requests:submit': 'OWN',
    'requests:approve_reject': 'DENY',

    // 14. Spaces
    'spaces:book': 'DENY',
    'spaces:approve': 'DENY',

    // 15. Skill Passport
    'passport:submit_proof': 'OWN',
    'passport:verify_claim': 'DENY',

    // 16. Emergency
    'emergency:trigger': 'DENY',
    'emergency:acknowledge': 'ALLOW',

    // 17. Alerts
    'alerts:dispatch': 'DENY',

    // 18. Analytics
    'analytics:view_reports': 'DENY',

    // 19. Audit Logs
    'audit:view_logs': 'DENY',
  },

  faculty: {
    // 01. Users
    'users:read_own': 'ALLOW',
    'users:update_own': 'OWN',
    'users:manage': 'DENY',
    'users:manage_roles': 'DENY',

    // 02. RBAC
    'rbac:modify_roles': 'DENY',
    'rbac:manage_permissions': 'DENY',

    // 03-06. Dashboards
    'student_dash:view': 'DENY',
    'faculty_dash:view': 'ALLOW',
    'admin_dash:view': 'DENY',
    'super_admin:view_telemetry': 'DENY',

    // 07. Notices
    'notices:read': 'ALLOW',
    'notices:publish_course': 'OWN',
    'notices:publish_college': 'DENY',
    'notices:broadcast_urgent': 'DENY',

    // 08. Chat
    'chat:send_course_message': 'OWN',
    'chat:moderate_messages': 'OWN',

    // 09. Polls
    'polls:create_course': 'OWN',
    'polls:vote': 'OWN',
    'polls:view_results': 'ALLOW',

    // 10. Calendar
    'calendar:view': 'ALLOW',
    'calendar:edit': 'DENY',

    // 11. Assignments
    'assignments:submit': 'DENY',
    'assignments:create_grade': 'OWN',
    'assignments:view_peer_submissions': 'DENY',

    // 12. Notes
    'notes:upload': 'OWN',
    'notes:download': 'ALLOW',

    // 13. Requests
    'requests:submit': 'OWN',
    'requests:approve_reject': 'OWN',

    // 14. Spaces
    'spaces:book': 'OWN',
    'spaces:approve': 'DENY',

    // 15. Skill Passport
    'passport:submit_proof': 'DENY',
    'passport:verify_claim': 'OWN',

    // 16. Emergency
    'emergency:trigger': 'DENY',
    'emergency:acknowledge': 'ALLOW',

    // 17. Alerts
    'alerts:dispatch': 'OWN',

    // 18. Analytics
    'analytics:view_reports': 'OWN',

    // 19. Audit Logs
    'audit:view_logs': 'DENY',
  },

  admin: {
    // 01. Users
    'users:read_own': 'ALLOW',
    'users:update_own': 'OWN',
    'users:manage': 'DEPT',
    'users:manage_roles': 'DENY',

    // 02. RBAC
    'rbac:modify_roles': 'DENY',
    'rbac:manage_permissions': 'DENY',

    // 03-06. Dashboards
    'student_dash:view': 'DENY',
    'faculty_dash:view': 'DENY',
    'admin_dash:view': 'ALLOW',
    'super_admin:view_telemetry': 'DENY',

    // 07. Notices
    'notices:read': 'ALLOW',
    'notices:publish_course': 'DEPT',
    'notices:publish_college': 'DEPT',
    'notices:broadcast_urgent': 'DEPT',

    // 08. Chat
    'chat:send_course_message': 'DEPT',
    'chat:moderate_messages': 'DEPT',

    // 09. Polls
    'polls:create_course': 'DEPT',
    'polls:vote': 'ALLOW',
    'polls:view_results': 'ALLOW',

    // 10. Calendar
    'calendar:view': 'ALLOW',
    'calendar:edit': 'ALLOW',

    // 11. Assignments
    'assignments:submit': 'DENY',
    'assignments:create_grade': 'DEPT',
    'assignments:view_peer_submissions': 'DENY',

    // 12. Notes
    'notes:upload': 'DEPT',
    'notes:download': 'ALLOW',

    // 13. Requests
    'requests:submit': 'DENY',
    'requests:approve_reject': 'DEPT',

    // 14. Spaces
    'spaces:book': 'DEPT',
    'spaces:approve': 'DEPT',

    // 15. Skill Passport
    'passport:submit_proof': 'DENY',
    'passport:verify_claim': 'DEPT',

    // 16. Emergency
    'emergency:trigger': 'DENY',
    'emergency:acknowledge': 'ALLOW',

    // 17. Alerts
    'alerts:dispatch': 'DEPT',

    // 18. Analytics
    'analytics:view_reports': 'DEPT',

    // 19. Audit Logs
    'audit:view_logs': 'DEPT',
  },

  super_admin: {
    // 01. Users
    'users:read_own': 'ALLOW',
    'users:update_own': 'OWN',
    'users:manage': 'ALLOW',
    'users:manage_roles': 'ALLOW',

    // 02. RBAC
    'rbac:modify_roles': 'ALLOW',
    'rbac:manage_permissions': 'ALLOW',

    // 03-06. Dashboards
    'student_dash:view': 'DENY',
    'faculty_dash:view': 'DENY',
    'admin_dash:view': 'ALLOW',
    'super_admin:view_telemetry': 'ALLOW',

    // 07. Notices
    'notices:read': 'ALLOW',
    'notices:publish_course': 'ALLOW',
    'notices:publish_college': 'ALLOW',
    'notices:broadcast_urgent': 'ALLOW',

    // 08. Chat
    'chat:send_course_message': 'ALLOW',
    'chat:moderate_messages': 'ALLOW',

    // 09. Polls
    'polls:create_course': 'ALLOW',
    'polls:vote': 'ALLOW',
    'polls:view_results': 'ALLOW',

    // 10. Calendar
    'calendar:view': 'ALLOW',
    'calendar:edit': 'ALLOW',

    // 11. Assignments
    'assignments:submit': 'DENY',
    'assignments:create_grade': 'ALLOW',
    'assignments:view_peer_submissions': 'DENY',

    // 12. Notes
    'notes:upload': 'ALLOW',
    'notes:download': 'ALLOW',

    // 13. Requests
    'requests:submit': 'DENY',
    'requests:approve_reject': 'ALLOW',

    // 14. Spaces
    'spaces:book': 'ALLOW',
    'spaces:approve': 'ALLOW',

    // 15. Skill Passport
    'passport:submit_proof': 'DENY',
    'passport:verify_claim': 'ALLOW',

    // 16. Emergency
    'emergency:trigger': 'ALLOW',
    'emergency:acknowledge': 'ALLOW',

    // 17. Alerts
    'alerts:dispatch': 'ALLOW',

    // 18. Analytics
    'analytics:view_reports': 'ALLOW',

    // 19. Audit Logs
    'audit:view_logs': 'ALLOW',
  },
};
