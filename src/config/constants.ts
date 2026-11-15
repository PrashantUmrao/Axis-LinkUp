/**
 * Shared Application Constants for Axis LinkUp.
 * Genuinely shared, cross-cutting values across server and client layers.
 */

import type { UserRole } from '@/types/common';

/**
 * Standard HTTP Status Codes.
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

/**
 * Standard Pagination Defaults and Limits.
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MIN_PAGE_SIZE: 1,
  MAX_PAGE_SIZE: 100,
  DEFAULT_CURSOR_LIMIT: 25,
  MAX_CURSOR_LIMIT: 100,
  DEFAULT_SORT_ORDER: 'desc' as const,
  DEFAULT_SORT_BY: 'createdAt',
} as const;

/**
 * Time intervals expressed in milliseconds.
 */
export const TIME_MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * File upload limits and approved MIME types.
 */
export const FILE_UPLOAD = {
  MAX_DOCUMENT_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_AVATAR_SIZE_BYTES: 2 * 1024 * 1024, // 2 MB
  ALLOWED_IMAGE_MIMES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  ALLOWED_DOCUMENT_MIMES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ] as const,
} as const;

/**
 * Approved User Roles in Axis LinkUp.
 */
export const USER_ROLES: readonly UserRole[] = [
  'student',
  'faculty',
  'admin',
  'super_admin',
] as const;

/**
 * Approved Administrative Sub-Roles in Axis LinkUp (Phase 4.8.2 / Phase 5).
 */
export const ADMIN_SUB_ROLES = ['sys_admin', 'hod', 'director'] as const;
export type AdminSubRole = (typeof ADMIN_SUB_ROLES)[number];

/**
 * Standardized Faculty Designations in Axis LinkUp (Phase 5.3.2).
 */
export const FACULTY_DESIGNATIONS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Lab Instructor',
  'Visiting Faculty',
] as const;
export type FacultyDesignation = (typeof FACULTY_DESIGNATIONS)[number];

/**
 * Standard Institutional Department Codes (Axis Institute).
 */
export const DEPARTMENT_CODES = [
  'CSE', // Computer Science & Engineering
  'ECE', // Electronics & Communication Engineering
  'ME', // Mechanical Engineering
  'CE', // Civil Engineering
  'EE', // Electrical Engineering
  'IT', // Information Technology
  'ASH', // Applied Sciences & Humanities
] as const;

export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];
