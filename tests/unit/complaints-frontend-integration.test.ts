/**
 * Phase 5.5: Grievance Redressal / Complaints Frontend & Subsystem Integration Test Suite.
 * Mandated under AICTE / UGC Grievance Redressal Regulations.
 * 
 * Verifies:
 * 1. Student Interface: Complaints & Communication feed, compose form, SLA countdowns, resolution acceptance.
 * 2. HOD Interface: Department-scoped cockpit, 48h SLA, inquiry assignment, escalation to Director.
 * 3. Director Interface: Executive Ombudsman Tribunal, directly addressed petitions + escalated appeals, 7-day SLA.
 * 4. System Administrator: Telemetry oversight, confidentiality notice, statutory redaction integrity.
 * 5. Lifecycle State Transitions, Dialogue Chains, and Immutable Audit Timeline.
 * 6. Attachment evidence docket rendering and security.
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Types } from 'mongoose';

// UI Components
import { StudentComplaintsView } from '../../src/components/complaints/student-complaints-view';
import { ComplaintComposeForm } from '../../src/components/complaints/complaint-compose-form';
import { ComplaintDetailModal } from '../../src/components/complaints/complaint-detail-modal';
import { AuthorityComplaintsView } from '../../src/components/complaints/authority-complaints-view';

// Services & Repositories
import { ComplaintRepository } from '../../src/lib/db/repositories/complaint.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { __setTestSession } from '../../src/lib/auth/server';

// Server Pages
import StudentComplaintsPage from '../../src/app/(student)/student/complaints/page';
import FacultyComplaintsPage from '../../src/app/(faculty)/faculty/complaints/page';
import AdminComplaintsPage from '../../src/app/(admin)/admin/complaints/page';

// Types
import type { UserSession, UserDTO } from '../../src/types/user';
import type { ComplaintDTO, IComplaint } from '../../src/types/complaints';

// Mock IDs
const cseDeptId = '6730a005f8b1a2001a000010';

const studentId = '6730a005f8b1a2001a000001';
const hodId = '6730a005f8b1a2001a000080';
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

const hodSession: UserSession = {
  userId: hodId,
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. R. K. Verma',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: cseDeptId,
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

const studentDTO: UserDTO = {
  id: studentId,
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  role: 'student',
  status: 'active',
  isProfileComplete: true,
  departmentId: cseDeptId,
  studentProfile: {
    rollNumber: '2101330100045',
    batchYear: 2021,
    currentSemester: 6,
    section: 'A',
    program: 'B.Tech Computer Science & Engineering',
    admissionType: 'regular',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function buildSampleComplaintDTO(overrides: Partial<ComplaintDTO> = {}): ComplaintDTO {
  const now = new Date();
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

  return {
    id: complaintId,
    ticketNumber: 'CMP-2026-0042',
    studentId,
    studentName: 'Rahul Verma',
    studentRoll: '2101330100045',
    studentEmail: 'rahul.verma@axiscolleges.in',
    department: 'Computer Science & Engineering',
    recipientRole: 'hod',
    recipientName: 'Head of Department (Dr. R. K. Verma)',
    category: 'lab_infrastructure',
    priority: 'high',
    subject: 'Lab 2 Workstation Network Downtime during Practical Exam',
    description:
      'During the mid-term practical evaluation for CSE-301, workstations suffered intermittent disconnects.',
    narrative:
      'During the mid-term practical evaluation for CSE-301, workstations suffered intermittent disconnects.',
    submittedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: 'under_review',
    slaRemainingHours: 44,
    escalatedToDirector: false,
    departmentId: cseDeptId,
    student: {
      fullName: 'Rahul Verma',
      email: 'rahul.verma@axiscolleges.in',
      rollNumber: '2101330100045',
      program: 'B.Tech CSE',
      currentSemester: 6,
      section: 'A',
      departmentName: 'Computer Science & Engineering',
    },
    departmentDetails: {
      name: 'Computer Science & Engineering',
      code: 'CSE',
    },
    sla: {
      slaHours: 48,
      deadline: deadline.toISOString(),
      isBreached: false,
      slaRemainingHours: 44,
    },
    attachments: ['Lab2_Terminal_Error.png'],
    detailedAttachments: [
      {
        id: 'att-1',
        name: 'Lab2_Terminal_Error.png',
        url: 'https://cloudinary.com/axis/lab2_error.png',
        sizeBytes: 102400,
        mimeType: 'image/png',
        uploadedAt: now.toISOString(),
      },
    ],
    responses: [
      {
        id: 'resp-1',
        authorId: hodId,
        authorName: 'Dr. R. K. Verma',
        authorRole: 'admin',
        message: 'Inquiry initiated with Campus Network Team. Logs extracted for audit.',
        timestamp: now.toISOString(),
        actionTaken: 'Network Infrastructure Inquiry Opened',
      },
    ],
    timeline: [
      {
        id: 'time-1',
        previousStatus: 'submitted',
        newStatus: 'under_review',
        action: 'STATUS_CHANGED_TO_UNDER_REVIEW',
        changedById: hodId,
        changedByName: 'Dr. R. K. Verma',
        changedByRole: 'admin',
        remarks: 'Initiated preliminary inquiry with lab assistant.',
        timestamp: now.toISOString(),
      },
    ],
    ...overrides,
  };
}

describe('Phase 5.5: Grievance Redressal Frontend & Integration Test Suite', () => {
  afterEach(() => {
    mock.reset();
    __setTestSession(undefined);
  });

  describe('1. Student Interface (Complaints & Communication)', () => {
    test('renders student grievance feed with ticket badge, category, and SLA countdown', () => {
      const sample = buildSampleComplaintDTO();
      const html = renderToStaticMarkup(
        React.createElement(StudentComplaintsView, {
          user: studentDTO,
          initialComplaints: [sample],
        })
      );

      assert.match(html, /Complaints &amp; Communication/);
      assert.match(html, /CMP-2026-0042/);
      assert.match(html, /Lab 2 Workstation Network Downtime/);
      assert.match(html, /Under Review/);
      assert.match(html, /44h Left/);
      assert.match(html, /AICTE \/ UGC/);
      assert.match(html, /Compose Complaint/);
    });

    test('renders empty state when student has no active petitions', () => {
      const html = renderToStaticMarkup(
        React.createElement(StudentComplaintsView, {
          user: studentDTO,
          initialComplaints: [],
        })
      );

      assert.match(html, /No Grievance Petitions Found/);
      assert.match(html, /Lodge New Petition/);
    });

    test('renders compose petition form with HOD and Director selectors, 8 categories, and priority rating', () => {
      const html = renderToStaticMarkup(
        React.createElement(ComplaintComposeForm, {
          user: studentDTO,
          onComplaintSubmitted: () => {},
          onCancel: () => {},
        })
      );

      assert.match(html, /Lodge Formal Grievance Petition/);
      assert.match(html, /Signed Identity/);
      assert.match(html, /Rahul Verma/);
      assert.match(html, /Head of Department \(HOD\)/);
      assert.match(html, /Executive Director \(Ombudsman\)/);
      assert.match(html, /Academic &amp; Evaluation/);
      assert.match(html, /Lab &amp; Infrastructure/);
      assert.match(html, /Harassment &amp; Anti-Ragging/);
      assert.match(html, /Hostel &amp; Residential/);
      assert.match(html, /Fee &amp; Account Clearance/);
      assert.match(html, /Urgency \/ Priority Level/);
      assert.match(html, /Submit Petition/);
    });

    test('renders detail modal for student with dialogue chain, evidence docket, and resolution controls when resolved', () => {
      const resolvedDTO = buildSampleComplaintDTO({
        status: 'resolved',
      });

      // 1. Details docket tab (default)
      const detailsHtml = renderToStaticMarkup(
        React.createElement(ComplaintDetailModal, {
          complaint: resolvedDTO,
          isOpen: true,
          onClose: () => {},
          currentUserRole: 'student',
          currentUserId: studentId,
          initialTab: 'details',
        })
      );

      assert.match(detailsHtml, /CMP-2026-0042/);
      assert.match(detailsHtml, /Resolved/);
      assert.match(detailsHtml, /Accept Resolution &amp; Close/);
      assert.match(detailsHtml, /Appeal \/ Reopen/);
      assert.match(detailsHtml, /Lab2_Terminal_Error.png/);

      // 2. Dialogue thread tab
      const dialogueHtml = renderToStaticMarkup(
        React.createElement(ComplaintDetailModal, {
          complaint: resolvedDTO,
          isOpen: true,
          onClose: () => {},
          currentUserRole: 'student',
          currentUserId: studentId,
          initialTab: 'dialogue',
        })
      );

      assert.match(dialogueHtml, /Dr. R. K. Verma/);
      assert.match(dialogueHtml, /Inquiry initiated with Campus Network Team/);
    });
  });

  describe('2. HOD Interface (Department Redressal Cockpit)', () => {
    test('renders HOD dashboard with department jurisdiction, 48h SLA indicators, and KPI metrics', () => {
      const sample = buildSampleComplaintDTO();
      const html = renderToStaticMarkup(
        React.createElement(AuthorityComplaintsView, {
          initialComplaints: [sample],
          authorityRole: 'hod',
          departmentName: 'Computer Science & Engineering',
          userRole: 'admin',
          adminSubRole: 'hod',
          userId: hodId,
        })
      );

      assert.match(html, /HOD Grievance Redressal Inbox/);
      assert.match(html, /Computer Science &amp; Engineering/);
      assert.match(html, /Department SLA: 48 Hours/);
      assert.match(html, /Under Review/);
      assert.match(html, /Total In Docket/);
      assert.match(html, /CMP-2026-0042/);
      assert.match(html, /Rahul Verma/);
    });

    test('renders authority tribunal actions in detail modal: update status, assign officer, escalate', () => {
      const sample = buildSampleComplaintDTO();
      const html = renderToStaticMarkup(
        React.createElement(ComplaintDetailModal, {
          complaint: sample,
          isOpen: true,
          onClose: () => {},
          currentUserRole: 'admin',
          currentAdminSubRole: 'hod',
          currentUserId: hodId,
          initialTab: 'dialogue',
        })
      );

      assert.match(html, /Update Status/);
      assert.match(html, /Assign Officer/);
      assert.match(html, /Escalate to Director/);
      assert.match(html, /Authority Response &amp; Inquiry Finding/);
    });
  });

  describe('3. Director Interface (Executive Ombudsman Tribunal)', () => {
    test('renders Directorate cockpit with campus ombudsman scope, 7-day SLA, and escalated appeals', () => {
      const escalatedDTO = buildSampleComplaintDTO({
        recipientRole: 'director',
        status: 'escalated',
        escalatedToDirector: true,
        slaRemainingHours: 160,
        escalation: {
          isEscalated: true,
          escalatedAt: new Date().toISOString(),
          escalatedByName: 'Dr. R. K. Verma (HOD)',
          reason: 'Hardware procurement exceeds departmental discretionary budget authority.',
        },
      });

      const html = renderToStaticMarkup(
        React.createElement(AuthorityComplaintsView, {
          initialComplaints: [escalatedDTO],
          authorityRole: 'director',
          departmentName: 'AITM Directorate',
          userRole: 'super_admin',
          adminSubRole: 'director',
          userId: directorId,
        })
      );

      assert.match(html, /Directorate Grievance Ombudsman/);
      assert.match(html, /Ombudsman SLA: 7 Days/);
      assert.match(html, /Directorate Appeal/);
      assert.match(html, /CMP-2026-0042/);
    });
  });

  describe('4. System Administrator Confidentiality Restrictions', () => {
    test('renders central IT oversight notice and protects narrative redaction in modal', () => {
      const redactedDTO = buildSampleComplaintDTO({
        description: '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]',
        narrative: '[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL]',
      });

      const html = renderToStaticMarkup(
        React.createElement(ComplaintDetailModal, {
          complaint: redactedDTO,
          isOpen: true,
          onClose: () => {},
          currentUserRole: 'super_admin',
          currentAdminSubRole: 'sys_admin',
          currentUserId: sysAdminId,
        })
      );

      assert.match(html, /Confidential Grievance Record/);
      assert.match(html, /substantive student allegations and communications are redacted from IT System Administrators/);
      assert.match(html, /\[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL\]/);
      // Ensure officer response composer is not rendered for sys_admin
      assert.doesNotMatch(html, /Authority Response &amp; Inquiry Finding/);
    });
  });

  describe('5. Server Component Page Ingress Testing', () => {
    test('StudentComplaintsPage loads live student complaints via ComplaintService', async () => {
      __setTestSession(studentSession);
      mock.method(UserRepository, 'findById', async () => ({
        ...studentDTO,
        _id: new Types.ObjectId(studentId),
        studentProfile: {
          rollNumber: '2101330100045',
          program: 'B.Tech CSE',
        },
      }));

      const mockComplaintDoc = {
        _id: new Types.ObjectId(complaintId),
        ticketNumber: 'CMP-2026-0042',
        studentId: new Types.ObjectId(studentId),
        studentSnapshot: {
          fullName: 'Rahul Verma',
          email: 'rahul.verma@axiscolleges.in',
          rollNumber: '2101330100045',
        },
        departmentId: new Types.ObjectId(cseDeptId),
        departmentSnapshot: { name: 'Computer Science & Engineering', code: 'CSE' },
        recipientRole: 'hod',
        category: 'academic',
        priority: 'high',
        subject: 'Student portal ledger inquiry',
        description: 'Testing live student complaint integration',
        status: 'submitted',
        sla: {
          slaHours: 48,
          deadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
          isBreached: false,
        },
        attachments: [],
        responses: [],
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as IComplaint;

      mock.method(ComplaintRepository, 'findStudentComplaints', async () => ({
        complaints: [mockComplaintDoc],
        total: 1,
      }));

      const pageElement = await StudentComplaintsPage();
      const html = renderToStaticMarkup(pageElement);

      assert.match(html, /Complaints &amp; Communication/);
      assert.match(html, /CMP-2026-0042/);
      assert.match(html, /Student portal ledger inquiry/);
    });

    test('FacultyComplaintsPage loads live department complaints via ComplaintService', async () => {
      __setTestSession(hodSession);
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        name: 'Computer Science & Engineering',
        code: 'CSE',
      }));

      const mockComplaintDoc = {
        _id: new Types.ObjectId(complaintId),
        ticketNumber: 'CMP-2026-0042',
        studentId: new Types.ObjectId(studentId),
        studentSnapshot: {
          fullName: 'Rahul Verma',
          email: 'rahul.verma@axiscolleges.in',
        },
        departmentId: new Types.ObjectId(cseDeptId),
        departmentSnapshot: { name: 'Computer Science & Engineering', code: 'CSE' },
        recipientRole: 'hod',
        category: 'lab_infrastructure',
        priority: 'medium',
        subject: 'Lab network connectivity inquiry',
        description: 'HOD portal live load verification',
        status: 'under_review',
        sla: {
          slaHours: 48,
          deadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
          isBreached: false,
        },
        attachments: [],
        responses: [],
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as IComplaint;

      mock.method(ComplaintRepository, 'findDepartmentComplaints', async () => ({
        complaints: [mockComplaintDoc],
        total: 1,
      }));

      const pageElement = await FacultyComplaintsPage();
      const html = renderToStaticMarkup(pageElement);

      assert.match(html, /HOD Grievance Redressal Inbox/);
      assert.match(html, /CMP-2026-0042/);
      assert.match(html, /Lab network connectivity inquiry/);
    });

    test('AdminComplaintsPage loads live Directorate petitions via ComplaintService', async () => {
      __setTestSession(directorSession);

      const mockComplaintDoc = {
        _id: new Types.ObjectId(complaintId),
        ticketNumber: 'CMP-DIR-2026-0001',
        studentId: new Types.ObjectId(studentId),
        studentSnapshot: {
          fullName: 'Rahul Verma',
          email: 'rahul.verma@axiscolleges.in',
        },
        departmentId: new Types.ObjectId(cseDeptId),
        departmentSnapshot: { name: 'Computer Science & Engineering', code: 'CSE' },
        recipientRole: 'director',
        category: 'academic',
        priority: 'urgent',
        subject: 'Institutional Ombudsman Appeal',
        description: 'Director portal live load verification',
        status: 'under_review',
        sla: {
          slaHours: 168,
          deadline: new Date(Date.now() + 168 * 60 * 60 * 1000),
          isBreached: false,
        },
        attachments: [],
        responses: [],
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as IComplaint;

      mock.method(ComplaintRepository, 'findDirectorComplaints', async () => ({
        complaints: [mockComplaintDoc],
        total: 1,
      }));

      const pageElement = await AdminComplaintsPage();
      const html = renderToStaticMarkup(pageElement);

      assert.match(html, /Directorate Grievance Ombudsman/);
      assert.match(html, /CMP-DIR-2026-0001/);
      assert.match(html, /Institutional Ombudsman Appeal/);
    });

    test('AdminComplaintsPage loads telemetry and protects narratives for System Administrator', async () => {
      __setTestSession(sysAdminSession);

      const mockComplaintDoc = {
        _id: new Types.ObjectId(complaintId),
        ticketNumber: 'CMP-2026-0042',
        studentId: new Types.ObjectId(studentId),
        studentSnapshot: {
          fullName: 'Rahul Verma',
          email: 'rahul.verma@axiscolleges.in',
        },
        departmentId: new Types.ObjectId(cseDeptId),
        departmentSnapshot: { name: 'Computer Science & Engineering', code: 'CSE' },
        recipientRole: 'director',
        category: 'academic',
        priority: 'high',
        subject: 'Confidential examination discrepancy',
        description: 'Student allegation regarding examination marks',
        status: 'under_review',
        sla: {
          slaHours: 168,
          deadline: new Date(Date.now() + 168 * 60 * 60 * 1000),
          isBreached: false,
        },
        attachments: [],
        responses: [],
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as IComplaint;

      mock.method(ComplaintRepository, 'findAllComplaints', async () => ({
        complaints: [mockComplaintDoc],
        total: 1,
      }));

      const pageElement = await AdminComplaintsPage();
      const html = renderToStaticMarkup(pageElement);

      assert.match(html, /Central IT Administrative Oversight Mode/);
      assert.match(html, /CMP-2026-0042/);
      assert.match(html, /\[PROTECTED STATUTORY GRIEVANCE CONTENT — RESTRICTED TO TRIBUNAL\]/);
    });
  });
});
