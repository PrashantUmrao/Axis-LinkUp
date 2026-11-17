'use client';

/**
 * Student Request Detail Modal Component (MOD-13 / Phase 5.8).
 * Detailed view of a student's requisition, student snapshot, evidence attachments, and lifecycle stepper.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Badge,
  Button,
} from '@/components/ui';
import {
  FileText,
  Calendar,
  CreditCard,
  Cpu,
  HelpCircle,
  Download,
  Paperclip,
  XCircle,
  FileCheck,
} from 'lucide-react';
import { RequestStatusStepper } from './request-status-stepper';
import type {
  ServiceRequestDTO,
  BonafideDetails,
  LeaveDetails,
  IdReplacementDetails,
  LabAccessDetails,
  GeneralInquiryDetails,
} from '@/types/service-request';

interface StudentRequestDetailModalProps {
  request: ServiceRequestDTO | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StudentRequestDetailModal({
  request,
  isOpen,
  onClose,
}: StudentRequestDetailModalProps) {
  if (!request) return null;

  const getCategoryIcon = () => {
    switch (request.category) {
      case 'bonafide':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'leave':
        return <Calendar className="h-4 w-4 text-emerald-500" />;
      case 'id_replacement':
        return <CreditCard className="h-4 w-4 text-purple-500" />;
      case 'lab_access':
        return <Cpu className="h-4 w-4 text-indigo-500" />;
      case 'general_inquiry':
        return <HelpCircle className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (request.status) {
      case 'submitted':
        return <Badge variant="outline">Submitted</Badge>;
      case 'under_review':
        return <Badge variant="secondary">Under Review</Badge>;
      case 'action_required':
        return <Badge variant="warning">Action Required</Badge>;
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'fulfilled':
        return <Badge variant="default">Fulfilled</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-primary tracking-wide">
                {request.ticketNumber}
              </span>
              {getStatusBadge()}
              {request.priority === 'urgent' && (
                <Badge variant="destructive">Urgent</Badge>
              )}
            </div>
            <time className="text-xs text-muted-foreground">
              Applied {new Date(request.createdAt).toLocaleDateString()}
            </time>
          </div>
          <DialogTitle className="text-lg font-bold mt-1 text-foreground">
            {request.subject}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {getCategoryIcon()}
            <span className="capitalize font-medium text-foreground">
              {request.category.replace('_', ' ')} Requisition
            </span>
            <span>&bull;</span>
            <span>{request.studentSnapshot.department}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-3">
          {/* Student Profile Snapshot */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Applicant Snapshot
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block">Student Name:</span>
                <span className="font-medium text-foreground">
                  {request.studentSnapshot.fullName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Enrollment No:</span>
                <span className="font-mono font-medium text-foreground">
                  {request.studentSnapshot.enrollmentNo}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Department / Branch:</span>
                <span className="font-medium text-foreground truncate block">
                  {request.studentSnapshot.department} ({request.studentSnapshot.branch})
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Semester & Section:</span>
                <span className="font-medium text-foreground">
                  Sem {request.studentSnapshot.semester} - Sec {request.studentSnapshot.section}
                </span>
              </div>
            </div>
          </div>

          {/* Contextual Category Details */}
          <div className="rounded-lg border border-border/80 p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Application Details
            </h4>

            {request.category === 'bonafide' && (() => {
              const details = request.details as BonafideDetails;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Stated Purpose:</span>
                    <span className="font-medium capitalize text-foreground">
                      {details.purpose?.replace('_', ' ')}
                    </span>
                  </div>
                  {details.customPurpose && (
                    <div>
                      <span className="text-muted-foreground block">Custom Specification:</span>
                      <span className="font-medium text-foreground">
                        {details.customPurpose}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {request.category === 'leave' && (() => {
              const details = request.details as LeaveDetails;
              return (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-muted-foreground block">From:</span>
                      <span className="font-medium text-foreground">
                        {new Date(details.startDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">To:</span>
                      <span className="font-medium text-foreground">
                        {new Date(details.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Emergency Contact:</span>
                      <span className="font-medium text-foreground">
                        {details.emergencyContact}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Reason for Leave:</span>
                    <p className="mt-1 text-muted-foreground bg-muted/30 p-2.5 rounded-md border border-border/50">
                      {details.reason}
                    </p>
                  </div>
                </div>
              );
            })()}

            {request.category === 'id_replacement' && (() => {
              const details = request.details as IdReplacementDetails;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Replacement Grounds:</span>
                    <span className="font-medium capitalize text-foreground">
                      {details.reason}
                    </span>
                  </div>
                  {details.policeReportRef && (
                    <div>
                      <span className="text-muted-foreground block">Police GD Reference:</span>
                      <span className="font-mono font-medium text-foreground">
                        {details.policeReportRef}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {request.category === 'lab_access' && (() => {
              const details = request.details as LabAccessDetails;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Lab Facility:</span>
                    <span className="font-medium text-foreground">{details.labName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Supervising Faculty:</span>
                    <span className="font-medium text-foreground">{details.facultySupervisor}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Hours per Day:</span>
                    <span className="font-medium text-foreground">{details.durationHours} hrs</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Required Dates:</span>
                    <span className="font-medium text-foreground">{details.requiredDates}</span>
                  </div>
                </div>
              );
            })()}

            {request.category === 'general_inquiry' && (() => {
              const details = request.details as GeneralInquiryDetails;
              return (
                <div className="text-xs space-y-1">
                  <span className="text-muted-foreground block">Inquiry / Requisition Text:</span>
                  <p className="text-foreground bg-muted/30 p-3 rounded-md border border-border/50 whitespace-pre-wrap">
                    {details.queryDetails}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Attached Evidence ({request.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {request.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 hover:bg-muted/40 transition-colors text-xs group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate font-medium text-foreground group-hover:text-primary">
                        {att.name}
                      </span>
                    </div>
                    <Download className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Fulfilled Document Card */}
          {request.status === 'fulfilled' && request.fulfillmentDocument && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <FileCheck className="h-6 w-6 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground">
                        Digital Document Issued
                      </h4>
                      <Badge variant="default" className="text-[10px]">
                        Official
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {request.fulfillmentDocument.name}
                    </p>
                    {request.fulfillmentDocument.referenceId && (
                      <p className="text-[11px] font-mono text-purple-700 dark:text-purple-300 mt-1">
                        Ref: {request.fulfillmentDocument.referenceId}
                      </p>
                    )}
                  </div>
                </div>
                <Button size="sm" asChild>
                  <a
                    href={request.fulfillmentDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Rejection Reason Card */}
          {request.status === 'rejected' && request.rejectionReason && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-semibold text-rose-700 dark:text-rose-300">
                  Official Rejection Remarks
                </span>
                <p className="text-rose-600 dark:text-rose-400">
                  {request.rejectionReason}
                </p>
              </div>
            </div>
          )}

          {/* Stepper & Audit Trail */}
          <div className="border-t pt-4">
            <RequestStatusStepper
              status={request.status}
              reviewHistory={request.reviewHistory}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
