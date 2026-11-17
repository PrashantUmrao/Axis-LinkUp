import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { AssignmentService } from '@/lib/services/assignment.service';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { StudentAssignmentView } from '@/components/assignments';
import type { UserDTO } from '@/types/user';
import type { AssignmentDTO } from '@/types/assignment';

export const metadata: Metadata = {
  title: 'Coursework & Assignments | Axis LinkUp',
  description: 'Collegiate coursework management, deliverable submissions, and academic evaluations.',
};

export default async function StudentAssignmentsPage() {
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
        fullName: session.fullName || 'Student',
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
      fullName: session.fullName || 'Student',
      role: session.role,
      status: session.status || 'active',
      isProfileComplete: false,
      departmentId: session.departmentId ?? null,
      avatarUrl: session.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Pre-fetch live assignments from domain service
  let initialAssignments: AssignmentDTO[] = [];
  try {
    const result = await AssignmentService.getAssignments(session, {
      limit: 50,
    });
    initialAssignments = result.assignments;
  } catch (err) {
    console.error('Failed to pre-fetch student assignments:', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <StudentAssignmentView
        user={userDTO}
        initialAssignments={initialAssignments}
      />
    </ContentContainer>
  );
}
