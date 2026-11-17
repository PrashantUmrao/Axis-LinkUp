import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { AssignmentService } from '@/lib/services/assignment.service';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { FacultyAssignmentView } from '@/components/assignments';
import type { UserDTO } from '@/types/user';
import type { AssignmentDTO } from '@/types/assignment';

export const metadata: Metadata = {
  title: 'Department Coursework & Gradebook | Axis LinkUp',
  description: 'Departmental coursework oversight, submission analytics, and gradebook management.',
};

export default async function AdminAssignmentsPage() {
  const session = await requireRole(['admin', 'super_admin']);

  let userDTO: UserDTO;
  let departmentName = session.adminSubRole === 'hod' ? 'Department Coursework' : 'Collegiate Coursework';

  try {
    const userDoc = await UserRepository.findById(session.userId);
    if (userDoc) {
      userDTO = toUserDTO(userDoc);
    } else {
      userDTO = {
        id: session.userId,
        email: session.email,
        fullName: session.fullName || 'Administrator',
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
      fullName: session.fullName || 'Administrator',
      role: session.role,
      status: session.status || 'active',
      isProfileComplete: false,
      departmentId: session.departmentId ?? null,
      avatarUrl: session.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (session.departmentId) {
    try {
      const deptDoc = await DepartmentRepository.findById(session.departmentId);
      if (deptDoc?.name) {
        departmentName = deptDoc.name;
      }
    } catch {
      // Graceful fallback
    }
  }

  // Pre-fetch live assignments
  let initialAssignments: AssignmentDTO[] = [];
  try {
    const result = await AssignmentService.getAssignments(session, {
      limit: 100,
    });
    initialAssignments = result.assignments;
  } catch (err) {
    console.error('Failed to pre-fetch admin assignments:', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <FacultyAssignmentView
        user={userDTO}
        assignedCourses={[]}
        initialAssignments={initialAssignments}
        departmentName={departmentName}
      />
    </ContentContainer>
  );
}
