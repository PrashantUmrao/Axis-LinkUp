/**
 * Phase 5.11: Emergency Broadcast Console & Global Takeover Frontend Integration Suite (MOD-16).
 *
 * Verifies:
 * 1. EmergencyGlobalBanner: Full-screen mandatory takeover modal in RED unacknowledged state.
 * 2. EmergencyGlobalBanner: Persistent top banner with "Acknowledged ✓" pill once acknowledged.
 * 3. EmergencyConsoleView: "All Clear — Standard Campus Operations" hero state.
 * 4. EmergencyConsoleView: Active emergency command panel with live coverage bar & role counters.
 * 5. EmergencyTriggerModal & EmergencyDeactivateModal: Clean mounting.
 * 6. SuperAdminEmergencyPage: Strict super_admin RBAC boundary enforcement.
 */

import { describe, test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  EmergencyGlobalBanner,
  EmergencyConsoleView,
  EmergencyTriggerModal,
  EmergencyDeactivateModal,
} from '../../src/components/emergency';
import SuperAdminEmergencyPage from '../../src/app/(super-admin)/super-admin/emergency/page';
import { EmergencyService } from '../../src/lib/services/emergency.service';
import { __setTestSession } from '../../src/lib/auth/server';
import { ForbiddenError } from '../../src/lib/errors/app-error';

import type { UserSession } from '../../src/types/user';
import type {
  EmergencyAlertDTO,
  EmergencyHistoryStatsDTO,
  EmergencyRoleBreakdownDTO,
} from '../../src/types/emergency';

const superAdminId = '6730a005f8b1a2001a000401';
const adminId = '6730a005f8b1a2001a000402';
const alertId = '6730a005f8b1a2001a000410';

const superAdminSession: UserSession = {
  userId: superAdminId,
  email: 'sysadmin@axiscolleges.in',
  fullName: 'Executive System Admin',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
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

const mockRedAlert: EmergencyAlertDTO = {
  id: alertId,
  alertCode: 'EMG-2026-10001',
  title: 'Campus Closure — Severe Storm Warning',
  message:
    'Immediate shelter-in-place directive across all blocks due to severe cyclone conditions.',
  severity: 'red',
  category: 'weather',
  instructions: [
    'Move to interior corridors away from windows.',
    'Do not exit buildings until All-Clear is issued.',
  ],
  affectedScope: 'all_campus',
  targetDepartments: [],
  isActive: true,
  triggeredBy: superAdminId,
  triggeredBySnapshot: {
    fullName: 'Executive System Admin',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
  },
  triggeredAt: new Date().toISOString(),
  deactivatedBy: null,
  deactivatedBySnapshot: null,
  deactivatedAt: null,
  deactivationNotes: null,
  acknowledgmentCount: 42,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockBreakdown: EmergencyRoleBreakdownDTO = {
  student: 30,
  faculty: 8,
  admin: 3,
  super_admin: 1,
  totalAcknowledged: 42,
  totalActiveUsers: 100,
  coveragePercent: 42,
};

const mockStats: EmergencyHistoryStatsDTO = {
  totalAlerts: 3,
  activeCount: 1,
  redCount: 1,
  amberCount: 1,
  yellowCount: 1,
};

describe('Phase 5.11: Emergency Broadcast Frontend & Portal Integration Suite', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  test('1. EmergencyGlobalBanner renders full-screen mandatory takeover modal for unacknowledged RED alert', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmergencyGlobalBanner, {
        initialAlert: mockRedAlert,
        initialAcknowledged: false,
      })
    );

    assert.ok(html.includes('EMG-2026-10001'));
    assert.ok(html.includes('RED — CRITICAL EMERGENCY'));
    assert.ok(html.includes('role="alertdialog"'));
    assert.ok(html.includes('Mandatory Safety Instructions'));
    assert.ok(html.includes('I Understand &amp; Acknowledge'));
  });

  test('2. EmergencyGlobalBanner renders persistent acknowledged banner without blocking modal once acknowledged', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmergencyGlobalBanner, {
        initialAlert: mockRedAlert,
        initialAcknowledged: true,
      })
    );

    assert.ok(html.includes('EMG-2026-10001'));
    assert.ok(html.includes('Acknowledged ✓'));
    assert.ok(!html.includes('role="alertdialog"'));
  });

  test('3. EmergencyConsoleView renders All Clear hero state when no emergency is active', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmergencyConsoleView, {
        initialActiveAlert: null,
        initialHistory: [],
        initialStats: { ...mockStats, activeCount: 0 },
      })
    );

    assert.ok(html.includes('Emergency Broadcast Console (MOD-16)'));
    assert.ok(html.includes('All Clear — Standard Campus Operations'));
    assert.ok(html.includes('Initiate Alert'));
  });

  test('4. EmergencyConsoleView renders active command panel with coverage progress & stand-down button', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmergencyConsoleView, {
        initialActiveAlert: mockRedAlert,
        initialActiveBreakdown: mockBreakdown,
        initialHistory: [mockRedAlert],
        initialStats: mockStats,
      })
    );

    assert.ok(html.includes('ACTIVE • EMG-2026-10001'));
    assert.ok(html.includes('Live Campus Acknowledgment Coverage'));
    assert.ok(html.includes('42%'));
    assert.ok(html.includes('Stand Down / Deactivate Alert'));
  });

  test('5. EmergencyTriggerModal and EmergencyDeactivateModal mount cleanly', () => {
    const trigHtml = renderToStaticMarkup(
      React.createElement(EmergencyTriggerModal, {
        isOpen: false,
        onClose: () => {},
        onSuccess: () => {},
      })
    );
    assert.equal(typeof trigHtml, 'string');

    const deactHtml = renderToStaticMarkup(
      React.createElement(EmergencyDeactivateModal, {
        alert: mockRedAlert,
        isOpen: false,
        onClose: () => {},
        onSuccess: () => {},
      })
    );
    assert.equal(typeof deactHtml, 'string');
  });

  test('6. SuperAdminEmergencyPage mounts for super_admin and blocks admin with 403', async () => {
    __setTestSession(adminSession);
    await assert.rejects(() => SuperAdminEmergencyPage(), ForbiddenError);

    __setTestSession(superAdminSession);
    mock.method(EmergencyService, 'getActiveAlertForUser', async () => ({
      activeAlert: mockRedAlert,
      hasAcknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    }));
    mock.method(EmergencyService, 'listAlertHistory', async () => ({
      alerts: [mockRedAlert],
      stats: mockStats,
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1, hasMore: false },
    }));
    mock.method(EmergencyService, 'getAlertAcknowledgments', async () => ({
      alert: mockRedAlert,
      acknowledgments: [],
      breakdown: mockBreakdown,
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1, hasMore: false },
    }));

    const element = await SuperAdminEmergencyPage();
    const html = renderToStaticMarkup(element);
    assert.ok(html.includes('Emergency Broadcast Console (MOD-16)'));
    assert.ok(html.includes('ACTIVE • EMG-2026-10001'));
  });
});
