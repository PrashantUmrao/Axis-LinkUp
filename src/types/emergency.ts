/**
 * Domain Type Definitions for Campus Emergency Mode & Master Broadcast Console (MOD-16 / Phase 5.11).
 * Shared across Mongoose Models, Zod Validations, Repositories, Services, APIs, and UI.
 */

import type { Document, Types } from 'mongoose';

export const EMERGENCY_SEVERITIES = ['yellow', 'amber', 'red'] as const;
export type EmergencySeverity = (typeof EMERGENCY_SEVERITIES)[number];

export const EMERGENCY_CATEGORIES = [
  'weather',
  'security',
  'medical',
  'evacuation',
  'infrastructure',
  'other',
] as const;
export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];

export const EMERGENCY_SCOPES = ['all_campus', 'specific_departments'] as const;
export type EmergencyAffectedScope = (typeof EMERGENCY_SCOPES)[number];

export const EMERGENCY_CONFIRMATION_PHRASE = 'CONFIRM EMERGENCY' as const;

/**
 * Embedded immutable snapshot of the Super Admin triggering or deactivating an emergency alert.
 */
export interface IEmergencyActorSnapshot {
  fullName: string;
  email: string;
  role: string;
}

/**
 * Mongoose Document interface for a Campus Emergency Alert.
 */
export interface IEmergencyAlert extends Document {
  _id: Types.ObjectId;
  alertCode: string;
  title: string;
  message: string;
  severity: EmergencySeverity;
  category: EmergencyCategory;
  instructions: string[];
  affectedScope: EmergencyAffectedScope;
  targetDepartments: string[];
  isActive: boolean;
  triggeredBy: Types.ObjectId;
  triggeredBySnapshot: IEmergencyActorSnapshot;
  triggeredAt: Date;
  deactivatedBy?: Types.ObjectId | null;
  deactivatedBySnapshot?: IEmergencyActorSnapshot | null;
  deactivatedAt?: Date | null;
  deactivationNotes?: string | null;
  acknowledgmentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client-safe Emergency Alert Data Transfer Object.
 */
export interface EmergencyAlertDTO {
  id: string;
  alertCode: string;
  title: string;
  message: string;
  severity: EmergencySeverity;
  category: EmergencyCategory;
  instructions: string[];
  affectedScope: EmergencyAffectedScope;
  targetDepartments: string[];
  isActive: boolean;
  triggeredBy: string;
  triggeredBySnapshot: IEmergencyActorSnapshot;
  triggeredAt: string;
  deactivatedBy: string | null;
  deactivatedBySnapshot: IEmergencyActorSnapshot | null;
  deactivatedAt: string | null;
  deactivationNotes: string | null;
  acknowledgmentCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Embedded immutable snapshot of a user acknowledging an active emergency directive.
 */
export interface IEmergencyAckUserSnapshot {
  fullName: string;
  email: string;
  role: string;
  department?: string | null;
}

/**
 * Mongoose Document interface for a per-user Emergency Acknowledgment Receipt.
 */
export interface IEmergencyAcknowledgment extends Document {
  _id: Types.ObjectId;
  alertId: Types.ObjectId;
  userId: Types.ObjectId;
  userSnapshot: IEmergencyAckUserSnapshot;
  acknowledgedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Client-safe Emergency Acknowledgment Data Transfer Object.
 */
export interface EmergencyAcknowledgmentDTO {
  id: string;
  alertId: string;
  userId: string;
  userSnapshot: IEmergencyAckUserSnapshot;
  acknowledgedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Response envelope for GET /api/v1/emergency/active.
 */
export interface ActiveEmergencyResponseDTO {
  activeAlert: EmergencyAlertDTO | null;
  hasAcknowledged: boolean;
  acknowledgedAt: string | null;
}

/**
 * Response envelope for POST /api/v1/emergency/[id]/acknowledge.
 */
export interface EmergencyAckResultDTO {
  acknowledgment: EmergencyAcknowledgmentDTO;
  alreadyAcknowledged: boolean;
  acknowledgmentCount: number;
}

/**
 * Role-based acknowledgment coverage breakdown for emergency monitoring.
 */
export interface EmergencyRoleBreakdownDTO {
  student: number;
  faculty: number;
  admin: number;
  super_admin: number;
  totalAcknowledged: number;
  totalActiveUsers: number;
  coveragePercent: number;
}

/**
 * Summary statistics across emergency broadcast history.
 */
export interface EmergencyHistoryStatsDTO {
  totalAlerts: number;
  activeCount: number;
  redCount: number;
  amberCount: number;
  yellowCount: number;
}

/**
 * Paginated Emergency Broadcast History response.
 */
export interface PaginatedEmergencyHistoryDTO {
  alerts: EmergencyAlertDTO[];
  stats: EmergencyHistoryStatsDTO;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Paginated Acknowledgment Roster with role coverage metrics.
 */
export interface EmergencyAcknowledgmentsResponseDTO {
  alert: EmergencyAlertDTO;
  acknowledgments: EmergencyAcknowledgmentDTO[];
  breakdown: EmergencyRoleBreakdownDTO;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
