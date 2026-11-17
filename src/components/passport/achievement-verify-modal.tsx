'use client';

/**
 * Faculty & Admin Achievement Verification Modal Component (MOD-15 / Phase 5.12).
 * Displays student snapshot, credential URL & uploaded proof preview, and enables
 * endorsing (with SHA-256 cryptographic stamp) or rejecting with mandatory remarks (>= 10 chars).
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Badge,
  Button,
  Label,
  Textarea,
} from '@/components/ui';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import {
  ACHIEVEMENT_CATEGORY_LABELS,
  type StudentAchievementDTO,
} from '@/types/passport';

interface AchievementVerifyModalProps {
  claim: StudentAchievementDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: StudentAchievementDTO) => void;
}

export function AchievementVerifyModal({
  claim,
  isOpen,
  onClose,
  onSuccess,
}: AchievementVerifyModalProps) {
  const [decision, setDecision] = useState<'verify' | 'reject'>('verify');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDecision('verify');
    setRemarks('');
    setError(null);
  }, [claim, isOpen]);

  if (!claim) return null;

  const isPending = claim.verificationStatus === 'pending';
  const requiresRemarks = decision === 'reject';
  const remarksTooShort = requiresRemarks && remarks.trim().length < 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (remarksTooShort) {
      setError('Rejecting a claim requires descriptive remarks of at least 10 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/passport/${claim.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          remarks: remarks.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Failed to process verification decision.');
        return;
      }

      onSuccess(json.data as StudentAchievementDTO);
      onClose();
    } catch {
      setError('Network error while recording verification decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Award className="text-primary h-4 w-4" />
              Verify Credential — {claim.claimCode}
            </DialogTitle>
            <Badge
              variant={
                claim.verificationStatus === 'verified'
                  ? 'success'
                  : claim.verificationStatus === 'rejected'
                    ? 'destructive'
                    : 'warning'
              }
              className="capitalize"
            >
              {claim.verificationStatus}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Inspect credential authenticity before applying the permanent institutional SHA-256 endorsement seal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Student Snapshot */}
          <div className="border-border/50 bg-muted/20 space-y-1 rounded-lg border p-3.5 text-xs">
            <div className="flex items-center gap-1.5 font-semibold">
              <User className="h-3.5 w-3.5 text-blue-500" />
              <span>{claim.studentSnapshot.fullName}</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {claim.studentSnapshot.enrollmentNo}
              </Badge>
            </div>
            <p className="text-muted-foreground text-[11px]">
              {claim.studentSnapshot.department} • {claim.studentSnapshot.branch} • Sem{' '}
              {claim.studentSnapshot.semester} (Sec {claim.studentSnapshot.section})
            </p>
          </div>

          {/* Achievement Summary */}
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="glass" className="text-[10px]">
                {ACHIEVEMENT_CATEGORY_LABELS[claim.category]}
              </Badge>
              <Badge variant="success" className="font-mono text-[10px]">
                +{claim.pointsWeight} Points
              </Badge>
              {claim.resubmissionCount > 0 && (
                <Badge variant="warning" className="text-[10px]">
                  Resubmitted Proof (Final Review)
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold">{claim.title}</h3>
            <p className="text-muted-foreground text-[11px]">
              Issued by <strong className="text-foreground">{claim.issuingOrganization}</strong> on{' '}
              {new Date(claim.issueDate).toLocaleDateString()}
            </p>
            <p className="text-muted-foreground leading-relaxed">{claim.description}</p>
          </div>

          {/* Proof Evidence Links */}
          <div className="border-border/50 bg-background/50 space-y-2 rounded-lg border p-3.5 text-xs">
            <p className="text-muted-foreground text-[10px] font-semibold uppercase">
              Submitted Proof Evidence
            </p>
            {claim.credentialUrl && (
              <a
                href={claim.credentialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-1.5 font-medium hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open External Credential Verification Link
              </a>
            )}
            {claim.proofAttachment && (
              <a
                href={claim.proofAttachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-1.5 font-medium hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                View Uploaded Proof: {claim.proofAttachment.name}
              </a>
            )}
          </div>

          {/* Existing Cryptographic Seal (if verified) */}
          {claim.verificationStatus === 'verified' && claim.verificationHash && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                <span>Verified by Axis Institute • {claim.claimCode}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] break-all">
                SHA-256: {claim.verificationHash}
              </p>
            </div>
          )}

          {/* Decision Form (Only when pending) */}
          {isPending && (
            <form onSubmit={handleSubmit} className="border-border/40 space-y-3 border-t pt-3">
              {error && (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDecision('verify')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-semibold transition-colors ${
                    decision === 'verify'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'border-border/60 text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve &amp; Stamp Verification
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('reject')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-semibold transition-colors ${
                    decision === 'reject'
                      ? 'border-destructive bg-destructive/15 text-destructive'
                      : 'border-border/60 text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <XCircle className="h-4 w-4" />
                  Reject Claim
                </button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="verify-remarks" className="text-xs">
                  {requiresRemarks
                    ? 'Rejection Remarks (Mandatory, min 10 characters) *'
                    : 'Endorsement Note (Optional)'}
                </Label>
                <Textarea
                  id="verify-remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={
                    requiresRemarks
                      ? 'Explain what is missing or unverifiable (student gets 1 resubmission opportunity)...'
                      : 'Optional faculty commendation note...'
                  }
                  rows={3}
                  maxLength={500}
                  required={requiresRemarks}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant={decision === 'reject' ? 'destructive' : 'default'}
                  disabled={isSubmitting || remarksTooShort}
                  className="gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {decision === 'verify' ? 'Approve & Stamp Verification' : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
