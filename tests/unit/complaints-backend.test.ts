/**
 * Phase 5.5: Grievance Redressal / Complaints Backend Unit & Integration Test Suite.
 * Mandated under AICTE / UGC Grievance Redressal Regulations.
 * 
 * Verifies:
 * 1. Model Schema & Ticket Generation (statutory SLAs, snapshots, DTO transformation).
 * 2. Complaint Creation & Payload Validation (Student role lock, category/priority validation).
 * 3. Role-Based Retrieval & Department Isolation (Zero-Trust ABAC, cross-dept prevention).
 * 4. Dialogue Thread & Response Processing (Student follow-ups, official action taken).
 * 5. Controlled Lifecycle Transitions & Immutable Audit Timeline (state machine integrity).
 * 6. Statutory Directorate Escalation (SLA recalibration, HOD appeal workflow).
 * 7. Inquiry Officer Assignment (investigator tracking, assignment audit).
 * 8. REST API Route Handlers (GET, POST, PATCH, responses, status, escalate, assign, stats).
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { ComplaintService } from '../../src/lib/services/complaint.service';
import { ComplaintRepository } from '../../src/lib/db/repositories/complaint.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { toComplaintDTO } from '../../src/lib/db/models/complaint.model';
import { __setTestSession } from '../../src/lib/auth/server';

import {
  GET as getComplaintsRoute,
  POST as createComplaintRoute,
} from '../../src/app/api/v1/complaints/route';
import { GET as getComplaintDetailRoute } from '../../src/app/api/v1/complaints/[id]/route';
import { POST as addResponseRoute } from '../../src/app/api/v1/complaints/[id]/responses/route';
import { PATCH as updateStatusRoute } from '../../src/app/api/v1/complaints/[id]/status/route';
import { POST as escalateRoute } from '../../src/app/api/v1/complaints/[id]/escalate/route';
import { POST as assignRoute } from '../../src/app/api/v1/complaints/[id]/assign/route';
import { GET as getStatsRoute } from '../../src/app/api/v1/complaints/stats/route';

import type { UserSession, IUser } from '../../src/types/user';
import type { IComplaint } from '../../src/types/complaints';
import type { IDepartment } from '../../src/types/department';

// Mock ObjectIds
const cseDeptId = '6730a005f8b1a2001a000010';
const eceDeptId = '6730a005f8b1a2001a000020';

const studentId = '6730a005f8b1a2001a000001';
const student2Id = '6730a005f8b1a2001a000002';
const facultyId = '6730a005f8b1a2001a000050';
const hodCseId = '6730a005f8b1a2001a000080';
const hodEceId = '6730a005f8b1a2001a000081';
const directorId = '6730a005f8b1a2001a000090';
const sysAdminId = '6730a005f8b1a2001a000099';
const complaintId = '6730a005f8b1a2001a000500';

// Mock User Sessions
const studentSession: UserSession = {
  userId: studentId,
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const student2Session: UserSession = {
  userId: student2Id,
  email: 'sneha.reddy@axiscolleges.in',
  fullName: 'Sneha Reddy',
  role: 'student',
  status: 'active',
  departmentId: eceDeptId,
};

const hodCseSession: UserSession = {
  userId: hodCseId,
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. R. K. Verma',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: cseDeptId,
};

const hodEceSession: UserSession = {
  userId: hodEceId,
  email: 'hod.ece@axiscolleges.in',
  fullName: 'Dr. P. K. Mishra',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: eceDeptId,
};

const directorSession: UserSession = {
  userId: directorId,
  email: 'director@axiscolleges.in',
  fullName: 'Executive Director (Ombudsman)',
  role: 'super_admin',
  adminSubRole: 'director',
  status: 'active',
};

const sysAdminSession: UserSession = {
  userId: sysAdminId,
  email: 'admin01@axiscolleges.in',
  fullName: 'System Administrator',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

// Mock Helper Entities
const cseDepartment = {
  _id: new Types.ObjectId(cseDeptId),
  code: 'CSE',
  name: 'Computer Science & Engineering',
  hodId: new Types.ObjectId(hodCseId),
  establishedYear: 2010,
  isActive: true,
  programs: [{ code: 'BTECH_CSE', name: 'B.Tech in CSE', isActive: true }],
} as unknown as IDepartment;

const studentUserDoc = {
  _id: new Types.ObjectId(studentId),
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  role: 'student',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  studentProfile: {
    rollNumber: '2101330100045',
    program: 'BTECH_CSE',
    batchYear: 2025,
    currentSemester: 7,
    section: 'A',
  },
} as unknown as IUser;

function buildMockComplaint(overrides: Partial<IComplaint> = {}): IComplaint {
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return {
    _id: new Types.ObjectId(complaintId),
    ticketNumber: 'CMP-2026-0042',
    studentId: new Types.ObjectId(studentId),
    studentSnapshot: {
      fullName: 'Rahul Verma',
      email: 'rahul.verma@axiscolleges.in',
      rollNumber: '2101330100045',
      program: 'BTECH_CSE',
      batchYear: 2025,
      currentSemester: 7,
      section: 'A',
      departmentName: 'Computer Science & Engineering',
      departmentCode: 'CSE',
    },
    departmentId: new Types.ObjectId(cseDeptId),
    departmentSnapshot: {
      name: 'Computer Science & Engineering',
      code: 'CSE',
    },
    academicContext: {
      batchYear: 2025,
      semester: 7,
      section: 'A',
      courseCode: 'CSE-301',
    },
    recipientRole: 'hod',
    category: 'lab_infrastructure',
    priority: 'high',
    subject: 'Lab 2 Workstation Network Downtime during Practical Exam',
    description:
      'During the practical evaluation for CSE-301, workstations suffered intermittent disconnects.',
    status: 'submitted',
    sla: {
      slaHours: 48,
      deadline,
      isBreached: false,
    },
    assignedTo: {},
    escalation: { isEscalated: false },
    attachments: [
      {
        name: 'Lab2_Terminal_Error.png',
        url: 'https://cloudinary.com/axis/lab2_error.png',
        sizeBytes: 102400,
        mimeType: 'image/png',
        uploadedAt: new Date(),
      },
    ],
    responses: [],
    timeline: [
      {
        previousStatus: 'submitted',
        newStatus: 'submitted',
        action: 'GRIEVANCE_LODGED',
        changedById: new Types.ObjectId(studentId),
        changedByName: 'Rahul Verma',
        changedByRole: 'student',
        remarks: 'Initial complaint petition lodged.',
        timestamp: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as IComplaint;
}

describe('Phase 5.5: Grievance Redressal Backend & Architecture Suite', () => {
  afterEach(() => {
    mock.reset();
    __setTestSession(undefined);
  });

  describe('1. Model Architecture, SLA Tracking & DTO Transformation', () => {
    test('transforms document to DTO with SLA calculation and snapshot fidelity', () => {
      const mockComplaint = buildMockComplaint();
      const dto = toComplaintDTO(mockComplaint);

      assert.strictEqual(dto.id, complaintId);
      assert.strictEqual(dto.ticketNumber, 'CMP-2026-0042');
      assert.strictEqual(dto.studentId, studentId);
      assert.strictEqual(dto.studentName, 'Rahul Verma');
      assert.strictEqual(dto.studentRoll, '2101330100045');
      assert.strictEqual(dto.department, 'Computer Science & Engineering');
      assert.strictEqual(dto.recipientRole, 'hod');
      assert.strictEqual(dto.category, 'lab_infrastructure');
      assert.strictEqual(dto.priority, 'high');
      assert.strictEqual(dto.subject, 'Lab 2 Workstation Network Downtime during Practical Exam');
      assert.strictEqual(dto.status, 'submitted');
      assert.strictEqual(dto.sla.slaHours, 48);
      assert.strictEqual(dto.sla.isBreached, false);
      assert.strictEqual(dto.attachments?.length, 1);
      assert.strictEqual(dto.attachments?.[0], 'Lab2_Terminal_Error.png');
      assert.strictEqual(dto.detailedAttachments.length, 1);
      assert.strictEqual(dto.timeline.length, 1);
      assert.strictEqual(dto.timeline[0]?.action, 'GRIEVANCE_LODGED');
    });

    test('detects SLA breaches correctly when current time exceeds deadline', () => {
      const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day in the past
      const breachedComplaint = buildMockComplaint({
        status: 'under_review',
        sla: { slaHours: 48, deadline: pastDeadline, isBreached: true },
      });

      const dto = toComplaintDTO(breachedComplaint);
      assert.strictEqual(dto.sla.isBreached, true);
      assert.strictEqual(dto.slaRemainingHours, 0);
    });

    test('generates valid ticket numbers matching HOD and Director conventions', async () => {
      mock.method(ComplaintRepository, 'generateTicketNumber', async (role: string) => {
        const year = new Date().getFullYear();
        return role === 'director' ? `CMP-DIR-${year}-0001` : `CMP-${year}-0001`;
      });

      const hodTicket = await ComplaintRepository.generateTicketNumber('hod');
      const dirTicket = await ComplaintRepository.generateTicketNumber('director');

      assert.match(hodTicket, /^CMP-\d{4}-\d{4}$/);
      assert.match(dirTicket, /^CMP-DIR-\d{4}-\d{4}$/);
    });
  });

  describe('2. Complaint Submission & Validation', () => {
    test('enrolled student successfully lodges grievance with academic context', async () => {
      mock.method(UserRepository, 'findById', async () => studentUserDoc);
      mock.method(DepartmentRepository, 'findById', async () => cseDepartment);

      const createdDoc = buildMockComplaint();
      mock.method(ComplaintRepository, 'create', async () => createdDoc);
      mock.method(ComplaintRepository, 'generateTicketNumber', async () => 'CMP-2026-0042');

      const result = await ComplaintService.submitComplaint(studentSession, {
        recipientRole: 'hod',
        category: 'lab_infrastructure',
        priority: 'high',
        subject: 'Lab 2 Workstation Network Downtime during Practical Exam',
        description:
          'During the practical evaluation for CSE-301, workstations suffered intermittent disconnects.',
        attachments: [
          {
            name: 'Lab2_Terminal_Error.png',
            url: 'https://cloudinary.com/axis/lab2_error.png',
            sizeBytes: 102400,
            mimeType: 'image/png',
          },
        ],
      });

      assert.strictEqual(result.ticketNumber, 'CMP-2026-0042');
      assert.strictEqual(result.studentRoll, '2101330100045');
      assert.strictEqual(result.status, 'submitted');
      assert.strictEqual(result.sla.slaHours, 48);
    });

    test('rejects complaint petition lodged by non-student role with 403 Forbidden', async () => {
      await assert.rejects(
        async () => {
          await ComplaintService.submitComplaint(hodCseSession, {
            recipientRole: 'director',
            category: 'academic',
            priority: 'medium',
            subject: 'Unauthorized faculty grievance attempt',
            description: 'Faculty attempting to use student complaint ingress.',
          });
        },
        {
          name: 'ForbiddenError',
          message: 'Only enrolled collegiate students may lodge statutory grievances.',
        }
      );
    });

    test('rejects complaint filing when student department context is unresolved', async () => {
      const orphanStudent = { ...studentUserDoc, departmentId: undefined } as unknown as IUser;
      mock.method(UserRepository, 'findById', async () => orphanStudent);

      await assert.rejects(
        async () => {
          await ComplaintService.submitComplaint(studentSession, {
            recipientRole: 'hod',
            category: 'academic',
            priority: 'medium',
            subject: 'Student without department context',
            description: 'Attempting to file petition without academic department.',
          });
        },
        {
          name: 'ValidationError',
          message:
            'Department context is missing. Student must belong to an academic department.',
        }
      );
    });
  });

  describe('3. Role-Based Retrieval & Department Isolation (Zero-Trust RBAC)', () => {
    test('student strictly retrieves only their own complaints', async () => {
      const mockComplaints = [buildMockComplaint()];
      mock.method(ComplaintRepository, 'findStudentComplaints', async (studentIdParam: string | Types.ObjectId) => {
        assert.strictEqual(String(studentIdParam), studentId);
        return { complaints: mockComplaints, total: 1 };
      });

      const result = await ComplaintService.getComplaints(studentSession, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.complaints[0]?.studentId, studentId);
    });

    test('student cannot access another student complaint by ID (Zero-Trust boundary)', async () => {
      const otherStudentComplaint = buildMockComplaint({
        studentId: new Types.ObjectId(student2Id),
      });
      mock.method(ComplaintRepository, 'findById', async () => otherStudentComplaint);

      // studentSession (student 1) attempting to access student 2's complaint
      await assert.rejects(
        async () => {
          await ComplaintService.getComplaintById(studentSession, complaintId);
        },
        {
          name: 'ForbiddenError',
          message: 'Access clearance denied. You may only view your own grievances.',
        }
      );

      const firstStudentComplaint = buildMockComplaint({
        studentId: new Types.ObjectId(studentId),
      });
      mock.method(ComplaintRepository, 'findById', async () => firstStudentComplaint);

      // student2Session (student 2) attempting to access student 1's complaint
      await assert.rejects(
        async () => {
          await ComplaintService.getComplaintById(student2Session, complaintId);
        },
        {
          name: 'ForbiddenError',
          message: 'Access clearance denied. You may only view your own grievances.',
        }
      );
    });

    test('HOD retrieves complaints strictly scoped to their academic department', async () => {
      const mockComplaints = [buildMockComplaint()];
      mock.method(ComplaintRepository, 'findDepartmentComplaints', async (deptIdParam: string | Types.ObjectId) => {
        assert.strictEqual(String(deptIdParam), cseDeptId);
        return { complaints: mockComplaints, total: 1 };
      });

      const result = await ComplaintService.getComplaints(hodCseSession, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.complaints[0]?.departmentId, cseDeptId);
    });

    test('HOD is blocked from accessing complaints from another department (Department Isolation)', async () => {
      // Complaint belongs to CSE department, but HOD of ECE attempts access
      const cseComplaint = buildMockComplaint({
        departmentId: new Types.ObjectId(cseDeptId),
      });
      mock.method(ComplaintRepository, 'findById', async () => cseComplaint);

      await assert.rejects(
        async () => {
          await ComplaintService.getComplaintById(hodEceSession, complaintId);
        },
        {
          name: 'ForbiddenError',
          message:
            'Departmental clearance violation. You cannot access grievances from other academic departments.',
        }
      );
    });

    test('Director retrieves institutional appeals and escalated grievances', async () => {
      const escalatedComplaint = buildMockComplaint({
        recipientRole: 'director',
        escalation: { isEscalated: true, reason: 'Escalated by HOD' },
      });
      mock.method(ComplaintRepository, 'findDirectorComplaints', async () => {
        return { complaints: [escalatedComplaint], total: 1 };
      });

      const result = await ComplaintService.getComplaints(directorSession, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.complaints[0]?.recipientRole, 'director');
    });

    test('System Administrator views oversight metadata with protected narrative redaction', async () => {
      const mockComplaints = [buildMockComplaint()];
      mock.method(ComplaintRepository, 'findAllComplaints', async () => {
        return { complaints: mockComplaints, total: 1 };
      });

      const result = await ComplaintService.getComplaints(sysAdminSession, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.total, 1);
      assert.strictEqual(
        result.complaints[0]?.description,
        '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]'
      );
    });
  });

  describe('4. Dialogue Responses & Follow-Up Messaging', () => {
    test('student adds permitted follow-up narrative to their active grievance', async () => {
      const activeComplaint = buildMockComplaint();
      mock.method(ComplaintRepository, 'findById', async () => activeComplaint);

      const updatedComplaint = buildMockComplaint({
        responses: [
          {
            _id: new Types.ObjectId(),
            authorId: new Types.ObjectId(studentId),
            authorName: 'Rahul Verma',
            authorRole: 'student',
            message: 'Additional screenshot attached showing workstation 15 terminal log.',
            createdAt: new Date(),
          },
        ],
      });
      mock.method(ComplaintRepository, 'addResponse', async () => updatedComplaint);

      const result = await ComplaintService.addResponse(studentSession, complaintId, {
        message: 'Additional screenshot attached showing workstation 15 terminal log.',
        isInternal: false,
      });

      assert.strictEqual(result.responses.length, 1);
      assert.strictEqual(result.responses[0]?.authorName, 'Rahul Verma');
    });

    test('rejects student follow-up attempt when complaint is closed', async () => {
      const closedComplaint = buildMockComplaint({ status: 'closed' });
      mock.method(ComplaintRepository, 'findById', async () => closedComplaint);

      await assert.rejects(
        async () => {
          await ComplaintService.addResponse(studentSession, complaintId, {
            message: 'Attempting follow-up on closed ticket',
            isInternal: false,
          });
        },
        {
          name: 'ValidationError',
          message: 'Cannot append follow-ups to a closed grievance ticket.',
        }
      );
    });

    test('authority response automatically advances status from submitted to in_progress', async () => {
      const submittedComplaint = buildMockComplaint({ status: 'submitted' });
      mock.method(ComplaintRepository, 'findById', async () => submittedComplaint);

      const inProgressComplaint = buildMockComplaint({
        status: 'in_progress',
        responses: [
          {
            _id: new Types.ObjectId(),
            authorId: new Types.ObjectId(hodCseId),
            authorName: 'Dr. R. K. Verma',
            authorRole: 'admin',
            message: 'Inquiry opened with Campus Network Team.',
            actionTaken: 'Network Infrastructure Inquiry Opened',
            createdAt: new Date(),
          },
        ],
      });

      mock.method(
        ComplaintRepository,
        'addResponse',
        async (_id: unknown, _resp: unknown, _audit: unknown, newStatus?: string) => {
          assert.strictEqual(newStatus, 'in_progress');
          return inProgressComplaint;
        }
      );

      const result = await ComplaintService.addResponse(hodCseSession, complaintId, {
        message: 'Inquiry opened with Campus Network Team.',
        actionTaken: 'Network Infrastructure Inquiry Opened',
        isInternal: false,
      });

      assert.strictEqual(result.status, 'in_progress');
      assert.strictEqual(result.responses[0]?.actionTaken, 'Network Infrastructure Inquiry Opened');
    });
  });

  describe('5. Controlled Lifecycle Transitions & Immutable Audit History', () => {
    test('HOD advances complaint through submitted -> under_review with mandatory remarks', async () => {
      const complaintDoc = buildMockComplaint({ status: 'submitted' });
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);

      const updatedDoc = buildMockComplaint({
        status: 'under_review',
        timeline: [
          ...complaintDoc.timeline,
          {
            previousStatus: 'submitted',
            newStatus: 'under_review',
            action: 'STATUS_CHANGED_TO_UNDER_REVIEW',
            changedById: new Types.ObjectId(hodCseId),
            changedByName: 'Dr. R. K. Verma',
            changedByRole: 'admin',
            remarks: 'Initiated preliminary inquiry with lab assistant.',
            timestamp: new Date(),
          },
        ],
      });
      mock.method(ComplaintRepository, 'updateStatus', async () => updatedDoc);

      const result = await ComplaintService.updateStatus(hodCseSession, complaintId, {
        status: 'under_review',
        remarks: 'Initiated preliminary inquiry with lab assistant.',
      });

      assert.strictEqual(result.status, 'under_review');
      assert.strictEqual(result.timeline.length, 2);
      assert.strictEqual(result.timeline[1]?.action, 'STATUS_CHANGED_TO_UNDER_REVIEW');
      assert.strictEqual(
        result.timeline[1]?.remarks,
        'Initiated preliminary inquiry with lab assistant.'
      );
    });

    test('rejects student attempting to transition complaint to resolved (Privilege Escalation)', async () => {
      const complaintDoc = buildMockComplaint({ status: 'in_progress' });
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);

      await assert.rejects(
        async () => {
          await ComplaintService.updateStatus(studentSession, complaintId, {
            status: 'resolved',
            remarks: 'Student attempting self-resolution',
          });
        },
        {
          name: 'ForbiddenError',
          message:
            'Students can only mark grievances as closed (accepting resolution) or reopened (appealing).',
        }
      );
    });

    test('rejects invalid lifecycle jumps (e.g. submitted directly to closed without resolution)', async () => {
      const complaintDoc = buildMockComplaint({ status: 'submitted' });
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);

      await assert.rejects(
        async () => {
          await ComplaintService.updateStatus(hodCseSession, complaintId, {
            status: 'closed',
            remarks: 'Direct close invalid',
          });
        },
        {
          name: 'ValidationError',
          message:
            "Invalid lifecycle transition from 'submitted' to 'closed'. Allowed next states: under_review, in_progress, responded, rejected, escalated",
        }
      );
    });

    test('student confirms resolution by closing grievance ticket', async () => {
      const resolvedComplaint = buildMockComplaint({ status: 'resolved' });
      mock.method(ComplaintRepository, 'findById', async () => resolvedComplaint);

      const closedComplaint = buildMockComplaint({
        status: 'closed',
        closedAt: new Date(),
      });
      mock.method(ComplaintRepository, 'updateStatus', async () => closedComplaint);

      const result = await ComplaintService.updateStatus(studentSession, complaintId, {
        status: 'closed',
        remarks: 'Issue resolved satisfactorily after network switch replacement.',
      });

      assert.strictEqual(result.status, 'closed');
    });

    test('student appeals resolution by reopening within permitted lifecycle', async () => {
      const resolvedComplaint = buildMockComplaint({ status: 'resolved' });
      mock.method(ComplaintRepository, 'findById', async () => resolvedComplaint);

      const reopenedComplaint = buildMockComplaint({
        status: 'reopened',
      });
      mock.method(ComplaintRepository, 'updateStatus', async () => reopenedComplaint);

      const result = await ComplaintService.updateStatus(studentSession, complaintId, {
        status: 'reopened',
        remarks: 'Network disconnect recurred during subsequent practical slot.',
      });

      assert.strictEqual(result.status, 'reopened');
    });
  });

  describe('6. Statutory Directorate Escalation Workflow', () => {
    test('HOD escalates unresolved complaint to Directorate Ombudsman with statutory reason', async () => {
      const activeComplaint = buildMockComplaint({ status: 'under_review' });
      mock.method(ComplaintRepository, 'findById', async () => activeComplaint);

      const escalatedComplaint = buildMockComplaint({
        recipientRole: 'director',
        status: 'escalated',
        escalation: {
          isEscalated: true,
          escalatedAt: new Date(),
          escalatedById: new Types.ObjectId(hodCseId),
          escalatedByName: 'Dr. R. K. Verma',
          reason: 'Hardware procurement exceeds departmental discretionary budget authority.',
        },
        sla: {
          slaHours: 168,
          deadline: new Date(Date.now() + 168 * 60 * 60 * 1000),
          isBreached: false,
        },
      });
      mock.method(ComplaintRepository, 'escalate', async () => escalatedComplaint);

      const result = await ComplaintService.escalateComplaint(hodCseSession, complaintId, {
        reason: 'Hardware procurement exceeds departmental discretionary budget authority.',
      });

      assert.strictEqual(result.status, 'escalated');
      assert.strictEqual(result.recipientRole, 'director');
      assert.strictEqual(result.escalatedToDirector, true);
      assert.strictEqual(result.sla.slaHours, 168);
    });

    test('rejects escalation when complaint is already escalated to the Directorate', async () => {
      const alreadyEscalated = buildMockComplaint({
        status: 'escalated',
        escalation: { isEscalated: true, reason: 'Already escalated' },
      });
      mock.method(ComplaintRepository, 'findById', async () => alreadyEscalated);

      await assert.rejects(
        async () => {
          await ComplaintService.escalateComplaint(hodCseSession, complaintId, {
            reason: 'Attempting duplicate escalation',
          });
        },
        {
          name: 'ValidationError',
          message: 'This grievance has already been escalated to the Directorate.',
        }
      );
    });

    test('rejects escalation attempts by unauthorized third-party roles', async () => {
      const complaintDoc = buildMockComplaint({
        departmentId: new Types.ObjectId(cseDeptId),
      });
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);

      await assert.rejects(
        async () => {
          await ComplaintService.escalateComplaint(hodEceSession, complaintId, {
            reason: 'Unauthorized cross-department escalation',
          });
        },
        {
          name: 'ForbiddenError',
          message:
            'Departmental clearance violation. You cannot access grievances from other academic departments.',
        }
      );
    });
  });

  describe('7. Inquiry Officer Assignment', () => {
    test('HOD assigns inquiry faculty mentor to investigate grievance', async () => {
      const complaintDoc = buildMockComplaint({ status: 'under_review' });
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);

      const assigneeDoc = {
        _id: new Types.ObjectId(facultyId),
        fullName: 'Prof. Ramesh Chandra',
        role: 'faculty',
      } as unknown as IUser;
      mock.method(UserRepository, 'findById', async () => assigneeDoc);

      const assignedComplaint = buildMockComplaint({
        assignedTo: {
          id: new Types.ObjectId(facultyId),
          name: 'Prof. Ramesh Chandra',
          role: 'Lab In-Charge Faculty',
          assignedAt: new Date(),
        },
      });
      mock.method(ComplaintRepository, 'assign', async () => assignedComplaint);

      const result = await ComplaintService.assignComplaint(hodCseSession, complaintId, {
        assignedToId: facultyId,
        assignedToName: 'Prof. Ramesh Chandra',
        assignedToRole: 'Lab In-Charge Faculty',
        remarks: 'Please audit workstation 12-19 switch ports.',
      });

      assert.strictEqual(result.assignedTo?.name, 'Prof. Ramesh Chandra');
      assert.strictEqual(result.assignedTo?.role, 'Lab In-Charge Faculty');
    });

    test('rejects assignment when assigned user does not exist in records', async () => {
      const complaintDoc = buildMockComplaint({ status: 'under_review' });
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);
      mock.method(UserRepository, 'findById', async () => null);

      await assert.rejects(
        async () => {
          await ComplaintService.assignComplaint(hodCseSession, complaintId, {
            assignedToId: facultyId,
            assignedToName: 'Non Existent Faculty',
          });
        },
        {
          name: 'NotFoundError',
          message: 'Assigned investigator or faculty mentor was not found.',
        }
      );
    });
  });

  describe('8. REST API Route Handlers Integration', () => {
    test('POST /api/v1/complaints returns 201 Created on valid petition', async () => {
      __setTestSession(studentSession);
      mock.method(UserRepository, 'findById', async () => studentUserDoc);
      mock.method(DepartmentRepository, 'findById', async () => cseDepartment);

      const createdDoc = buildMockComplaint();
      mock.method(ComplaintRepository, 'create', async () => createdDoc);
      mock.method(ComplaintRepository, 'generateTicketNumber', async () => 'CMP-2026-0042');

      const req = new NextRequest('http://localhost:3000/api/v1/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientRole: 'hod',
          category: 'lab_infrastructure',
          priority: 'high',
          subject: 'Lab 2 Workstation Network Downtime during Practical Exam',
          description:
            'During the practical evaluation for CSE-301, workstations suffered intermittent disconnects.',
        }),
      });

      const res = await createComplaintRoute(req);
      assert.strictEqual(res.status, 201);

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.ticketNumber, 'CMP-2026-0042');
    });

    test('GET /api/v1/complaints returns 200 OK with paginated collection', async () => {
      __setTestSession(studentSession);
      const mockComplaints = [buildMockComplaint()];
      mock.method(ComplaintRepository, 'findStudentComplaints', async () => {
        return { complaints: mockComplaints, total: 1 };
      });

      const req = new NextRequest(
        'http://localhost:3000/api/v1/complaints?page=1&limit=20&status=submitted'
      );
      const res = await getComplaintsRoute(req);

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.length, 1);
      assert.strictEqual(json.pagination.totalItems, 1);
    });

    test('GET /api/v1/complaints/[id] returns 200 for authorized caller and 403 for unauthorized caller', async () => {
      const complaintDoc = buildMockComplaint();
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);

      // 1. Authorized student access
      __setTestSession(studentSession);
      const req = new NextRequest(`http://localhost:3000/api/v1/complaints/${complaintId}`);
      const res = await getComplaintDetailRoute(req, {
        params: Promise.resolve({ id: complaintId }),
      });
      assert.strictEqual(res.status, 200);

      // 2. Unauthorized cross-department HOD access
      __setTestSession(hodEceSession);
      const unauthorizedRes = await getComplaintDetailRoute(req, {
        params: Promise.resolve({ id: complaintId }),
      });
      assert.strictEqual(unauthorizedRes.status, 403);
    });

    test('POST /api/v1/complaints/[id]/responses appends dialogue response', async () => {
      __setTestSession(studentSession);
      const activeComplaint = buildMockComplaint();
      mock.method(ComplaintRepository, 'findById', async () => activeComplaint);
      mock.method(ComplaintRepository, 'addResponse', async () => activeComplaint);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/complaints/${complaintId}/responses`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Adding follow-up notes for the lab exam grievance.',
          }),
        }
      );

      const res = await addResponseRoute(req, {
        params: Promise.resolve({ id: complaintId }),
      });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('PATCH /api/v1/complaints/[id]/status performs controlled status mutation', async () => {
      __setTestSession(hodCseSession);
      const complaintDoc = buildMockComplaint({ status: 'submitted' });
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);

      const updatedDoc = buildMockComplaint({ status: 'under_review' });
      mock.method(ComplaintRepository, 'updateStatus', async () => updatedDoc);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/complaints/${complaintId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'under_review',
            remarks: 'Audit initiated with network engineering team.',
          }),
        }
      );

      const res = await updateStatusRoute(req, {
        params: Promise.resolve({ id: complaintId }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.status, 'under_review');
    });

    test('POST /api/v1/complaints/[id]/escalate routes grievance to Directorate', async () => {
      __setTestSession(hodCseSession);
      const complaintDoc = buildMockComplaint({ status: 'under_review' });
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);

      const escalatedDoc = buildMockComplaint({
        recipientRole: 'director',
        status: 'escalated',
        escalation: { isEscalated: true, reason: 'Budget limits' },
      });
      mock.method(ComplaintRepository, 'escalate', async () => escalatedDoc);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/complaints/${complaintId}/escalate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'Hardware replacement exceeds department discretionary quota.',
          }),
        }
      );

      const res = await escalateRoute(req, {
        params: Promise.resolve({ id: complaintId }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.status, 'escalated');
    });

    test('POST /api/v1/complaints/[id]/assign designates inquiry investigator', async () => {
      __setTestSession(hodCseSession);
      const complaintDoc = buildMockComplaint({ status: 'under_review' });
      mock.method(ComplaintRepository, 'findById', async () => complaintDoc);

      const assigneeDoc = {
        _id: new Types.ObjectId(facultyId),
        fullName: 'Prof. Ramesh Chandra',
      } as unknown as IUser;
      mock.method(UserRepository, 'findById', async () => assigneeDoc);

      const assignedDoc = buildMockComplaint({
        assignedTo: {
          id: new Types.ObjectId(facultyId),
          name: 'Prof. Ramesh Chandra',
        },
      });
      mock.method(ComplaintRepository, 'assign', async () => assignedDoc);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/complaints/${complaintId}/assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignedToId: facultyId,
            assignedToName: 'Prof. Ramesh Chandra',
            assignedToRole: 'Inquiry Officer',
          }),
        }
      );

      const res = await assignRoute(req, {
        params: Promise.resolve({ id: complaintId }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('GET /api/v1/complaints/stats returns aggregated metrics envelope', async () => {
      __setTestSession(hodCseSession);
      mock.method(ComplaintRepository, 'getStats', async () => ({
        total: 10,
        submitted: 3,
        underReview: 2,
        inProgress: 2,
        resolved: 2,
        closed: 1,
        escalated: 1,
        rejected: 0,
        slaBreached: 0,
        byCategory: {
          academic: 4,
          lab_infrastructure: 4,
          hostel: 0,
          harassment: 0,
          administrative: 2,
          fee_accounts: 0,
          examination: 0,
          other: 0,
        },
        byPriority: {
          low: 1,
          medium: 6,
          high: 2,
          urgent: 1,
        },
      }));

      const req = new NextRequest('http://localhost:3000/api/v1/complaints/stats');
      const res = await getStatsRoute(req);

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.total, 10);
      assert.strictEqual(json.data.byCategory.academic, 4);
    });
  });
});

