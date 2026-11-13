import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { AuthorityComplaintsView } from '@/components/complaints';
import type { ComplaintTicket } from '@/types/complaints';

export const metadata: Metadata = {
  title: 'HOD Grievance Redressal Inbox | Axis LinkUp',
  description: 'AICTE / UGC Tier-1 Department Student Grievance Adjudication.',
};

const DEPARTMENT_COMPLAINTS: ComplaintTicket[] = [
  {
    id: 'cmp-1',
    ticketNumber: 'CMP-2026-0042',
    studentId: 'std-101',
    studentName: 'Rahul Verma',
    studentRoll: '2101330100045',
    studentEmail: 'rahul.verma@axis.edu.in',
    department: 'Computer Science & Engineering',
    recipientRole: 'hod',
    recipientName: 'Head of Department (Dr. R. K. Verma)',
    category: 'lab_infrastructure',
    subject: 'Lab 2 Workstation Network Downtime during Practical Exam',
    narrative:
      'During the mid-term practical evaluation for CSE-301, workstations 12 through 19 in Lab 2 suffered intermittent network disconnects, preventing code submissions to the internal git server.',
    submittedAt: 'Yesterday, 10:30 AM',
    updatedAt: '6 hours ago',
    status: 'under_review',
    slaRemainingHours: 42,
    attachments: ['Lab2_Terminal_Error.png'],
    responses: [
      {
        id: 'resp-1',
        authorId: 'fac-hod',
        authorName: 'Dr. R. K. Verma',
        authorRole: 'faculty',
        message:
          'Inquiry initiated with Campus Network Team. Network switch logs have been extracted for audit. Students will receive compensatory evaluation time if verified.',
        timestamp: 'Yesterday, 04:15 PM',
        actionTaken: 'Network Infrastructure Inquiry Opened',
      },
    ],
  },
  {
    id: 'cmp-2',
    ticketNumber: 'CMP-2026-0048',
    studentId: 'std-102',
    studentName: 'Priya Verma',
    studentRoll: '2101330100072',
    studentEmail: 'priya.verma@axis.edu.in',
    department: 'Computer Science & Engineering',
    recipientRole: 'hod',
    recipientName: 'Head of Department (Dr. R. K. Verma)',
    category: 'academic',
    subject: 'Request for Extra Remedial Lectures in DBMS Transaction Concurrency',
    narrative:
      'Several students in Batch A are experiencing conceptual difficulties with Two-Phase Locking and Multi-version concurrency protocols prior to end-semester examinations.',
    submittedAt: 'Today, 09:00 AM',
    updatedAt: 'Today, 09:00 AM',
    status: 'submitted',
    slaRemainingHours: 47,
    attachments: [],
    responses: [],
  },
  {
    id: 'cmp-3',
    ticketNumber: 'CMP-2026-0039',
    studentId: 'std-103',
    studentName: 'Pooja Tiwari',
    studentRoll: '2101330100088',
    studentEmail: 'pooja.tiwari@axis.edu.in',
    department: 'Computer Science & Engineering',
    recipientRole: 'hod',
    recipientName: 'Head of Department (Dr. R. K. Verma)',
    category: 'academic',
    subject: 'Discrepancy in Mid-Term Internal Evaluation Marks for CSE-302',
    narrative:
      'My total marks calculated on physical answer sheet evaluated to 26/30, but the college portal ledger displays 22/30.',
    submittedAt: 'Nov 08, 2026',
    updatedAt: 'Nov 10, 2026',
    status: 'resolved',
    slaRemainingHours: 0,
    attachments: ['Answer_Sheet_Scan.pdf'],
    responses: [
      {
        id: 'resp-2',
        authorId: 'fac-hod',
        authorName: 'Dr. R. K. Verma',
        authorRole: 'faculty',
        message:
          'Physical answer script re-checked alongside course instructor Prof. Anjali Sharma. Tabulation error verified and corrected to 26/30 in institutional ledger.',
        timestamp: 'Nov 10, 2026, 02:00 PM',
        actionTaken: 'Ledger Rectification Applied',
      },
    ],
  },
];

export default async function FacultyComplaintsPage() {
  await requireRole(['faculty', 'super_admin']);

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <AuthorityComplaintsView
        initialComplaints={DEPARTMENT_COMPLAINTS}
        authorityRole="hod"
        departmentName="Computer Science & Engineering"
      />
    </ContentContainer>
  );
}
