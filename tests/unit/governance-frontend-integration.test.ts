/**
 * Phase 5.10: Security Audit Logs & IAM Governance Frontend & Portal Integration Suite.
 *
 * Verifies:
 * 1. AuditLogsView: KPI strip, Verified/Tampered hash-chain badges, filter bar, Export CSV/JSON controls, log entries.
 * 2. IamGovernanceView: Role KPI strip, User Role Directory, Modify Role / Change Status triggers, RBAC Permission Matrix.
 * 3. IamRoleEditModal & IamStatusModal: Clean rendering & prop wiring.
 * 4. Server Pages RBAC Verification: SuperAdminAuditPage & SuperAdminRolesPage restrict access strictly to super_admin.
 */

import { describe, test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AuditLogsView,
  IamGovernanceView,
  IamRoleEditModal,
  IamStatusModal,
} from '../../src/components/governance';
import SuperAdminAuditPage from '../../src/app/(super-admin)/super-admin/audit/page';
import SuperAdminRolesPage from '../../src/app/(super-admin)/super-admin/roles/page';
import { AuditService } from '../../src/lib/services/audit.service';
import { IamGovernanceService } from '../../src/lib/services/iam-governance.service';
import { __setTestSession } from '../../src/lib/auth/server';
import { ForbiddenError } from '../../src/lib/errors/app-error';

import type { UserSession } from '../../src/types/user';
import type {
  AuditChainVerificationDTO,
  AuditLogDTO,
  AuditStatsDTO,
  GovernedUserDTO,
  IamRoleDistributionStatsDTO,
  PermissionMatrixDTO,
} from '../../src/types/governance';

const superAdminId = '6730a005f8b1a2001a000601';
const adminId = '6730a005f8b1a2001a000602';
const facultyId = '6730a005f8b1a2001a000603';

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

const mockLogs: AuditLogDTO[] = [
  {
    id: '6730a005f8b1a2001a000650',
    eventId: 'AUD-2026-100001',
    actorId: superAdminId,
    actorSnapshot: {
      fullName: 'Executive System Admin',
      email: 'sysadmin@axiscolleges.in',
      role: 'super_admin',
      department: null,
    },
    action: 'ROLE_CHANGED',
    module: 'IAM',
    severity: 'high',
    targetEntityType: 'User',
    targetEntityId: facultyId,
    targetLabel: 'prof.sharma@axiscolleges.in',
    department: 'Computer Science & Engineering',
    oldState: { role: 'faculty' },
    newState: { role: 'admin', adminSubRole: 'hod' },
    reason: 'Appointed HOD Computer Science per Academic Council Order.',
    ipAddress: '10.10.0.5',
    userAgent: 'AxisGovernance/1.0',
    previousHash: 'GENESIS',
    entryHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    createdAt: new Date().toISOString(),
  },
];

const mockAuditStats: AuditStatsDTO = {
  totalLogs: 1,
  highCriticalLast24h: 1,
  byModule: { IAM: 1 },
  bySeverity: { info: 0, warning: 0, high: 1, critical: 0 },
  latestEventId: 'AUD-2026-100001',
  latestEntryHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
};

const mockVerificationValid: AuditChainVerificationDTO = {
  valid: true,
  checkedCount: 1,
  verifiedAt: new Date().toISOString(),
};

const mockVerificationTampered: AuditChainVerificationDTO = {
  valid: false,
  checkedCount: 1,
  brokenAtEventId: 'AUD-2026-100001',
  verifiedAt: new Date().toISOString(),
};

const mockUsers: GovernedUserDTO[] = [
  {
    id: facultyId,
    email: 'prof.sharma@axiscolleges.in',
    username: 'alok.sharma',
    fullName: 'Prof. Alok Sharma',
    role: 'faculty',
    adminSubRole: null,
    status: 'active',
    isProfileComplete: true,
    departmentId: '6730a005f8b1a2001a000610',
    departmentName: 'Computer Science & Engineering',
    departmentCode: 'CSE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockIamStats: IamRoleDistributionStatsDTO = {
  totalUsers: 24,
  byRole: { student: 15, faculty: 6, admin: 2, super_admin: 1 },
  byStatus: { active: 22, suspended: 2, pending_verification: 0, deactivated: 0, other: 0 },
};

const mockMatrix: PermissionMatrixDTO = {
  roles: ['student', 'faculty', 'admin', 'super_admin'],
  rows: [
    {
      permission: 'rbac:modify_roles',
      module: '02. RBAC & IAM Governance',
      scopes: { student: 'DENY', faculty: 'DENY', admin: 'DENY', super_admin: 'ALLOW' },
    },
    {
      permission: 'audit:view_logs',
      module: '19. Security Audit Logs',
      scopes: { student: 'DENY', faculty: 'DENY', admin: 'DEPT', super_admin: 'ALLOW' },
    },
  ],
  totalPermissions: 2,
};

describe('Phase 5.10: Security Audit Logs & IAM Governance Frontend Integration Suite', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  test('1. AuditLogsView renders KPI strip, verified hash badge, export controls, and audit rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditLogsView, {
        initialLogs: mockLogs,
        initialStats: mockAuditStats,
        initialVerification: mockVerificationValid,
      })
    );

    assert.ok(html.includes('Immutable Security Audit Logs'));
    assert.ok(html.includes('Verify Chain Integrity'));
    assert.ok(html.includes('Export CSV'));
    assert.ok(html.includes('Export JSON'));
    assert.ok(html.includes('Verified (1 checked)'));
    assert.ok(html.includes('AUD-2026-100001'));
    assert.ok(html.includes('ROLE_CHANGED'));
  });

  test('2. AuditLogsView displays Tampered alert badge when hash verification fails', () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditLogsView, {
        initialLogs: mockLogs,
        initialStats: mockAuditStats,
        initialVerification: mockVerificationTampered,
      })
    );

    assert.ok(html.includes('Tampered (AUD-2026-100001)'));
  });

  test('3. IamGovernanceView renders role KPI strip, user directory, and matrix tab', () => {
    const html = renderToStaticMarkup(
      React.createElement(IamGovernanceView, {
        currentUserId: superAdminId,
        initialUsers: mockUsers,
        initialStats: mockIamStats,
        initialMatrix: mockMatrix,
      })
    );

    assert.ok(html.includes('IAM Governance &amp; RBAC Console'));
    assert.ok(html.includes('Super Admins'));
    assert.ok(html.includes('User Role Directory (1)'));
    assert.ok(html.includes('RBAC Permission Matrix (2)'));
    assert.ok(html.includes('Prof. Alok Sharma'));
    assert.ok(html.includes('Modify Role'));
    assert.ok(html.includes('Change Status'));
  });

  test('4. IamRoleEditModal and IamStatusModal mount cleanly', () => {
    const roleModalHtml = renderToStaticMarkup(
      React.createElement(IamRoleEditModal, {
        user: mockUsers[0] ?? null,
        currentUserId: superAdminId,
        isOpen: false,
        onClose: () => {},
        onSuccess: () => {},
      })
    );
    assert.equal(typeof roleModalHtml, 'string');

    const statusModalHtml = renderToStaticMarkup(
      React.createElement(IamStatusModal, {
        user: mockUsers[0] ?? null,
        currentUserId: superAdminId,
        isOpen: false,
        onClose: () => {},
        onSuccess: () => {},
      })
    );
    assert.equal(typeof statusModalHtml, 'string');
  });

  test('5. SuperAdminAuditPage mounts for super_admin and blocks admin with 403', async () => {
    __setTestSession(adminSession);
    await assert.rejects(() => SuperAdminAuditPage(), ForbiddenError);

    __setTestSession(superAdminSession);
    mock.method(AuditService, 'listAuditLogs', async () => ({
      logs: mockLogs,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasMore: false },
    }));
    mock.method(AuditService, 'getAuditStats', async () => mockAuditStats);
    mock.method(AuditService, 'verifyHashChain', async () => mockVerificationValid);

    const element = await SuperAdminAuditPage();
    const html = renderToStaticMarkup(element);
    assert.ok(html.includes('Immutable Security Audit Logs'));
    assert.ok(html.includes('AUD-2026-100001'));
  });

  test('6. SuperAdminRolesPage mounts for super_admin and blocks admin with 403', async () => {
    __setTestSession(adminSession);
    await assert.rejects(() => SuperAdminRolesPage(), ForbiddenError);

    __setTestSession(superAdminSession);
    mock.method(IamGovernanceService, 'listGovernedUsers', async () => ({
      users: mockUsers,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasMore: false },
    }));
    mock.method(IamGovernanceService, 'getRoleDistributionStats', async () => mockIamStats);
    mock.method(IamGovernanceService, 'getPermissionMatrix', () => mockMatrix);

    const element = await SuperAdminRolesPage();
    const html = renderToStaticMarkup(element);
    assert.ok(html.includes('IAM Governance &amp; RBAC Console'));
    assert.ok(html.includes('Prof. Alok Sharma'));
  });
});
