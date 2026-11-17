/**
 * Phase 5.10: Immutable Security Audit Logs (MOD-19) & IAM Governance Backend Test Suite.
 *
 * Verifies:
 * 1. AuditLog Append-Only Immutability Enforcement (Mongoose hooks reject all updates/deletes).
 * 2. Cryptographic SHA-256 Hash Chaining & Tamper Detection (valid chain vs tampered field / broken link).
 * 3. Sensitive Secret/Token Redaction (password, token, secret, otp stripped recursively).
 * 4. CSV Formula-Injection Protection (=, +, -, @ neutralized).
 * 5. Strict RBAC Alignment (student/faculty 403; admin dept-scoped on audit, 403 on IAM; super_admin global).
 * 6. IAM Governance Safety Invariants (no self-demotion, no self-suspension, last super_admin protection, mandatory audit trail).
 * 7. REST API Route Handler Integration across all 9 /api/v1/audit/* and /api/v1/iam/* endpoints.
 */

import { describe, test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import {
  AuditLogModel,
  AUDIT_LOG_IMMUTABILITY_ERROR,
  BLOCKED_AUDIT_MUTATION_HOOKS,
} from '../../src/lib/db/models/audit-log.model';
import { AuditLogRepository } from '../../src/lib/db/repositories/audit-log.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { UserService } from '../../src/lib/services/user.service';
import { AuditService } from '../../src/lib/services/audit.service';
import { IamGovernanceService } from '../../src/lib/services/iam-governance.service';
import {
  iamUpdateRoleSchema,
  iamUpdateStatusSchema,
} from '../../src/lib/validations/governance.schema';
import { __setTestSession } from '../../src/lib/auth/server';
import { BadRequestError, ForbiddenError } from '../../src/lib/errors/app-error';

// API Route Handlers
import { GET as getAuditLogsRoute } from '../../src/app/api/v1/audit/logs/route';
import { GET as getAuditStatsRoute } from '../../src/app/api/v1/audit/stats/route';
import { GET as verifyAuditRoute } from '../../src/app/api/v1/audit/verify/route';
import { GET as exportAuditRoute } from '../../src/app/api/v1/audit/export/route';
import { GET as getIamUsersRoute } from '../../src/app/api/v1/iam/users/route';
import { GET as getIamStatsRoute } from '../../src/app/api/v1/iam/stats/route';
import { GET as getIamMatrixRoute } from '../../src/app/api/v1/iam/matrix/route';
import { POST as updateIamRoleRoute } from '../../src/app/api/v1/iam/users/[id]/role/route';
import { POST as updateIamStatusRoute } from '../../src/app/api/v1/iam/users/[id]/status/route';

import type { UserSession, IUser } from '../../src/types/user';
import type { IAuditLog } from '../../src/types/governance';
import type { IDepartment } from '../../src/types/department';

const studentId = '6730a005f8b1a2001a000701';
const facultyId = '6730a005f8b1a2001a000702';
const adminId = '6730a005f8b1a2001a000703';
const superAdminId = '6730a005f8b1a2001a000704';
const otherSuperAdminId = '6730a005f8b1a2001a000705';
const cseDeptId = '6730a005f8b1a2001a000710';

const studentSession: UserSession = {
  userId: studentId,
  email: 'student@axiscolleges.in',
  fullName: 'Rohan Kumar',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'faculty@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  role: 'faculty',
  status: 'active',
  departmentId: cseDeptId,
};

const adminSession: UserSession = {
  userId: adminId,
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. S. K. Gupta',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: cseDeptId,
};

const superAdminSession: UserSession = {
  userId: superAdminId,
  email: 'sysadmin@axiscolleges.in',
  fullName: 'Executive System Admin',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

function createMockUser(overrides: Partial<IUser> = {}): IUser {
  const now = new Date();
  return {
    _id: new Types.ObjectId(facultyId),
    email: 'faculty@axiscolleges.in',
    username: 'alok.sharma',
    fullName: 'Prof. Alok Sharma',
    role: 'faculty',
    adminSubRole: null,
    status: 'active',
    isProfileComplete: true,
    departmentId: new Types.ObjectId(cseDeptId),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as IUser;
}

function createChainedMockLogs(): IAuditLog[] {
  const t1 = new Date('2026-11-18T01:00:00.000Z');
  const t2 = new Date('2026-11-18T01:05:00.000Z');

  const h1 = AuditService.computeEntryHash({
    eventId: 'AUD-2026-100001',
    actorId: superAdminId,
    action: 'ROLE_CHANGED',
    module: 'IAM',
    targetEntityId: facultyId,
    oldState: { role: 'faculty' },
    newState: { role: 'admin' },
    previousHash: 'GENESIS',
    createdAt: t1.toISOString(),
  });

  const h2 = AuditService.computeEntryHash({
    eventId: 'AUD-2026-100002',
    actorId: superAdminId,
    action: 'ACCOUNT_STATUS_CHANGED',
    module: 'IAM',
    targetEntityId: studentId,
    oldState: { status: 'active' },
    newState: { status: 'suspended' },
    previousHash: h1,
    createdAt: t2.toISOString(),
  });

  return [
    {
      _id: new Types.ObjectId(),
      eventId: 'AUD-2026-100001',
      actorId: new Types.ObjectId(superAdminId),
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
      targetLabel: 'faculty@axiscolleges.in',
      department: 'Computer Science & Engineering',
      oldState: { role: 'faculty' },
      newState: { role: 'admin' },
      reason: 'Appointed Departmental HOD per Registrar Notice.',
      ipAddress: '10.0.0.1',
      userAgent: 'AxisGovernance/1.0',
      previousHash: 'GENESIS',
      entryHash: h1,
      createdAt: t1,
    } as unknown as IAuditLog,
    {
      _id: new Types.ObjectId(),
      eventId: 'AUD-2026-100002',
      actorId: new Types.ObjectId(superAdminId),
      actorSnapshot: {
        fullName: 'Executive System Admin',
        email: 'sysadmin@axiscolleges.in',
        role: 'super_admin',
        department: null,
      },
      action: 'ACCOUNT_STATUS_CHANGED',
      module: 'IAM',
      severity: 'critical',
      targetEntityType: 'User',
      targetEntityId: studentId,
      targetLabel: 'student@axiscolleges.in',
      department: 'Computer Science & Engineering',
      oldState: { status: 'active' },
      newState: { status: 'suspended' },
      reason: 'Disciplinary administrative hold pending review.',
      ipAddress: '10.0.0.1',
      userAgent: 'AxisGovernance/1.0',
      previousHash: h1,
      entryHash: h2,
      createdAt: t2,
    } as unknown as IAuditLog,
  ];
}

describe('Phase 5.10: Immutable Audit Logs (MOD-19) & IAM Governance Backend Suite', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  /* ======================================================================== */
  /* 1. Append-Only Immutability Enforcement                                  */
  /* ======================================================================== */
  describe('1. AuditLog Append-Only Immutability Guards', () => {
    test('Mongoose pre-hooks explicitly reject all update and delete operations', async () => {
      assert.ok(BLOCKED_AUDIT_MUTATION_HOOKS.includes('updateOne'));
      assert.ok(BLOCKED_AUDIT_MUTATION_HOOKS.includes('updateMany'));
      assert.ok(BLOCKED_AUDIT_MUTATION_HOOKS.includes('findOneAndUpdate'));
      assert.ok(BLOCKED_AUDIT_MUTATION_HOOKS.includes('deleteOne'));
      assert.ok(BLOCKED_AUDIT_MUTATION_HOOKS.includes('deleteMany'));
      assert.ok(BLOCKED_AUDIT_MUTATION_HOOKS.includes('findOneAndDelete'));

      await assert.rejects(
        () => AuditLogModel.updateOne({ eventId: 'AUD-2026-100001' }, { $set: { reason: 'Tampered' } }).exec(),
        { message: AUDIT_LOG_IMMUTABILITY_ERROR }
      );
      await assert.rejects(
        () => AuditLogModel.updateMany({}, { $set: { severity: 'info' } }).exec(),
        { message: AUDIT_LOG_IMMUTABILITY_ERROR }
      );
      await assert.rejects(
        () => AuditLogModel.findOneAndUpdate({ eventId: 'AUD-2026-100001' }, { $set: { reason: 'Tampered' } }).exec(),
        { message: AUDIT_LOG_IMMUTABILITY_ERROR }
      );
      await assert.rejects(
        () => AuditLogModel.deleteOne({ eventId: 'AUD-2026-100001' }).exec(),
        { message: AUDIT_LOG_IMMUTABILITY_ERROR }
      );
      await assert.rejects(
        () => AuditLogModel.deleteMany({}).exec(),
        { message: AUDIT_LOG_IMMUTABILITY_ERROR }
      );
      await assert.rejects(
        () => AuditLogModel.findOneAndDelete({ eventId: 'AUD-2026-100001' }).exec(),
        { message: AUDIT_LOG_IMMUTABILITY_ERROR }
      );
    });

    test('AuditLogRepository strictly omits update and delete methods', () => {
      const repoRecord = AuditLogRepository as unknown as Record<string, unknown>;
      assert.equal(repoRecord.update, undefined);
      assert.equal(repoRecord.delete, undefined);
      assert.equal(repoRecord.deleteById, undefined);
      assert.equal(repoRecord.remove, undefined);
    });
  });

  /* ======================================================================== */
  /* 2. SHA-256 Hash Chaining, Redaction & CSV Injection Safety               */
  /* ======================================================================== */
  describe('2. Cryptographic Hash Chaining, Secret Redaction & CSV Safety', () => {
    test('verifies a valid SHA-256 hash chain cleanly', async () => {
      const chain = createChainedMockLogs();
      mock.method(AuditLogRepository, 'getRecentChain', async () => ({
        entries: chain,
        totalCount: chain.length,
      }));

      const result = await AuditService.verifyHashChain(superAdminSession);
      assert.equal(result.valid, true);
      assert.equal(result.checkedCount, 2);
      assert.equal(result.brokenAtEventId, undefined);
    });

    test('detects out-of-band field tampering and reports exact brokenAtEventId', async () => {
      const chain = createChainedMockLogs();
      // Tamper with newState of second entry without updating its SHA-256 entryHash
      (chain[1] as unknown as Record<string, unknown>).newState = { status: 'active' };

      mock.method(AuditLogRepository, 'getRecentChain', async () => ({
        entries: chain,
        totalCount: chain.length,
      }));

      const result = await AuditService.verifyHashChain(superAdminSession);
      assert.equal(result.valid, false);
      assert.equal(result.brokenAtEventId, 'AUD-2026-100002');
    });

    test('recursively redacts sensitive password, token, secret, and OTP keys', () => {
      const sanitized = AuditService.sanitizeState({
        role: 'admin',
        password: 'SuperSecretPassword123!',
        passwordHash: 'sha256:abcd',
        activationToken: 'tok_999',
        nested: {
          department: 'CSE',
          clerkSecret: 'sk_live_xxx',
          otpCode: '123456',
          apiKey: 'key_123',
        },
      });

      assert.deepEqual(sanitized, {
        role: 'admin',
        nested: {
          department: 'CSE',
        },
      });
    });

    test('neutralizes spreadsheet formula injection in CSV export cells', () => {
      assert.equal(AuditService.escapeCsvCell('=CMD("calc")'), `"'=CMD(""calc"")"`);
      assert.equal(AuditService.escapeCsvCell('+1+1'), `'+1+1`);
      assert.equal(AuditService.escapeCsvCell('-2+3'), `'-2+3`);
      assert.equal(AuditService.escapeCsvCell('@SUM(A1:A10)'), `'@SUM(A1:A10)`);
      assert.equal(AuditService.escapeCsvCell('Normal Reason, approved'), '"Normal Reason, approved"');
    });
  });

  /* ======================================================================== */
  /* 3. Strict RBAC Alignment (Audit Logs & IAM Governance)                   */
  /* ======================================================================== */
  describe('3. Strict RBAC Enforcement', () => {
    test('blocks student and faculty with HTTP 403 on Audit Logs and IAM endpoints', async () => {
      await assert.rejects(() => AuditService.listAuditLogs(studentSession), ForbiddenError);
      await assert.rejects(() => AuditService.listAuditLogs(facultySession), ForbiddenError);
      await assert.rejects(() => IamGovernanceService.listGovernedUsers(studentSession), ForbiddenError);
      await assert.rejects(() => IamGovernanceService.listGovernedUsers(facultySession), ForbiddenError);
    });

    test('blocks admin from IAM Governance & Audit Verify/Export while dept-scoping Audit Reads', async () => {
      await assert.rejects(() => IamGovernanceService.listGovernedUsers(adminSession), ForbiddenError);
      await assert.rejects(() => AuditService.verifyHashChain(adminSession), ForbiddenError);
      await assert.rejects(() => AuditService.exportAuditLogs(adminSession), ForbiddenError);

      // Admin audit log listing strictly applies department filter
      let capturedFilter: Record<string, unknown> = {};
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        code: 'CSE',
        name: 'Computer Science & Engineering',
      }) as unknown as IDepartment);
      mock.method(AuditLogRepository, 'findLogs', async (filter: Record<string, unknown>) => {
        capturedFilter = filter;
        return { logs: [], total: 0 };
      });

      await AuditService.listAuditLogs(adminSession, { department: 'Mechanical Engineering' });
      assert.equal(capturedFilter.department, 'Computer Science & Engineering');
    });
  });

  /* ======================================================================== */
  /* 4. IAM Safety Invariants & Mandatory Audit Recording                     */
  /* ======================================================================== */
  describe('4. IAM Safety Invariants & Mandatory Audit Logging', () => {
    test('enforces mandatory justification (>= 10 chars) in validation schemas', () => {
      const badRole = iamUpdateRoleSchema.safeParse({ role: 'admin', reason: 'short' });
      assert.equal(badRole.success, false);

      const badStatus = iamUpdateStatusSchema.safeParse({ status: 'suspended', reason: 'nope' });
      assert.equal(badStatus.success, false);

      const validRole = iamUpdateRoleSchema.safeParse({
        role: 'admin',
        adminSubRole: 'system_admin',
        reason: 'Formal institutional reassignment approved by board.',
      });
      assert.equal(validRole.success, true);
      if (validRole.success) {
        assert.equal(validRole.data.adminSubRole, 'sys_admin');
      }
    });

    test('blocks self-demotion and self-suspension with HTTP 400 BadRequestError', async () => {
      await assert.rejects(
        () =>
          IamGovernanceService.changeUserRole(superAdminSession, superAdminId, {
            role: 'admin',
            reason: 'Attempting to demote my own active super admin session.',
          }),
        BadRequestError
      );

      await assert.rejects(
        () =>
          IamGovernanceService.changeUserStatus(superAdminSession, superAdminId, {
            status: 'suspended',
            reason: 'Attempting to suspend my own active super admin session.',
          }),
        BadRequestError
      );
    });

    test('prevents demoting or suspending the last remaining active Super Admin (400)', async () => {
      const otherSuper = createMockUser({
        _id: new Types.ObjectId(otherSuperAdminId),
        email: 'other.super@axiscolleges.in',
        role: 'super_admin',
        status: 'active',
      });
      mock.method(UserRepository, 'findById', async () => otherSuper);
      mock.method(UserRepository, 'countByRole', async () => 1);

      await assert.rejects(
        () =>
          IamGovernanceService.changeUserRole(superAdminSession, otherSuperAdminId, {
            role: 'admin',
            reason: 'Trying to remove the final remaining active super admin.',
          }),
        BadRequestError
      );

      await assert.rejects(
        () =>
          IamGovernanceService.changeUserStatus(superAdminSession, otherSuperAdminId, {
            status: 'suspended',
            reason: 'Trying to suspend the final remaining active super admin.',
          }),
        BadRequestError
      );
    });

    test('executes role change via UserService and writes hash-chained AuditLog entry', async () => {
      const targetUser = createMockUser();
      const promotedUser = createMockUser({ role: 'admin', adminSubRole: 'hod' });

      mock.method(UserRepository, 'findById', async () => targetUser);
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        code: 'CSE',
        name: 'Computer Science & Engineering',
      }) as unknown as IDepartment);
      mock.method(UserService, 'updateUserRole', async () => ({
        id: facultyId,
        email: promotedUser.email,
        fullName: promotedUser.fullName,
        role: 'admin',
        adminSubRole: null,
        status: 'active',
        isProfileComplete: true,
        departmentId: cseDeptId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      mock.method(UserService, 'updateAdminSubRole', async () => ({
        id: facultyId,
        email: promotedUser.email,
        fullName: promotedUser.fullName,
        role: 'admin',
        adminSubRole: 'hod',
        status: 'active',
        isProfileComplete: true,
        departmentId: cseDeptId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      mock.method(AuditLogRepository, 'findLatestEntry', async () => null);
      mock.method(AuditLogRepository, 'getNextEventId', async () => 'AUD-2026-100001');
      let savedAuditData: Partial<IAuditLog> | null = null;
      mock.method(AuditLogRepository, 'create', async (data: Partial<IAuditLog>) => {
        savedAuditData = data;
        return { _id: new Types.ObjectId(), ...data } as unknown as IAuditLog;
      });

      const res = await IamGovernanceService.changeUserRole(
        superAdminSession,
        facultyId,
        {
          role: 'admin',
          adminSubRole: 'hod',
          reason: 'Promoted to HOD Computer Science per Academic Council Order.',
        },
        { ipAddress: '192.168.1.50', userAgent: 'UnitTestAgent/1.0' }
      );

      assert.equal(res.user.role, 'admin');
      assert.equal(res.user.adminSubRole, 'hod');
      assert.equal(res.auditEvent.eventId, 'AUD-2026-100001');
      assert.equal(res.auditEvent.action, 'ROLE_CHANGED');
      assert.equal(res.auditEvent.severity, 'high');
      assert.equal(res.auditEvent.previousHash, 'GENESIS');
      assert.equal(res.auditEvent.entryHash.length, 64);
      assert.ok(savedAuditData !== null);
    });
  });

  /* ======================================================================== */
  /* 5. REST API Route Handlers Integration                                   */
  /* ======================================================================== */
  describe('5. REST API Route Handlers Integration (/api/v1/audit/* & /api/v1/iam/*)', () => {
    test('enforces strict RBAC and serves responses across all 4 Audit routes', async () => {
      // Student blocked -> 403
      __setTestSession(studentSession);
      const studentRes = await getAuditLogsRoute(
        new NextRequest('http://localhost/api/v1/audit/logs')
      );
      assert.equal(studentRes.status, 403);

      // Admin blocked from verify & export -> 403
      __setTestSession(adminSession);
      const adminVerifyRes = await verifyAuditRoute(
        new NextRequest('http://localhost/api/v1/audit/verify')
      );
      assert.equal(adminVerifyRes.status, 403);

      const adminExportRes = await exportAuditRoute(
        new NextRequest('http://localhost/api/v1/audit/export?format=csv')
      );
      assert.equal(adminExportRes.status, 403);

      // Super Admin allowed across all 4 Audit routes -> 200
      __setTestSession(superAdminSession);
      const chain = createChainedMockLogs();
      mock.method(AuditLogRepository, 'findLogs', async () => ({
        logs: chain,
        total: chain.length,
      }));
      mock.method(AuditLogRepository, 'getStats', async () => ({
        totalLogs: 2,
        highCriticalLast24h: 2,
        byModule: { IAM: 2 },
        bySeverity: { info: 0, warning: 0, high: 1, critical: 1 },
        latestEventId: 'AUD-2026-100002',
        latestEntryHash: chain[1]!.entryHash,
      }));
      mock.method(AuditLogRepository, 'getRecentChain', async () => ({
        entries: chain,
        totalCount: chain.length,
      }));

      const logsRes = await getAuditLogsRoute(
        new NextRequest('http://localhost/api/v1/audit/logs?module=IAM')
      );
      assert.equal(logsRes.status, 200);

      const statsRes = await getAuditStatsRoute();
      assert.equal(statsRes.status, 200);

      const verifyRes = await verifyAuditRoute(
        new NextRequest('http://localhost/api/v1/audit/verify')
      );
      assert.equal(verifyRes.status, 200);
      const verifyJson = await verifyRes.json();
      assert.equal(verifyJson.data.valid, true);

      const csvRes = await exportAuditRoute(
        new NextRequest('http://localhost/api/v1/audit/export?format=csv')
      );
      assert.equal(csvRes.status, 200);
      assert.ok(csvRes.headers.get('content-type')?.includes('text/csv'));
    });

    test('enforces strict Super Admin RBAC and serves responses across all 5 IAM routes', async () => {
      // Admin blocked -> 403
      __setTestSession(adminSession);
      const adminIamRes = await getIamUsersRoute(
        new NextRequest('http://localhost/api/v1/iam/users')
      );
      assert.equal(adminIamRes.status, 403);

      // Super Admin allowed -> 200
      __setTestSession(superAdminSession);
      mock.method(UserRepository, 'findGovernedUsers', async () => ({
        users: [createMockUser()],
        total: 1,
      }));
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        code: 'CSE',
        name: 'Computer Science & Engineering',
      }) as unknown as IDepartment);
      mock.method(UserRepository, 'getRoleDistributionStats', async () => ({
        totalUsers: 10,
        byRole: { student: 5, faculty: 3, admin: 1, super_admin: 1 },
        byStatus: { active: 9, suspended: 1, pending_verification: 0, deactivated: 0, other: 0 },
      }));

      const usersRes = await getIamUsersRoute(new NextRequest('http://localhost/api/v1/iam/users'));
      assert.equal(usersRes.status, 200);

      const statsRes = await getIamStatsRoute();
      assert.equal(statsRes.status, 200);

      const matrixRes = await getIamMatrixRoute();
      assert.equal(matrixRes.status, 200);
      const matrixJson = await matrixRes.json();
      assert.ok(matrixJson.data.totalPermissions > 20);

      // Role & Status mutation routes
      mock.method(IamGovernanceService, 'changeUserRole', async () => ({
        user: {
          id: facultyId,
          email: 'faculty@axiscolleges.in',
          fullName: 'Prof. Alok Sharma',
          role: 'admin',
          adminSubRole: 'hod',
          status: 'active',
          isProfileComplete: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        auditEvent: {
          id: '6730a005f8b1a2001a000799',
          eventId: 'AUD-2026-100001',
          actorId: superAdminId,
          actorSnapshot: { fullName: 'SysAdmin', email: 'sysadmin@axiscolleges.in', role: 'super_admin' },
          action: 'ROLE_CHANGED',
          module: 'IAM',
          severity: 'high',
          targetEntityType: 'User',
          targetEntityId: facultyId,
          targetLabel: 'faculty@axiscolleges.in',
          department: 'CSE',
          oldState: { role: 'faculty' },
          newState: { role: 'admin' },
          reason: 'Board approved HOD appointment.',
          ipAddress: null,
          userAgent: null,
          previousHash: 'GENESIS',
          entryHash: 'a'.repeat(64),
          createdAt: new Date().toISOString(),
        },
      }));

      const rolePostRes = await updateIamRoleRoute(
        new NextRequest(`http://localhost/api/v1/iam/users/${facultyId}/role`, {
          method: 'POST',
          body: JSON.stringify({
            role: 'admin',
            adminSubRole: 'hod',
            reason: 'Board approved HOD appointment for CSE department.',
          }),
        }),
        { params: Promise.resolve({ id: facultyId }) }
      );
      assert.equal(rolePostRes.status, 200);

      mock.method(IamGovernanceService, 'changeUserStatus', async () => ({
        user: {
          id: studentId,
          email: 'student@axiscolleges.in',
          fullName: 'Rohan Kumar',
          role: 'student',
          status: 'suspended',
          isProfileComplete: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        auditEvent: {
          id: '6730a005f8b1a2001a000798',
          eventId: 'AUD-2026-100002',
          actorId: superAdminId,
          actorSnapshot: { fullName: 'SysAdmin', email: 'sysadmin@axiscolleges.in', role: 'super_admin' },
          action: 'ACCOUNT_STATUS_CHANGED',
          module: 'IAM',
          severity: 'critical',
          targetEntityType: 'User',
          targetEntityId: studentId,
          targetLabel: 'student@axiscolleges.in',
          department: 'CSE',
          oldState: { status: 'active' },
          newState: { status: 'suspended' },
          reason: 'Disciplinary hold by academic board.',
          ipAddress: null,
          userAgent: null,
          previousHash: 'a'.repeat(64),
          entryHash: 'b'.repeat(64),
          createdAt: new Date().toISOString(),
        },
      }));

      const statusPostRes = await updateIamStatusRoute(
        new NextRequest(`http://localhost/api/v1/iam/users/${studentId}/status`, {
          method: 'POST',
          body: JSON.stringify({
            status: 'suspended',
            reason: 'Disciplinary hold ordered by academic affairs board.',
          }),
        }),
        { params: Promise.resolve({ id: studentId }) }
      );
      assert.equal(statusPostRes.status, 200);
    });
  });
});
