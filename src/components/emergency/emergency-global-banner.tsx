'use client';

/**
 * Global Campus Emergency Overlay & Persistent Banner (MOD-16 / Phase 5.11).
 * Mounted inside AppShell so every authenticated user across all 4 portals receives
 * real-time campus emergency directives (Ably + safe HTTP fallback), a persistent
 * severity-coded top banner, and a mandatory full-screen takeover modal for RED alerts.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, Button } from '@/components/ui';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Megaphone,
  ListChecks,
  X,
} from 'lucide-react';
import type { EmergencyAlertDTO, EmergencySeverity } from '@/types/emergency';

interface EmergencyGlobalBannerProps {
  initialAlert?: EmergencyAlertDTO | null;
  initialAcknowledged?: boolean;
}

const SEVERITY_BANNER_STYLES: Record<EmergencySeverity, string> = {
  red: 'bg-red-600 text-white border-b-red-800',
  amber: 'bg-amber-500 text-slate-950 border-b-amber-700',
  yellow: 'bg-yellow-400 text-slate-950 border-b-yellow-600',
};

const SEVERITY_LABELS: Record<EmergencySeverity, string> = {
  red: 'RED — CRITICAL EMERGENCY',
  amber: 'AMBER — HIGH ALERT',
  yellow: 'YELLOW — CAMPUS ADVISORY',
};

export function EmergencyGlobalBanner({
  initialAlert = null,
  initialAcknowledged = false,
}: EmergencyGlobalBannerProps) {
  const [activeAlert, setActiveAlert] = useState<EmergencyAlertDTO | null>(initialAlert);
  const [hasAcknowledged, setHasAcknowledged] = useState<boolean>(initialAcknowledged);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(
    Boolean(initialAlert && initialAlert.severity === 'red' && !initialAcknowledged)
  );
  const [isAcknowledging, setIsAcknowledging] = useState<boolean>(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  const fetchActiveAlert = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/emergency/active', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        const alert = (json.data.activeAlert as EmergencyAlertDTO | null) || null;
        const acked = Boolean(json.data.hasAcknowledged);
        setActiveAlert(alert);
        setHasAcknowledged(acked);
        if (alert && alert.severity === 'red' && !acked) {
          setIsModalOpen(true);
        }
        if (!alert) {
          setIsModalOpen(false);
        }
      }
    } catch {
      // Safe silent fallback
    }
  }, []);

  useEffect(() => {
    if (initialAlert !== null) return;
    void fetchActiveAlert();

    // Poll cleanly every 45 seconds as HTTP fail-safe
    const pollInterval = setInterval(() => {
      void fetchActiveAlert();
    }, 45000);

    // Optional Ably Realtime subscription on campus:emergency:broadcast
    let realtimeClient: { close: () => void } | null = null;
    let isMounted = true;

    async function connectRealtime() {
      try {
        const tokenRes = await fetch('/api/v1/chat/token');
        if (!tokenRes.ok || !isMounted) return;
        const tokenJson = await tokenRes.json();
        if (!tokenJson.success || tokenJson.data?.isMock) return;

        const Ably = await import('ably');
        if (!isMounted) return;

        const client = new Ably.Realtime({
          authCallback: async (_params, callback) => {
            try {
              const r = await fetch('/api/v1/chat/token');
              const j = await r.json();
              if (r.ok && j.success && j.data) {
                callback(null, j.data);
              } else {
                callback('Token error', null);
              }
            } catch (err) {
              callback(err instanceof Error ? err.message : 'Token error', null);
            }
          },
        });

        realtimeClient = client;
        const channel = client.channels.get('campus:emergency:broadcast');
        await channel.subscribe((msg) => {
          if (!isMounted) return;
          if (msg.name === 'emergency.triggered' || msg.name === 'emergency.deactivated') {
            void fetchActiveAlert();
          }
        });
      } catch {
        // Graceful fallback to HTTP polling
      }
    }

    void connectRealtime();

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (realtimeClient) {
        try {
          realtimeClient.close();
        } catch {
          // Ignore close errors
        }
      }
    };
  }, [fetchActiveAlert, initialAlert]);

  const isMandatoryTakeover = Boolean(
    activeAlert && activeAlert.severity === 'red' && !hasAcknowledged
  );
  const showModal = Boolean(activeAlert && (isModalOpen || isMandatoryTakeover));

  // Keyboard Escape handling for non-mandatory dialogs + focus management on open
  useEffect(() => {
    if (!showModal) return;

    modalContainerRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isMandatoryTakeover) {
        event.preventDefault();
        setIsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, isMandatoryTakeover]);

  if (!activeAlert) return null;

  const handleAcknowledge = async () => {
    setAckError(null);
    setIsAcknowledging(true);
    try {
      const res = await fetch(`/api/v1/emergency/${activeAlert.id}/acknowledge`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setAckError(json.error?.message || json.message || 'Failed to record acknowledgment.');
        return;
      }
      setHasAcknowledged(true);
      setIsModalOpen(false);
    } catch {
      setAckError('Network error while recording acknowledgment. Please retry.');
    } finally {
      setIsAcknowledging(false);
    }
  };

  return (
    <>
      {/* Persistent High-Contrast Top Banner */}
      <div
        role="alert"
        data-emergency-severity={activeAlert.severity}
        className={`z-40 border-b px-4 py-2.5 shadow-sm ${SEVERITY_BANNER_STYLES[activeAlert.severity]}`}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            {activeAlert.severity === 'red' ? (
              <ShieldAlert className="h-5 w-5 shrink-0 animate-pulse" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[10px] font-bold">
                  {activeAlert.alertCode}
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase">
                  {SEVERITY_LABELS[activeAlert.severity]}
                </span>
              </div>
              <p className="truncate text-xs font-bold sm:text-sm">{activeAlert.title}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasAcknowledged ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Acknowledged ✓
                </span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="rounded-md bg-black/15 px-2.5 py-1 text-[11px] font-semibold underline-offset-2 hover:bg-black/25 hover:underline"
                >
                  View Directive
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="rounded-md bg-white px-3 py-1 text-xs font-bold text-slate-950 shadow-xs transition-transform hover:scale-[1.02]"
              >
                View Directive / Acknowledge
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Mandatory Takeover Modal (RED unacknowledged) or Directive Viewer */}
      {showModal && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="emergency-takeover-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            ref={modalContainerRef}
            tabIndex={-1}
            className="bg-background border-destructive/60 relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-2 p-6 shadow-2xl focus:outline-none"
          >
            {!isMandatoryTakeover && (
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close emergency directive modal"
                className="text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-md p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  activeAlert.severity === 'red'
                    ? 'bg-red-600 text-white'
                    : activeAlert.severity === 'amber'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-yellow-400 text-slate-950'
                }`}
              >
                <Megaphone className="h-5 w-5" />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      activeAlert.severity === 'red'
                        ? 'destructive'
                        : activeAlert.severity === 'amber'
                          ? 'warning'
                          : 'info'
                    }
                    className="font-mono text-[10px]"
                  >
                    {activeAlert.alertCode}
                  </Badge>
                  <span className="text-xs font-bold uppercase">
                    {SEVERITY_LABELS[activeAlert.severity]}
                  </span>
                </div>
                <h2
                  id="emergency-takeover-title"
                  className="font-heading text-lg font-bold tracking-tight sm:text-xl"
                >
                  {activeAlert.title}
                </h2>
                <p className="text-muted-foreground text-[11px]">
                  Issued by {activeAlert.triggeredBySnapshot.fullName} •{' '}
                  {new Intl.DateTimeFormat('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Kolkata',
                  }).format(new Date(activeAlert.triggeredAt))}
                </p>
              </div>
            </div>

            <div className="border-border/50 bg-muted/20 mt-4 rounded-xl border p-4 text-sm leading-relaxed">
              {activeAlert.message}
            </div>

            {activeAlert.instructions.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase">
                  <ListChecks className="text-primary h-4 w-4" />
                  Mandatory Safety Instructions
                </p>
                <ol className="space-y-2">
                  {activeAlert.instructions.map((step, idx) => (
                    <li
                      key={`${idx}-${step}`}
                      className="border-border/50 bg-background/80 flex items-start gap-2.5 rounded-lg border p-2.5 text-xs"
                    >
                      <span className="bg-primary/15 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {ackError && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive mt-4 rounded-lg border p-3 text-xs">
                {ackError}
              </div>
            )}

            <div className="border-border/50 mt-6 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
              <p className="text-muted-foreground text-[11px]">
                {isMandatoryTakeover
                  ? 'Mandatory acknowledgment is required to confirm receipt of this critical campus directive.'
                  : hasAcknowledged
                    ? 'Your acknowledgment receipt has been recorded.'
                    : 'Confirm receipt so Campus Administration can track safety coverage.'}
              </p>

              {hasAcknowledged ? (
                <Button size="sm" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Close Directive
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={activeAlert.severity === 'red' ? 'destructive' : 'default'}
                  disabled={isAcknowledging}
                  onClick={handleAcknowledge}
                  className="w-full gap-1.5 font-bold sm:w-auto"
                >
                  {isAcknowledging && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  I Understand &amp; Acknowledge
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
