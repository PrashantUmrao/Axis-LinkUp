import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { AuthorityComplaintsView } from '@/components/complaints';
import { ComplaintService } from '@/lib/services/complaint.service';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import type { ComplaintDTO } from '@/types/complaints';

export const metadata: Metadata = {
  title: 'HOD Grievance Redressal Inbox | Axis LinkUp',
  description: 'AICTE / UGC Tier-1 Department Student Grievance Adjudication.',
};

export default async function FacultyComplaintsPage() {
  const session = await requireRole(['faculty', 'admin', 'super_admin']);

  let departmentName = 'Academic Department';
  if (session.departmentId) {
    try {
      const deptDoc = await DepartmentRepository.findById(session.departmentId);
      if (deptDoc?.name) {
        departmentName = deptDoc.name;
      }
    } catch {
      // Fallback
    }
  }

  // Authoritative real data fetch from ComplaintService
  let initialComplaints: ComplaintDTO[] = [];
  try {
    const complaintsResult = await ComplaintService.getComplaints(session, {
      page: 1,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    initialComplaints = complaintsResult.complaints;
  } catch (err) {
    console.error('Failed to pre-fetch department complaints', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <AuthorityComplaintsView
        initialComplaints={initialComplaints}
        authorityRole="hod"
        departmentName={departmentName}
        userRole={session.role}
        adminSubRole={session.adminSubRole || undefined}
        userId={session.userId}
      />
    </ContentContainer>
  );
}
