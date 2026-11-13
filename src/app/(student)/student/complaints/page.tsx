import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { StudentComplaintsView } from '@/components/complaints';
import type { UserDTO } from '@/types/user';
import type { ComplaintTicket } from '@/types/complaints';

export const metadata: Metadata = {
  title: 'Complaints & Communication | Axis LinkUp',
  description: 'AICTE / UGC Mandated Student Grievance Redressal and Higher Authority Petitions.',
};

const INITIAL_STUDENT_COMPLAINTS: ComplaintTicket[] = [
  {
    id: 'cmp-1',
    ticketNumber: 'CMP-2026-0042',
    studentId: 'user-current',
    studentName: 'Student User',
    studentRoll: '2101330100045',
    studentEmail: 'student@axis.edu.in',
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
    ticketNumber: 'CMP-2026-0039',
    studentId: 'user-current',
    studentName: 'Student User',
    studentRoll: '2101330100045',
    studentEmail: 'student@axis.edu.in',
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

export default async function StudentComplaintsPage() {
  const session = await requireRole(['student', 'super_admin']);

  let userDTO: UserDTO;
  try {
    const userDoc = await UserRepository.findById(session.userId);
    if (userDoc) {
      userDTO = toUserDTO(userDoc);
    } else {
      userDTO = {
        id: session.userId,
        email: session.email,
        fullName: session.fullName || 'Student Complainant',
        role: session.role,
        status: session.status || 'active',
        isProfileComplete: false,
        departmentId: session.departmentId ?? null,
        avatarUrl: session.avatarUrl ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  } catch {
    userDTO = {
      id: session.userId,
      email: session.email,
      fullName: session.fullName || 'Student Complainant',
      role: session.role,
      status: session.status || 'active',
      isProfileComplete: false,
      departmentId: session.departmentId ?? null,
      avatarUrl: session.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Bind real student name and email to initial tickets
  const personalizedComplaints = INITIAL_STUDENT_COMPLAINTS.map((c) => ({
    ...c,
    studentId: userDTO.id,
    studentName: userDTO.fullName,
    studentEmail: userDTO.email,
  }));

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <StudentComplaintsView user={userDTO} initialComplaints={personalizedComplaints} />
    </ContentContainer>
  );
}
