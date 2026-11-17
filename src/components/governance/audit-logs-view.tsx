'use client';

/**
 * Immutable Security Audit Logs View (MOD-19 / Phase 5.10).
 * Displays KPI telemetry, SHA-256 hash-chain integrity verification badge & trigger,
 * multi-criteria filters, CSV/JSON compliance export buttons, and an expandable
 * diff drawer comparing oldState vs. newState with cryptographic hashes.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Badge, Button, Input, EmptyState } from '@/components/ui';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Download,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
  Lock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  AUDIT_MODULES,
  AUDIT_SEVERITIES,
  type AuditChainVerificationDTO,
  type AuditLogDTO,
  type AuditModule,
  type AuditSeverity,
  type AuditStatsDTO,
} from '@/types/governance';

interface AuditLogsViewProps {
  initialLogs?: AuditLogDTO[];
  initialStats?: AuditStatsDTO | null;
  initialVerification?: AuditChainVerificationDTO | null;
}

export function AuditLogsView({
  initialLogs = [],
  initialStats = null,
  initialVerification = null,
}: AuditLogsViewProps) {
  const [logs, setLogs] = useState<AuditLogDTO[]>(initialLogs);
  const [stats, setStats] = useState<AuditStatsDTO | null>(initialStats);
  const [verification, setVerification] = useState<AuditChainVerificationDTO | null>(
    initialVerification
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<'all' | AuditModule>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | AuditSeverity>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expandable diff drawer state
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const buildFilterQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedModule !== 'all') params.set('module', selectedModule);
    if (selectedSeverity !== 'all') params.set('severity', selectedSeverity);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params.toString();
  }, [selectedModule, selectedSeverity, searchQuery, dateFrom, dateTo]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const qs = buildFilterQueryString();
      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/v1/audit/logs?limit=100${qs ? `&${qs}` : ''}`),
        fetch('/api/v1/audit/stats'),
      ]);

      const logsJson = await logsRes.json();
      if (logsRes.ok && logsJson.success && logsJson.data?.logs) {
        setLogs(logsJson.data.logs);
      }

      const statsJson = await statsRes.json();
      if (statsRes.ok && statsJson.success && statsJson.data) {
        setStats(statsJson.data);
      }
    } catch (err) {
      console.error('Failed to refresh security audit logs', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [buildFilterQueryString]);

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/v1/audit/verify?limit=500');
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setVerification(json.data as AuditChainVerificationDTO);
      }
    } catch (err) {
      console.error('Failed to verify audit hash chain', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const qs = buildFilterQueryString();
    const url = `/api/v1/audit/export?format=${format}${qs ? `&${qs}` : ''}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (selectedModule !== 'all' && entry.module !== selectedModule) return false;
      if (selectedSeverity !== 'all' && entry.severity !== selectedSeverity) return false;

      if (dateFrom) {
        const fromMs = new Date(dateFrom).getTime();
        if (!Number.isNaN(fromMs) && new Date(entry.createdAt).getTime() < fromMs) return false;
      }
      if (dateTo) {
        const toMs = new Date(dateTo).getTime() + 86400000 - 1;
        if (!Number.isNaN(toMs) && new Date(entry.createdAt).getTime() > toMs) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hitEvent = entry.eventId.toLowerCase().includes(q);
        const hitAction = entry.action.toLowerCase().includes(q);
        const hitActor = entry.actorSnapshot.fullName.toLowerCase().includes(q);
        const hitEmail = entry.actorSnapshot.email.toLowerCase().includes(q);
        const hitTarget = (entry.targetLabel || entry.targetEntityId).toLowerCase().includes(q);
        const hitReason = (entry.reason || '').toLowerCase().includes(q);
        if (!hitEvent && !hitAction && !hitActor && !hitEmail && !hitTarget && !hitReason) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedModule, selectedSeverity, dateFrom, dateTo, searchQuery]);

  const totalEvents = stats?.totalLogs ?? logs.length;
  const highCritical24h =
    stats?.highCriticalLast24h ??
    logs.filter((l) => l.severity === 'high' || l.severity === 'critical').length;

  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">CRITICAL</Badge>;
      case 'high':
        return <Badge variant="warning">HIGH</Badge>;
      case 'warning':
        return <Badge variant="info">WARNING</Badge>;
      case 'info':
        return <Badge variant="outline">INFO</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Immutable Security Audit Logs
            </h1>
            <Badge variant="glass" className="gap-1 text-[10px]">
              <Lock className="h-3 w-3" />
              Append-Only SHA-256
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Tamper-evident institutional security trail with cryptographic hash chaining and compliance export (MOD-19).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="gap-1.5 text-xs"
          >
            {isVerifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            )}
            Verify Chain Integrity
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('csv')}
            className="gap-1.5 text-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('json')}
            className="gap-1.5 text-xs"
          >
            <FileJson className="h-3.5 w-3.5" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* KPI Telemetry Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">Total Audit Events</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{totalEvents}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            Immutable append-only ledger records
          </p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              High / Critical (Last 24h)
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-amber-500">{highCritical24h}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            Role elevations, suspensions &amp; security events
          </p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              Hash-Chain Integrity
            </span>
            {verification && !verification.valid ? (
              <ShieldAlert className="text-destructive h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {verification ? (
              verification.valid ? (
                <Badge variant="success" className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified ({verification.checkedCount} checked)
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Tampered ({verification.brokenAtEventId || 'Mismatch'})
                </Badge>
              )
            ) : (
              <Badge variant="glass">Ready to Verify</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 truncate font-mono text-[10px]">
            Anchor: {stats?.latestEntryHash ? `${stats.latestEntryHash.slice(0, 20)}...` : 'GENESIS'}
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card variant="glass" className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search event ID, actor, action, target, reason..."
              aria-label="Search security audit logs"
              className="pl-9 text-xs"
            />
          </div>

          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value as 'all' | AuditModule)}
            aria-label="Filter by module"
            className="border-input bg-background/60 h-9 rounded-md border px-2.5 text-xs"
          >
            <option value="all">All Modules</option>
            {AUDIT_MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value as 'all' | AuditSeverity)}
            aria-label="Filter by severity"
            className="border-input bg-background/60 h-9 rounded-md border px-2.5 text-xs"
          >
            <option value="all">All Severities</option>
            {AUDIT_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Date from"
            className="h-9 text-xs"
          />

          <div className="flex gap-2">
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Date to"
              className="h-9 flex-1 text-xs"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Reload audit stream"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Immutable Audit Table + Expandable Diff Drawer */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          glass
          title="No Audit Events Found"
          description="No security audit records match your current search, module, severity, or date range filters."
          className="py-10"
        />
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;

            return (
              <Card key={log.id} variant="glass" className="overflow-hidden p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {log.eventId}
                      </Badge>
                      <Badge variant="glass" className="text-[10px] font-semibold">
                        {log.module}
                      </Badge>
                      {getSeverityBadge(log.severity)}
                      <span className="font-mono text-xs font-semibold">{log.action}</span>
                    </div>

                    <p className="text-muted-foreground text-xs">
                      Actor:{' '}
                      <span className="text-foreground font-medium">
                        {log.actorSnapshot.fullName}
                      </span>{' '}
                      ({log.actorSnapshot.email}) • Target:{' '}
                      <span className="text-foreground font-medium">
                        {log.targetLabel || log.targetEntityId}
                      </span>{' '}
                      ({log.targetEntityType})
                    </p>

                    {log.reason && (
                      <p className="text-muted-foreground text-[11px]">
                        Justification: <span className="text-foreground">{log.reason}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-[11px]">
                      <p className="text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                      <p className="text-muted-foreground font-mono text-[10px]">
                        SHA: {log.entryHash.slice(0, 14)}…
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="gap-1 text-xs"
                    >
                      Diff
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expandable Diff & Cryptographic Proof Drawer */}
                {isExpanded && (
                  <div className="border-border/50 bg-muted/20 mt-3 space-y-3 rounded-lg border p-3.5 text-xs">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">
                          Previous State (oldState)
                        </p>
                        <pre className="bg-background/70 border-border/40 overflow-x-auto rounded-md border p-2.5 font-mono text-[11px]">
                          {log.oldState ? JSON.stringify(log.oldState, null, 2) : 'null'}
                        </pre>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">
                          Updated State (newState)
                        </p>
                        <pre className="bg-background/70 border-border/40 overflow-x-auto rounded-md border p-2.5 font-mono text-[11px]">
                          {log.newState ? JSON.stringify(log.newState, null, 2) : 'null'}
                        </pre>
                      </div>
                    </div>

                    <div className="text-muted-foreground border-border/40 grid grid-cols-1 gap-1.5 border-t pt-2.5 font-mono text-[10px] sm:grid-cols-2">
                      <p className="truncate">
                        <span className="font-sans font-semibold">Previous Hash:</span>{' '}
                        {log.previousHash}
                      </p>
                      <p className="truncate">
                        <span className="font-sans font-semibold">Entry Hash:</span> {log.entryHash}
                      </p>
                      <p>
                        <span className="font-sans font-semibold">IP Address:</span>{' '}
                        {log.ipAddress || 'Internal / Unrecorded'}
                      </p>
                      <p className="truncate">
                        <span className="font-sans font-semibold">User-Agent:</span>{' '}
                        {log.userAgent || 'Server Action / Internal'}
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Compliance Footer */}
      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" />
          CSV exports automatically neutralize spreadsheet formula injection (=, +, -, @).
        </span>
        <span className="font-mono">MOD-19 • SHA-256 CHAIN</span>
      </div>
    </div>
  );
}
