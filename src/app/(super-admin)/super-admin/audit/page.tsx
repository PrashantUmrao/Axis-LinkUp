import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { AuditService } from '@/lib/services/audit.service';
import { ContentContainer } from '@/components/layouts';
import { AuditLogsView } from '@/components/governance';
import type {
  AuditChainVerificationDTO,
  AuditLogDTO,
  AuditStatsDTO,
} from '@/types/governance';

export const metadata: Metadata = {
  title: 'Security Audit Logs | Axis LinkUp',
  description:
    'Immutable, SHA-256 hash-chained security and institutional governance audit trail (MOD-19).',
};

export default async function SuperAdminAuditPage() {
  const session = await requireRole('super_admin');

  let initialLogs: AuditLogDTO[] = [];
  let initialStats: AuditStatsDTO | null = null;
  let initialVerification: AuditChainVerificationDTO | null = null;

  try {
    const [logsRes, statsRes, verifyRes] = await Promise.all([
      AuditService.listAuditLogs(session, { page: 1, limit: 100 }),
      AuditService.getAuditStats(session),
      AuditService.verifyHashChain(session, 500),
    ]);

    initialLogs = logsRes.logs;
    initialStats = statsRes;
    initialVerification = verifyRes;
  } catch (err) {
    console.error('Failed to pre-fetch super admin audit trail', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <AuditLogsView
        initialLogs={initialLogs}
        initialStats={initialStats}
        initialVerification={initialVerification}
      />
    </ContentContainer>
  );
}
