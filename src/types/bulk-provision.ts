/**
 * Bulk Account Provisioning Types & Data Contracts.
 * Supports Phase 5.2.4 CSV-based bulk student and faculty onboarding.
 */

import type { ProvisionUserInput } from '@/lib/validations/provision.schema';

export type BulkProvisionRole = 'student' | 'faculty';

export type BulkRowStatus = 'valid' | 'invalid' | 'duplicate';

export interface BulkPreviewRow {
  rowNumber: number;
  fullName: string;
  username: string;
  email: string;
  department: string;
  role: BulkProvisionRole;
  institutionalId: string; // rollNumber for students, employeeId for faculty
  status: BulkRowStatus;
  errors: string[];
  payload?: ProvisionUserInput;
}

export interface BulkPreviewResponse {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  canProceed: boolean;
  rows: BulkPreviewRow[];
}

export interface BulkProvisionResultItem {
  rowNumber: number;
  fullName: string;
  username: string;
  email: string;
  role: BulkProvisionRole;
  status: 'success' | 'failed' | 'skipped';
  userId?: string;
  reason?: string;
}

export interface BulkProvisionResponse {
  totalRows: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  results: BulkProvisionResultItem[];
  errorReportCsv?: string;
}

