import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { PassportService } from '@/lib/services/passport.service';
import { ContentContainer } from '@/components/layouts';
import { PassportVerificationView } from '@/components/passport';
import type {
  PassportVerificationStatsDTO,
  StudentAchievementDTO,
} from '@/types/passport';

export const metadata: Metadata = {
  title: 'Skill Verification Desk | Axis LinkUp',
  description:
    'Faculty verification desk for endorsing student co-curricular achievements with cryptographic seals.',
};

export default async function FacultyPassportPage() {
  const session = await requireRole(['faculty', 'admin', 'super_admin']);

  let departmentScope: string | undefined;
  if (session.departmentId) {
    try {
      const dept = await DepartmentRepository.findById(session.departmentId);
      if (dept?.name) departmentScope = dept.name;
    } catch {
      // Fallback
    }
  }

  let initialAchievements: StudentAchievementDTO[] = [];
  let initialStats: PassportVerificationStatsDTO | null = null;

  try {
    const res = await PassportService.listVerificationQueue(session, { page: 1, limit: 100 });
    initialAchievements = res.achievements;
    initialStats = res.stats;
  } catch (err) {
    console.error('Failed to pre-fetch faculty passport verification queue', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <PassportVerificationView
        canExportCsv={session.role === 'admin' || session.role === 'super_admin'}
        departmentScope={departmentScope}
        initialAchievements={initialAchievements}
        initialStats={initialStats}
      />
    </ContentContainer>
  );
}
