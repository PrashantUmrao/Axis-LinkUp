/**
 * Phase 5.11: Emergency Broadcast Console & Campus-Wide Alert Takeover Backend Test Suite (MOD-16).
 *
 * Verifies:
 * 1. Zod Validation Layer (dual-confirmation phrase enforcement, deactivation notes, specific_departments scope).
 * 2. Strict RBAC Enforcement (student/faculty/admin blocked from trigger & deactivate; student/faculty blocked from history/rosters).
 * 3. Single Active Emergency Invariant (HTTP 409 Conflict when an alert is already active).
 * 4. Idempotent Acknowledgment Receipts (re-acknowledging does not throw or double-increment acknowledgmentCount).
 * 5. Mandatory AuditLog Coupling (critical EMERGENCY_TRIGGERED & EMERGENCY_DEACTIVATED entries + Ably campus broadcast).
 * 6. REST API Route Handler Integration across all 6 /api/v1/emergency/* routes.
 */

import { describe, test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import {
  triggerEmergencySchema,
  deactivateEmergencySchema,
} from '../../src/lib/validations/emergency.schema';
import { EmergencyService } from '../../src/lib/services/emergency.service';
import { EmergencyAlertRepository } from '../../src/lib/db/repositories/emergency-alert.repository';
import { EmergencyAcknowledgmentRepository } from '../../src/lib/db/repositories/emergency-acknowledgment.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { AuditService, type RecordAuditEventInput } from '../../src/lib/services/audit.service';
import { AblyBroker } from '../../src/lib/realtime/ably-broker';
import { __setTestSession } from '../../src/lib/auth/server';
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../../src/lib/errors/app-error';

// API Route Handlers
import { GET as getActiveEmergencyRoute } from '../../src/app/api/v1/emergency/active/route';
import { POST as triggerEmergencyRoute } from '../../src/app/api/v1/emergency/trigger/route';
import { POST as deactivateEmergencyRoute } from '../../src/app/api/v1/emergency/[id]/deactivate/route';
import { POST as acknowledgeEmergencyRoute } from '../../src/app/api/v1/emergency/[id]/acknowledge/route';
import { GET as getEmergencyHistoryRoute } from '../../src/app/api/v1/emergency/history/route';
import { GET as getEmergencyAcksRoute } from '../../src/app/api/v1/emergency/[id]/acknowledgments/route';

import type { UserSession } from '../../src/types/user';
import type {
  IEmergencyAlert,
  IEmergencyAcknowledgment,
} from '../../src/types/emergency';
import type { AuditLogDTO } from '../../src/types/governance';

const studentId = '6730a005f8b1a2001a000501';
const facultyId = '6730a005f8b1a2001a000502';
const adminId = '6730a005f8b1a2001a000503';
const superAdminId = '6730a005f8b1a2001a000504';
const alertId = '6730a005f8b1a2001a000520';
const ackId = '6730a005f8b1a2001a000530';

const studentSession: UserSession = {
  userId: studentId,
  email: 'student@axiscolleges.in',
  fullName: 'Aarav Sharma',
  role: 'student',
  status: 'active',
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'faculty@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  role: 'faculty',
  status: 'active',
};

const adminSession: UserSession = {
  userId: adminId,
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. S. K. Gupta',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
};

const superAdminSession: UserSession = {
  userId: superAdminId,
  email: 'sysadmin@axiscolleges.in',
  fullName: 'Executive System Admin',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

function createMockAlert(overrides: Partial<IEmergencyAlert> = {}): IEmergencyAlert {
  const now = new Date();
  return {
    _id: new Types.ObjectId(alertId),
    alertCode: 'EMG-2026-10001',
    title: 'Campus Closure — Severe Storm Warning',
    message:
      'All academic blocks are closing immediately due to severe cyclone and storm warnings. Proceed to safe indoor assembly shelters.',
    severity: 'red',
    category: 'weather',
    instructions: [
      'Move immediately away from glass windows and open terraces.',
      'Await official All-Clear signal before exiting your block.',
    ],
    affectedScope: 'all_campus',
    targetDepartments: [],
    isActive: true,
    triggeredBy: new Types.ObjectId(superAdminId),
    triggeredBySnapshot: {
      fullName: 'Executive System Admin',
      email: 'sysadmin@axiscolleges.in',
      role: 'super_admin',
    },
    triggeredAt: now,
    deactivatedBy: null,
    deactivatedBySnapshot: null,
    deactivatedAt: null,
    deactivationNotes: null,
    acknowledgmentCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as IEmergencyAlert;
}

function createMockAck(
  overrides: Partial<IEmergencyAcknowledgment> = {}
): IEmergencyAcknowledgment {
  return {
    _id: new Types.ObjectId(ackId),
    alertId: new Types.ObjectId(alertId),
    userId: new Types.ObjectId(studentId),
    userSnapshot: {
      fullName: 'Aarav Sharma',
      email: 'student@axiscolleges.in',
      role: 'student',
      department: 'Computer Science & Engineering',
    },
    acknowledgedAt: new Date(),
    ipAddress: '10.0.0.2',
    userAgent: 'AxisPortal/1.0',
    ...overrides,
  } as unknown as IEmergencyAcknowledgment;
}

const dummyAuditResult: AuditLogDTO = {
  id: '6730a005f8b1a2001a000599',
  eventId: 'AUD-2026-100001',
  actorId: superAdminId,
  actorSnapshot: {
    fullName: 'Executive System Admin',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
  },
  action: 'EMERGENCY_TRIGGERED',
  module: 'EMERGENCY',
  severity: 'critical',
  targetEntityType: 'EmergencyAlert',
  targetEntityId: alertId,
  targetLabel: 'EMG-2026-10001',
  department: 'ALL_CAMPUS',
  oldState: null,
  newState: null,
  reason: 'Emergency triggered',
  ipAddress: null,
  userAgent: null,
  previousHash: 'GENESIS',
  entryHash: 'f'.repeat(64),
  createdAt: new Date().toISOString(),
};

describe('Phase 5.11: Emergency Broadcast Console Backend Suite (MOD-16)', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  /* ======================================================================== */
  /* 1. Zod Dual-Confirmation & Scope Validation                              */
  /* ======================================================================== */
  describe('1. Zod Validation & Dual-Confirmation Phrase Gate', () => {
    test('rejects missing or mismatched confirmationPhrase and short deactivation notes', () => {
      const wrongPhrase = triggerEmergencySchema.safeParse({
        title: 'Severe Storm Warning',
        message: 'Immediate indoor sheltering directive across all Axis campus blocks.',
        severity: 'red',
        category: 'weather',
        confirmationPhrase: 'confirm emergency', // wrong case
      });
      assert.equal(wrongPhrase.success, false);

      const missingDepts = triggerEmergencySchema.safeParse({
        title: 'Block B Lab Evacuation',
        message: 'Evacuate Block B computing labs immediately due to power fault.',
        severity: 'amber',
        category: 'infrastructure',
        affectedScope: 'specific_departments',
        targetDepartments: [],
        confirmationPhrase: 'CONFIRM EMERGENCY',
      });
      assert.equal(missingDepts.success, false);

      const shortNotes = deactivateEmergencySchema.safeParse({
        deactivationNotes: 'All good',
      });
      assert.equal(shortNotes.success, false);

      const validTrigger = triggerEmergencySchema.safeParse({
        title: 'Campus Closure — Severe Storm Warning',
        message: 'Proceed immediately to designated indoor safe zones across campus.',
        severity: 'red',
        category: 'weather',
        instructions: ['Stay indoors until All-Clear'],
        affectedScope: 'all_campus',
        confirmationPhrase: 'CONFIRM EMERGENCY',
      });
      assert.equal(validTrigger.success, true);
    });
  });

  /* ======================================================================== */
  /* 2. Strict RBAC Enforcement                                               */
  /* ======================================================================== */
  describe('2. Strict RBAC Enforcement (DOC-AUTH-005)', () => {
    test('blocks student, faculty, and admin from triggering or deactivating emergencies (403)', async () => {
      const payload = {
        title: 'Unauthorized Alert Test',
        message: 'Attempting to fire a campus emergency alert without super admin role.',
        severity: 'red',
        category: 'security',
        confirmationPhrase: 'CONFIRM EMERGENCY',
      };

      for (const s of [studentSession, facultySession, adminSession]) {
        await assert.rejects(() => EmergencyService.triggerAlert(s, payload), ForbiddenError);
        await assert.rejects(
          () =>
            EmergencyService.deactivateAlert(s, alertId, {
              deactivationNotes: 'Attempting unauthorized stand down.',
            }),
          ForbiddenError
        );
      }
    });

    test('blocks student and faculty from viewing history and acknowledgment rosters (403)', async () => {
      for (const s of [studentSession, facultySession]) {
        await assert.rejects(() => EmergencyService.listAlertHistory(s), ForbiddenError);
        await assert.rejects(
          () => EmergencyService.getAlertAcknowledgments(s, alertId),
          ForbiddenError
        );
      }
    });
  });

  /* ======================================================================== */
  /* 3. Single Active Emergency Invariant & AuditLog Coupling                 */
  /* ======================================================================== */
  describe('3. Single Active Emergency, AuditLog Coupling & Realtime Broadcast', () => {
    test('rejects triggering a second emergency while one is active (HTTP 409 Conflict)', async () => {
      mock.method(EmergencyAlertRepository, 'findActiveAlert', async () => createMockAlert());

      await assert.rejects(
        () =>
          EmergencyService.triggerAlert(superAdminSession, {
            title: 'Second Overlapping Alert',
            message: 'Attempting to trigger a second emergency while first is still active.',
            severity: 'amber',
            category: 'other',
            confirmationPhrase: 'CONFIRM EMERGENCY',
          }),
        ConflictError
      );
    });

    test('triggerAlert persists alert, writes critical EMERGENCY_TRIGGERED audit log, and broadcasts via Ably', async () => {
      mock.method(EmergencyAlertRepository, 'findActiveAlert', async () => null);
      mock.method(EmergencyAlertRepository, 'getNextAlertCode', async () => 'EMG-2026-10001');
      mock.method(EmergencyAlertRepository, 'create', async () => createMockAlert());

      let recordedAuditAction = '';
      let recordedAuditSeverity = '';
      let recordedAuditModule = '';
      mock.method(AuditService, 'recordEvent', async (input: RecordAuditEventInput) => {
        recordedAuditAction = input.action;
        recordedAuditSeverity = input.severity || '';
        recordedAuditModule = input.module;
        return dummyAuditResult;
      });

      let publishedChannel = '';
      let publishedEvent = '';
      mock.method(AblyBroker, 'publish', async (channel: string, event: string) => {
        publishedChannel = channel;
        publishedEvent = event;
        return { published: true, channel };
      });

      const created = await EmergencyService.triggerAlert(superAdminSession, {
        title: 'Campus Closure — Severe Storm Warning',
        message:
          'All academic blocks are closing immediately due to severe cyclone and storm warnings.',
        severity: 'red',
        category: 'weather',
        instructions: ['Stay indoors away from windows.'],
        affectedScope: 'all_campus',
        confirmationPhrase: 'CONFIRM EMERGENCY',
      });

      assert.equal(created.alertCode, 'EMG-2026-10001');
      assert.equal(created.isActive, true);
      assert.equal(recordedAuditAction, 'EMERGENCY_TRIGGERED');
      assert.equal(recordedAuditSeverity, 'critical');
      assert.equal(recordedAuditModule, 'EMERGENCY');
      assert.equal(publishedChannel, 'campus:emergency:broadcast');
      assert.equal(publishedEvent, 'emergency.triggered');
    });

    test('deactivateAlert stands down emergency, writes critical EMERGENCY_DEACTIVATED audit log, and broadcasts all-clear', async () => {
      mock.method(EmergencyAlertRepository, 'findById', async () => createMockAlert());
      mock.method(EmergencyAlertRepository, 'deactivate', async () =>
        createMockAlert({
          isActive: false,
          deactivatedAt: new Date(),
          deactivationNotes: 'Storm passed safely; all blocks inspected and cleared.',
        })
      );

      let recordedAuditAction = '';
      let recordedAuditSeverity = '';
      mock.method(AuditService, 'recordEvent', async (input: RecordAuditEventInput) => {
        recordedAuditAction = input.action;
        recordedAuditSeverity = input.severity || '';
        return dummyAuditResult;
      });

      let publishedEvent = '';
      mock.method(AblyBroker, 'publish', async (channel: string, event: string) => {
        publishedEvent = event;
        return { published: true, channel };
      });

      const updated = await EmergencyService.deactivateAlert(superAdminSession, alertId, {
        deactivationNotes: 'Storm passed safely; all blocks inspected and cleared.',
      });

      assert.equal(updated.isActive, false);
      assert.equal(recordedAuditAction, 'EMERGENCY_DEACTIVATED');
      assert.equal(recordedAuditSeverity, 'critical');
      assert.equal(publishedEvent, 'emergency.deactivated');
    });
  });

  /* ======================================================================== */
  /* 4. Idempotent Acknowledgment Receipts                                    */
  /* ======================================================================== */
  describe('4. Idempotent Per-User Acknowledgment Receipts', () => {
    test('increments acknowledgmentCount once and handles repeat acknowledgment idempotently', async () => {
      let incrementCalls = 0;
      let storedAck = false;

      mock.method(EmergencyAlertRepository, 'findById', async () =>
        createMockAlert({ acknowledgmentCount: incrementCalls })
      );
      mock.method(DepartmentRepository, 'findById', async () => null);
      mock.method(EmergencyAcknowledgmentRepository, 'recordAcknowledgment', async () => {
        if (!storedAck) {
          storedAck = true;
          return { record: createMockAck(), created: true };
        }
        return { record: createMockAck(), created: false };
      });
      mock.method(EmergencyAlertRepository, 'incrementAcknowledgmentCount', async () => {
        incrementCalls += 1;
        return createMockAlert({ acknowledgmentCount: incrementCalls });
      });
      mock.method(AblyBroker, 'publish', async (channel: string) => ({
        published: true,
        channel,
      }));

      // First acknowledgment by student
      const first = await EmergencyService.acknowledgeAlert(studentSession, alertId);
      assert.equal(first.alreadyAcknowledged, false);
      assert.equal(first.acknowledgmentCount, 1);
      assert.equal(incrementCalls, 1);

      // Second (duplicate) acknowledgment by same student
      const second = await EmergencyService.acknowledgeAlert(studentSession, alertId);
      assert.equal(second.alreadyAcknowledged, true);
      assert.equal(second.acknowledgmentCount, 1);
      assert.equal(incrementCalls, 1); // Never double-incremented!
    });

    test('rejects triggerAlert with ValidationError on bad phrase', async () => {
      await assert.rejects(
        () =>
          EmergencyService.triggerAlert(superAdminSession, {
            title: 'Bad Phrase Alert',
            message: 'Attempting trigger without matching dual confirmation phrase.',
            severity: 'red',
            category: 'security',
            confirmationPhrase: 'WRONG',
          }),
        ValidationError
      );
    });
  });

  /* ======================================================================== */
  /* 5. REST API Route Handlers Integration                                   */
  /* ======================================================================== */
  describe('5. REST API Route Handlers Integration (/api/v1/emergency/*)', () => {
    test('validates all 6 emergency API endpoints end-to-end with RBAC enforcement', async () => {
      // Admin blocked from POST /api/v1/emergency/trigger -> 403
      __setTestSession(adminSession);
      const forbiddenTrig = await triggerEmergencyRoute(
        new NextRequest('http://localhost/api/v1/emergency/trigger', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Admin Unauthorized Alert',
            message: 'Admins must never be able to trigger campus emergency mode.',
            severity: 'red',
            category: 'security',
            confirmationPhrase: 'CONFIRM EMERGENCY',
          }),
        })
      );
      assert.equal(forbiddenTrig.status, 403);

      // Super Admin triggers alert -> 201
      __setTestSession(superAdminSession);
      mock.method(EmergencyAlertRepository, 'findActiveAlert', async () => null);
      mock.method(EmergencyAlertRepository, 'getNextAlertCode', async () => 'EMG-2026-10001');
      mock.method(EmergencyAlertRepository, 'create', async () => createMockAlert());
      mock.method(AuditService, 'recordEvent', async () => dummyAuditResult);
      mock.method(AblyBroker, 'publish', async (channel: string) => ({
        published: true,
        channel,
      }));

      const trigRes = await triggerEmergencyRoute(
        new NextRequest('http://localhost/api/v1/emergency/trigger', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Campus Closure — Severe Storm Warning',
            message: 'Severe storm warning across campus. Proceed to safe shelters immediately.',
            severity: 'red',
            category: 'weather',
            confirmationPhrase: 'CONFIRM EMERGENCY',
          }),
        })
      );
      assert.equal(trigRes.status, 201);

      // Student reads active emergency & acknowledges -> 200
      __setTestSession(studentSession);
      mock.method(EmergencyAlertRepository, 'findActiveAlert', async () => createMockAlert());
      mock.method(EmergencyAcknowledgmentRepository, 'findByAlertAndUser', async () => null);

      const activeRes = await getActiveEmergencyRoute();
      assert.equal(activeRes.status, 200);
      const activeJson = await activeRes.json();
      assert.equal(activeJson.data.activeAlert.alertCode, 'EMG-2026-10001');
      assert.equal(activeJson.data.hasAcknowledged, false);

      mock.method(EmergencyAlertRepository, 'findById', async () => createMockAlert());
      mock.method(EmergencyAcknowledgmentRepository, 'recordAcknowledgment', async () => ({
        record: createMockAck(),
        created: true,
      }));
      mock.method(EmergencyAlertRepository, 'incrementAcknowledgmentCount', async () =>
        createMockAlert({ acknowledgmentCount: 1 })
      );

      const ackRes = await acknowledgeEmergencyRoute(
        new NextRequest(`http://localhost/api/v1/emergency/${alertId}/acknowledge`, {
          method: 'POST',
        }),
        { params: Promise.resolve({ id: alertId }) }
      );
      assert.equal(ackRes.status, 200);

      // Admin views history & acknowledgments -> 200
      __setTestSession(adminSession);
      mock.method(EmergencyAlertRepository, 'findHistory', async () => ({
        alerts: [createMockAlert()],
        total: 1,
      }));
      mock.method(EmergencyAlertRepository, 'getStats', async () => ({
        totalAlerts: 1,
        activeCount: 1,
        redCount: 1,
        amberCount: 0,
        yellowCount: 0,
      }));
      const histRes = await getEmergencyHistoryRoute(
        new NextRequest('http://localhost/api/v1/emergency/history')
      );
      assert.equal(histRes.status, 200);

      mock.method(EmergencyAcknowledgmentRepository, 'listByAlert', async () => ({
        acknowledgments: [createMockAck()],
        total: 1,
      }));
      mock.method(EmergencyAcknowledgmentRepository, 'getRoleBreakdown', async () => ({
        student: 1,
        faculty: 0,
        admin: 0,
        super_admin: 0,
        totalAcknowledged: 1,
      }));
      mock.method(UserRepository, 'getRoleDistributionStats', async () => ({
        totalUsers: 10,
        byRole: { student: 5, faculty: 3, admin: 1, super_admin: 1 },
        byStatus: { active: 10, suspended: 0, pending_verification: 0, deactivated: 0, other: 0 },
      }));

      const ackListRes = await getEmergencyAcksRoute(
        new NextRequest(`http://localhost/api/v1/emergency/${alertId}/acknowledgments`),
        { params: Promise.resolve({ id: alertId }) }
      );
      assert.equal(ackListRes.status, 200);
      const ackListJson = await ackListRes.json();
      assert.equal(ackListJson.data.breakdown.coveragePercent, 10);

      // Super Admin deactivates -> 200
      __setTestSession(superAdminSession);
      mock.method(EmergencyAlertRepository, 'deactivate', async () =>
        createMockAlert({
          isActive: false,
          deactivationNotes: 'Campus cleared by executive security team.',
        })
      );

      const deactRes = await deactivateEmergencyRoute(
        new NextRequest(`http://localhost/api/v1/emergency/${alertId}/deactivate`, {
          method: 'POST',
          body: JSON.stringify({
            deactivationNotes: 'Campus cleared by executive security team.',
          }),
        }),
        { params: Promise.resolve({ id: alertId }) }
      );
      assert.equal(deactRes.status, 200);
    });
  });
});
