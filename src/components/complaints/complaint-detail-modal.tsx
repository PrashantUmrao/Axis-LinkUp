'use client';

/**
 * Detailed Grievance Docket & Resolution Tribunal View.
 * Displays complaint facts, student identity, statutory SLA timer,
 * full chronological official responses, and resolution / escalation controls.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Badge,
  Button,
  Textarea,
} from '@/components/ui';
import {
  Scale,
  Clock,
  ShieldCheck,
  User,
  FileText,
  MessageSquare,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import type { ComplaintTicket } from '@/types/complaints';
import type { UserRole } from '@/types/user';

interface ComplaintDetailModalProps {
  complaint: ComplaintTicket | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  onAddResponse?: (
    complaintId: string,
    responseText: string,
    action?: 'resolve' | 'escalate'
  ) => void;
}

export function ComplaintDetailModal({
  complaint,
  isOpen,
  onClose,
  currentUserRole,
  onAddResponse,
}: ComplaintDetailModalProps) {
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!complaint) return null;

  const isOfficer =
    currentUserRole === 'faculty' ||
    currentUserRole === 'admin' ||
    currentUserRole === 'super_admin';

  const handleSendResponse = (action?: 'resolve' | 'escalate') => {
    if (!responseText.trim() || !onAddResponse) return;
    setIsSubmitting(true);
    onAddResponse(complaint.id, responseText.trim(), action);
    setResponseText('');
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: ComplaintTicket['status']) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="outline">Submitted</Badge>;
      case 'under_review':
        return <Badge variant="warning">Under Review</Badge>;
      case 'responded':
        return <Badge variant="info">Responded</Badge>;
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      case 'escalated':
        return <Badge variant="destructive">Escalated to Director</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card/95 border-glass-border max-h-[90vh] max-w-2xl space-y-6 overflow-y-auto border p-6 shadow-2xl backdrop-blur-2xl">
        {/* Header Strip */}
        <DialogHeader className="border-border/40 space-y-2 border-b p-0 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-2 py-0.5 font-mono text-xs">
                {complaint.ticketNumber}
              </Badge>
              {getStatusBadge(complaint.status)}
              <Badge variant="glass" className="text-[10px] capitalize">
                {complaint.category.replace('_', ' ')}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs text-amber-500">
              <Clock className="size-3.5" />
              <span>{complaint.slaRemainingHours}h SLA Active</span>
            </div>
          </div>

          <DialogTitle className="font-heading text-foreground text-lg leading-snug font-bold">
            {complaint.subject}
          </DialogTitle>
        </DialogHeader>

        {/* Complainant & Addressing Authority Info */}
        <div className="bg-card/40 border-glass-border grid grid-cols-1 gap-3 rounded-xl border p-3.5 text-xs sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Complainant Student
            </span>
            <div className="flex items-center gap-2">
              <User className="text-primary size-4" />
              <span className="text-foreground font-semibold">{complaint.studentName}</span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Roll: {complaint.studentRoll} • {complaint.department}
            </p>
          </div>

          <div className="sm:border-border/30 space-y-1 sm:border-l sm:pl-3">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Addressed Authority
            </span>
            <div className="flex items-center gap-2">
              <Scale className="size-4 text-indigo-500" />
              <span className="text-foreground font-semibold">{complaint.recipientName}</span>
            </div>
            <p className="text-muted-foreground text-[11px]">Filed: {complaint.submittedAt}</p>
          </div>
        </div>

        {/* Detailed Narrative Statement */}
        <div className="space-y-1.5">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Petition Statement &amp; Grounds
          </h4>
          <div className="bg-card/30 border-glass-border text-foreground rounded-xl border p-4 text-xs leading-relaxed whitespace-pre-wrap select-text sm:text-sm">
            {complaint.narrative}
          </div>
        </div>

        {/* Attachments if any */}
        {complaint.attachments && complaint.attachments.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Supporting Evidence Docket
            </h4>
            <div className="flex flex-wrap gap-2">
              {complaint.attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="bg-card/50 border-glass-border flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
                >
                  <FileText className="text-primary size-4" />
                  <span className="text-foreground font-medium">{file}</span>
                  <Badge variant="outline" className="px-1 py-0 text-[9px]">
                    Verified Proof
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Official Response History Timeline */}
        <div className="border-border/30 space-y-3 border-t pt-2">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
              <MessageSquare className="text-primary size-3.5" />
              Official Tribunal Response Chain ({complaint.responses.length})
            </h4>
            <span className="text-muted-foreground text-[10px]">Immutable Redressal Record</span>
          </div>

          {complaint.responses.length === 0 ? (
            <div className="bg-card/20 border-glass-border text-muted-foreground rounded-xl border p-4 text-center text-xs">
              No official responses recorded yet. Authority review currently underway.
            </div>
          ) : (
            <div className="divide-border/20 space-y-3 divide-y">
              {complaint.responses.map((resp) => (
                <div key={resp.id} className="space-y-1.5 pt-3 first:pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-foreground text-xs font-bold">
                        {resp.authorName}
                      </span>
                      <Badge variant="glass" className="px-1 py-0 font-mono text-[9px] uppercase">
                        {resp.authorRole}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {resp.timestamp}
                    </span>
                  </div>

                  <p className="text-foreground bg-card/40 border-glass-border rounded-xl border p-3 text-xs leading-relaxed sm:text-sm">
                    {resp.message}
                  </p>

                  {resp.actionTaken && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                      <CheckCircle2 className="size-3" />
                      Action: {resp.actionTaken}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Response Composer for Authorized Officers */}
        {isOfficer && (
          <div className="border-border/30 space-y-3 border-t pt-3">
            <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              Authority Response &amp; Official Finding
            </label>

            <Textarea
              placeholder="Record official inquiry findings, schedule hearing, or state resolution directive..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              className="bg-card/40 border-glass-border min-h-[90px] text-xs sm:text-sm"
            />

            <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!responseText.trim() || isSubmitting}
                  onClick={() => handleSendResponse()}
                  className="text-xs"
                >
                  Record Response
                </Button>

                <Button
                  type="button"
                  variant="pill-primary"
                  size="sm"
                  disabled={!responseText.trim() || isSubmitting}
                  onClick={() => handleSendResponse('resolve')}
                  className="gap-1 bg-emerald-600 text-xs hover:bg-emerald-700"
                >
                  <CheckCircle2 className="size-3" />
                  Resolve Grievance
                </Button>
              </div>

              {currentUserRole === 'faculty' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!responseText.trim() || isSubmitting}
                  onClick={() => handleSendResponse('escalate')}
                  className="gap-1 text-xs text-rose-500 hover:text-rose-600"
                >
                  <ArrowUpRight className="size-3" />
                  Escalate to Director
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Close Button */}
        <div className="border-border/30 flex justify-end border-t pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close Docket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
