/**
 * Campus Emergency Mode & Broadcast Service (MOD-16 / Phase 5.11).
 * Orchestrates fail-safe campus emergency triggers, dual-confirmation verification,
 * single-active-emergency enforcement, idempotent per-user acknowledgment receipts,
 * real-time Ably broadcasting, and mandatory critical AuditLog persistence.
 */

import { Types } from 'mongoose';
import { EmergencyAlertRepository } from '@/lib/db/repositories/emergency-alert.repository';
import { EmergencyAcknowledgmentRepository } from '@/lib/db/repositories/emergency-acknowledgment.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { toEmergencyAlertDTO } from '@/lib/db/models/emergency-alert.model';
import { toEmergencyAcknowledgmentDTO } from '@/lib/db/models/emergency-acknowledgment.model';
import { AuditService } from '@/lib/services/audit.service';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hasPermission } from '@/lib/auth/rbac';
import {
  triggerEmergencySchema,
  deactivateEmergencySchema,
  type EmergencyHistoryQueryParams,
  type AcknowledgmentQueryParams,
} from '@/lib/validations/emergency.schema';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/app-error';
import type { UserSession } from '@/types/user';
import type { AuditRequestMeta } from '@/types/governance';
import type {
  ActiveEmergencyResponseDTO,
  EmergencyAckResultDTO,
  EmergencyAcknowledgmentsResponseDTO,
  EmergencyAlertDTO,
  PaginatedEmergencyHistoryDTO,
} from '@/types/emergency';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class EmergencyService {
  /**
   * Triggers a new campus-wide or department-scoped emergency broadcast.
   * Strictly restricted to Super Administrators with dual-confirmation phrase verification
   * and single-active-emergency enforcement.
   */
  public static async triggerAlert(
    session: UserSession,
    rawInput: unknown,
    requestMeta: AuditRequestMeta = {}
  ): Promise<EmergencyAlertDTO> {
    if (!hasPermission(session.role, PERMISSIONS.EMERGENCY_TRIGGER)) {
      throw new ForbiddenError(
        'Access denied. Only Super Administrators may trigger campus emergency broadcasts.'
      );
    }

    const parsed = triggerEmergencySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError('Invalid emergency broadcast payload', parsed.error.flatten());
    }
    const data = parsed.data;

    // Single Active Emergency Invariant
    const existingActive = await EmergencyAlertRepository.findActiveAlert();
    if (existingActive) {
      throw new ConflictError(
        `An active campus emergency (${existingActive.alertCode}: "${existingActive.title}") is already in progress. Deactivate it before triggering a new alert.`,
        { activeAlertCode: existingActive.alertCode, activeAlertId: existingActive._id.toString() }
      );
    }

    const alertCode = await EmergencyAlertRepository.getNextAlertCode();
    const triggeredBySnapshot = {
      fullName: session.fullName || 'Super Administrator',
      email: session.email,
      role: session.role,
    };

    const created = await EmergencyAlertRepository.create({
      alertCode,
      title: data.title,
      message: data.message,
      severity: data.severity,
      category: data.category,
      instructions: data.instructions,
      affectedScope: data.affectedScope,
      targetDepartments:
        data.affectedScope === 'specific_departments' ? data.targetDepartments : [],
      isActive: true,
      triggeredBy: new Types.ObjectId(session.userId),
      triggeredBySnapshot,
      triggeredAt: new Date(),
      acknowledgmentCount: 0,
    });

    const dto = toEmergencyAlertDTO(created);

    // Mandatory Critical Audit Log Entry (Phase 5.10 integration)
    await AuditService.recordEvent({
      actorId: session.userId,
      actorSnapshot: {
        fullName: triggeredBySnapshot.fullName,
        email: triggeredBySnapshot.email,
        role: triggeredBySnapshot.role,
        department: null,
      },
      action: 'EMERGENCY_TRIGGERED',
      module: 'EMERGENCY',
      severity: 'critical',
      targetEntityType: 'EmergencyAlert',
      targetEntityId: dto.id,
      targetLabel: `${dto.alertCode} — ${dto.title}`,
      department:
        dto.affectedScope === 'specific_departments'
          ? dto.targetDepartments.join(', ')
          : 'ALL_CAMPUS',
      oldState: { isActive: false },
      newState: {
        alertCode: dto.alertCode,
        title: dto.title,
        severity: dto.severity,
        category: dto.category,
        affectedScope: dto.affectedScope,
        targetDepartments: dto.targetDepartments,
        isActive: true,
      },
      reason: `Emergency broadcast activated (${dto.severity.toUpperCase()}): ${dto.title}`,
      ipAddress: requestMeta.ipAddress ?? null,
      userAgent: requestMeta.userAgent ?? null,
    });

    // Real-time campus broadcast via Ably (non-blocking)
    try {
      await AblyBroker.publish(
        AblyBroker.getEmergencyBroadcastChannel(),
        'emergency.triggered',
        {
          alert: dto,
          triggeredAt: dto.triggeredAt,
        }
      );
    } catch {
      // Non-blocking realtime dispatch
    }

    return dto;
  }

  /**
   * Stands down (deactivates) an active emergency broadcast with mandatory all-clear summary.
   * Strictly restricted to Super Administrators and writes a critical AuditLog record.
   */
  public static async deactivateAlert(
    session: UserSession,
    alertId: string,
    rawInput: unknown,
    requestMeta: AuditRequestMeta = {}
  ): Promise<EmergencyAlertDTO> {
    if (!hasPermission(session.role, PERMISSIONS.EMERGENCY_TRIGGER)) {
      throw new ForbiddenError(
        'Access denied. Only Super Administrators may deactivate campus emergency alerts.'
      );
    }

    const parsed = deactivateEmergencySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError('Invalid deactivation payload', parsed.error.flatten());
    }

    const existing = await EmergencyAlertRepository.findById(alertId);
    if (!existing) {
      throw new NotFoundError('Emergency alert', alertId);
    }

    if (!existing.isActive) {
      throw new BadRequestError(
        `Emergency alert ${existing.alertCode} has already been deactivated.`
      );
    }

    const deactivatedBySnapshot = {
      fullName: session.fullName || 'Super Administrator',
      email: session.email,
      role: session.role,
    };

    const updated = await EmergencyAlertRepository.deactivate(
      alertId,
      session.userId,
      deactivatedBySnapshot,
      parsed.data.deactivationNotes
    );

    if (!updated) {
      throw new BadRequestError('Failed to deactivate emergency alert; it may already be inactive.');
    }

    const dto = toEmergencyAlertDTO(updated);

    // Mandatory Critical Audit Log Entry (Phase 5.10 integration)
    await AuditService.recordEvent({
      actorId: session.userId,
      actorSnapshot: {
        fullName: deactivatedBySnapshot.fullName,
        email: deactivatedBySnapshot.email,
        role: deactivatedBySnapshot.role,
        department: null,
      },
      action: 'EMERGENCY_DEACTIVATED',
      module: 'EMERGENCY',
      severity: 'critical',
      targetEntityType: 'EmergencyAlert',
      targetEntityId: dto.id,
      targetLabel: `${dto.alertCode} — ${dto.title}`,
      department:
        dto.affectedScope === 'specific_departments'
          ? dto.targetDepartments.join(', ')
          : 'ALL_CAMPUS',
      oldState: { isActive: true, acknowledgmentCount: existing.acknowledgmentCount },
      newState: {
        isActive: false,
        deactivationNotes: dto.deactivationNotes,
        acknowledgmentCount: dto.acknowledgmentCount,
      },
      reason: parsed.data.deactivationNotes,
      ipAddress: requestMeta.ipAddress ?? null,
      userAgent: requestMeta.userAgent ?? null,
    });

    // Broadcast All-Clear signal via Ably (non-blocking)
    try {
      await AblyBroker.publish(
        AblyBroker.getEmergencyBroadcastChannel(),
        'emergency.deactivated',
        {
          alertId: dto.id,
          alertCode: dto.alertCode,
          deactivationNotes: dto.deactivationNotes,
          deactivatedAt: dto.deactivatedAt,
        }
      );
    } catch {
      // Non-blocking realtime dispatch
    }

    return dto;
  }

  /**
   * Returns the active campus emergency applicable to the caller alongside their receipt state.
   */
  public static async getActiveAlertForUser(
    session: UserSession
  ): Promise<ActiveEmergencyResponseDTO> {
    if (!hasPermission(session.role, PERMISSIONS.EMERGENCY_ACKNOWLEDGE)) {
      throw new ForbiddenError('Unauthorized access to campus emergency directives.');
    }

    const active = await EmergencyAlertRepository.findActiveAlert();
    if (!active) {
      return { activeAlert: null, hasAcknowledged: false, acknowledgedAt: null };
    }

    // Scope filtering for department-targeted emergencies (admin/super_admin always see active alerts)
    if (
      active.affectedScope === 'specific_departments' &&
      session.role !== 'admin' &&
      session.role !== 'super_admin'
    ) {
      const normalizedTargets = (active.targetDepartments || []).map((d) =>
        d.trim().toLowerCase()
      );
      let userDeptMatches = false;

      if (session.departmentId) {
        try {
          const dept = await DepartmentRepository.findById(session.departmentId);
          if (dept) {
            userDeptMatches =
              normalizedTargets.includes(dept.code.toLowerCase()) ||
              normalizedTargets.includes(dept.name.toLowerCase()) ||
              normalizedTargets.includes(dept._id.toString().toLowerCase());
          }
        } catch {
          // Fallback
        }
      }

      if (!userDeptMatches) {
        return { activeAlert: null, hasAcknowledged: false, acknowledgedAt: null };
      }
    }

    const existingAck = await EmergencyAcknowledgmentRepository.findByAlertAndUser(
      active._id.toString(),
      session.userId
    );

    return {
      activeAlert: toEmergencyAlertDTO(active),
      hasAcknowledged: Boolean(existingAck),
      acknowledgedAt: existingAck ? existingAck.acknowledgedAt.toISOString() : null,
    };
  }

  /**
   * Records an idempotent per-user acknowledgment receipt for an active emergency.
   * Re-acknowledging does NOT throw and does NOT double-increment acknowledgmentCount.
   */
  public static async acknowledgeAlert(
    session: UserSession,
    alertId: string,
    requestMeta: AuditRequestMeta = {}
  ): Promise<EmergencyAckResultDTO> {
    if (!hasPermission(session.role, PERMISSIONS.EMERGENCY_ACKNOWLEDGE)) {
      throw new ForbiddenError('You do not have permission to acknowledge emergency directives.');
    }

    const alert = await EmergencyAlertRepository.findById(alertId);
    if (!alert) {
      throw new NotFoundError('Emergency alert', alertId);
    }

    if (!alert.isActive) {
      throw new BadRequestError(
        `Emergency alert ${alert.alertCode} is no longer active and does not require acknowledgment.`
      );
    }

    let departmentName: string | null = null;
    if (session.departmentId) {
      try {
        const dept = await DepartmentRepository.findById(session.departmentId);
        if (dept) departmentName = dept.name;
      } catch {
        // Optional enrichment
      }
    }

    const { record, created } = await EmergencyAcknowledgmentRepository.recordAcknowledgment({
      alertId: alert._id.toString(),
      userId: session.userId,
      userSnapshot: {
        fullName: session.fullName || 'Institutional Member',
        email: session.email,
        role: session.role,
        department: departmentName,
      },
      ipAddress: requestMeta.ipAddress ?? null,
      userAgent: requestMeta.userAgent ?? null,
    });

    let latestCount = alert.acknowledgmentCount;

    if (created) {
      const incremented = await EmergencyAlertRepository.incrementAcknowledgmentCount(
        alert._id.toString()
      );
      latestCount = incremented ? incremented.acknowledgmentCount : alert.acknowledgmentCount + 1;

      // Broadcast lightweight counter update to command console
      try {
        await AblyBroker.publish(
          AblyBroker.getEmergencyBroadcastChannel(),
          'emergency.acknowledged',
          {
            alertId: alert._id.toString(),
            alertCode: alert.alertCode,
            acknowledgmentCount: latestCount,
            acknowledgedRole: session.role,
          }
        );
      } catch {
        // Non-blocking
      }
    }

    return {
      acknowledgment: toEmergencyAcknowledgmentDTO(record),
      alreadyAcknowledged: !created,
      acknowledgmentCount: latestCount,
    };
  }

  /**
   * Lists historical emergency broadcasts & summary counters (admin and super_admin only).
   */
  public static async listAlertHistory(
    session: UserSession,
    query: Partial<EmergencyHistoryQueryParams> = {}
  ): Promise<PaginatedEmergencyHistoryDTO> {
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw new ForbiddenError(
        'Access denied. Emergency broadcast history is restricted to Administrators and Super Administrators.'
      );
    }

    const filter: Record<string, unknown> = {};
    if (query.severity) filter.severity = query.severity;
    if (query.category) filter.category = query.category;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [{ alerts, total }, stats] = await Promise.all([
      EmergencyAlertRepository.findHistory(filter, page, limit),
      EmergencyAlertRepository.getStats(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      alerts: alerts.map(toEmergencyAlertDTO),
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Retrieves live acknowledgment roster and role/campus coverage breakdown (admin & super_admin).
   */
  public static async getAlertAcknowledgments(
    session: UserSession,
    alertId: string,
    query: Partial<AcknowledgmentQueryParams> = {}
  ): Promise<EmergencyAcknowledgmentsResponseDTO> {
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw new ForbiddenError(
        'Access denied. Emergency acknowledgment rosters are restricted to Administrators and Super Administrators.'
      );
    }

    const alert = await EmergencyAlertRepository.findById(alertId);
    if (!alert) {
      throw new NotFoundError('Emergency alert', alertId);
    }

    const filter: Record<string, unknown> = {};
    if (query.role) filter['userSnapshot.role'] = query.role;
    if (query.department && query.department.trim()) {
      filter['userSnapshot.department'] = {
        $regex: escapeRegex(query.department.trim()),
        $options: 'i',
      };
    }
    if (query.search && query.search.trim()) {
      const term = escapeRegex(query.search.trim());
      filter.$or = [
        { 'userSnapshot.fullName': { $regex: term, $options: 'i' } },
        { 'userSnapshot.email': { $regex: term, $options: 'i' } },
        { 'userSnapshot.department': { $regex: term, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 25;

    const [{ acknowledgments, total }, roleBreakdown, userStats] = await Promise.all([
      EmergencyAcknowledgmentRepository.listByAlert(alertId, filter, page, limit),
      EmergencyAcknowledgmentRepository.getRoleBreakdown(alertId),
      UserRepository.getRoleDistributionStats().catch(() => ({
        totalUsers: 0,
        byRole: { student: 0, faculty: 0, admin: 0, super_admin: 0 },
        byStatus: { active: 0, suspended: 0, pending_verification: 0, deactivated: 0, other: 0 },
      })),
    ]);

    const totalActiveUsers = userStats.byStatus.active || 0;
    const coveragePercent =
      totalActiveUsers > 0
        ? Math.min(100, Math.round((roleBreakdown.totalAcknowledged / totalActiveUsers) * 100))
        : roleBreakdown.totalAcknowledged > 0
          ? 100
          : 0;

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      alert: toEmergencyAlertDTO(alert),
      acknowledgments: acknowledgments.map(toEmergencyAcknowledgmentDTO),
      breakdown: {
        ...roleBreakdown,
        totalActiveUsers,
        coveragePercent,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }
}
