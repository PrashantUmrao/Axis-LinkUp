/**
 * Bulk Account Provisioning Domain Service.
 * Orchestrates CSV parsing, schema validation, intra-batch and database deduplication,
 * bounded-concurrency provisioning, failure resilience, and sanitized error reporting.
 */

import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import { ValidationError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { ProvisioningService } from './provisioning.service';
import {
  parseCsv,
  generateCsv,
  getStudentCsvTemplate,
  getFacultyCsvTemplate,
} from '@/lib/utils/csv';
import {
  MAX_BULK_CSV_BYTES,
  MAX_BULK_ROWS,
  normalizeHeader,
  mapCsvRowToProvisionInput,
} from '@/lib/validations/bulk-provision.schema';
import type { UserSession } from '@/types/user';
import type {
  BulkProvisionRole,
  BulkPreviewRow,
  BulkPreviewResponse,
  BulkProvisionResultItem,
  BulkProvisionResponse,
} from '@/types/bulk-provision';

export class BulkProvisioningService {
  /**
   * Concurrency boundary for bulk provisioning workers.
   * Limits simultaneous external API and DB writes to 3.
   */
  public static CONCURRENCY_LIMIT = 3;

  /**
   * Generates downloadable CSV template for student or faculty roles.
   */
  public static getTemplate(role: BulkProvisionRole): string {
    return role === 'student' ? getStudentCsvTemplate() : getFacultyCsvTemplate();
  }

  /**
   * Validates and parses CSV roster content, producing a dry-run preview.
   * Checks schema conformance, intra-batch duplicates, and existing database entities.
   * Does NOT persist users or create Clerk accounts.
   */
  public static async previewCsv(
    csvContent: string,
    role: BulkProvisionRole,
    callerSession: UserSession
  ): Promise<BulkPreviewResponse> {
    // 1. Authorization Gate: Strictly System Administrators
    assertCanManageUserRoles(
      callerSession,
      'Only System Administrators are authorized to preview and perform bulk account provisioning.'
    );

    // 2. File Size Boundary Check
    const byteLength = Buffer.byteLength(csvContent, 'utf8');
    if (byteLength > MAX_BULK_CSV_BYTES) {
      throw new ValidationError(
        `Uploaded CSV file size (${(byteLength / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit of 2 MB.`
      );
    }

    // 3. RFC 4180 CSV Parsing
    const parsedRows = parseCsv(csvContent);
    if (parsedRows.length === 0) {
      throw new ValidationError('The uploaded CSV file is empty.');
    }

    // Header extraction & normalization
    const rawHeaders = parsedRows[0] ?? [];
    const normalizedHeaders = rawHeaders.map(normalizeHeader);

    const dataRows = parsedRows.slice(1);
    if (dataRows.length === 0) {
      throw new ValidationError('The uploaded CSV contains a header but no data rows.');
    }

    if (dataRows.length > MAX_BULK_ROWS) {
      throw new ValidationError(
        `The uploaded CSV contains ${dataRows.length} rows, which exceeds the maximum limit of ${MAX_BULK_ROWS} rows per batch.`
      );
    }

    // 4. Pre-fetch Active Departments for fast in-memory validation
    await ProvisioningService.ensureDbConnected();
    const activeDepartments = await DepartmentRepository.findAllActive();
    const departmentMap = new Map<string, string>();
    for (const dept of activeDepartments) {
      departmentMap.set(dept.code.toUpperCase(), dept._id.toString());
      departmentMap.set(dept._id.toString(), dept._id.toString());
    }

    // Tracking sets for Intra-Batch Duplicates
    const seenEmails = new Set<string>();
    const seenUsernames = new Set<string>();
    const seenInstitutionalIds = new Set<string>();

    const previewRows: BulkPreviewRow[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let idx = 0; idx < dataRows.length; idx++) {
      const rowValues = dataRows[idx] ?? [];
      const rowNumber = idx + 2; // Line 1 is header, 1-indexed

      // Build key-value map for this row
      const rowMap: Record<string, string> = {};
      for (let h = 0; h < normalizedHeaders.length; h++) {
        const headerKey = normalizedHeaders[h];
        if (headerKey) {
          rowMap[headerKey] = rowValues[h] || '';
        }
      }

      // Map to schema input
      const { payload, errors } = mapCsvRowToProvisionInput(rowMap, role);
      const fullName = rowMap.fullName?.trim() || `Row ${rowNumber}`;
      const username = rowMap.username?.trim().toLowerCase() || '';
      const email = rowMap.institutionalEmail?.trim().toLowerCase() || '';
      const deptCode = rowMap.department?.trim().toUpperCase() || '';
      const institutionalId =
        role === 'student'
          ? rowMap.rollNumber?.trim().toUpperCase() || ''
          : rowMap.employeeId?.trim().toUpperCase() || '';

      const rowErrors = [...errors];
      let isDuplicate = false;

      // 4.1 Department Reference Verification
      if (deptCode && !departmentMap.has(deptCode)) {
        rowErrors.push(`Academic department "${deptCode}" is invalid, inactive, or not found`);
      } else if (role === 'student' && payload?.studentProfile?.program && deptCode) {
        // 4.1.1 Academic Program Verification: Program must belong to the assigned department and be active
        const programCheck = await DepartmentRepository.isProgramApprovedForDepartment(
          deptCode,
          payload.studentProfile.program
        );
        if (!programCheck.valid) {
          rowErrors.push(
            programCheck.reason ||
              `Program "${payload.studentProfile.program}" is not active or approved for Department "${deptCode}"`
          );
        }
      }

      // 4.2 Intra-Batch Duplicate Detection
      if (email) {
        if (seenEmails.has(email)) {
          rowErrors.push(`Duplicate institutional email "${email}" repeated within this CSV file`);
          isDuplicate = true;
        } else {
          seenEmails.add(email);
        }
      }

      if (username) {
        if (seenUsernames.has(username)) {
          rowErrors.push(`Duplicate username "${username}" repeated within this CSV file`);
          isDuplicate = true;
        } else {
          seenUsernames.add(username);
        }
      }

      if (institutionalId) {
        if (seenInstitutionalIds.has(institutionalId)) {
          rowErrors.push(
            `Duplicate ${role === 'student' ? 'roll number' : 'employee ID'} "${institutionalId}" repeated within this CSV file`
          );
          isDuplicate = true;
        } else {
          seenInstitutionalIds.add(institutionalId);
        }
      }

      // 4.3 Database Collision Verification (only if intra-batch duplicate check passed)
      if (email && !isDuplicate) {
        const existingEmail = await UserRepository.findByEmail(email);
        if (existingEmail) {
          rowErrors.push(`Collegiate user with institutional email "${email}" already exists`);
          isDuplicate = true;
        }
      }

      if (username && !isDuplicate) {
        const existingUsername = await UserRepository.findByUsername(username);
        if (existingUsername) {
          rowErrors.push(`Collegiate user with username "${username}" already exists`);
          isDuplicate = true;
        }
      }

      if (institutionalId && !isDuplicate) {
        const existingIdDoc =
          role === 'student'
            ? await UserRepository.findByRollNumber(institutionalId)
            : await UserRepository.findByEmployeeId(institutionalId);
        if (existingIdDoc) {
          rowErrors.push(
            `Collegiate user with ${role === 'student' ? 'roll number' : 'employee ID'} "${institutionalId}" already exists`
          );
          isDuplicate = true;
        }
      }

      // Determine row status
      let rowStatus: 'valid' | 'invalid' | 'duplicate' = 'valid';
      if (isDuplicate) {
        rowStatus = 'duplicate';
        duplicateCount++;
      } else if (rowErrors.length > 0) {
        rowStatus = 'invalid';
        invalidCount++;
      } else {
        validCount++;
      }

      previewRows.push({
        rowNumber,
        fullName,
        username,
        email,
        department: deptCode,
        role,
        institutionalId,
        status: rowStatus,
        errors: rowErrors,
        payload: rowStatus === 'valid' && payload ? payload : undefined,
      });
    }

    return {
      totalRows: dataRows.length,
      validCount,
      invalidCount,
      duplicateCount,
      canProceed: validCount > 0,
      rows: previewRows,
    };
  }

  /**
   * Executes the bulk account provisioning workflow with bounded concurrency.
   * Reuses ProvisioningService.provisionSingleAccount for each record.
   */
  public static async executeBulkProvision(
    csvContent: string,
    role: BulkProvisionRole,
    callerSession: UserSession,
    options?: { skipInvalid?: boolean }
  ): Promise<BulkProvisionResponse> {
    // 1. Authorization Gate
    assertCanManageUserRoles(
      callerSession,
      'Only System Administrators are authorized to execute bulk account provisioning.'
    );

    const skipInvalid = options?.skipInvalid ?? false;

    // 2. Perform Full Preview & Validation
    const preview = await this.previewCsv(csvContent, role, callerSession);

    if (preview.validCount === 0) {
      throw new ValidationError(
        'Cannot proceed with bulk provisioning: 0 valid records found in the uploaded file.'
      );
    }

    if (!skipInvalid && (preview.invalidCount > 0 || preview.duplicateCount > 0)) {
      throw new ValidationError(
        `CSV contains ${preview.invalidCount} invalid row(s) and ${preview.duplicateCount} duplicate row(s). Correct errors or enable "Skip Invalid Rows" to proceed.`
      );
    }

    logger.info(
      `[BulkProvisioningService] Starting bulk import of ${preview.validCount} accounts (${role}) by admin ${callerSession.userId}`
    );

    const results: BulkProvisionResultItem[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Filter rows into actionable items and non-actionable items
    const rowsToProcess: BulkPreviewRow[] = [];

    for (const row of preview.rows) {
      if (row.status === 'valid' && row.payload) {
        rowsToProcess.push(row);
      } else {
        skippedCount++;
        results.push({
          rowNumber: row.rowNumber,
          fullName: row.fullName,
          username: row.username,
          email: row.email,
          role,
          status: 'skipped',
          reason: row.errors.join('; ') || 'Record skipped due to validation or duplicate issues',
        });
      }
    }

    // 3. Process actionable rows with Bounded Concurrency
    const concurrency = this.CONCURRENCY_LIMIT;
    let currentIndex = 0;

    const processRow = async (row: BulkPreviewRow): Promise<void> => {
      try {
        const createdUser = await ProvisioningService.provisionSingleAccount(
          row.payload,
          callerSession
        );
        successCount++;
        results.push({
          rowNumber: row.rowNumber,
          fullName: row.fullName,
          username: row.username,
          email: row.email,
          role,
          status: 'success',
          userId: createdUser.id,
        });
      } catch (err: unknown) {
        failedCount++;
        const reason = err instanceof Error ? err.message : 'Unknown provisioning failure';
        logger.error(
          `[BulkProvisioningService] Failed to provision row ${row.rowNumber} (${row.email}) | error=${reason}`
        );
        results.push({
          rowNumber: row.rowNumber,
          fullName: row.fullName,
          username: row.username,
          email: row.email,
          role,
          status: 'failed',
          reason,
        });
      }
    };

    const workerPool: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrency, rowsToProcess.length); i++) {
      workerPool.push(
        (async () => {
          while (currentIndex < rowsToProcess.length) {
            const index = currentIndex++;
            const row = rowsToProcess[index];
            if (row) {
              await processRow(row);
            }
          }
        })()
      );
    }

    await Promise.all(workerPool);

    // Sort results by original rowNumber for deterministic display
    results.sort((a, b) => a.rowNumber - b.rowNumber);

    // 4. Generate Downloadable Error Report CSV if any rows failed or were skipped
    let errorReportCsv: string | undefined;
    const problematicRows = results.filter((r) => r.status === 'failed' || r.status === 'skipped');
    if (problematicRows.length > 0) {
      const reportHeaders = [
        'Row Number',
        'Full Name',
        'Username',
        'Institutional Email',
        'Role',
        'Status',
        'Reason',
      ];
      const reportRows = problematicRows.map((r) => [
        r.rowNumber,
        r.fullName,
        r.username,
        r.email,
        r.role,
        r.status,
        r.reason || '',
      ]);
      errorReportCsv = generateCsv(reportHeaders, reportRows);
    }

    logger.info(
      `[BulkProvisioningService] Bulk import completed: ${successCount} succeeded, ${failedCount} failed, ${skippedCount} skipped.`
    );

    return {
      totalRows: preview.totalRows,
      successCount,
      failedCount,
      skippedCount,
      results,
      errorReportCsv,
    };
  }
}

