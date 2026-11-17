'use client';

/**
 * Super Admin Emergency Broadcast Console View (MOD-16 / Phase 5.11).
 * Features:
 * - Live Status Hero ("All Clear — Standard Campus Operations" vs Active Command Panel)
 * - Live acknowledgment progress bar & role-by-role receipt counters
 * - Dual-confirmation Trigger Modal & All-Clear Stand-Down Modal
 * - Historical Broadcasts table with expandable live acknowledgment receipts drawer
 */

import React, { useState, useCallback } from 'react';
import { Card, Badge, Button, EmptyState } from '@/components/ui';
import {
  ShieldCheck,
  ShieldAlert,
  BellRing,
  Users,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  Loader2,
} from 'lucide-react';
import { EmergencyTriggerModal } from './emergency-trigger-modal';
import { EmergencyDeactivateModal } from './emergency-deactivate-modal';
import type {
  EmergencyAcknowledgmentDTO,
  EmergencyAlertDTO,
  EmergencyHistoryStatsDTO,
  EmergencyRoleBreakdownDTO,
} from '@/types/emergency';

interface EmergencyConsoleViewProps {
  initialActiveAlert?: EmergencyAlertDTO | null;
  initialActiveBreakdown?: EmergencyRoleBreakdownDTO | null;
  initialHistory?: EmergencyAlertDTO[];
  initialStats?: EmergencyHistoryStatsDTO | null;
}

export function EmergencyConsoleView({
  initialActiveAlert = null,
  initialActiveBreakdown = null,
  initialHistory = [],
  initialStats = null,
}: EmergencyConsoleViewProps) {
  const [activeAlert, setActiveAlert] = useState<EmergencyAlertDTO | null>(initialActiveAlert);
  const [activeBreakdown, setActiveBreakdown] = useState<EmergencyRoleBreakdownDTO | null>(
    initialActiveBreakdown
  );
  const [history, setHistory] = useState<EmergencyAlertDTO[]>(initialHistory);
  const [stats, setStats] = useState<EmergencyHistoryStatsDTO | null>(initialStats);

  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Expandable acknowledgment roster drawer
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [receiptCache, setReceiptCache] = useState<
    Record<string, { acks: EmergencyAcknowledgmentDTO[]; breakdown: EmergencyRoleBreakdownDTO }>
  >({});
  const [loadingReceiptsId, setLoadingReceiptsId] = useState<string | null>(null);

  const refreshConsole = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [activeRes, historyRes] = await Promise.all([
        fetch('/api/v1/emergency/active', { cache: 'no-store' }),
        fetch('/api/v1/emergency/history?limit=50', { cache: 'no-store' }),
      ]);

      let nextActive: EmergencyAlertDTO | null = null;
      const activeJson = await activeRes.json();
      if (activeRes.ok && activeJson.success && activeJson.data) {
        nextActive = activeJson.data.activeAlert || null;
        setActiveAlert(nextActive);
      }

      const histJson = await historyRes.json();
      if (historyRes.ok && histJson.success && histJson.data) {
        setHistory(histJson.data.alerts || []);
        setStats(histJson.data.stats || null);
      }

      if (nextActive) {
        const ackRes = await fetch(`/api/v1/emergency/${nextActive.id}/acknowledgments?limit=25`);
        const ackJson = await ackRes.json();
        if (ackRes.ok && ackJson.success && ackJson.data?.breakdown) {
          setActiveBreakdown(ackJson.data.breakdown);
        }
      } else {
        setActiveBreakdown(null);
      }
    } catch (err) {
      console.error('Failed to refresh emergency command console', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleToggleReceipts = async (alertId: string) => {
    if (expandedAlertId === alertId) {
      setExpandedAlertId(null);
      return;
    }

    setExpandedAlertId(alertId);
    setLoadingReceiptsId(alertId);
    try {
      const res = await fetch(`/api/v1/emergency/${alertId}/acknowledgments?limit=50`);
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setReceiptCache((prev) => ({
          ...prev,
          [alertId]: {
            acks: json.data.acknowledgments || [],
            breakdown: json.data.breakdown,
          },
        }));
      }
    } catch (err) {
      console.error('Failed to load emergency acknowledgments', err);
    } finally {
      setLoadingReceiptsId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Emergency Broadcast Console (MOD-16)
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Master campus override for severe weather closures, security lockdowns, real-time portal takeovers, and safety receipt tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={refreshConsole}
            disabled={isRefreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={Boolean(activeAlert)}
            onClick={() => setIsTriggerModalOpen(true)}
            className="gap-1.5 text-xs font-bold"
            title={
              activeAlert
                ? 'Stand down the current active emergency before triggering a new one'
                : 'Trigger a new campus emergency broadcast'
            }
          >
            <BellRing className="h-3.5 w-3.5" />
            Trigger Emergency Broadcast
          </Button>
        </div>
      </div>

      {/* Live Status Hero */}
      {!activeAlert ? (
        <Card
          variant="glass"
          className="border-emerald-500/30 bg-emerald-500/5 flex flex-col items-start justify-between gap-4 border p-6 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  All Clear — Standard Campus Operations
                </h2>
                <Badge variant="success">NORMAL</Badge>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                No active campus emergency directives. Broadcast channels and fail-safe Ably relays are on standby.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => setIsTriggerModalOpen(true)}
            className="gap-1.5 text-xs font-bold"
          >
            <ShieldAlert className="h-4 w-4" />
            Initiate Alert
          </Button>
        </Card>
      ) : (
        <Card
          variant="glass"
          className="border-destructive/60 bg-destructive/10 space-y-5 border-2 p-6"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3.5">
              <div className="bg-destructive flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive" className="font-mono text-[10px]">
                    ACTIVE • {activeAlert.alertCode}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {activeAlert.severity} / {activeAlert.category}
                  </Badge>
                </div>
                <h2 className="font-heading text-xl font-bold">{activeAlert.title}</h2>
                <p className="text-muted-foreground text-xs">
                  Triggered by {activeAlert.triggeredBySnapshot.fullName} at{' '}
                  {new Date(activeAlert.triggeredAt).toLocaleString()}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setIsDeactivateModalOpen(true)}
              className="gap-1.5 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              Stand Down / Deactivate Alert
            </Button>
          </div>

          <p className="bg-background/60 border-border/50 rounded-lg border p-3.5 text-xs leading-relaxed">
            {activeAlert.message}
          </p>

          {/* Live Acknowledgment Coverage Bar & Role Counters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-500" />
                Live Campus Acknowledgment Coverage
              </span>
              <span>
                {activeBreakdown?.totalAcknowledged ?? activeAlert.acknowledgmentCount} receipts
                {activeBreakdown
                  ? ` / ${activeBreakdown.totalActiveUsers} active users (${activeBreakdown.coveragePercent}%)`
                  : ''}
              </span>
            </div>

            <div className="bg-muted/50 h-2.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${activeBreakdown?.coveragePercent ?? 0}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="bg-background/60 border-border/40 rounded-lg border p-3 text-xs">
                <p className="text-muted-foreground text-[10px] uppercase">Students</p>
                <p className="mt-1 text-lg font-bold">{activeBreakdown?.student ?? 0}</p>
              </div>
              <div className="bg-background/60 border-border/40 rounded-lg border p-3 text-xs">
                <p className="text-muted-foreground text-[10px] uppercase">Faculty</p>
                <p className="mt-1 text-lg font-bold">{activeBreakdown?.faculty ?? 0}</p>
              </div>
              <div className="bg-background/60 border-border/40 rounded-lg border p-3 text-xs">
                <p className="text-muted-foreground text-[10px] uppercase">Admins / HODs</p>
                <p className="mt-1 text-lg font-bold">{activeBreakdown?.admin ?? 0}</p>
              </div>
              <div className="bg-background/60 border-border/40 rounded-lg border p-3 text-xs">
                <p className="text-muted-foreground text-[10px] uppercase">Super Admins</p>
                <p className="mt-1 text-lg font-bold">{activeBreakdown?.super_admin ?? 0}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Historical Broadcasts Summary Strip */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card variant="glass" className="p-4">
            <span className="text-muted-foreground text-[11px]">Total Broadcasts</span>
            <p className="mt-1 text-2xl font-bold">{stats.totalAlerts}</p>
          </Card>
          <Card variant="glass" className="p-4">
            <span className="text-muted-foreground text-[11px]">Red Lockdowns</span>
            <p className="mt-1 text-2xl font-bold text-red-500">{stats.redCount}</p>
          </Card>
          <Card variant="glass" className="p-4">
            <span className="text-muted-foreground text-[11px]">Amber High Alerts</span>
            <p className="mt-1 text-2xl font-bold text-amber-500">{stats.amberCount}</p>
          </Card>
          <Card variant="glass" className="p-4">
            <span className="text-muted-foreground text-[11px]">Yellow Advisories</span>
            <p className="mt-1 text-2xl font-bold text-yellow-500">{stats.yellowCount}</p>
          </Card>
        </div>
      )}

      {/* Historical Broadcasts & Acknowledgment Receipts Table */}
      <div className="space-y-3">
        <h2 className="font-heading text-base font-semibold">
          Broadcast History &amp; Acknowledgment Receipts ({history.length})
        </h2>

        {history.length === 0 ? (
          <EmptyState
            glass
            title="No Historical Emergency Broadcasts"
            description="Past emergency activations, stand-down summaries, and per-user safety receipts will appear here."
            className="py-10"
          />
        ) : (
          history.map((item) => {
            const isExpanded = expandedAlertId === item.id;
            const cached = receiptCache[item.id];

            return (
              <Card key={item.id} variant="glass" className="p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {item.alertCode}
                      </Badge>
                      <Badge
                        variant={
                          item.severity === 'red'
                            ? 'destructive'
                            : item.severity === 'amber'
                              ? 'warning'
                              : 'info'
                        }
                        className="text-[10px] uppercase"
                      >
                        {item.severity}
                      </Badge>
                      <Badge variant={item.isActive ? 'destructive' : 'glass'} className="text-[10px]">
                        {item.isActive ? 'ACTIVE' : 'STAND DOWN'}
                      </Badge>
                      <span className="truncate text-sm font-semibold">{item.title}</span>
                    </div>

                    <p className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(item.triggeredAt).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {item.acknowledgmentCount} acknowledgments
                      </span>
                    </p>

                    {item.deactivationNotes && (
                      <p className="text-muted-foreground text-[11px]">
                        All-Clear Summary: <span className="text-foreground">{item.deactivationNotes}</span>
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleReceipts(item.id)}
                    className="gap-1 text-xs"
                  >
                    Receipts
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="border-border/50 bg-muted/20 mt-3 rounded-lg border p-3.5 text-xs">
                    {loadingReceiptsId === item.id ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="text-primary h-5 w-5 animate-spin" />
                      </div>
                    ) : cached && cached.acks.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-[11px] font-semibold">
                          Coverage: {cached.breakdown.totalAcknowledged} /{' '}
                          {cached.breakdown.totalActiveUsers} ({cached.breakdown.coveragePercent}%)
                        </p>
                        <div className="divide-border/40 max-h-60 divide-y overflow-y-auto">
                          {cached.acks.map((ack) => (
                            <div
                              key={ack.id}
                              className="flex items-center justify-between py-1.5 text-[11px]"
                            >
                              <div>
                                <span className="font-medium">{ack.userSnapshot.fullName}</span>{' '}
                                <span className="text-muted-foreground">
                                  ({ack.userSnapshot.email})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] capitalize">
                                  {ack.userSnapshot.role}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {new Date(ack.acknowledgedAt).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center text-xs">
                        No acknowledgment receipts recorded for this broadcast yet.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Modals */}
      <EmergencyTriggerModal
        isOpen={isTriggerModalOpen}
        onClose={() => setIsTriggerModalOpen(false)}
        onSuccess={(created) => {
          setActiveAlert(created);
          setHistory((prev) => [created, ...prev]);
          void refreshConsole();
        }}
      />

      <EmergencyDeactivateModal
        alert={activeAlert}
        isOpen={isDeactivateModalOpen}
        onClose={() => setIsDeactivateModalOpen(false)}
        onSuccess={(deactivated) => {
          setActiveAlert(null);
          setActiveBreakdown(null);
          setHistory((prev) => prev.map((a) => (a.id === deactivated.id ? deactivated : a)));
          void refreshConsole();
        }}
      />
    </div>
  );
}
