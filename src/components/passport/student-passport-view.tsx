'use client';

/**
 * Student Skill & Achievement Passport Workspace (MOD-15 / Phase 5.12).
 * Features:
 * - KPI strip (Total Verified Points, Verified Badges, Pending Review, Rejected/Resubmittable)
 * - Public Recruiter Share Controls Bar (toggle on/off, copy share URL, rotate token, Print Transcript)
 * - Category filter tabs & Achievement cards with cryptographic Verified by Axis Institute seal
 * - Single-resubmission CTA for first-time rejected claims & withdrawal for pending claims
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Badge, Button, Input, EmptyState } from '@/components/ui';
import {
  Award,
  ShieldCheck,
  Clock,
  XCircle,
  Plus,
  Share2,
  Copy,
  RefreshCw,
  Printer,
  ExternalLink,
  FileText,
  RotateCcw,
  Trash2,
  Check,
} from 'lucide-react';
import { AchievementSubmitModal } from './achievement-submit-modal';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_LABELS,
  type AchievementCategory,
  type PassportShareDTO,
  type StudentAchievementDTO,
  type StudentPassportStatsDTO,
} from '@/types/passport';

interface StudentPassportViewProps {
  initialAchievements?: StudentAchievementDTO[];
  initialStats?: StudentPassportStatsDTO | null;
  initialShare?: PassportShareDTO | null;
}

export function StudentPassportView({
  initialAchievements = [],
  initialStats = null,
  initialShare = null,
}: StudentPassportViewProps) {
  const [achievements, setAchievements] = useState<StudentAchievementDTO[]>(initialAchievements);
  const [stats, setStats] = useState<StudentPassportStatsDTO | null>(initialStats);
  const [share, setShare] = useState<PassportShareDTO | null>(initialShare);
  const [headlineDraft, setHeadlineDraft] = useState(initialShare?.headline || '');

  const [selectedCategory, setSelectedCategory] = useState<'all' | AchievementCategory>('all');
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [resubmittingClaim, setResubmittingClaim] = useState<StudentAchievementDTO | null>(null);
  const [copied, setCopied] = useState(false);
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);

  const refreshPassport = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/passport?limit=100');
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setAchievements(json.data.achievements || []);
        setStats(json.data.stats || null);
        if (json.data.share) {
          setShare(json.data.share);
          setHeadlineDraft(json.data.share.headline || '');
        }
      }
    } catch (err) {
      console.error('Failed to refresh student passport', err);
    }
  }, []);

  const handleUpdateShare = async (options: {
    isEnabled?: boolean;
    rotateToken?: boolean;
    headline?: string;
  }) => {
    setIsUpdatingShare(true);
    try {
      const res = await fetch('/api/v1/passport/share', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: options.isEnabled ?? share?.isEnabled ?? false,
          headline: options.headline !== undefined ? options.headline : headlineDraft,
          rotateToken: options.rotateToken ?? false,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setShare(json.data as PassportShareDTO);
      }
    } catch (err) {
      console.error('Failed to update passport share settings', err);
    } finally {
      setIsUpdatingShare(false);
    }
  };

  const handleWithdrawPending = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/passport/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAchievements((prev) => prev.filter((a) => a.id !== id));
        void refreshPassport();
      }
    } catch (err) {
      console.error('Failed to withdraw pending claim', err);
    }
  };

  const sharePath = share ? `/passport/${share.shareToken}` : '';

  const handleCopyShareUrl = () => {
    if (!sharePath) return;
    const fullUrl =
      typeof window !== 'undefined' ? `${window.location.origin}${sharePath}` : sharePath;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'all') return achievements;
    return achievements.filter((a) => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  const kpi = useMemo(() => {
    if (stats) return stats;
    const verified = achievements.filter((a) => a.verificationStatus === 'verified');
    return {
      totalClaims: achievements.length,
      verifiedCount: verified.length,
      pendingCount: achievements.filter((a) => a.verificationStatus === 'pending').length,
      rejectedCount: achievements.filter((a) => a.verificationStatus === 'rejected').length,
      resubmittableCount: achievements.filter(
        (a) => a.verificationStatus === 'rejected' && a.resubmissionCount < 1
      ).length,
      totalVerifiedPoints: verified.reduce((s, a) => s + a.pointsWeight, 0),
    };
  }, [stats, achievements]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Skill &amp; Achievement Passport
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Faculty-endorsed digital co-curricular portfolio with SHA-256 verification seals and recruiter share link.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button
            size="sm"
            variant="outline"
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="gap-1.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Transcript
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setResubmittingClaim(null);
              setIsSubmitOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Submit Achievement
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">
              Total Verified Points
            </span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-amber-500">{kpi.totalVerifiedPoints}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Verified Badges</span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-emerald-500">{kpi.verifiedCount}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Pending Review</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{kpi.pendingCount}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">
              Rejected (Resubmittable)
            </span>
            <XCircle className="text-destructive h-4 w-4" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">
            {kpi.rejectedCount}{' '}
            <span className="text-muted-foreground text-xs font-normal">
              ({kpi.resubmittableCount} open)
            </span>
          </p>
        </Card>
      </div>

      {/* Public Recruiter Share Controls Bar */}
      <Card variant="glass" className="space-y-3 p-4 print:hidden">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <Share2 className="text-primary h-4 w-4" />
            <div>
              <p className="text-xs font-semibold">Public Recruiter Portfolio Link</p>
              <p className="text-muted-foreground text-[11px]">
                Exposes ONLY verified achievements &amp; AXP seals — never email, phone, or pending claims.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={share?.isEnabled ? 'default' : 'outline'}
              disabled={isUpdatingShare}
              onClick={() => handleUpdateShare({ isEnabled: !share?.isEnabled })}
              className="text-xs"
            >
              {share?.isEnabled ? 'Public Link Active' : 'Enable Public Link'}
            </Button>

            {share && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!share.isEnabled}
                  onClick={handleCopyShareUrl}
                  className="gap-1 text-xs"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy Link'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isUpdatingShare}
                  onClick={() => handleUpdateShare({ rotateToken: true })}
                  className="gap-1 text-xs"
                  title="Revoke previous link and generate a new token"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Rotate Link
                </Button>
              </>
            )}
          </div>
        </div>

        {share && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              value={headlineDraft}
              onChange={(e) => setHeadlineDraft(e.target.value)}
              placeholder="Portfolio headline (e.g., B.Tech CSE — Full-Stack & Cloud)"
              className="text-xs sm:col-span-2"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isUpdatingShare}
                onClick={() => handleUpdateShare({ headline: headlineDraft })}
                className="text-xs"
              >
                Save Headline
              </Button>
              <span className="text-muted-foreground truncate font-mono text-[10px]">
                {share.isEnabled ? sharePath : 'Link disabled'}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 print:hidden">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            selectedCategory === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          All Categories ({achievements.length})
        </button>
        {ACHIEVEMENT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/40'
            }`}
          >
            {ACHIEVEMENT_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Achievement Cards */}
      {filteredAchievements.length === 0 ? (
        <EmptyState
          glass
          title="No Achievements Recorded Yet"
          description="Submit your technical certifications, hackathon awards, research papers, or leadership proofs to build your verified Axis Skill Passport."
          className="py-10"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredAchievements.map((claim) => {
            const isVerified = claim.verificationStatus === 'verified';
            const isPending = claim.verificationStatus === 'pending';
            const canResubmit =
              claim.verificationStatus === 'rejected' && claim.resubmissionCount < 1;

            return (
              <Card key={claim.id} variant="glass" className="flex flex-col justify-between p-5">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {claim.claimCode}
                      </Badge>
                      <Badge variant="glass" className="text-[10px]">
                        {ACHIEVEMENT_CATEGORY_LABELS[claim.category]}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        +{claim.pointsWeight} pts
                      </Badge>
                    </div>

                    {isVerified ? (
                      <Badge variant="success" className="gap-1 text-[10px]">
                        <ShieldCheck className="h-3 w-3" />
                        Verified
                      </Badge>
                    ) : isPending ? (
                      <Badge variant="warning" className="gap-1 text-[10px]">
                        <Clock className="h-3 w-3" />
                        Pending Review
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1 text-[10px]">
                        <XCircle className="h-3 w-3" />
                        Rejected
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">{claim.title}</h3>
                    <p className="text-muted-foreground text-[11px]">
                      {claim.issuingOrganization} • {new Date(claim.issueDate).toLocaleDateString()}
                    </p>
                  </div>

                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {claim.description}
                  </p>

                  {claim.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {claim.skills.map((skill) => (
                        <span
                          key={skill}
                          className="border-border/50 bg-muted/40 text-muted-foreground rounded-md border px-2 py-0.5 text-[10px]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Official Cryptographic Verification Seal (STRICTLY verified only) */}
                  {isVerified && claim.verificationHash && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Verified by Axis Institute • {claim.claimCode}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] opacity-85">
                        Endorsed by {claim.verifiedBySnapshot?.fullName || 'Faculty'} • SHA:{' '}
                        {claim.verificationHash.slice(0, 16)}…
                      </p>
                    </div>
                  )}

                  {/* Rejection Feedback */}
                  {claim.verificationStatus === 'rejected' && claim.reviewRemarks && (
                    <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-[11px]">
                      <p className="font-semibold">Faculty Remarks:</p>
                      <p className="mt-0.5">{claim.reviewRemarks}</p>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="border-border/40 mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs print:hidden">
                  <div className="flex items-center gap-3">
                    {claim.credentialUrl && (
                      <a
                        href={claim.credentialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Credential
                      </a>
                    )}
                    {claim.proofAttachment && (
                      <a
                        href={claim.proofAttachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary flex items-center gap-1 hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Proof
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {canResubmit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResubmittingClaim(claim);
                          setIsSubmitOpen(true);
                        }}
                        className="gap-1 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Resubmit Proof
                      </Button>
                    )}

                    {isPending && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleWithdrawPending(claim.id)}
                        className="text-destructive hover:bg-destructive/10 gap-1 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AchievementSubmitModal
        isOpen={isSubmitOpen}
        resubmittingClaim={resubmittingClaim}
        onClose={() => setIsSubmitOpen(false)}
        onSuccess={(saved) => {
          setAchievements((prev) => {
            const exists = prev.some((a) => a.id === saved.id);
            return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
          });
          void refreshPassport();
        }}
      />
    </div>
  );
}
