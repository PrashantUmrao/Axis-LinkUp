/**
 * Bulk Provisioning Request & Row Validation Schemas (Zod).
 * Enforces file size boundaries, row constraints, and persona mappings.
 */

import { z } from 'zod';
import { provisionUserSchema, type ProvisionUserInput } from './provision.schema';

export const MAX_BULK_CSV_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_BULK_ROWS = 500;

export const bulkPreviewRequestSchema = z.object({
  csvContent: z
    .string({ message: 'CSV content is required' })
    .min(1, 'CSV content cannot be empty')
    .max(MAX_BULK_CSV_BYTES, 'CSV file exceeds maximum allowed size of 2MB'),
  role: z.enum(['student', 'faculty'], {
    message: 'Role must be specified as either student or faculty',
  }),
});

export const bulkProvisionRequestSchema = bulkPreviewRequestSchema.extend({
  skipInvalid: z.boolean().optional().default(false),
});

export type BulkPreviewRequestInput = z.infer<typeof bulkPreviewRequestSchema>;
export type BulkProvisionRequestInput = z.infer<typeof bulkProvisionRequestSchema>;

/**
 * Normalizes header string by trimming, removing quotes, and converting to camelCase/lowercase.
 */
export function normalizeHeader(raw: string): string {
  const clean = raw.trim().replace(/^["']|["']$/g, '');
  const lower = clean.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower === 'fullname' || lower === 'name') return 'fullName';
  if (lower === 'username' || lower === 'uname') return 'username';
  if (
    lower === 'institutionalemail' ||
    lower === 'email' ||
    lower === 'collegemail' ||
    lower === 'campusmail'
  ) {
    return 'institutionalEmail';
  }
  if (lower === 'department' || lower === 'dept' || lower === 'departmentid') return 'department';
  if (lower === 'rollnumber' || lower === 'rollno' || lower === 'enrollmentno') return 'rollNumber';
  if (lower === 'enrollmentnumber' || lower === 'enrollmentid') return 'enrollmentNumber';
  if (lower === 'batchyear' || lower === 'batch' || lower === 'year') return 'batchYear';
  if (lower === 'currentsemester' || lower === 'semester' || lower === 'sem') return 'currentSemester';
  if (lower === 'section' || lower === 'sec') return 'section';
  if (lower === 'program' || lower === 'prog' || lower === 'course' || lower === 'academicprogram') return 'program';
  if (lower === 'admissionyear' || lower === 'admyear') return 'admissionYear';
  if (lower === 'employeeid' || lower === 'empid' || lower === 'facultyid') return 'employeeId';
  if (lower === 'designation' || lower === 'title' || lower === 'role_title') return 'designation';
  if (lower === 'specialization' || lower === 'specializations' || lower === 'spec') return 'specialization';

  return clean;
}

/**
 * Maps a raw dictionary of parsed CSV columns into structured ProvisionUserInput.
 */
export function mapCsvRowToProvisionInput(
  rowMap: Record<string, string>,
  role: 'student' | 'faculty'
): { payload: ProvisionUserInput | null; errors: string[] } {
  const errors: string[] = [];

  const fullName = rowMap.fullName?.trim() || '';
  const username = rowMap.username?.trim().toLowerCase() || '';
  const email = rowMap.institutionalEmail?.trim().toLowerCase() || '';
  const department = rowMap.department?.trim().toUpperCase() || '';

  if (!fullName) errors.push('Full name is missing');
  if (!username) errors.push('Username is missing');
  if (!email) errors.push('Institutional email is missing');
  if (!department) errors.push('Department is missing');

  let rawPayload: Record<string, unknown>;

  if (role === 'student') {
    const rollNumber = rowMap.rollNumber?.trim().toUpperCase() || '';
    const rawBatchYear = rowMap.batchYear?.trim() || '';
    const rawSemester = rowMap.currentSemester?.trim() || '1';
    const section = rowMap.section?.trim().toUpperCase() || 'A';
    const program = rowMap.program?.trim().toUpperCase() || undefined;
    const rawAdmissionYear = rowMap.admissionYear?.trim();
    const admissionYear =
      rawAdmissionYear && !isNaN(Number(rawAdmissionYear))
        ? Number(rawAdmissionYear)
        : undefined;
    const enrollmentNumber = rowMap.enrollmentNumber?.trim() || undefined;

    const batchYear = Number(rawBatchYear);
    const currentSemester = Number(rawSemester);

    if (!rollNumber) errors.push('Roll number is missing');
    if (isNaN(batchYear)) errors.push('Batch year must be a valid number');
    if (isNaN(currentSemester) || currentSemester < 1 || currentSemester > 8) {
      errors.push('Current semester must be between 1 and 8');
    }

    rawPayload = {
      fullName,
      username,
      email,
      role: 'student',
      departmentId: department,
      studentProfile: {
        rollNumber,
        batchYear: isNaN(batchYear) ? new Date().getFullYear() : batchYear,
        currentSemester: isNaN(currentSemester) ? 1 : currentSemester,
        section: section || 'A',
        ...(program ? { program } : {}),
        ...(admissionYear ? { admissionYear } : {}),
        ...(enrollmentNumber ? { enrollmentNumber } : {}),
      },
    };
  } else {
    const employeeId = rowMap.employeeId?.trim().toUpperCase() || '';
    const designation = rowMap.designation?.trim() || '';
    const rawSpec = rowMap.specialization?.trim();
    const specialization = rawSpec
      ? rawSpec
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    if (!employeeId) errors.push('Employee ID is missing');
    if (!designation) errors.push('Designation is missing');

    rawPayload = {
      fullName,
      username,
      email,
      role: 'faculty',
      departmentId: department,
      facultyProfile: {
        employeeId,
        designation,
        ...(specialization && specialization.length > 0 ? { specialization } : {}),
      },
    };
  }

  if (errors.length > 0) {
    return { payload: null, errors };
  }

  // Validate with Zod provisionUserSchema
  const parseResult = provisionUserSchema.safeParse(rawPayload);
  if (!parseResult.success) {
    const zodIssues = parseResult.error.issues.map((issue) => issue.message);
    return { payload: null, errors: zodIssues };
  }

  return { payload: parseResult.data, errors: [] };
}

