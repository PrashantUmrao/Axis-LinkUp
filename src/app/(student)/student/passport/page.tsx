import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { PassportService } from '@/lib/services/passport.service';
import { ContentContainer } from '@/components/layouts';
import { StudentPassportView } from '@/components/passport';
import type {
  PassportShareDTO,
  StudentAchievementDTO,
  StudentPassportStatsDTO,
} from '@/types/passport';

export const metadata: Metadata = {
  title: 'Skill & Achievement Passport | Axis LinkUp',
  description:
    'Faculty-endorsed digital co-curricular portfolio, verified badges, and recruiter share link (MOD-15).',
};

export default async function StudentPassportPage() {
  const session = await requireRole(['student', 'super_admin']);

  let initialAchievements: StudentAchievementDTO[] = [];
  let initialStats: StudentPassportStatsDTO | null = null;
  let initialShare: PassportShareDTO | null = null;

  try {
    const res = await PassportService.getStudentPassport(session, { page: 1, limit: 100 });
    initialAchievements = res.achievements;
    initialStats = res.stats;
    initialShare = res.share;
  } catch (err) {
    console.error('Failed to pre-fetch student skill passport', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <StudentPassportView
        initialAchievements={initialAchievements}
        initialStats={initialStats}
        initialShare={initialShare}
      />
    </ContentContainer>
  );
}
