'use client';

/**
 * Bulk Student & Faculty Account Provisioning Component.
 * Supports Phase 5.2.4 CSV-based bulk onboarding with pre-validation preview,
 * duplicate collision detection, bounded concurrency execution, and sanitized error reports.
 */

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import type {
  BulkProvisionRole,
  BulkPreviewResponse,
  BulkProvisionResponse,
} from '@/types/bulk-provision';

interface AdminBulkProvisioningProps {
  onComplete?: () => void;
  onBackToSingle?: () => void;
}

export function AdminBulkProvisioning({ onComplete, onBackToSingle }: AdminBulkProvisioningProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuration State
  const [role, setRole] = useState<BulkProvisionRole>('student');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');

  // Workflow Stages: 'upload' -> 'preview' -> 'provisioning' -> 'complete'
  const [stage, setStage] = useState<'upload' | 'preview' | 'provisioning' | 'complete'>('upload');

  // Preview & Result Data
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<BulkPreviewResponse | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(true);

  // Execution State
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<BulkProvisionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'text/plain') {
      setErrorMessage('Please select a valid CSV file (.csv)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('File size exceeds the maximum limit of 2 MB');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    try {
      const text = await file.text();
      setCsvContent(text);
    } catch {
      setErrorMessage('Failed to read CSV file contents');
    }
  };

  // Download official CSV template
  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = `/api/v1/admin/users/bulk/template?role=${role}`;
    link.download = `axis-linkup-${role}-roster-template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Request CSV Preview
  const handleGeneratePreview = async () => {
    if (!csvContent) {
      setErrorMessage('Please upload a CSV file first');
      return;
    }

    setIsPreviewLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/admin/users/bulk/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, role }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to generate CSV preview');
      }

      setPreviewData(json.data);
      setStage('preview');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse CSV preview');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Execute Bulk Provisioning
  const handleExecuteBulkProvision = async () => {
    if (!csvContent || !previewData) return;

    setIsProvisioning(true);
    setStage('provisioning');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/admin/users/bulk/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent, role, skipInvalid }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Bulk account provisioning failed');
      }

      setProvisionResult(json.data);
      setStage('complete');
      router.refresh();
      if (onComplete) onComplete();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Bulk provisioning failed');
      setStage('preview');
    } finally {
      setIsProvisioning(false);
    }
  };

  // Download Error Report CSV
  const handleDownloadErrorReport = () => {
    if (!provisionResult?.errorReportCsv) return;

    const blob = new Blob([provisionResult.errorReportCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `axis-linkup-${role}-import-errors.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset entire bulk onboarding workflow
  const handleReset = () => {
    setSelectedFile(null);
    setCsvContent('');
    setPreviewData(null);
    setProvisionResult(null);
    setErrorMessage(null);
    setStage('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card variant="glass" className="border-glass-border space-y-4 border p-5 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col justify-between gap-3 border-b p-0 pb-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-xl">
            <Upload className="size-4" />
          </div>
          <div>
            <CardTitle className="font-heading text-foreground text-sm font-semibold">
              Bulk Collegiate Roster Onboarding
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Batch identity generation with CSV pre-flight inspection and collision isolation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="glass" className="flex items-center gap-1 text-[11px] text-emerald-500">
            <ShieldCheck className="size-3" />
            System Admin Exclusive
          </Badge>

          {onBackToSingle && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBackToSingle}
              className="border-glass-border h-7 text-xs"
            >
              Single Account Form
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Step 1: Upload Stage */}
        {stage === 'upload' && (
          <div className="space-y-4">
            {/* Target Role Selector */}
            <div className="bg-muted/40 border-glass-border flex max-w-sm rounded-xl border p-1">
              <button
                type="button"
                onClick={() => {
                  setRole('student');
                  handleReset();
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  role === 'student'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="size-3.5" />
                Student Roster
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('faculty');
                  handleReset();
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  role === 'faculty'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileSpreadsheet className="size-3.5" />
                Faculty Roster
              </button>
            </div>

            {/* Template Download Notification Card */}
            <div className="border-border/30 bg-muted/20 flex flex-col items-start justify-between gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
              <div className="space-y-0.5">
                <p className="text-foreground text-xs font-semibold">
                  Required Format: {role === 'student' ? 'Student' : 'Faculty'} CSV
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {role === 'student'
                    ? 'Headers: fullName, username, institutionalEmail, department, rollNumber, batchYear, currentSemester, section'
                    : 'Headers: fullName, username, institutionalEmail, department, employeeId, designation'}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="border-glass-border h-8 shrink-0 gap-1.5 text-xs"
              >
                <Download className="size-3.5" />
                Download Template
              </Button>
            </div>

            {/* File Upload Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-border/60 bg-card/30 hover:border-primary/60 hover:bg-card/50 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="bg-primary/10 text-primary mb-3 flex size-12 items-center justify-center rounded-2xl">
                <Upload className="size-6" />
              </div>

              <div className="space-y-1">
                <p className="text-foreground text-xs font-semibold">
                  {selectedFile ? selectedFile.name : 'Click to select CSV roster or drag and drop'}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB • Ready for preview`
                    : 'Standard RFC 4180 CSV files up to 2 MB (Max 500 records per roster)'}
                </p>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Validation Error</p>
                  <p className="text-[11px] opacity-90">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="pill-primary"
                size="sm"
                disabled={!selectedFile || isPreviewLoading}
                onClick={handleGeneratePreview}
                className="h-9 px-5 text-xs font-semibold"
              >
                {isPreviewLoading ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Inspecting CSV Rows...
                  </>
                ) : (
                  <>
                    <FileText className="mr-1.5 size-3.5" />
                    Preview & Validate Roster
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview Stage */}
        {stage === 'preview' && previewData && (
          <div className="space-y-4">
            {/* KPI Metric Chips */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="bg-card/40 border-glass-border rounded-xl border p-2.5 text-center">
                <div className="text-muted-foreground text-[10px] uppercase">Total Records</div>
                <div className="font-mono text-base font-semibold">{previewData.totalRows}</div>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-center">
                <div className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400">
                  Ready to Provision
                </div>
                <div className="font-mono text-base font-semibold text-emerald-500">
                  {previewData.validCount}
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-center">
                <div className="text-[10px] uppercase text-amber-600 dark:text-amber-400">
                  Duplicate Collisions
                </div>
                <div className="font-mono text-base font-semibold text-amber-500">
                  {previewData.duplicateCount}
                </div>
              </div>

              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-2.5 text-center">
                <div className="text-[10px] uppercase text-destructive">Invalid Syntax</div>
                <div className="font-mono text-base font-semibold text-destructive">
                  {previewData.invalidCount}
                </div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border-border/40 max-h-72 overflow-y-auto rounded-xl border">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-muted/60 text-muted-foreground sticky top-0 border-b text-[10px] uppercase">
                  <tr>
                    <th className="px-2.5 py-2">Row</th>
                    <th className="px-2.5 py-2">Name</th>
                    <th className="px-2.5 py-2">Username</th>
                    <th className="px-2.5 py-2">Institutional Email</th>
                    <th className="px-2.5 py-2">Dept</th>
                    <th className="px-2.5 py-2">{role === 'student' ? 'Roll No' : 'Emp ID'}</th>
                    <th className="px-2.5 py-2">Status</th>
                    <th className="px-2.5 py-2">Notes / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-border/20 divide-y">
                  {previewData.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        row.status === 'valid'
                          ? 'hover:bg-muted/10'
                          : row.status === 'duplicate'
                            ? 'bg-amber-500/5 hover:bg-amber-500/10'
                            : 'bg-destructive/5 hover:bg-destructive/10'
                      }
                    >
                      <td className="text-muted-foreground px-2.5 py-1.5 font-mono">
                        #{row.rowNumber}
                      </td>
                      <td className="text-foreground px-2.5 py-1.5 font-medium">{row.fullName}</td>
                      <td className="text-muted-foreground px-2.5 py-1.5 font-mono">
                        {row.username ? `@${row.username}` : '—'}
                      </td>
                      <td className="text-muted-foreground px-2.5 py-1.5">{row.email || '—'}</td>
                      <td className="px-2.5 py-1.5 font-mono">{row.department || '—'}</td>
                      <td className="px-2.5 py-1.5 font-mono">{row.institutionalId || '—'}</td>
                      <td className="px-2.5 py-1.5">
                        {row.status === 'valid' && (
                          <Badge variant="outline" className="text-[9px] text-emerald-500">
                            Valid
                          </Badge>
                        )}
                        {row.status === 'duplicate' && (
                          <Badge variant="outline" className="text-[9px] text-amber-500">
                            Duplicate
                          </Badge>
                        )}
                        {row.status === 'invalid' && (
                          <Badge variant="outline" className="text-[9px] text-destructive">
                            Invalid
                          </Badge>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-2.5 py-1.5 text-[10px]">
                        {row.errors.length > 0 ? (
                          <span
                            className={
                              row.status === 'duplicate' ? 'text-amber-500' : 'text-destructive'
                            }
                            title={row.errors.join('; ')}
                          >
                            {row.errors.join('; ')}
                          </span>
                        ) : (
                          <span className="text-emerald-500">Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Execution Error</p>
                  <p className="text-[11px] opacity-90">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Skip Options & Confirmation Controls */}
            <div className="border-border/30 flex flex-col items-start justify-between gap-3 border-t pt-3 sm:flex-row sm:items-center">
              <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={skipInvalid}
                  onChange={(e) => setSkipInvalid(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-4"
                />
                <span>
                  Skip invalid and duplicate records (proceed with{' '}
                  <strong className="text-foreground">{previewData.validCount} valid accounts</strong>)
                </span>
              </label>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="border-glass-border h-8 text-xs"
                >
                  Cancel / Re-upload
                </Button>

                <Button
                  type="button"
                  variant="pill-primary"
                  size="sm"
                  disabled={isProvisioning || previewData.validCount === 0 || (!skipInvalid && (previewData.invalidCount > 0 || previewData.duplicateCount > 0))}
                  onClick={handleExecuteBulkProvision}
                  className="h-8 px-4 text-xs font-semibold"
                >
                  <CheckCircle2 className="mr-1.5 size-3.5" />
                  Provision {previewData.validCount} Accounts
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Provisioning Stage */}
        {stage === 'provisioning' && (
          <div className="space-y-4 py-8 text-center">
            <Loader2 className="text-primary mx-auto size-8 animate-spin" />
            <div className="space-y-1">
              <h4 className="text-foreground text-sm font-semibold">
                Executing Bulk Onboarding Pipeline...
              </h4>
              <p className="text-muted-foreground text-xs">
                Provisioning Clerk IAM identities with closed access policy and persisting linked
                collegiate records.
              </p>
            </div>
            <div className="mx-auto max-w-xs">
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div className="bg-primary h-full w-2/3 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Complete Stage */}
        {stage === 'complete' && provisionResult && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Bulk Onboarding Completed Successfully</h4>
                <p className="text-xs opacity-90">
                  Provisioned <strong>{provisionResult.successCount}</strong> collegiate accounts.{' '}
                  {provisionResult.skippedCount > 0 &&
                    `(${provisionResult.skippedCount} records skipped). `}
                  {provisionResult.failedCount > 0 &&
                    `(${provisionResult.failedCount} records failed).`}
                </p>
              </div>
            </div>

            {/* Results breakdown cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-card/40 border-glass-border rounded-xl border p-2.5 text-center">
                <div className="text-muted-foreground text-[10px] uppercase">Processed</div>
                <div className="font-mono text-base font-semibold">{provisionResult.totalRows}</div>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-center">
                <div className="text-[10px] uppercase text-emerald-500">Succeeded</div>
                <div className="font-mono text-base font-semibold text-emerald-500">
                  {provisionResult.successCount}
                </div>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-center">
                <div className="text-[10px] uppercase text-amber-500">Skipped / Failed</div>
                <div className="font-mono text-base font-semibold text-amber-500">
                  {provisionResult.skippedCount + provisionResult.failedCount}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              {provisionResult.errorReportCsv ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadErrorReport}
                  className="border-glass-border h-8 gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                >
                  <Download className="size-3.5" />
                  Download Error & Skip Report (.csv)
                </Button>
              ) : (
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  Zero errors encountered
                </div>
              )}

              <Button
                type="button"
                variant="pill-primary"
                size="sm"
                onClick={handleReset}
                className="h-8 px-4 text-xs font-semibold"
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Import Another Roster
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

