'use client';

/**
 * Request Status Stepper Component (MOD-13 / Phase 5.8).
 * Displays collegiate workflow lifecycle progress and immutable review history audit trail.
 */

import React from 'react';
import { Badge } from '@/components/ui';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  FileCheck,
  Send,
  UserCheck,
} from 'lucide-react';
import type {
  ServiceRequestStatus,
  ReviewHistoryDTO,
} from '@/types/service-request';

interface RequestStatusStepperProps {
  status: ServiceRequestStatus;
  reviewHistory: ReviewHistoryDTO[];
}

export function RequestStatusStepper({
  status,
  reviewHistory,
}: RequestStatusStepperProps) {
  const steps: { key: ServiceRequestStatus; label: string }[] = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'fulfilled', label: 'Fulfilled' },
  ];

  const getStepIndex = (st: ServiceRequestStatus): number => {
    switch (st) {
      case 'submitted':
        return 0;
      case 'under_review':
      case 'action_required':
        return 1;
      case 'approved':
        return 2;
      case 'fulfilled':
        return 3;
      case 'rejected':
        return -1;
      default:
        return 0;
    }
  };

  const currentStepIndex = getStepIndex(status);

  return (
    <div className="space-y-6">
      {/* Visual Workflow Steps (if not rejected) */}
      {status !== 'rejected' && (
        <div className="relative">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => {
              const isCompleted = currentStepIndex > idx || (currentStepIndex === idx && idx === 3);
              const isCurrent = currentStepIndex === idx && idx < 3;

              return (
                <div key={step.key} className="flex flex-1 flex-col items-center relative">
                  {/* Connecting Line */}
                  {idx > 0 && (
                    <div
                      className={`absolute top-4 -left-1/2 w-full h-0.5 -z-0 transition-colors ${
                        currentStepIndex >= idx
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : 'bg-muted dark:bg-muted/40'
                      }`}
                    />
                  )}

                  {/* Step Icon Indicator */}
                  <div
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all ${
                      isCompleted
                        ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-500'
                        : isCurrent
                        ? 'border-primary bg-background text-primary ring-4 ring-primary/20 dark:border-primary'
                        : 'border-muted bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isCurrent ? (
                      <Clock className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <span
                    className={`mt-2 text-xs font-medium text-center ${
                      isCompleted
                        ? 'text-foreground'
                        : isCurrent
                        ? 'text-primary font-semibold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Required Alert Banner */}
      {status === 'action_required' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Action Required from Student</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              The administration has reviewed your application and requested clarification or additional documentation before processing.
            </p>
          </div>
        </div>
      )}

      {/* Rejection Alert Banner */}
      {status === 'rejected' && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-800 dark:text-rose-300 flex items-start gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Application Rejected</p>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
              This request was rejected during administrative evaluation. Please review the official remarks below.
            </p>
          </div>
        </div>
      )}

      {/* Historical Audit Trail */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Review Audit Trail
        </h4>
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {reviewHistory.map((item, index) => {
            const getIcon = () => {
              switch (item.action) {
                case 'submitted':
                  return <Send className="h-3.5 w-3.5 text-blue-500" />;
                case 'under_review':
                  return <Clock className="h-3.5 w-3.5 text-amber-500" />;
                case 'action_required':
                  return <AlertCircle className="h-3.5 w-3.5 text-orange-500" />;
                case 'approved':
                  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
                case 'fulfilled':
                  return <FileCheck className="h-3.5 w-3.5 text-purple-500" />;
                case 'rejected':
                  return <XCircle className="h-3.5 w-3.5 text-rose-500" />;
                default:
                  return <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />;
              }
            };

            const getActionBadge = () => {
              switch (item.action) {
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
              <div key={index} className="relative group">
                <div className="absolute -left-6 mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border">
                  {getIcon()}
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-2">
                      {getActionBadge()}
                      <span className="text-xs font-medium text-foreground">
                        {item.actorName || item.actorRole}
                      </span>
                    </div>
                    <time className="text-[11px] text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString()}
                    </time>
                  </div>
                  {item.remarks && (
                    <p className="text-xs text-muted-foreground mt-1 bg-background/50 p-2 rounded border border-border/40">
                      &ldquo;{item.remarks}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
