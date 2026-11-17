import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { IamGovernanceService } from '@/lib/services/iam-governance.service';
import { ContentContainer } from '@/components/layouts';
import { IamGovernanceView } from '@/components/governance';
import type {
  GovernedUserDTO,
  IamRoleDistributionStatsDTO,
  PermissionMatrixDTO,
} from '@/types/governance';

export const metadata: Metadata = {
  title: 'IAM Governance & RBAC | Axis LinkUp',
  description:
    'Super Administrator IAM Governance Console for managing institutional roles, account lifecycle statuses, and the canonical RBAC permission matrix.',
};

export default async function SuperAdminRolesPage() {
  const session = await requireRole('super_admin');

  let initialUsers: GovernedUserDTO[] = [];
  let initialStats: IamRoleDistributionStatsDTO | null = null;
  let initialMatrix: PermissionMatrixDTO | null = null;

  try {
    const [usersRes, statsRes] = await Promise.all([
      IamGovernanceService.listGovernedUsers(session, { page: 1, limit: 100 }),
      IamGovernanceService.getRoleDistributionStats(session),
    ]);

    initialUsers = usersRes.users;
    initialStats = statsRes;
    initialMatrix = IamGovernanceService.getPermissionMatrix(session);
  } catch (err) {
    console.error('Failed to pre-fetch IAM governance console', err);
    try {
      initialMatrix = IamGovernanceService.getPermissionMatrix(session);
    } catch {
      // Fallback
    }
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <IamGovernanceView
        currentUserId={session.userId}
        initialUsers={initialUsers}
        initialStats={initialStats}
        initialMatrix={initialMatrix}
      />
    </ContentContainer>
  );
}
