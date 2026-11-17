'use client';

/**
 * Achievement Submit & Resubmit Modal Component (MOD-15 / Phase 5.12).
 * Allows students to submit new co-curricular credential proofs or resubmit a
 * first-time rejected claim (enforcing the 1-resubmission limit), reusing the
 * Cloudinary-backed FileUploader component (max 25MB).
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Textarea,
  Badge,
} from '@/components/ui';
import { AlertCircle, Award, Loader2 } from 'lucide-react';
import { FileUploader } from '@/components/assignments/file-uploader';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_LABELS,
  ACHIEVEMENT_CATEGORY_POINTS,
  type AchievementCategory,
  type StudentAchievementDTO,
} from '@/types/passport';
import type { AssignmentAttachment } from '@/types/assignment';

interface AchievementSubmitModalProps {
  isOpen: boolean;
  resubmittingClaim?: StudentAchievementDTO | null;
  onClose: () => void;
  onSuccess: (claim: StudentAchievementDTO) => void;
}

export function AchievementSubmitModal({
  isOpen,
  resubmittingClaim = null,
  onClose,
  onSuccess,
}: AchievementSubmitModalProps) {
  const isResubmit = Boolean(resubmittingClaim);

  const [category, setCategory] = useState<AchievementCategory>(
    resubmittingClaim?.category || 'technical_certification'
  );
  const [title, setTitle] = useState(resubmittingClaim?.title || '');
  const [issuingOrganization, setIssuingOrganization] = useState(
    resubmittingClaim?.issuingOrganization || ''
  );
  const [issueDate, setIssueDate] = useState(
    resubmittingClaim?.issueDate
      ? resubmittingClaim.issueDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState(resubmittingClaim?.description || '');
  const [skillsInput, setSkillsInput] = useState(
    resubmittingClaim?.skills?.join(', ') || ''
  );
  const [credentialUrl, setCredentialUrl] = useState(resubmittingClaim?.credentialUrl || '');
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>(() => {
    if (resubmittingClaim?.proofAttachment) {
      const p = resubmittingClaim.proofAttachment;
      return [
        {
          id: p.publicId || 'existing-proof',
          name: p.name,
          url: p.url,
          mimeType: p.fileType,
          sizeBytes: p.size,
          publicId: p.publicId,
          uploadedAt: resubmittingClaim.updatedAt,
        },
      ];
    }
    return [];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resubmittingClaim) {
      setCategory(resubmittingClaim.category);
      setTitle(resubmittingClaim.title);
      setIssuingOrganization(resubmittingClaim.issuingOrganization);
      setIssueDate(resubmittingClaim.issueDate.slice(0, 10));
      setDescription(resubmittingClaim.description);
      setSkillsInput(resubmittingClaim.skills.join(', '));
      setCredentialUrl(resubmittingClaim.credentialUrl || '');
      if (resubmittingClaim.proofAttachment) {
        const p = resubmittingClaim.proofAttachment;
        setAttachments([
          {
            id: p.publicId || 'existing-proof',
            name: p.name,
            url: p.url,
            mimeType: p.fileType,
            sizeBytes: p.size,
            publicId: p.publicId,
            uploadedAt: resubmittingClaim.updatedAt,
          },
        ]);
      } else {
        setAttachments([]);
      }
    } else if (isOpen) {
      setCategory('technical_certification');
      setTitle('');
      setIssuingOrganization('');
      setIssueDate(new Date().toISOString().slice(0, 10));
      setDescription('');
      setSkillsInput('');
      setCredentialUrl('');
      setAttachments([]);
    }
    setError(null);
  }, [resubmittingClaim, isOpen]);

  const pointsPreview = ACHIEVEMENT_CATEGORY_POINTS[category];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const firstAtt = attachments[0];
    const trimmedUrl = credentialUrl.trim();

    if (!trimmedUrl && !firstAtt) {
      setError('Provide either a credential verification URL or upload a proof certificate.');
      return;
    }

    const skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    const payload = {
      category,
      title: title.trim(),
      issuingOrganization: issuingOrganization.trim(),
      issueDate: new Date(issueDate).toISOString(),
      description: description.trim(),
      skills,
      credentialUrl: trimmedUrl || null,
      proofAttachment: firstAtt
        ? {
            name: firstAtt.name,
            url: firstAtt.url,
            fileType: firstAtt.mimeType,
            size: firstAtt.sizeBytes,
            publicId: firstAtt.publicId || firstAtt.id || 'local',
          }
        : null,
    };

    setIsSubmitting(true);
    try {
      const url =
        isResubmit && resubmittingClaim
          ? `/api/v1/passport/${resubmittingClaim.id}`
          : '/api/v1/passport';
      const method = isResubmit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Failed to submit achievement claim.');
        return;
      }

      onSuccess(json.data as StudentAchievementDTO);
      onClose();
    } catch {
      setError('Network error while submitting achievement claim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Award className="text-primary h-4 w-4" />
            {isResubmit
              ? `Resubmit Rejected Claim — ${resubmittingClaim?.claimCode}`
              : 'Submit Skill & Achievement Proof'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isResubmit
              ? 'Update your supporting proof or description. Note: Each rejected claim allows at most 1 resubmission.'
              : 'Claims enter faculty review and receive a cryptographic SHA-256 verification seal upon endorsement.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isResubmit && resubmittingClaim?.reviewRemarks && (
            <div className="border-amber-500/40 bg-amber-500/10 rounded-lg border p-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold">Previous Faculty Remarks:</p>
              <p className="mt-0.5">{resubmittingClaim.reviewRemarks}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ach-category" className="text-xs">
                Achievement Category *
              </Label>
              <select
                id="ach-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as AchievementCategory)}
                className="border-input bg-background h-9 w-full rounded-md border px-2.5 text-xs"
              >
                {ACHIEVEMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {ACHIEVEMENT_CATEGORY_LABELS[cat]} (+{ACHIEVEMENT_CATEGORY_POINTS[cat]} pts)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <div className="border-border/50 bg-muted/20 flex h-9 items-center justify-between rounded-md border px-3 text-xs">
                <span className="text-muted-foreground">Credit Weight:</span>
                <Badge variant="success" className="font-mono text-[11px]">
                  +{pointsPreview} Points
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ach-title" className="text-xs">
              Achievement Title *
            </Label>
            <Input
              id="ach-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 1st Place — Smart India Hackathon 2026"
              minLength={5}
              maxLength={140}
              required
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ach-org" className="text-xs">
                Issuing Organization *
              </Label>
              <Input
                id="ach-org"
                value={issuingOrganization}
                onChange={(e) => setIssuingOrganization(e.target.value)}
                placeholder="e.g., Ministry of Education / AWS / IEEE"
                minLength={2}
                maxLength={120}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ach-date" className="text-xs">
                Issue / Completion Date *
              </Label>
              <Input
                id="ach-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ach-desc" className="text-xs">
              Description &amp; Impact *
            </Label>
            <Textarea
              id="ach-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize your achievement, project scope, or competition standing..."
              rows={3}
              minLength={15}
              maxLength={1000}
              required
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ach-skills" className="text-xs">
                Skill Tags (Comma-separated, max 10)
              </Label>
              <Input
                id="ach-skills"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder="Next.js, AI/ML, System Design"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ach-url" className="text-xs">
                Credential Verification URL (https://)
              </Label>
              <Input
                id="ach-url"
                type="url"
                value={credentialUrl}
                onChange={(e) => setCredentialUrl(e.target.value)}
                placeholder="https://credly.com/badges/..."
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Supporting Certificate / Proof Attachment (PDF/Image, max 25MB)
            </Label>
            <FileUploader
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              maxFiles={1}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isResubmit ? 'Resubmit for Verification' : 'Submit Proof for Endorsement'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
