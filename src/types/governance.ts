/**
 * Domain Type Definitions for Immutable Security Audit Logs (MOD-19) & IAM Governance Console.
 * Conforms to DOC-AUTH-005 (RBAC Matrix) and Tier-1 Institutional Governance standards.
 */

import type { Document, Types } from 'mongoose';
import type { UserRole, UserStatus, AdminSubRole, UserDTO } from './user';
import type { PermissionScope } from '@/lib/auth/permissions';

export const AUDIT_MODULES = [
  'IAM',
  'AUTH',
  'REQUESTS',
  'FACILITIES',
  'ASSIGNMENTS',
  'COMPLAINTS',
  'NOTICES',
  'POLLS',
  'CHAT',
  'EMERGENCY',
  'SYSTEM',
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];

export const AUDIT_SEVERITIES = ['info', 'warning', 'high', 'critical'] as const;

export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_ACTIONS = [
  'ROLE_CHANGED',
  'ADMIN_SUBROLE_CHANGED',
  'ACCOUNT_STATUS_CHANGED',
  'DEPARTMENT_ASSIGNED',
  'USER_PROVISIONED',
  'REQUEST_PROCESSED',
  'FACILITY_REVIEWED',
  'EMERGENCY_TRIGGERED',
  'EMERGENCY_DEACTIVATED',
  'AUTH_LOGIN_FAILED',
  'SECURITY_POLICY_EVENT',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Embedded immutable snapshot of the actor who performed the audited action.
 */
export interface IAuditActorSnapshot {
  fullName: string;
  email: string;
  role: string;
  department?: string | null;
}

/**
 * Mongoose Document interface for an append-only, hash-chained Security Audit Log entry.
 */
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  eventId: string;
  actorId: Types.ObjectId;
  actorSnapshot: IAuditActorSnapshot;
  action: AuditAction | string;
  module: AuditModule;
  severity: AuditSeverity;
  targetEntityType: string;
  targetEntityId: string;
  targetLabel?: string | null;
  department?: string | null;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  previousHash: string;
  entryHash: string;
  createdAt: Date;
}

/**
 * Client-safe Security Audit Log Data Transfer Object.
 */
export interface AuditLogDTO {
  id: string;
  eventId: string;
  actorId: string;
  actorSnapshot: IAuditActorSnapshot;
  action: string;
  module: AuditModule;
  severity: AuditSeverity;
  targetEntityType: string;
  targetEntityId: string;
  targetLabel: string | null;
  department: string | null;
  oldState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  previousHash: string;
  entryHash: string;
  createdAt: string;
}

/**
 * Canonical payload hashed with SHA-256 to guarantee tamper-evidence.
 */
export interface AuditHashPayload {
  eventId: string;
  actorId: string;
  action: string;
  module: string;
  targetEntityId: string;
  oldState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  previousHash: string;
  createdAt: string;
}

/**
 * Request metadata captured alongside audited mutations.
 */
export interface AuditRequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Result of cryptographic SHA-256 hash-chain verification.
 */
export interface AuditChainVerificationDTO {
  valid: boolean;
  checkedCount: number;
  brokenAtEventId?: string;
  verifiedAt: string;
}

/**
 * Summary statistics for the Security Audit Logs Console.
 */
export interface AuditStatsDTO {
  totalLogs: number;
  highCriticalLast24h: number;
  byModule: Record<string, number>;
  bySeverity: Record<AuditSeverity, number>;
  latestEventId: string | null;
  latestEntryHash: string | null;
}

/**
 * Paginated Security Audit Log response payload.
 */
export interface PaginatedAuditLogsDTO {
  logs: AuditLogDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Governed User DTO enriched with resolved department name for IAM Console display.
 */
export interface GovernedUserDTO extends UserDTO {
  departmentName?: string | null;
  departmentCode?: string | null;
}

/**
 * Paginated IAM User Directory payload.
 */
export interface PaginatedGovernedUsersDTO {
  users: GovernedUserDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Role and Account Status Distribution KPI counts.
 */
export interface IamRoleDistributionStatsDTO {
  totalUsers: number;
  byRole: Record<UserRole, number>;
  byStatus: {
    active: number;
    suspended: number;
    pending_verification: number;
    deactivated: number;
    other: number;
  };
}

/**
 * Single row in the live RBAC Permission Matrix view.
 */
export interface PermissionMatrixRowDTO {
  permission: string;
  module: string;
  scopes: Record<UserRole, PermissionScope>;
}

/**
 * Complete canonical RBAC Permission Matrix derived from permissions.ts.
 */
export interface PermissionMatrixDTO {
  roles: UserRole[];
  rows: PermissionMatrixRowDTO[];
  totalPermissions: number;
}

/**
 * Result returned by IAM role/status governance mutations.
 */
export interface IamMutationResultDTO {
  user: GovernedUserDTO;
  auditEvent: AuditLogDTO;
}

export type IamGovernableStatus = Extract<UserStatus, 'active' | 'suspended' | 'deactivated'>;
export type IamSubRoleOption = AdminSubRole | null;
