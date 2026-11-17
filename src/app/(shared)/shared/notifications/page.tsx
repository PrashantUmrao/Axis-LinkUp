import React from 'react';
import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification.service';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { ContentContainer } from '@/components/layouts';
import { NotificationCenterView } from '@/components/notifications';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Notification Center | Axis LinkUp',
  description:
    'Unified real-time campus notifications, category preferences, and targeted institutional alert management.',
};

export default async function SharedNotificationsPage() {
  const session = await requireAuth();

  const [inbox, preferences] = await Promise.all([
    NotificationService.listUserNotifications(session, { page: 1, limit: 20 }),
    NotificationService.getPreferences(session),
  ]);

  let departmentScope: { id: string; name: string; code: string } | null = null;
  let availableDepartments: Array<{ id: string; name: string; code: string }> = [];

  if (session.role !== 'student') {
    try {
      if (session.departmentId) {
        const ownDept = await DepartmentRepository.findById(session.departmentId);
        if (ownDept) {
          departmentScope = {
            id: ownDept._id.toString(),
            name: ownDept.name,
            code: ownDept.code,
          };
        }
      }
      if (session.role === 'super_admin') {
        const activeDepts = await DepartmentRepository.findAllActive();
        availableDepartments = activeDepts.map((d) => ({
          id: d._id.toString(),
          name: d.name,
          code: d.code,
        }));
      }
    } catch {
      // Safe fallback when optional department lookup is unavailable
    }
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <NotificationCenterView
        userRole={session.role}
        initialNotifications={inbox.notifications}
        initialUnreadCount={inbox.unreadCount}
        initialPagination={inbox.pagination}
        initialPreferences={preferences}
        departmentScope={departmentScope}
        availableDepartments={availableDepartments}
      />
    </ContentContainer>
  );
}
