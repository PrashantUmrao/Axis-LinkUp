'use client';

/**
 * Notice Detail & Statutory Acknowledgment Dialog.
 * Displays official collegiate bulletin contents, category metadata, and priority badges.
 * Enforces:
 * - Read receipt recording on view.
 * - Statutory acknowledgment without IP address collection (Approved Policy 5).
 * - Receipt analytics ledger for authors, HODs, Director, and SysAdmin.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Badge,
  Button,
} from '@/components/ui';
import {
  Megaphone,
  AlertTriangle,
  Clock,
  User,
  Building,
  CheckCircle2,
  FileText,
  Eye,
  CheckCheck,
  ShieldAlert,
} from 'lucide-react';
import type { NoticeDTO } from '@/types/notice';
import type { NoticeReceiptStatsDTO } from '@/types/notice-receipt';

interface NoticeDetailDialogProps {
  notice: NoticeDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onNoticeUpdated?: (updated: NoticeDTO) => void;
  currentUserRole?: string;
  currentUserId?: string;
}

export function NoticeDetailDialog({
  notice,
  isOpen,
  onClose,
  onNoticeUpdated,
  currentUserRole,
  currentUserId,
}: NoticeDetailDialogProps) {
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [showReceiptsTab, setShowReceiptsTab] = useState(false);
  const [receiptStats, setReceiptStats] = useState<NoticeReceiptStatsDTO | null>(null);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);

  const isAuthor =
    currentUserId &&
    notice &&
    (notice.author?.id === currentUserId ||
      (notice as unknown as { authorId?: string }).authorId === currentUserId);
  const isPrivileged =
    currentUserRole === 'super_admin' ||
    currentUserRole === 'admin' ||
    Boolean(isAuthor);

  // Auto-fetch receipt analytics if privileged and requested
  useEffect(() => {
    if (showReceiptsTab && notice && isPrivileged) {
      setIsLoadingReceipts(true);
      fetch(`/api/v1/notices/${notice.id}/receipts`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setReceiptStats(json.data);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingReceipts(false));
    }
  }, [showReceiptsTab, notice, isPrivileged]);

  if (!notice) return null;

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    setAckError(null);

    try {
      const res = await fetch(`/api/v1/notices/${notice.id}/receipt`, {
        method: 'POST',
      });
      const json = await res.json();

      if (!res.ok) {
        setAckError(json.error?.message || json.message || 'Failed to acknowledge notice.');
        return;
      }

      if (onNoticeUpdated) {
        onNoticeUpdated({
          ...notice,
          hasAcknowledged: true,
          acknowledgmentCount: notice.acknowledgmentCount + 1,
        });
      }
    } catch {
      setAckError('Network error while recording statutory acknowledgment.');
    } finally {
      setIsAcknowledging(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <Badge variant="destructive" className="gap-1 animate-pulse">
            <AlertTriangle className="size-3" />
            URGENT EMERGENCY
          </Badge>
        );
      case 'important':
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="size-3" />
            Important
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            General
          </Badge>
        );
    }
  };

  const getCategoryLabel = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-2 border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {getPriorityBadge(notice.priority)}
              <Badge variant="secondary" className="text-xs">
                {getCategoryLabel(notice.category)}
              </Badge>
              {notice.isPinned && (
                <Badge variant="outline" className="text-xs font-mono">
                  📌 Pinned
                </Badge>
              )}
            </div>

            <span className="text-xs text-muted-foreground font-mono">
              {new Date(notice.publishedAt || notice.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {notice.title}
          </DialogTitle>

          <DialogDescription className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <User className="size-3.5 text-primary" />
              {notice.author?.name || (notice as unknown as { authorSnapshot?: { name?: string } }).authorSnapshot?.name || 'Campus Administration'} ({((notice.author?.role || (notice as unknown as { authorSnapshot?: { role?: string } }).authorSnapshot?.role) ?? 'OFFICIAL').toUpperCase()})
            </span>
            {(notice.author?.departmentCode || (notice as unknown as { authorSnapshot?: { departmentName?: string } }).authorSnapshot?.departmentName) && (
              <span className="flex items-center gap-1.5">
                <Building className="size-3.5 text-primary" />
                {notice.author?.departmentCode || (notice as unknown as { authorSnapshot?: { departmentName?: string } }).authorSnapshot?.departmentName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Toggle for Privileged Authors / Admins */}
        {isPrivileged && (
          <div className="flex items-center gap-2 border-b border-border/30 pb-2 pt-1">
            <button
              type="button"
              onClick={() => setShowReceiptsTab(false)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                !showReceiptsTab
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="size-3.5" />
              Bulletin Content
            </button>
            <button
              type="button"
              onClick={() => setShowReceiptsTab(true)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                showReceiptsTab
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="size-3.5" />
              Readership Analytics ({notice.readCount} reads / {notice.acknowledgmentCount} acks)
            </button>
          </div>
        )}

        {!showReceiptsTab ? (
          <div className="space-y-4 py-2">
            {/* Notice Summary if provided */}
            {notice.summary && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/90 font-medium">
                {notice.summary}
              </div>
            )}

            {/* Markdown Body */}
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap rounded-xl border border-border/40 bg-card/40 p-4 font-sans text-sm">
              {notice.contentMarkdown}
            </div>

            {/* Attachments Section */}
            {notice.attachments && notice.attachments.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5" />
                  Official Circular Attachments ({notice.attachments.length})
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {notice.attachments.map((att, idx) => (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <span className="truncate font-medium text-foreground">{att.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {(att.sizeBytes / 1024).toFixed(0)} KB
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Mandatory Acknowledgment Banner (Policy 5) */}
            {notice.requiresAcknowledgment && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-amber-500" />
                    <span className="text-xs font-semibold text-foreground">
                      Mandatory Institutional Acknowledgment
                    </span>
                  </div>
                  {notice.hasAcknowledged ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/10 gap-1 text-[11px]">
                      <CheckCheck className="size-3.5" />
                      Acknowledged
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10 text-[11px]">
                      Pending Acknowledgment
                    </Badge>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This circular contains statutory academic or administrative terms requiring formal student / faculty receipt. Acknowledging verifies you have reviewed this bulletin.
                </p>

                {ackError && (
                  <p className="text-xs text-destructive font-medium">{ackError}</p>
                )}

                {!notice.hasAcknowledged && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      onClick={handleAcknowledge}
                      disabled={isAcknowledging}
                      className="gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <CheckCircle2 className="size-3.5" />
                      {isAcknowledging ? 'Recording Receipt...' : 'Acknowledge Bulletin'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Receipt Analytics Tab */
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                <div className="text-2xl font-bold text-foreground">
                  {receiptStats ? receiptStats.totalReads : notice.readCount}
                </div>
                <div className="text-xs text-muted-foreground font-medium">Total Views</div>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-500">
                  {receiptStats ? receiptStats.totalAcknowledgments : notice.acknowledgmentCount}
                </div>
                <div className="text-xs text-muted-foreground font-medium">Formal Acknowledgments</div>
              </div>
            </div>

            {isLoadingReceipts ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Loading readership ledger...
              </div>
            ) : receiptStats && receiptStats.receipts.length > 0 ? (
              <div className="space-y-1.5 max-h-60 overflow-y-auto rounded-xl border border-border/40 p-2">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1">
                  Recipient Ledger (Masked &amp; Privacy-Preserved)
                </div>
                {receiptStats.receipts.map((rcpt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-border/30 bg-card/60 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-medium text-foreground">{rcpt.userName}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground uppercase font-mono">
                        {rcpt.userRole}
                      </span>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground font-mono">
                      {rcpt.acknowledgedAt ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCheck className="size-3" />
                          Ack: {new Date(rcpt.acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span>Read: {new Date(rcpt.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No recipient receipts logged yet for this circular.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-t border-border/40 pt-4 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Megaphone className="size-3.5 text-primary" />
            <span>Collegiate Official Bulletin • AITM Kanpur</span>
          </div>

          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

