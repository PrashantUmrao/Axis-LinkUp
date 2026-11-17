'use client';

/**
 * Faculty & Admin Passport Verification Queue View (MOD-15 / Phase 5.12).
 * Enables Faculty, HODs, and Super Administrators to triage student credential claims,
 * stamp SHA-256 endorsements, reject invalid proofs with remarks, and export verified
 * NAAC/NIRF accreditation CSV datasets (Admin / Super Admin only).
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Badge, Button, Input, EmptyState } from '@/components/ui';
import {
  Award,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  FileSpreadsheet,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { AchievementVerifyModal } from './achievement-verify-modal';
import {
  ACHIEVEMENT_CATEGORY_LABELS,
  type PassportVerificationStatsDTO,
  type StudentAchievementDTO,
  type VerificationStatus,
} from '@/types/passport';

interface PassportVerificationViewProps {
  canExportCsv?: boolean;
  departmentScope?: string;
  initialAchievements?: StudentAchievementDTO[];
  initialStats?: PassportVerificationStatsDTO | null;
}

export function PassportVerificationView({
  canExportCsv = false,
  departmentScope,
  initialAchievements = [],
  initialStats = null,
}: PassportVerificationViewProps) {
  const [achievements, setAchievements] = useState<StudentAchievementDTO[]>(initialAchievements);
  const [stats, setStats] = useState<PassportVerificationStatsDTO | null>(initialStats);
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<StudentAchievementDTO | null>(null);

  const refreshQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/passport?limit=100');
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setAchievements(json.data.achievements || []);
        setStats(json.data.stats || null);
      }
    } catch (err) {
      console.error('Failed to refresh passport verification queue', err);
    }
  }, []);

  const handleExportCsv = () => {
    if (typeof window !== 'undefined') {
      window.open('/api/v1/passport/export', '_blank', 'noopener,noreferrer');
    }
  };

  const filteredClaims = useMemo(() => {
    return achievements.filter((claim) => {
      if (statusFilter !== 'all' && claim.verificationStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hitCode = claim.claimCode.toLowerCase().includes(q);
        const hitTitle = claim.title.toLowerCase().includes(q);
        const hitStudent = claim.studentSnapshot.fullName.toLowerCase().includes(q);
        const hitRoll = claim.studentSnapshot.enrollmentNo.toLowerCase().includes(q);
        const hitOrg = claim.issuingOrganization.toLowerCase().includes(q);
        if (!hitCode && !hitTitle && !hitStudent && !hitRoll && !hitOrg) return false;
      }
      return true;
    });
  }, [achievements, statusFilter, searchQuery]);

  const kpi = useMemo(() => {
    if (stats) return stats;
    const verified = achievements.filter((a) => a.verificationStatus === 'verified');
    return {
      total: achievements.length,
      pending: achievements.filter((a) => a.verificationStatus === 'pending').length,
      verified: verified.length,
      rejected: achievements.filter((a) => a.verificationStatus === 'rejected').length,
      totalVerifiedPoints: verified.reduce((s, a) => s + a.pointsWeight, 0),
    };
  }, [stats, achievements]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              {canExportCsv
                ? 'Accreditation & Skill Passport Verification'
                : 'Faculty Skill Verification Desk'}
            </h1>
            {departmentScope && (
              <Badge variant="glass" className="text-[11px]">
                Scope: {departmentScope}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Review student co-curricular proofs, stamp SHA-256 endorsements, and maintain NAAC/NIRF accreditation records.
          </p>
        </div>

        {canExportCsv && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            Export Verified CSV (NAAC/NIRF)
          </Button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Pending Queue</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-amber-500">{kpi.pending}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Verified Claims</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-emerald-500">{kpi.verified}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Rejected Claims</span>
            <XCircle className="text-destructive h-4 w-4" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{kpi.rejected}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">
              Verified Credit Points
            </span>
            <Award className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-blue-500">{kpi.totalVerifiedPoints}</p>
        </Card>
      </div>

      {/* Search & Status Filter Bar */}
      <Card
        variant="glass"
        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student name, enrollment no, AXP code, title, organization..."
            aria-label="Search passport claims"
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(['pending', 'verified', 'rejected', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/40'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </Card>

      {/* Verification Queue List */}
      {filteredClaims.length === 0 ? (
        <EmptyState
          glass
          title="Verification Queue Clear"
          description="No student achievement claims match the selected status tab or search criteria."
          className="py-10"
        />
      ) : (
        <div className="space-y-2.5">
          {filteredClaims.map((claim) => (
            <Card
              key={claim.id}
              variant="glass"
              className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {claim.claimCode}
                  </Badge>
                  <Badge
                    variant={
                      claim.verificationStatus === 'verified'
                        ? 'success'
                        : claim.verificationStatus === 'rejected'
                          ? 'destructive'
                          : 'warning'
                    }
                    className="gap-1 text-[10px] capitalize"
                  >
                    {claim.verificationStatus === 'verified' && (
                      <ShieldCheck className="h-3 w-3" />
                    )}
                    {claim.verificationStatus}
                  </Badge>
                  <Badge variant="glass" className="text-[10px]">
                    {ACHIEVEMENT_CATEGORY_LABELS[claim.category]} (+{claim.pointsWeight} pts)
                  </Badge>
                </div>

                <p className="truncate text-sm font-semibold">{claim.title}</p>
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">
                    {claim.studentSnapshot.fullName}
                  </span>{' '}
                  ({claim.studentSnapshot.enrollmentNo}) • {claim.studentSnapshot.department} •{' '}
                  {claim.issuingOrganization}
                </p>
              </div>

              <Button
                size="sm"
                variant={claim.verificationStatus === 'pending' ? 'default' : 'outline'}
                onClick={() => setSelectedClaim(claim)}
                className="gap-1 text-xs"
              >
                {claim.verificationStatus === 'pending' ? 'Review & Verify' : 'Inspect Seal'}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <AchievementVerifyModal
        claim={selectedClaim}
        isOpen={Boolean(selectedClaim)}
        onClose={() => setSelectedClaim(null)}
        onSuccess={(updated) => {
          setAchievements((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          void refreshQueue();
        }}
      />
    </div>
  );
}
