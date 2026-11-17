'use client';

/**
 * Public Recruiter Skill & Achievement Passport View (MOD-15 / Phase 5.12).
 * Read-only, privacy-preserved verification portfolio displaying ONLY faculty-endorsed
 * achievements, verified credit points, and AXP-YYYY-XXXXXX cryptographic authenticity seals.
 */

import React from 'react';
import { Card, Badge, EmptyState } from '@/components/ui';
import {
  Award,
  ShieldCheck,
  GraduationCap,
  ExternalLink,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import {
  ACHIEVEMENT_CATEGORY_LABELS,
  type PublicPassportDTO,
} from '@/types/passport';

interface PublicPassportViewProps {
  portfolio: PublicPassportDTO;
}

export function PublicPassportView({ portfolio }: PublicPassportViewProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      {/* Institutional Authenticity Header */}
      <Card variant="glass" className="border-primary/20 space-y-4 border p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-4">
            <div className="bg-primary/15 text-primary ring-primary/30 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success" className="gap-1 text-[10px]">
                  <ShieldCheck className="h-3 w-3" />
                  Official Verified Portfolio • Axis Colleges
                </Badge>
                <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                  <Eye className="h-3 w-3" />
                  {portfolio.viewCount} views
                </span>
              </div>
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                {portfolio.student.fullName}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {portfolio.student.department} • {portfolio.student.branch} • Semester{' '}
                {portfolio.student.semester}
              </p>
              {portfolio.headline && (
                <p className="text-foreground pt-1 text-sm font-medium">{portfolio.headline}</p>
              )}
            </div>
          </div>

          <div className="border-border/50 bg-muted/30 flex shrink-0 flex-col items-center justify-center rounded-xl border px-5 py-3 text-center">
            <span className="text-muted-foreground text-[10px] font-semibold uppercase">
              Verified Points
            </span>
            <span className="text-primary mt-0.5 text-3xl font-black">
              {portfolio.totalVerifiedPoints}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {portfolio.verifiedCount} Endorsed Badges
            </span>
          </div>
        </div>

        {/* Verified Skills Cloud */}
        {portfolio.skills.length > 0 && (
          <div className="border-border/40 flex flex-wrap gap-1.5 border-t pt-4">
            {portfolio.skills.map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Verified Achievements List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading flex items-center gap-2 text-lg font-bold">
            <Award className="text-primary h-5 w-5" />
            Verified Credentials &amp; Achievements ({portfolio.achievements.length})
          </h2>
        </div>

        {portfolio.achievements.length === 0 ? (
          <EmptyState
            glass
            title="No Verified Achievements Published Yet"
            description="Only faculty-endorsed credentials with cryptographic seals appear on public recruiter portfolios."
            className="py-10"
          />
        ) : (
          <div className="space-y-4">
            {portfolio.achievements.map((item) => (
              <Card key={item.claimCode} variant="glass" className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {item.claimCode}
                      </Badge>
                      <Badge variant="glass" className="text-[10px]">
                        {ACHIEVEMENT_CATEGORY_LABELS[item.category]}
                      </Badge>
                      <Badge variant="success" className="font-mono text-[10px]">
                        +{item.pointsWeight} pts
                      </Badge>
                    </div>
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground text-xs">
                      Issued by <strong className="text-foreground">{item.issuingOrganization}</strong>{' '}
                      • {new Date(item.issueDate).toLocaleDateString()}
                    </p>
                  </div>

                  {item.credentialUrl && (
                    <a
                      href={item.credentialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Verify Source
                    </a>
                  )}
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">{item.description}</p>

                {item.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.skills.map((s) => (
                      <span
                        key={s}
                        className="border-border/50 bg-muted/40 text-muted-foreground rounded-md border px-2 py-0.5 text-[10px]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Authenticity Seal */}
                <div className="flex flex-col justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[11px] text-emerald-700 sm:flex-row sm:items-center dark:text-emerald-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      Verified by Axis Institute • Endorsed by {item.verifiedByName} (
                      {item.verifiedByRole})
                    </span>
                  </div>
                  <span className="font-mono text-[10px]">
                    SHA-256: {item.verificationHash.slice(0, 16)}…
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Institutional Verification Footer */}
      <footer className="border-border/40 text-muted-foreground border-t pt-4 text-center text-[11px]">
        <p>
          Axis LinkUp — Official Digital Skill &amp; Achievement Passport • Axis Institute of
          Technology &amp; Management (AITM)
        </p>
        <p className="mt-0.5 font-mono text-[10px]">
          Cryptographically Endorsed Records Only • Generated {new Date(portfolio.generatedAt).toLocaleDateString()}
        </p>
      </footer>
    </div>
  );
}
