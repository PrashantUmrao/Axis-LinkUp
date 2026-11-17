import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { EmergencyService } from '@/lib/services/emergency.service';
import { ContentContainer } from '@/components/layouts';
import { EmergencyConsoleView } from '@/components/emergency';
import type {
  EmergencyAlertDTO,
  EmergencyHistoryStatsDTO,
  EmergencyRoleBreakdownDTO,
} from '@/types/emergency';

export const metadata: Metadata = {
  title: 'Emergency Broadcast Console | Axis LinkUp',
  description:
    'Master Campus Emergency Broadcast Console for severe weather closures, lockdowns, real-time portal takeovers, and acknowledgment telemetry (MOD-16).',
};

export default async function SuperAdminEmergencyPage() {
  const session = await requireRole('super_admin');

  let initialActiveAlert: EmergencyAlertDTO | null = null;
  let initialActiveBreakdown: EmergencyRoleBreakdownDTO | null = null;
  let initialHistory: EmergencyAlertDTO[] = [];
  let initialStats: EmergencyHistoryStatsDTO | null = null;

  try {
    const [activeRes, historyRes] = await Promise.all([
      EmergencyService.getActiveAlertForUser(session),
      EmergencyService.listAlertHistory(session, { page: 1, limit: 50 }),
    ]);

    initialActiveAlert = activeRes.activeAlert;
    initialHistory = historyRes.alerts;
    initialStats = historyRes.stats;

    if (initialActiveAlert) {
      const ackRes = await EmergencyService.getAlertAcknowledgments(
        session,
        initialActiveAlert.id,
        { page: 1, limit: 25 }
      );
      initialActiveBreakdown = ackRes.breakdown;
    }
  } catch (err) {
    console.error('Failed to pre-fetch emergency broadcast console', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <EmergencyConsoleView
        initialActiveAlert={initialActiveAlert}
        initialActiveBreakdown={initialActiveBreakdown}
        initialHistory={initialHistory}
        initialStats={initialStats}
      />
    </ContentContainer>
  );
}
