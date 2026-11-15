'use client';

/**
 * Detailed Grievance Docket & Resolution Tribunal View.
 * Displays complaint facts, student identity, statutory SLA timer,
 * full chronological official responses, resolution / escalation controls,
 * and immutable audit timeline.
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
  Input,
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
  AlertTriangle,
  History,
  Send,
  UserCheck,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import type { ComplaintDTO, ComplaintStatus, ComplaintTicket } from '@/types/complaints';
import type { UserRole } from '@/types/user';

interface ComplaintDetailModalProps {
  complaint: ComplaintDTO | ComplaintTicket | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  currentAdminSubRole?: string;
  currentUserId?: string;
  initialTab?: 'details' | 'dialogue' | 'timeline';
  onComplaintUpdated?: (updatedComplaint: ComplaintDTO) => void;
}

export function ComplaintDetailModal({
  complaint,
  isOpen,
  onClose,
  currentUserRole,
  currentAdminSubRole,
  currentUserId,
  initialTab = 'details',
  onComplaintUpdated,
}: ComplaintDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'dialogue' | 'timeline'>(initialTab);

  // Response composer state
  const [responseText, setResponseText] = useState('');
  const [actionTakenText, setActionTakenText] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // Status mutation modal state
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<ComplaintStatus>('under_review');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Escalation modal state
  const [isEscalateDialogOpen, setIsEscalateDialogOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [isSubmittingEscalate, setIsSubmittingEscalate] = useState(false);

  // Assignment modal state
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [assigneeRole, setAssigneeRole] = useState('Inquiry Faculty Mentor');
  const [assignRemarks, setAssignRemarks] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Student resolution / appeal state
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [closeRemarks, setCloseRemarks] = useState('');
  const [reopenRemarks, setReopenRemarks] = useState('');
  const [isSubmittingStudentAction, setIsSubmittingStudentAction] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!complaint) return null;

  const isOfficer =
    currentUserRole === 'faculty' ||
    currentUserRole === 'admin' ||
    (currentUserRole === 'super_admin' && currentAdminSubRole !== 'sys_admin');

  const isSysAdmin = currentUserRole === 'super_admin' && currentAdminSubRole === 'sys_admin';
  const isStudentOwner = currentUserRole === 'student' || (currentUserId && currentUserId === complaint.studentId);
  const isHod = currentAdminSubRole === 'hod' || (currentUserRole === 'faculty' && !isSysAdmin);

  const isClosed = complaint.status === 'closed' || complaint.status === 'rejected';

  // Cast to DTO if available
  const dto = complaint as ComplaintDTO;
  const slaRemainingHours = dto.slaRemainingHours ?? (complaint as ComplaintTicket).slaRemainingHours ?? 0;
  const isSlaBreached = dto.sla?.isBreached || slaRemainingHours <= 0;

  const getStatusBadge = (status: ComplaintStatus) => {
    switch (status) {
      case 'submitted':
        return <Badge variant="outline">Submitted</Badge>;
      case 'under_review':
        return <Badge variant="warning">Under Review</Badge>;
      case 'in_progress':
        return <Badge variant="info">In Progress</Badge>;
      case 'responded':
        return <Badge variant="info">Responded</Badge>;
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      case 'closed':
        return <Badge variant="outline">Closed</Badge>;
      case 'escalated':
        return <Badge variant="destructive">Escalated to Director</Badge>;
      case 'reopened':
        return <Badge variant="warning">Reopened</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive" className="uppercase text-[9px]">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning" className="uppercase text-[9px]">High</Badge>;
      case 'medium':
        return <Badge variant="info" className="uppercase text-[9px]">Medium</Badge>;
      default:
        return <Badge variant="outline" className="uppercase text-[9px]">Low</Badge>;
    }
  };

  // 1. Submit Dialogue Response (Officer or Student Follow-up)
  const handleSendResponse = async () => {
    if (!responseText.trim()) return;

    setIsSubmittingResponse(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaint.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: responseText.trim(),
          actionTaken: actionTakenText.trim() || undefined,
          isInternal: false,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to submit response');
      }

      setResponseText('');
      setActionTakenText('');
      onComplaintUpdated?.(json.data as ComplaintDTO);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error submitting response');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // 2. Perform Status Transition
  const handleUpdateStatus = async () => {
    if (!statusRemarks.trim() || statusRemarks.trim().length < 3) {
      setErrorMessage('Audit remarks must be at least 3 characters.');
      return;
    }

    setIsSubmittingStatus(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaint.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          remarks: statusRemarks.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to transition status');
      }

      setIsStatusDialogOpen(false);
      setStatusRemarks('');
      onComplaintUpdated?.(json.data as ComplaintDTO);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // 3. Escalate to Directorate
  const handleEscalate = async () => {
    if (!escalateReason.trim() || escalateReason.trim().length < 10) {
      setErrorMessage('Statutory escalation reason must be at least 10 characters.');
      return;
    }

    setIsSubmittingEscalate(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaint.id}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: escalateReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to escalate grievance');
      }

      setIsEscalateDialogOpen(false);
      setEscalateReason('');
      onComplaintUpdated?.(json.data as ComplaintDTO);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to escalate');
    } finally {
      setIsSubmittingEscalate(false);
    }
  };

  // 4. Assign Inquiry Officer
  const handleAssign = async () => {
    if (!assigneeId.trim() || !assigneeName.trim()) {
      setErrorMessage('Investigator user ID and name are required.');
      return;
    }

    setIsSubmittingAssign(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaint.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedToId: assigneeId.trim(),
          assignedToName: assigneeName.trim(),
          assignedToRole: assigneeRole.trim(),
          remarks: assignRemarks.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to assign investigator');
      }

      setIsAssignDialogOpen(false);
      setAssigneeId('');
      setAssigneeName('');
      setAssignRemarks('');
      onComplaintUpdated?.(json.data as ComplaintDTO);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to assign investigator');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // 5. Student Close Ticket
  const handleStudentClose = async () => {
    if (!closeRemarks.trim()) {
      setErrorMessage('Please confirm resolution remarks.');
      return;
    }

    setIsSubmittingStudentAction(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaint.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed',
          remarks: closeRemarks.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to close grievance');
      }

      setIsCloseDialogOpen(false);
      setCloseRemarks('');
      onComplaintUpdated?.(json.data as ComplaintDTO);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to close grievance');
    } finally {
      setIsSubmittingStudentAction(false);
    }
  };

  // 6. Student Reopen Ticket
  const handleStudentReopen = async () => {
    if (!reopenRemarks.trim()) {
      setErrorMessage('Please state your grounds for reopening the petition.');
      return;
    }

    setIsSubmittingStudentAction(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaint.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'reopened',
          remarks: reopenRemarks.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Failed to reopen grievance');
      }

      setIsReopenDialogOpen(false);
      setReopenRemarks('');
      onComplaintUpdated?.(json.data as ComplaintDTO);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reopen grievance');
    } finally {
      setIsSubmittingStudentAction(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="bg-card/95 border-glass-border max-h-[92vh] max-w-3xl space-y-5 overflow-y-auto border p-6 shadow-2xl backdrop-blur-2xl">
          {/* Header Strip */}
          <DialogHeader className="border-border/40 space-y-2 border-b p-0 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="px-2 py-0.5 font-mono text-xs">
                  {complaint.ticketNumber}
                </Badge>
                {getStatusBadge(complaint.status)}
                {getPriorityBadge(dto.priority)}
                <Badge variant="glass" className="text-[10px] capitalize">
                  {complaint.category.replace('_', ' ')}
                </Badge>
                {dto.escalatedToDirector && (
                  <Badge variant="destructive" className="text-[9px]">
                    Escalated
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 font-mono text-xs">
                {isSlaBreached ? (
                  <div className="flex items-center gap-1 text-rose-500 font-semibold">
                    <AlertTriangle className="size-3.5" />
                    <span>SLA Breached ({slaRemainingHours}h)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-amber-500">
                    <Clock className="size-3.5" />
                    <span>{slaRemainingHours}h SLA Remaining</span>
                  </div>
                )}
              </div>
            </div>

            <DialogTitle className="font-heading text-foreground text-lg leading-snug font-bold">
              {complaint.subject}
            </DialogTitle>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 pt-1 border-t border-border/20">
              <Button
                type="button"
                variant={activeTab === 'details' ? 'pill-primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('details')}
                className="h-7 text-xs"
              >
                Docket &amp; Evidence
              </Button>
              <Button
                type="button"
                variant={activeTab === 'dialogue' ? 'pill-primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('dialogue')}
                className="h-7 text-xs gap-1.5"
              >
                <MessageSquare className="size-3" />
                Dialogue Thread ({complaint.responses.length})
              </Button>
              <Button
                type="button"
                variant={activeTab === 'timeline' ? 'pill-primary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('timeline')}
                className="h-7 text-xs gap-1.5"
              >
                <History className="size-3" />
                Audit Trail ({dto.timeline?.length || 0})
              </Button>
            </div>
          </DialogHeader>

          {/* System Administrator Confidentiality Alert */}
          {isSysAdmin && (
            <div className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-2.5 rounded-xl border p-3 text-xs leading-relaxed">
              <ShieldAlert className="size-4 shrink-0 text-amber-500" />
              <span>
                <strong>Confidential Grievance Record:</strong> In accordance with institutional confidentiality regulations, substantive student allegations and communications are redacted from IT System Administrators and reserved exclusively for the Statutory Tribunal.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-destructive/10 border-destructive/20 text-destructive flex items-center gap-2 rounded-xl border p-3 text-xs">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: DETAILS & EVIDENCE */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Complainant & Authority Snapshot Card */}
              <div className="bg-card/40 border-glass-border grid grid-cols-1 gap-3.5 rounded-xl border p-4 text-xs sm:grid-cols-2">
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
                  {dto.student?.program && (
                    <p className="text-muted-foreground text-[10px]">
                      Program: {dto.student.program} • Sem {dto.student.currentSemester || 'N/A'} • Sec {dto.student.section || 'A'}
                    </p>
                  )}
                </div>

                <div className="sm:border-border/30 space-y-1 sm:border-l sm:pl-3.5">
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Tribunal &amp; Assignment
                  </span>
                  <div className="flex items-center gap-2">
                    <Scale className="size-4 text-indigo-500" />
                    <span className="text-foreground font-semibold">{complaint.recipientName}</span>
                  </div>
                  {dto.assignedTo?.name ? (
                    <div className="flex items-center gap-1.5 text-emerald-500 text-[11px]">
                      <UserCheck className="size-3.5" />
                      <span>Investigator: {dto.assignedTo.name} ({dto.assignedTo.role || 'Officer'})</span>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-[11px]">No external investigator assigned</p>
                  )}
                  <p className="text-muted-foreground text-[10px]">Filed: {new Date(complaint.submittedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Escalation Callout if escalated */}
              {dto.escalation?.isEscalated && (
                <div className="bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl border p-3.5 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ArrowUpRight className="size-4" />
                    <span>Statutory Directorate Appeal Recorded</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Escalation Grounds: {dto.escalation.reason || 'Escalated by Department HOD'}
                  </p>
                  <p className="text-muted-foreground font-mono text-[10px]">
                    Escalated by {dto.escalation.escalatedByName || 'Department Officer'}
                  </p>
                </div>
              )}

              {/* Detailed Narrative Statement */}
              <div className="space-y-1.5">
                <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Petition Statement &amp; Factual Grounds
                </h4>
                <div className="bg-card/30 border-glass-border text-foreground rounded-xl border p-4 text-xs leading-relaxed whitespace-pre-wrap select-text sm:text-sm">
                  {dto.description || complaint.narrative}
                </div>
              </div>

              {/* Supporting Evidence Docket */}
              <div className="space-y-2">
                <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Supporting Evidence Docket
                </h4>
                {(!dto.detailedAttachments || dto.detailedAttachments.length === 0) &&
                (!complaint.attachments || complaint.attachments.length === 0) ? (
                  <p className="text-muted-foreground text-xs italic">
                    No documentary evidence docket uploaded with this petition.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {dto.detailedAttachments && dto.detailedAttachments.length > 0
                      ? dto.detailedAttachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="bg-card/50 border-glass-border flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
                          >
                            <FileText className="text-primary size-4" />
                            <span className="text-foreground font-medium">{att.name}</span>
                            {att.sizeBytes ? (
                              <span className="text-muted-foreground text-[10px]">
                                ({(att.sizeBytes / 1024).toFixed(1)} KB)
                              </span>
                            ) : null}
                            {att.url && (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline ml-1"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        ))
                      : complaint.attachments?.map((file, idx) => (
                          <div
                            key={idx}
                            className="bg-card/50 border-glass-border flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs"
                          >
                            <FileText className="text-primary size-4" />
                            <span className="text-foreground font-medium">{file}</span>
                            <Badge variant="outline" className="px-1 py-0 text-[9px]">
                              Proof Docket
                            </Badge>
                          </div>
                        ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DIALOGUE RESPONSES */}
          {activeTab === 'dialogue' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-heading text-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                  <MessageSquare className="text-primary size-3.5" />
                  Official Tribunal Response Chain ({complaint.responses.length})
                </h4>
                <span className="text-muted-foreground text-[10px]">AICTE Immutable Log</span>
              </div>

              {complaint.responses.length === 0 ? (
                <div className="bg-card/20 border-glass-border text-muted-foreground rounded-xl border p-6 text-center text-xs">
                  No official responses recorded yet. Authority review currently underway.
                </div>
              ) : (
                <div className="divide-border/20 space-y-3.5 divide-y">
                  {complaint.responses.map((resp) => (
                    <div key={resp.id} className="space-y-1.5 pt-3 first:pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-foreground text-xs font-bold">
                            {resp.authorName}
                          </span>
                          <Badge variant="glass" className="px-1.5 py-0 font-mono text-[9px] uppercase">
                            {resp.authorRole}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {resp.timestamp}
                        </span>
                      </div>

                      <p className="text-foreground bg-card/40 border-glass-border rounded-xl border p-3.5 text-xs leading-relaxed sm:text-sm">
                        {resp.message}
                      </p>

                      {resp.actionTaken && (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                          <CheckCircle2 className="size-3" />
                          <span>Action Taken: {resp.actionTaken}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Dialogue Composer for Officers and Complainant Students */}
              {!isSysAdmin && !isClosed && (
                <div className="border-border/30 space-y-3 border-t pt-3">
                  <label className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                    <ShieldCheck className="size-3.5 text-emerald-500" />
                    {isOfficer
                      ? 'Authority Response & Inquiry Finding'
                      : 'Append Complainant Follow-Up Information'}
                  </label>

                  <Textarea
                    placeholder={
                      isOfficer
                        ? 'Record official inquiry findings, schedule hearing, or state resolution directive...'
                        : 'Provide additional factual clarifications, screenshots, or followup comments...'
                    }
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="bg-card/40 border-glass-border min-h-[90px] text-xs sm:text-sm"
                  />

                  {isOfficer && (
                    <Input
                      placeholder="Optional Action Taken Summary (e.g. Lab Switch Replaced, Ledger Corrected)"
                      value={actionTakenText}
                      onChange={(e) => setActionTakenText(e.target.value)}
                      className="bg-card/40 border-glass-border h-8 text-xs"
                    />
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="pill-primary"
                      size="sm"
                      disabled={!responseText.trim() || isSubmittingResponse}
                      onClick={handleSendResponse}
                      className="gap-1.5 text-xs shadow-xs"
                    >
                      <Send className="size-3" />
                      <span>{isSubmittingResponse ? 'Posting...' : 'Record Message'}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: IMMUTABLE AUDIT TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-heading text-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                  <History className="text-primary size-3.5" />
                  Statutory Life-Cycle Timeline
                </h4>
                <span className="text-muted-foreground text-[10px]">Tamper-Proof Audit Trail</span>
              </div>

              {!dto.timeline || dto.timeline.length === 0 ? (
                <div className="bg-card/20 border-glass-border text-muted-foreground rounded-xl border p-6 text-center text-xs">
                  No lifecycle mutations logged yet. Initial petition registered.
                </div>
              ) : (
                <div className="space-y-3">
                  {dto.timeline.map((evt, idx) => (
                    <div
                      key={evt.id || idx}
                      className="bg-card/30 border-glass-border rounded-xl border p-3.5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {evt.action}
                          </Badge>
                          <span className="text-foreground font-semibold">{evt.changedByName}</span>
                          <span className="text-muted-foreground text-[10px]">({evt.changedByRole})</span>
                        </div>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>

                      {evt.previousStatus !== evt.newStatus && (
                        <div className="text-[11px] text-muted-foreground">
                          Status Transition: <strong className="text-foreground">{evt.previousStatus}</strong> &rarr;{' '}
                          <strong className="text-foreground">{evt.newStatus}</strong>
                        </div>
                      )}

                      {evt.remarks && (
                        <p className="text-foreground bg-card/40 rounded-lg p-2.5 text-xs leading-relaxed">
                          {evt.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Footer Bar */}
          <div className="border-border/30 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            {/* Left side actions (Student Close/Reopen) */}
            <div className="flex flex-wrap items-center gap-2">
              {isStudentOwner && complaint.status === 'resolved' && (
                <>
                  <Button
                    type="button"
                    variant="pill-primary"
                    size="sm"
                    onClick={() => setIsCloseDialogOpen(true)}
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs shadow-xs"
                  >
                    <CheckCircle2 className="size-3" />
                    Accept Resolution &amp; Close
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReopenDialogOpen(true)}
                    className="gap-1 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 text-xs"
                  >
                    <RotateCcw className="size-3" />
                    Appeal / Reopen
                  </Button>
                </>
              )}

              {/* Officer Decision Controls */}
              {isOfficer && !isClosed && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsStatusDialogOpen(true)}
                    className="text-xs"
                  >
                    Update Status
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAssignDialogOpen(true)}
                    className="gap-1 text-xs"
                  >
                    <UserCheck className="size-3" />
                    Assign Officer
                  </Button>

                  {isHod && !dto.escalatedToDirector && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEscalateDialogOpen(true)}
                      className="gap-1 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    >
                      <ArrowUpRight className="size-3" />
                      Escalate to Director
                    </Button>
                  )}
                </>
              )}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close Docket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SUB-DIALOG: STATUS TRANSITION */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Advance Grievance Lifecycle Status</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">Select Target Status</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as ComplaintStatus)}
                className="bg-card border-border w-full rounded-lg border p-2 text-xs"
              >
                <option value="under_review">Under Review</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected (Dismissed)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold">Statutory Audit Remarks (Mandatory)</label>
              <Textarea
                placeholder="Detail the official reason or resolution directive for this transition..."
                value={statusRemarks}
                onChange={(e) => setStatusRemarks(e.target.value)}
                className="min-h-[80px] text-xs"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsStatusDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="pill-primary"
              size="sm"
              disabled={isSubmittingStatus || !statusRemarks.trim()}
              onClick={handleUpdateStatus}
              className="text-xs"
            >
              {isSubmittingStatus ? 'Updating...' : 'Confirm Status Mutation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SUB-DIALOG: ESCALATE TO DIRECTOR */}
      <Dialog open={isEscalateDialogOpen} onOpenChange={setIsEscalateDialogOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-rose-500">
              Escalate to Directorate Ombudsman
            </DialogTitle>
          </DialogHeader>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Escalating will transfer primary adjudication to the Executive Director. SLA will recalibrate to 7 calendar days.
          </p>

          <div>
            <label className="text-xs font-semibold">Statutory Escalation Reason (Min 10 characters)</label>
            <Textarea
              placeholder="Explain why this grievance cannot be resolved at the department level..."
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              className="min-h-[90px] text-xs"
              required
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEscalateDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isSubmittingEscalate || escalateReason.trim().length < 10}
              onClick={handleEscalate}
              className="text-xs"
            >
              {isSubmittingEscalate ? 'Escalating...' : 'Confirm Directorate Escalation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SUB-DIALOG: ASSIGN INQUIRY OFFICER */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Assign Grievance Inquiry Officer</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold">Faculty / Officer User ID</label>
              <Input
                placeholder="MongoDB ObjectId (e.g. 6730a005f8b1a2001a000080)"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Officer Full Name</label>
              <Input
                placeholder="Prof. Ramesh Chandra"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Designated Role / Title</label>
              <Input
                placeholder="Lab In-Charge Faculty / Inquiry Mentor"
                value={assigneeRole}
                onChange={(e) => setAssigneeRole(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Investigation Directive / Remarks</label>
              <Textarea
                placeholder="Please audit workstation switch ports and submit report..."
                value={assignRemarks}
                onChange={(e) => setAssignRemarks(e.target.value)}
                className="min-h-[70px] text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAssignDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="pill-primary"
              size="sm"
              disabled={isSubmittingAssign || !assigneeId.trim() || !assigneeName.trim()}
              onClick={handleAssign}
              className="text-xs"
            >
              {isSubmittingAssign ? 'Designating...' : 'Assign Investigator'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SUB-DIALOG: STUDENT CONFIRM RESOLUTION */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-emerald-600">
              Confirm Resolution &amp; Close Grievance
            </DialogTitle>
          </DialogHeader>

          <p className="text-muted-foreground text-xs leading-relaxed">
            By closing this petition, you confirm that your grievance has been addressed satisfactorily by the institution.
          </p>

          <div>
            <label className="text-xs font-semibold">Satisfaction Feedback / Remarks</label>
            <Textarea
              placeholder="e.g. Issue resolved satisfactorily after lab workstation switch was replaced."
              value={closeRemarks}
              onChange={(e) => setCloseRemarks(e.target.value)}
              className="min-h-[80px] text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCloseDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="pill-primary"
              size="sm"
              disabled={isSubmittingStudentAction || !closeRemarks.trim()}
              onClick={handleStudentClose}
              className="bg-emerald-600 hover:bg-emerald-700 text-xs shadow-xs"
            >
              {isSubmittingStudentAction ? 'Closing...' : 'Confirm &amp; Close Docket'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SUB-DIALOG: STUDENT APPEAL / REOPEN */}
      <Dialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-amber-500">
              Appeal Resolution &amp; Reopen Grievance
            </DialogTitle>
          </DialogHeader>

          <p className="text-muted-foreground text-xs leading-relaxed">
            If the resolution directive was not implemented or the underlying issue has recurred, detail your appeal grounds below.
          </p>

          <div>
            <label className="text-xs font-semibold">Appeal Grounds (Mandatory)</label>
            <Textarea
              placeholder="Detail why the resolution is incomplete or what issues remain unaddressed..."
              value={reopenRemarks}
              onChange={(e) => setReopenRemarks(e.target.value)}
              className="min-h-[80px] text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsReopenDialogOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isSubmittingStudentAction || !reopenRemarks.trim()}
              onClick={handleStudentReopen}
              className="text-xs"
            >
              {isSubmittingStudentAction ? 'Reopening...' : 'Submit Appeal to Tribunal'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
