import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { AuthorityComplaintsView } from '@/components/complaints';
import { ComplaintService } from '@/lib/services/complaint.service';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import type { ComplaintDTO } from '@/types/complaints';

export const metadata: Metadata = {
  title: 'Directorate Appeals & Ombudsman | Axis LinkUp',
  description: 'Executive Director Higher Authority Grievance Tribunal and Appeals.',
};

export default async function AdminComplaintsPage() {
  const session = await requireRole(['admin', 'super_admin']);

  const isHod = session.adminSubRole === 'hod';
  const authorityRole: 'hod' | 'director' = isHod ? 'hod' : 'director';

  let departmentName = isHod ? 'Academic Department' : 'AITM Directorate';
  if (isHod && session.departmentId) {
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
    console.error('Failed to pre-fetch admin complaints', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <AuthorityComplaintsView
        initialComplaints={initialComplaints}
        authorityRole={authorityRole}
        departmentName={departmentName}
        userRole={session.role}
        adminSubRole={session.adminSubRole || undefined}
        userId={session.userId}
      />
    </ContentContainer>
  );
}
