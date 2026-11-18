/**
 * P0 Remediation Batch 2 — Grievance RBAC Hardening, Query Overwrite Defense,
 * SysAdmin/Director Separation & Internal Note Privacy Regression Suite.
 *
 * Covers:
 * - AUD-C01: Immutable baseFilter ($and composition), scope override rejection,
 *            regex metacharacter escaping (AUD-M02), sortBy allowlist.
 * - AUD-C02: Regular non-HOD faculty restricted strictly to assigned complaints;
 *            HOD blocked from reading/mutating Director-only complaints;
 *            HOD missing departmentId fails closed; student escalation SLA-breach gate.
 * - AUD-C03: System Administrator (sys_admin & root super_admin without director sub-role)
 *            denied all mutations (403) and restricted to metadata-only redacted DTOs;
 *            Executive Director retains full ombudsman authority.
 * - AUD-H01: isInternal: true tribunal notes stripped from student DTOs and students
 *            forbidden from persisting isInternal: true responses.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import {
  buildComplaintQueryFilter,
  escapeComplaintRegex,
  ComplaintRepository,
} from '@/lib/db/repositories/complaint.repository';
import { ComplaintService } from '@/lib/services/complaint.service';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import {
  complaintQuerySchema,
  COMPLAINT_SORT_FIELDS,
} from '@/lib/validations/complaint.schema';
import { __setTestSession } from '@/lib/auth/server';
import { ForbiddenError } from '@/lib/errors/app-error';
import type { UserSession } from '@/types/user';
import type { IComplaint } from '@/types/complaints';

import { GET as GET_COMPLAINTS } from '@/app/api/v1/complaints/route';
import { GET as GET_COMPLAINT_BY_ID } from '@/app/api/v1/complaints/[id]/route';
import { POST as POST_RESPONSE } from '@/app/api/v1/complaints/[id]/responses/route';
import { PATCH as PATCH_STATUS } from '@/app/api/v1/complaints/[id]/status/route';
import { POST as POST_ESCALATE } from '@/app/api/v1/complaints/[id]/escalate/route';
import { POST as POST_ASSIGN } from '@/app/api/v1/complaints/[id]/assign/route';
import { GET as GET_STATS } from '@/app/api/v1/complaints/stats/route';

// Stable ObjectIds for test personas and records
const DEPT_CSE_ID = new Types.ObjectId('65000000000000000000a001');
const DEPT_ECE_ID = new Types.ObjectId('65000000000000000000a002');
const STUDENT_ID = new Types.ObjectId('65000000000000000000b001');
const FACULTY_UNASSIGNED_ID = new Types.ObjectId('65000000000000000000c001');
const FACULTY_ASSIGNED_ID = new Types.ObjectId('65000000000000000000c002');
const HOD_CSE_ID = new Types.ObjectId('65000000000000000000d001');
const HOD_NO_DEPT_ID = new Types.ObjectId('65000000000000000000d002');
const DIRECTOR_ID = new Types.ObjectId('65000000000000000000e001');
const SYS_ADMIN_ID = new Types.ObjectId('65000000000000000000e002');
const ROOT_SUPER_ADMIN_ID = new Types.ObjectId('65000000000000000000e003');
const COMPLAINT_ID = new Types.ObjectId('65000000000000000000f001');

const studentSession: UserSession = {
  userId: STUDENT_ID.toString(),
  authProviderId: 'clerk_student_p0b2',
  email: 'student.cse@axiscolleges.org',
  fullName: 'Aarav Sharma',
  role: 'student',
  departmentId: DEPT_CSE_ID.toString(),
  status: 'active',
};

const unassignedFacultySession: UserSession = {
  userId: FACULTY_UNASSIGNED_ID.toString(),
  authProviderId: 'clerk_faculty_unassigned',
  email: 'faculty.regular@axiscolleges.org',
  fullName: 'Prof. Regular Faculty',
  role: 'faculty',
  departmentId: DEPT_CSE_ID.toString(),
  status: 'active',
};

const assignedFacultySession: UserSession = {
  userId: FACULTY_ASSIGNED_ID.toString(),
  authProviderId: 'clerk_faculty_assigned',
  email: 'faculty.inquiry@axiscolleges.org',
  fullName: 'Prof. Inquiry Officer',
  role: 'faculty',
  departmentId: DEPT_CSE_ID.toString(),
  status: 'active',
};

const hodCseSession: UserSession = {
  userId: HOD_CSE_ID.toString(),
  authProviderId: 'clerk_hod_cse_p0b2',
  email: 'hod.cse@axiscolleges.org',
  fullName: 'Dr. HOD CSE',
  role: 'admin',
  adminSubRole: 'hod',
  departmentId: DEPT_CSE_ID.toString(),
  status: 'active',
};

const hodNoDeptSession: UserSession = {
  userId: HOD_NO_DEPT_ID.toString(),
  authProviderId: 'clerk_hod_nodept',
  email: 'hod.unassigned@axiscolleges.org',
  fullName: 'Dr. Unassigned HOD',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
};

const directorSession: UserSession = {
  userId: DIRECTOR_ID.toString(),
  authProviderId: 'clerk_director_p0b2',
  email: 'director@axiscolleges.org',
  fullName: 'Dr. Executive Director',
  role: 'super_admin',
  adminSubRole: 'director',
  status: 'active',
};

const sysAdminSession: UserSession = {
  userId: SYS_ADMIN_ID.toString(),
  authProviderId: 'clerk_sysadmin_p0b2',
  email: 'sysadmin@axiscolleges.org',
  fullName: 'System Administrator',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

const rootSuperAdminSession: UserSession = {
  userId: ROOT_SUPER_ADMIN_ID.toString(),
  authProviderId: 'clerk_root_sa_p0b2',
  email: 'root.admin@axiscolleges.org',
  fullName: 'Root Super Admin',
  role: 'super_admin',
  status: 'active',
};

function makeMockComplaint(overrides: Partial<IComplaint> = {}): IComplaint {
  const now = new Date();
  const futureDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  return {
    _id: COMPLAINT_ID,
    ticketNumber: 'CMP-2026-0777',
    studentId: STUDENT_ID,
    studentSnapshot: {
      fullName: 'Aarav Sharma',
      email: 'student.cse@axiscolleges.org',
      rollNumber: '2200101042',
      program: 'B.Tech CSE',
      departmentName: 'Computer Science & Engineering',
      departmentCode: 'CSE',
    },
    departmentId: DEPT_CSE_ID,
    departmentSnapshot: {
      name: 'Computer Science & Engineering',
      code: 'CSE',
    },
    recipientRole: 'hod',
    category: 'academic',
    priority: 'high',
    subject: 'Confidential lab grading irregularity report',
    description: 'Detailed narrative alleging confidential grading discrepancy in CS-304.',
    status: 'submitted',
    sla: {
      slaHours: 48,
      deadline: futureDeadline,
      isBreached: false,
    },
    attachments: [
      {
        name: 'evidence.pdf',
        url: 'https://res.cloudinary.com/axis/raw/upload/evidence.pdf',
        sizeBytes: 12040,
        mimeType: 'application/pdf',
        uploadedAt: now,
      },
    ],
    responses: [
      {
        _id: new Types.ObjectId(),
        authorId: HOD_CSE_ID,
        authorName: 'Dr. HOD CSE',
        authorRole: 'admin',
        message: 'Public response: we are reviewing your submission.',
        attachments: [],
        isInternal: false,
        createdAt: now,
      },
      {
        _id: new Types.ObjectId(),
        authorId: HOD_CSE_ID,
        authorName: 'Dr. HOD CSE',
        authorRole: 'admin',
        message: 'CONFIDENTIAL TRIBUNAL NOTE: Witness interview scheduled privately.',
        attachments: [],
        isInternal: true,
        createdAt: now,
      },
    ],
    timeline: [
      {
        _id: new Types.ObjectId(),
        previousStatus: 'submitted',
        newStatus: 'submitted',
        action: 'GRIEVANCE_LODGED',
        changedById: STUDENT_ID,
        changedByName: 'Aarav Sharma',
        changedByRole: 'student',
        remarks: 'Sensitive initial grievance remark mentioning faculty name.',
        timestamp: now,
      },
    ],
    escalation: {
      isEscalated: true,
      escalatedAt: now,
      escalatedById: HOD_CSE_ID,
      escalatedByName: 'Dr. HOD CSE',
      reason: 'Confidential escalation rationale naming accused personnel.',
      previousRecipient: 'hod',
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as IComplaint;
}

// Snapshot originals for clean restoration after each test
const origFindById = ComplaintRepository.findById;
const origFindStudentComplaints = ComplaintRepository.findStudentComplaints;
const origFindAssignedComplaints = ComplaintRepository.findAssignedComplaints;
const origFindDepartmentComplaints = ComplaintRepository.findDepartmentComplaints;
const origFindDirectorComplaints = ComplaintRepository.findDirectorComplaints;
const origFindAllComplaints = ComplaintRepository.findAllComplaints;
const origAddResponse = ComplaintRepository.addResponse;
const origUpdateStatus = ComplaintRepository.updateStatus;
const origEscalate = ComplaintRepository.escalate;
const origAssign = ComplaintRepository.assign;
const origGetStats = ComplaintRepository.getStats;
const origUserFindById = UserRepository.findById;

function restoreMocks() {
  ComplaintRepository.findById = origFindById;
  ComplaintRepository.findStudentComplaints = origFindStudentComplaints;
  ComplaintRepository.findAssignedComplaints = origFindAssignedComplaints;
  ComplaintRepository.findDepartmentComplaints = origFindDepartmentComplaints;
  ComplaintRepository.findDirectorComplaints = origFindDirectorComplaints;
  ComplaintRepository.findAllComplaints = origFindAllComplaints;
  ComplaintRepository.addResponse = origAddResponse;
  ComplaintRepository.updateStatus = origUpdateStatus;
  ComplaintRepository.escalate = origEscalate;
  ComplaintRepository.assign = origAssign;
  ComplaintRepository.getStats = origGetStats;
  UserRepository.findById = origUserFindById;
  __setTestSession(null);
}

describe('P0 Remediation Batch 2: Grievance Security Hardening', () => {
  beforeEach(() => {
    restoreMocks();
  });

  afterEach(() => {
    restoreMocks();
  });

  // =========================================================================
  // 1. AUD-C01: Query Overwrite Defense, Regex Escaping & Sort Allowlist
  // =========================================================================
  describe('AUD-C01: Query Overwrite Defense, ReDoS Escaping & Sort Allowlist', () => {
    it('prevents HOD query params from overwriting departmentId or recipientRole (allowScopeFilters: false)', () => {
      const baseFilter = {
        departmentId: DEPT_CSE_ID,
        recipientRole: 'hod',
      };

      const filter = buildComplaintQueryFilter(
        baseFilter,
        {
          departmentId: DEPT_ECE_ID.toString(),
          recipientRole: 'director',
          status: 'submitted',
        },
        { allowScopeFilters: false }
      );

      assert.ok(Array.isArray(filter.$and), 'Filter must wrap baseFilter and user conditions in $and');
      const clauses = filter.$and as Record<string, unknown>[];
      assert.deepEqual(clauses[0], baseFilter, 'Authoritative baseFilter must remain untouched');
      assert.equal(
        clauses.some((c) => 'departmentId' in c && String(c.departmentId) === DEPT_ECE_ID.toString()),
        false,
        'Caller departmentId override must be completely ignored'
      );
      assert.equal(
        clauses.some((c) => 'recipientRole' in c && c.recipientRole === 'director'),
        false,
        'Caller recipientRole override must be completely ignored'
      );
      assert.equal(
        clauses.some((c) => c.status === 'submitted'),
        true,
        'Legitimate non-scope status filter should still apply'
      );
    });

    it('prevents student query params from injecting departmentId or recipientRole', () => {
      const baseFilter = { studentId: STUDENT_ID };
      const filter = buildComplaintQueryFilter(
        baseFilter,
        {
          departmentId: DEPT_ECE_ID.toString(),
          recipientRole: 'director',
          priority: 'urgent',
        },
        { allowScopeFilters: false }
      );

      assert.ok(Array.isArray(filter.$and));
      const clauses = filter.$and as Record<string, unknown>[];
      assert.deepEqual(clauses[0], baseFilter);
      assert.equal(clauses.length, 2);
      assert.deepEqual(clauses[1], { priority: 'urgent' });
    });

    it('preserves Director $or baseFilter inside $and when search ($or) and scope filters are combined', () => {
      const baseFilter = {
        $or: [{ recipientRole: 'director' }, { 'escalation.isEscalated': true }],
      };

      const filter = buildComplaintQueryFilter(
        baseFilter,
        {
          departmentId: DEPT_ECE_ID.toString(),
          search: 'lab',
        },
        { allowScopeFilters: true }
      );

      assert.ok(Array.isArray(filter.$and), 'Director filter with search must use $and, never overwrite $or');
      const clauses = filter.$and as Record<string, unknown>[];
      assert.deepEqual(clauses[0], baseFilter, 'Director $or scope must remain intact as first $and element');
      assert.equal(
        clauses.some((c) => '$or' in c && c !== baseFilter),
        true,
        'Search $or clause must live as a separate $and element'
      );
      assert.equal(
        clauses.some((c) => 'departmentId' in c && String(c.departmentId) === DEPT_ECE_ID.toString()),
        true,
        'Director should retain narrowing departmentId filter'
      );
    });

    it('escapes ReDoS and malformed regex metacharacters without throwing SyntaxError (AUD-M02)', () => {
      const maliciousPayload = '.*(a+)+$[';
      const escaped = escapeComplaintRegex(maliciousPayload);
      assert.equal(escaped, '\\.\\*\\(a\\+\\)\\+\\$\\[');

      const filter = buildComplaintQueryFilter(
        { departmentId: DEPT_CSE_ID, recipientRole: 'hod' },
        { search: maliciousPayload },
        { allowScopeFilters: false }
      );

      assert.ok(Array.isArray(filter.$and));
      const searchClause = (filter.$and as Record<string, unknown>[])[1] as {
        $or: Array<Record<string, RegExp>>;
      };
      const regex = searchClause.$or[0]!.ticketNumber!;
      assert.ok(regex instanceof RegExp);
      assert.equal(regex.test('.*(a+)+$['), true, 'Escaped regex matches literal payload');
      assert.equal(regex.test('aaaaaaaaaaaaaaaaaaaaaaaa!'), false, 'Escaped regex does not evaluate quantifiers');
    });

    it('validates complaintQuerySchema sortBy strictly against allowlist', () => {
      for (const field of COMPLAINT_SORT_FIELDS) {
        const res = complaintQuerySchema.safeParse({ sortBy: field });
        assert.equal(res.success, true, `Expected ${field} to be accepted`);
      }

      for (const badSort of ['studentSnapshot.email', '$where', 'description', 'responses']) {
        const res = complaintQuerySchema.safeParse({ sortBy: badSort });
        assert.equal(res.success, false, `Expected unapproved sortBy '${badSort}' to be rejected`);
      }
    });

    it('GET /api/v1/complaints rejects unapproved sortBy with 400 and scopes HOD to own department', async () => {
      __setTestSession(hodCseSession);

      // Unapproved sortBy returns 400
      const badReq = new NextRequest(
        'http://localhost:3000/api/v1/complaints?sortBy=studentSnapshot.email'
      );
      const badRes = await GET_COMPLAINTS(badReq);
      assert.equal(badRes.status, 400);

      // Hostile departmentId & recipientRole query params still route exclusively to HOD CSE dept
      let capturedDeptId = '';
      ComplaintRepository.findDepartmentComplaints = async (deptId) => {
        capturedDeptId = String(deptId);
        return { complaints: [], total: 0 };
      };

      const req = new NextRequest(
        `http://localhost:3000/api/v1/complaints?departmentId=${DEPT_ECE_ID.toString()}&recipientRole=director&search=${encodeURIComponent('.*(a+)+$[')}`
      );
      const res = await GET_COMPLAINTS(req);
      assert.equal(res.status, 200);
      assert.equal(capturedDeptId, DEPT_CSE_ID.toString());
    });
  });

  // =========================================================================
  // 2. AUD-C02: Regular Faculty Isolation & HOD -> Director Boundary
  // =========================================================================
  describe('AUD-C02: Regular Faculty Isolation & HOD vs Director Boundary', () => {
    it('routes regular non-HOD faculty getComplaints strictly to findAssignedComplaints', async () => {
      let assignedCalledWith = '';
      let deptCalled = false;

      ComplaintRepository.findAssignedComplaints = async (assigneeId) => {
        assignedCalledWith = String(assigneeId);
        return { complaints: [], total: 0 };
      };
      ComplaintRepository.findDepartmentComplaints = async () => {
        deptCalled = true;
        return { complaints: [makeMockComplaint()], total: 1 };
      };

      const res = await ComplaintService.getComplaints(unassignedFacultySession, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.equal(assignedCalledWith, FACULTY_UNASSIGNED_ID.toString());
      assert.equal(deptCalled, false, 'Regular faculty must NEVER query findDepartmentComplaints');
      assert.equal(res.complaints.length, 0);
    });

    it('blocks unassigned regular faculty with 403 across read, respond, status, escalate, assign, and stats', async () => {
      const cseHodComplaint = makeMockComplaint();
      ComplaintRepository.findById = async () => cseHodComplaint;

      await assert.rejects(
        () => ComplaintService.getComplaintById(unassignedFacultySession, COMPLAINT_ID.toString()),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.addResponse(unassignedFacultySession, COMPLAINT_ID.toString(), {
            message: 'Unauthorized faculty reply',
            isInternal: false,
          }),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.updateStatus(unassignedFacultySession, COMPLAINT_ID.toString(), {
            status: 'in_progress',
            remarks: 'Attempting status hijack',
          }),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.escalateComplaint(unassignedFacultySession, COMPLAINT_ID.toString(), {
            reason: 'Attempting unauthorized escalation',
          }),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.assignComplaint(unassignedFacultySession, COMPLAINT_ID.toString(), {
            assignedToId: FACULTY_ASSIGNED_ID.toString(),
            assignedToName: 'Prof. Inquiry Officer',
          }),
        ForbiddenError
      );
      await assert.rejects(
        () => ComplaintService.getStats(unassignedFacultySession),
        ForbiddenError
      );

      // Verify HTTP 403 via route handler for stats
      __setTestSession(unassignedFacultySession);
      const statsRes = await GET_STATS(new NextRequest('http://localhost:3000/api/v1/complaints/stats'));
      assert.equal(statsRes.status, 403);
    });

    it('allows assigned regular faculty inquiry officer to read & respond ONLY, blocking status/escalate/assign/stats', async () => {
      const assignedComplaint = makeMockComplaint({
        assignedTo: {
          id: FACULTY_ASSIGNED_ID,
          name: 'Prof. Inquiry Officer',
          role: 'Inquiry Officer',
          assignedAt: new Date(),
        },
      });
      ComplaintRepository.findById = async () => assignedComplaint;
      ComplaintRepository.addResponse = async () => assignedComplaint;

      const fetched = await ComplaintService.getComplaintById(
        assignedFacultySession,
        COMPLAINT_ID.toString()
      );
      assert.equal(fetched.ticketNumber, 'CMP-2026-0777');

      const responded = await ComplaintService.addResponse(
        assignedFacultySession,
        COMPLAINT_ID.toString(),
        {
          message: 'Inquiry officer findings recorded.',
          isInternal: true,
        }
      );
      assert.equal(responded.ticketNumber, 'CMP-2026-0777');

      // Mutations beyond response remain strictly forbidden
      await assert.rejects(
        () =>
          ComplaintService.updateStatus(assignedFacultySession, COMPLAINT_ID.toString(), {
            status: 'resolved',
            remarks: 'Trying to resolve without HOD authority',
          }),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.escalateComplaint(assignedFacultySession, COMPLAINT_ID.toString(), {
            reason: 'Trying to escalate without HOD authority',
          }),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.assignComplaint(assignedFacultySession, COMPLAINT_ID.toString(), {
            assignedToId: FACULTY_UNASSIGNED_ID.toString(),
            assignedToName: 'Other Faculty',
          }),
        ForbiddenError
      );
      await assert.rejects(
        () => ComplaintService.getStats(assignedFacultySession),
        ForbiddenError
      );
    });

    it('blocks same-department HOD from reading or mutating Director-only complaints', async () => {
      const directorOnlyComplaint = makeMockComplaint({
        departmentId: DEPT_CSE_ID,
        recipientRole: 'director',
        ticketNumber: 'CMP-DIR-2026-0099',
        escalation: { isEscalated: false },
      });
      ComplaintRepository.findById = async () => directorOnlyComplaint;

      await assert.rejects(
        () => ComplaintService.getComplaintById(hodCseSession, COMPLAINT_ID.toString()),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.addResponse(hodCseSession, COMPLAINT_ID.toString(), {
            message: 'HOD snooping on Director grievance',
            isInternal: false,
          }),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.updateStatus(hodCseSession, COMPLAINT_ID.toString(), {
            status: 'under_review',
            remarks: 'HOD attempting to alter Director grievance',
          }),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.assignComplaint(hodCseSession, COMPLAINT_ID.toString(), {
            assignedToId: FACULTY_ASSIGNED_ID.toString(),
            assignedToName: 'Prof. Inquiry Officer',
          }),
        ForbiddenError
      );
      await assert.rejects(
        () =>
          ComplaintService.escalateComplaint(hodCseSession, COMPLAINT_ID.toString(), {
            reason: 'HOD trying to escalate a Director-only ticket',
          }),
        ForbiddenError
      );
    });

    it('fails closed with 403 when an HOD has no departmentId in session or database', async () => {
      UserRepository.findById = async () => null;

      await assert.rejects(
        () =>
          ComplaintService.getComplaints(hodNoDeptSession, {
            page: 1,
            limit: 20,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
        ForbiddenError
      );
      await assert.rejects(() => ComplaintService.getStats(hodNoDeptSession), ForbiddenError);
    });
  });

  // =========================================================================
  // 3. AUD-C03: System Admin vs Director Separation & Metadata Redaction
  // =========================================================================
  describe('AUD-C03: System Admin Mutation Denial & Complete Metadata Redaction', () => {
    for (const [label, session] of [
      ['sys_admin', sysAdminSession],
      ['root super_admin (no director sub-role)', rootSuperAdminSession],
    ] as const) {
      it(`denies ALL mutations with 403 for ${label}`, async () => {
        const complaint = makeMockComplaint();
        ComplaintRepository.findById = async () => complaint;

        await assert.rejects(
          () =>
            ComplaintService.addResponse(session, COMPLAINT_ID.toString(), {
              message: 'SysAdmin trying to reply',
              isInternal: false,
            }),
          ForbiddenError
        );
        await assert.rejects(
          () =>
            ComplaintService.updateStatus(session, COMPLAINT_ID.toString(), {
              status: 'resolved',
              remarks: 'SysAdmin trying to adjudicate',
            }),
          ForbiddenError
        );
        await assert.rejects(
          () =>
            ComplaintService.assignComplaint(session, COMPLAINT_ID.toString(), {
              assignedToId: FACULTY_ASSIGNED_ID.toString(),
              assignedToName: 'Prof. Inquiry Officer',
            }),
          ForbiddenError
        );
        await assert.rejects(
          () =>
            ComplaintService.escalateComplaint(session, COMPLAINT_ID.toString(), {
              reason: 'SysAdmin trying to escalate grievance',
            }),
          ForbiddenError
        );

        // Verify HTTP 403 via all 4 mutation API route handlers
        __setTestSession(session);
        const ctx = { params: Promise.resolve({ id: COMPLAINT_ID.toString() }) };

        const r1 = await POST_RESPONSE(
          new NextRequest('http://localhost:3000/api/v1/complaints/id/responses', {
            method: 'POST',
            body: JSON.stringify({ message: 'Blocked' }),
          }),
          ctx
        );
        assert.equal(r1.status, 403);

        const r2 = await PATCH_STATUS(
          new NextRequest('http://localhost:3000/api/v1/complaints/id/status', {
            method: 'PATCH',
            body: JSON.stringify({ status: 'in_progress', remarks: 'Blocked status mutation' }),
          }),
          ctx
        );
        assert.equal(r2.status, 403);

        const r3 = await POST_ASSIGN(
          new NextRequest('http://localhost:3000/api/v1/complaints/id/assign', {
            method: 'POST',
            body: JSON.stringify({
              assignedToId: FACULTY_ASSIGNED_ID.toString(),
              assignedToName: 'Prof. Inquiry Officer',
            }),
          }),
          ctx
        );
        assert.equal(r3.status, 403);

        const r4 = await POST_ESCALATE(
          new NextRequest('http://localhost:3000/api/v1/complaints/id/escalate', {
            method: 'POST',
            body: JSON.stringify({ reason: 'Blocked escalation attempt by sysadmin' }),
          }),
          ctx
        );
        assert.equal(r4.status, 403);
      });

      it(`redacts ALL confidential grievance fields on read for ${label}`, async () => {
        const complaint = makeMockComplaint();
        ComplaintRepository.findById = async () => complaint;
        ComplaintRepository.findAllComplaints = async () => ({
          complaints: [complaint],
          total: 1,
        });

        const single = await ComplaintService.getComplaintById(session, COMPLAINT_ID.toString());
        const list = await ComplaintService.getComplaints(session, {
          page: 1,
          limit: 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        for (const dto of [single, list.complaints[0]!]) {
          assert.equal(dto.ticketNumber, 'CMP-2026-0777', 'Telemetry metadata must remain intact');
          assert.equal(dto.subject, '[REDACTED — TRIBUNAL CONFIDENTIAL]');
          assert.equal(
            dto.narrative,
            '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]'
          );
          assert.equal(
            dto.description,
            '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]'
          );
          assert.deepEqual(dto.responses, []);
          assert.deepEqual(dto.attachments, []);
          assert.deepEqual(dto.detailedAttachments, []);
          assert.equal(dto.escalation?.reason, '[REDACTED — TRIBUNAL CONFIDENTIAL]');
          assert.ok(dto.timeline.length > 0);
          for (const event of dto.timeline) {
            assert.equal(event.remarks, '[REDACTED]');
          }
        }
      });
    }

    it('preserves full unredacted read and adjudication capabilities for Executive Director', async () => {
      const complaint = makeMockComplaint({ recipientRole: 'director' });
      ComplaintRepository.findById = async () => complaint;
      ComplaintRepository.addResponse = async () => complaint;
      ComplaintRepository.updateStatus = async () => ({ ...complaint, status: 'in_progress' } as IComplaint);
      ComplaintRepository.assign = async () => complaint;
      UserRepository.findById = async () =>
        ({ _id: FACULTY_ASSIGNED_ID, fullName: 'Prof. Inquiry Officer' }) as never;

      const dto = await ComplaintService.getComplaintById(directorSession, COMPLAINT_ID.toString());
      assert.equal(dto.subject, 'Confidential lab grading irregularity report');
      assert.equal(dto.responses.length, 2);
      assert.equal(dto.attachments?.length, 1);
      assert.equal(dto.detailedAttachments.length, 1);
      assert.equal(
        dto.escalation?.reason,
        'Confidential escalation rationale naming accused personnel.'
      );
      assert.equal(
        dto.timeline[0]?.remarks,
        'Sensitive initial grievance remark mentioning faculty name.'
      );

      const replied = await ComplaintService.addResponse(directorSession, COMPLAINT_ID.toString(), {
        message: 'Directorate review initiated.',
        isInternal: true,
      });
      assert.equal(replied.ticketNumber, 'CMP-2026-0777');

      const transitioned = await ComplaintService.updateStatus(
        directorSession,
        COMPLAINT_ID.toString(),
        {
          status: 'in_progress',
          remarks: 'Directorate inquiry formally opened.',
        }
      );
      assert.equal(transitioned.status, 'in_progress');

      const assigned = await ComplaintService.assignComplaint(
        directorSession,
        COMPLAINT_ID.toString(),
        {
          assignedToId: FACULTY_ASSIGNED_ID.toString(),
          assignedToName: 'Prof. Inquiry Officer',
        }
      );
      assert.equal(assigned.ticketNumber, 'CMP-2026-0777');
    });
  });

  // =========================================================================
  // 4. AUD-H01: Confidential Internal Tribunal Notes Privacy
  // =========================================================================
  describe('AUD-H01: Confidential Internal Note Filtering & Coercion', () => {
    it('strips isInternal: true notes from student responses across list, detail, and reply DTOs', async () => {
      const complaint = makeMockComplaint();
      ComplaintRepository.findById = async () => complaint;
      ComplaintRepository.findStudentComplaints = async () => ({
        complaints: [complaint],
        total: 1,
      });
      ComplaintRepository.addResponse = async () => complaint;

      // 1. Detail view
      const detailDto = await ComplaintService.getComplaintById(
        studentSession,
        COMPLAINT_ID.toString()
      );
      assert.equal(detailDto.responses.length, 1);
      assert.equal(detailDto.responses.every((r) => !r.isInternal), true);
      assert.equal(
        detailDto.responses.some((r) => r.message.includes('CONFIDENTIAL TRIBUNAL NOTE')),
        false
      );

      // 2. List view
      const listRes = await ComplaintService.getComplaints(studentSession, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      assert.equal(listRes.complaints[0]!.responses.length, 1);
      assert.equal(listRes.complaints[0]!.responses.every((r) => !r.isInternal), true);

      // 3. After student posts follow-up
      const replyDto = await ComplaintService.addResponse(studentSession, COMPLAINT_ID.toString(), {
        message: 'Student follow-up message',
        isInternal: false,
      });
      assert.equal(replyDto.responses.length, 1);
      assert.equal(replyDto.responses.every((r) => !r.isInternal), true);

      // 4. HTTP GET /api/v1/complaints/[id] as student strips internal notes
      __setTestSession(studentSession);
      const httpRes = await GET_COMPLAINT_BY_ID(
        new NextRequest(`http://localhost:3000/api/v1/complaints/${COMPLAINT_ID.toString()}`),
        { params: Promise.resolve({ id: COMPLAINT_ID.toString() }) }
      );
      assert.equal(httpRes.status, 200);
      const body = (await httpRes.json()) as { data: { responses: Array<{ isInternal: boolean }> } };
      assert.equal(body.data.responses.length, 1);
      assert.equal(body.data.responses[0]!.isInternal, false);

      // 5. HOD still sees internal notes on the same complaint
      const hodDto = await ComplaintService.getComplaintById(hodCseSession, COMPLAINT_ID.toString());
      assert.equal(hodDto.responses.length, 2);
      assert.equal(hodDto.responses.some((r) => r.isInternal === true), true);
    });

    it('coerces isInternal to false when a student attempts to submit isInternal: true', async () => {
      const complaint = makeMockComplaint();
      ComplaintRepository.findById = async () => complaint;

      let persistedIsInternal: boolean | undefined;
      ComplaintRepository.addResponse = async (_id, responseData) => {
        persistedIsInternal = responseData.isInternal;
        return complaint;
      };

      await ComplaintService.addResponse(studentSession, COMPLAINT_ID.toString(), {
        message: 'Student trying to inject internal note',
        isInternal: true,
      });

      assert.equal(persistedIsInternal, false, 'Student response isInternal MUST be forced to false');

      // Authority (HOD) retains ability to persist isInternal: true without leaking actionTaken into timeline
      persistedIsInternal = undefined;
      let capturedTimelineAction: string | undefined;
      let capturedTimelineRemarks: string | undefined;
      ComplaintRepository.addResponse = async (_id, responseData, auditEvent) => {
        persistedIsInternal = responseData.isInternal;
        capturedTimelineAction = auditEvent?.action;
        capturedTimelineRemarks = auditEvent?.remarks;
        return complaint;
      };
      await ComplaintService.addResponse(hodCseSession, COMPLAINT_ID.toString(), {
        message: 'HOD confidential tribunal note',
        actionTaken: 'Secret witness debriefing',
        isInternal: true,
      });
      assert.equal(persistedIsInternal, true);
      assert.equal(capturedTimelineAction, 'INTERNAL_TRIBUNAL_NOTE');
      assert.equal(capturedTimelineRemarks?.includes('Secret witness debriefing'), false);
    });
  });

  // =========================================================================
  // 5. Student Escalation Statutory SLA-Breach Gate
  // =========================================================================
  describe('Student Escalation Statutory SLA-Breach Gate', () => {
    it('rejects student self-escalation with 403 when SLA deadline has not been breached', async () => {
      const activeComplaint = makeMockComplaint({
        escalation: { isEscalated: false },
        sla: {
          slaHours: 48,
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          isBreached: false,
        },
      });
      ComplaintRepository.findById = async () => activeComplaint;

      await assert.rejects(
        () =>
          ComplaintService.escalateComplaint(studentSession, COMPLAINT_ID.toString(), {
            reason: 'Trying to escalate prematurely before SLA breach',
          }),
        ForbiddenError
      );
    });

    it('permits student self-escalation once SLA deadline has passed or isBreached is true', async () => {
      const breachedComplaint = makeMockComplaint({
        escalation: { isEscalated: false },
        sla: {
          slaHours: 48,
          deadline: new Date(Date.now() - 60 * 60 * 1000),
          isBreached: false,
        },
      });
      ComplaintRepository.findById = async () => breachedComplaint;
      ComplaintRepository.escalate = async () =>
        ({
          ...breachedComplaint,
          status: 'escalated',
          recipientRole: 'director',
          escalation: {
            isEscalated: true,
            reason: 'No HOD response past 48-hour statutory deadline.',
          },
        }) as unknown as IComplaint;

      const result = await ComplaintService.escalateComplaint(
        studentSession,
        COMPLAINT_ID.toString(),
        {
          reason: 'No HOD response past 48-hour statutory deadline.',
        }
      );

      assert.equal(result.status, 'escalated');
      assert.equal(result.responses.every((r) => !r.isInternal), true);
    });
  });
});
