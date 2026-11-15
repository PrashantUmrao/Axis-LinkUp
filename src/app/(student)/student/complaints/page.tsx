import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { ComplaintService } from '@/lib/services/complaint.service';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { StudentComplaintsView } from '@/components/complaints';
import type { UserDTO } from '@/types/user';
import type { ComplaintDTO } from '@/types/complaints';

export const metadata: Metadata = {
  title: 'Complaints & Communication | Axis LinkUp',
  description: 'AICTE / UGC Mandated Student Grievance Redressal and Higher Authority Petitions.',
};

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
    console.error('Failed to pre-fetch student complaints', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <StudentComplaintsView user={userDTO} initialComplaints={initialComplaints} />
    </ContentContainer>
  );
}
