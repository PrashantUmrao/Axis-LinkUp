'use client';

/**
 * Interactive Campus Poll Card Component.
 * Supports:
 * - Single-choice and multiple-choice voting.
 * - Selection limit validation.
 * - Confirmation before submission.
 * - Strict ballot immutability protection (Approved Policy 2).
 * - Context-aware result percentage bar visualizations.
 * - Early closure & archival for creators and administrators.
 */

import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
} from '@/components/ui';
import {
  BarChart3,
  CheckCircle2,
  Lock,
  Vote,
  Clock,
  Archive,
  XCircle,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import type { PollDTO } from '@/types/poll';

interface PollCardProps {
  poll: PollDTO;
  onPollUpdated?: (updated: PollDTO) => void;
  currentUserRole?: string;
  currentUserId?: string;
}

export function PollCard({
  poll,
  onPollUpdated,
  currentUserRole,
  currentUserId,
}: PollCardProps) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    poll.selectedOptionIds || (poll as unknown as { userVotedOptionIds?: string[] }).userVotedOptionIds || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const isCreator =
    currentUserId &&
    (poll.creator?.id === currentUserId ||
      (poll as unknown as { creatorId?: string }).creatorId === currentUserId);
  const isPrivileged =
    currentUserRole === 'super_admin' ||
    currentUserRole === 'admin' ||
    Boolean(isCreator);

  const isExpired = poll.expiresAt ? new Date() >= new Date(poll.expiresAt) : false;
  const isVotingActive = poll.status === 'active' && !isExpired && !poll.hasVoted;

  const handleOptionToggle = (optionId: string) => {
    if (!isVotingActive) return;

    if (poll.type === 'single') {
      setSelectedOptions([optionId]);
    } else {
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter((id) => id !== optionId));
      } else {
        if (selectedOptions.length >= poll.maxSelections) {
          setErrorMessage(`You may select at most ${poll.maxSelections} choices.`);
          return;
        }
        setErrorMessage(null);
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };

  const handleVoteSubmit = async () => {
    if (selectedOptions.length === 0) {
      setErrorMessage('Please select at least one choice to cast your ballot.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedOptionIds: selectedOptions,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.error?.message || json.message || 'Failed to submit ballot.');
        setShowConfirm(false);
        return;
      }

      // Fetch fresh poll state with unmasked results
      const pollRes = await fetch(`/api/v1/polls/${poll.id}`);
      const pollJson = await pollRes.json();

      if (pollRes.ok && onPollUpdated) {
        onPollUpdated(pollJson.data);
      }
      setShowConfirm(false);
    } catch {
      setErrorMessage('Network error while recording ballot.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePoll = async () => {
    setIsClosing(true);
    try {
      const res = await fetch(`/api/v1/polls/${poll.id}/close`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && onPollUpdated) {
        onPollUpdated(json.data);
      }
    } catch {
      setErrorMessage('Failed to close poll.');
    } finally {
      setIsClosing(false);
    }
  };

  const handleArchivePoll = async () => {
    try {
      const res = await fetch(`/api/v1/polls/${poll.id}/archive`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && onPollUpdated) {
        onPollUpdated(json.data);
      }
    } catch {
      setErrorMessage('Failed to archive poll.');
    }
  };

  // Check if results are visible to the caller
  const areResultsVisible = poll.options.length > 0 && poll.options[0]?.percentage !== undefined;

  return (
    <Card variant="glass" className="space-y-4 p-5 shadow-sm transition-all hover:border-primary/30">
      {/* Header */}
      <CardHeader className="border-b border-border/40 p-0 pb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-[11px] font-mono">
              <BarChart3 className="size-3 text-cyan-500" />
              {poll.type === 'single' ? 'Single Choice' : `Multi Choice (Max ${poll.maxSelections})`}
            </Badge>

            {poll.isAnonymous && (
              <Badge variant="glass" className="gap-1 text-[11px] text-emerald-500 border-emerald-500/20">
                <Lock className="size-3" />
                Anonymous
              </Badge>
            )}

            {poll.status === 'closed' && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <XCircle className="size-3" />
                Poll Closed
              </Badge>
            )}

            {isExpired && poll.status === 'active' && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <Clock className="size-3" />
                Expired
              </Badge>
            )}
          </div>

          <span className="text-[11px] text-muted-foreground font-mono">
            By {poll.creator?.name || (poll as unknown as { creatorSnapshot?: { name?: string } }).creatorSnapshot?.name || 'Academic Administration'} ({poll.creator?.departmentCode || (poll as unknown as { creatorSnapshot?: { departmentCode?: string } }).creatorSnapshot?.departmentCode || 'Campus'})
          </span>
        </div>

        <CardTitle className="text-base font-bold text-foreground leading-snug">
          {poll.question}
        </CardTitle>

        {poll.description && (
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            {poll.description}
          </CardDescription>
        )}
      </CardHeader>

      {/* Content: Options List */}
      <CardContent className="space-y-3 p-0 pt-1">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-2.5">
          {poll.options.map((option) => {
            const isSelected = selectedOptions.includes(option.id);
            const isUserChoice = (poll.selectedOptionIds || (poll as unknown as { userVotedOptionIds?: string[] }).userVotedOptionIds)?.includes(option.id);
            const percentage = option.percentage ?? 0;

            return (
              <div
                key={option.id}
                onClick={() => isVotingActive && handleOptionToggle(option.id)}
                className={`relative overflow-hidden rounded-xl border p-3 transition-all ${
                  isVotingActive
                    ? 'cursor-pointer hover:border-primary/40 hover:bg-card/80'
                    : 'cursor-default'
                } ${
                  isSelected
                    ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border/50 bg-card/40'
                }`}
              >
                {/* Result Progress Bar Background */}
                {areResultsVisible && (
                  <div
                    className={`absolute inset-0 transition-all duration-700 ease-out ${
                      isUserChoice ? 'bg-primary/15' : 'bg-muted/40'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                )}

                {/* Option Text & Tallies */}
                <div className="relative flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    {/* Choice Indicator */}
                    <div
                      className={`flex size-4 shrink-0 items-center justify-center rounded-${
                        poll.type === 'single' ? 'full' : 'sm'
                      } border ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40 bg-background'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="size-3" />}
                    </div>

                    <span className={`font-medium ${isUserChoice ? 'text-primary font-semibold' : 'text-foreground'}`}>
                      {option.text}
                    </span>

                    {isUserChoice && (
                      <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Your Vote
                      </span>
                    )}
                  </div>

                  {/* Percentage & Vote Count (Context-Aware) */}
                  {areResultsVisible && (
                    <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                      <span className="text-muted-foreground">
                        {option.voteCount ?? 0} {option.voteCount === 1 ? 'vote' : 'votes'}
                      </span>
                      <span className="font-bold text-foreground">{percentage}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Visibility Footnote */}
        {!areResultsVisible && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground italic px-1">
            <Lock className="size-3" />
            {poll.resultsVisibility === 'after_vote' && 'Results will be revealed once you cast your ballot.'}
            {poll.resultsVisibility === 'after_close' && 'Results will be published after the voting deadline closes.'}
            {poll.resultsVisibility === 'creator_only' && 'Results are confidential to institutional coordinators.'}
          </div>
        )}

        {/* Ballot Immutability Notice (Policy 2) */}
        {poll.hasVoted && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              <span>Ballot submitted &amp; cryptographically sealed (Policy 2: Strictly Immutable).</span>
            </div>
            {poll.totalVotes !== undefined && (
              <span className="font-mono font-bold text-xs">{poll.totalVotes} total ballots</span>
            )}
          </div>
        )}
      </CardContent>

      {/* Footer & Actions */}
      <CardFooter className="border-t border-border/40 p-0 pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          {poll.expiresAt ? (
            <span>Ends {new Date(poll.expiresAt).toLocaleDateString()}</span>
          ) : (
            <span>No expiry set</span>
          )}
        </div>

        {/* Voting Submission Flow */}
        {isVotingActive && (
          <div>
            {!showConfirm ? (
              <Button
                size="sm"
                onClick={() => {
                  if (selectedOptions.length === 0) {
                    setErrorMessage('Please select a choice first.');
                    return;
                  }
                  setShowConfirm(true);
                }}
                className="gap-1.5 text-xs font-semibold"
              >
                <Vote className="size-3.5" />
                Submit Ballot
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowConfirm(false)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  Change
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleVoteSubmit}
                  disabled={isSubmitting}
                  className="gap-1 text-xs font-semibold"
                >
                  <Lock className="size-3" />
                  {isSubmitting ? 'Sealing...' : 'Confirm (Cannot Change)'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Creator / Admin Controls */}
        {isPrivileged && poll.status === 'active' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleClosePoll}
            disabled={isClosing}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Clock className="size-3" />
            {isClosing ? 'Closing...' : 'Close Poll'}
          </Button>
        )}

        {isPrivileged && poll.status === 'closed' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleArchivePoll}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Archive className="size-3" />
            Archive
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

