import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { AuthorityComplaintsView } from '@/components/complaints';
import type { ComplaintTicket } from '@/types/complaints';

export const metadata: Metadata = {
  title: 'Directorate Appeals & Ombudsman | Axis LinkUp',
  description: 'Executive Director Higher Authority Grievance Tribunal and Appeals.',
};

const DIRECTOR_COMPLAINTS: ComplaintTicket[] = [
  {
    id: 'cmp-dir-1',
    ticketNumber: 'CMP-DIR-2026-0008',
    studentId: 'std-201',
    studentName: 'Amit Saxena',
    studentRoll: '2001330100012',
    studentEmail: 'amit.saxena@axis.edu.in',
    department: 'Computer Science & Engineering',
    recipientRole: 'director',
    recipientName: 'Executive Director (Ombudsman Tribunal)',
    category: 'lab_infrastructure',
    subject: 'Escalated: Annual Department Lab Workstation Modernization Grant Petition',
    narrative:
      'Following unresolved department review, this appeal petitions the Executive Director for procurement of GPU accelerated computing machines for 4th year AI/ML research projects.',
    submittedAt: 'Yesterday, 04:30 PM',
    updatedAt: 'Yesterday, 04:30 PM',
    status: 'submitted',
    slaRemainingHours: 160,
    attachments: ['Project_Hardware_Specs.pdf'],
    responses: [],
  },
  {
    id: 'cmp-dir-2',
    ticketNumber: 'CMP-DIR-2026-0005',
    studentId: 'std-205',
    studentName: 'Sneha Reddy',
    studentRoll: '2101330100091',
    studentEmail: 'sneha.reddy@axis.edu.in',
    department: 'Electronics & Communication',
    recipientRole: 'director',
    recipientName: 'Executive Director (Ombudsman Tribunal)',
    category: 'academic',
    subject: 'Direct Petition: Attendance Condonation on Verified Medical Grounds',
    narrative:
      'Formal petition under University Ordinance 12.4 for attendance condonation due to hospitalization during mid-semester examinations. Medical superintendent certificate attached.',
    submittedAt: '3 days ago',
    updatedAt: '1 day ago',
    status: 'under_review',
    slaRemainingHours: 96,
    attachments: ['Hospital_Discharge_Summary.pdf'],
    responses: [
      {
        id: 'resp-dir-1',
        authorId: 'dir-officer',
        authorName: 'Executive Director Office',
        authorRole: 'director',
        message:
          'Medical documentation verified with Campus Medical Officer. Medical board condonation hearing scheduled for Friday.',
        timestamp: 'Yesterday, 11:00 AM',
        actionTaken: 'Medical Board Hearing Scheduled',
      },
    ],
  },
];

export default async function AdminComplaintsPage() {
  await requireRole(['admin', 'super_admin']);

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <AuthorityComplaintsView
        initialComplaints={DIRECTOR_COMPLAINTS}
        authorityRole="director"
        departmentName="AITM Directorate"
      />
    </ContentContainer>
  );
}
