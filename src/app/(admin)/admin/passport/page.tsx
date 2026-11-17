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
  title: 'Accreditation & Skill Passport | Axis LinkUp',
  description:
    'Departmental and institutional Skill Passport verification desk with NAAC/NIRF verified CSV exports.',
};

export default async function AdminPassportPage() {
  const session = await requireRole(['admin', 'super_admin']);

  let departmentScope: string | undefined;
  if (session.role === 'admin' && session.departmentId) {
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
    console.error('Failed to pre-fetch admin passport accreditation desk', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <PassportVerificationView
        canExportCsv
        departmentScope={departmentScope}
        initialAchievements={initialAchievements}
        initialStats={initialStats}
      />
    </ContentContainer>
  );
}
