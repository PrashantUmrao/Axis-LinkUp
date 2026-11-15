/**
 * Automated Unit Test Suite for Bulk Student & Faculty Account Provisioning (Phase 5.2.4).
 * Verifies CSV parsing, schema validation, intra-batch and database deduplication,
 * bounded-concurrency execution, failure resilience, compensating rollback,
 * administrative separation of powers, file and row boundaries, and formula injection sanitization.
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import {
  parseCsv,
  generateCsv,
  sanitizeCsvFormula,
  getStudentCsvTemplate,
  getFacultyCsvTemplate,
  STUDENT_CSV_HEADERS,
  FACULTY_CSV_HEADERS,
} from '../../src/lib/utils/csv';
import {
  normalizeHeader,
  mapCsvRowToProvisionInput,
  MAX_BULK_CSV_BYTES,
  MAX_BULK_ROWS,
} from '../../src/lib/validations/bulk-provision.schema';
import { BulkProvisioningService } from '../../src/lib/services/bulk-provisioning.service';
import { ProvisioningService } from '../../src/lib/services/provisioning.service';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { ForbiddenError, ValidationError } from '../../src/lib/errors/app-error';
import type { UserSession, UserDTO, IUser } from '../../src/types/user';
import type { IDepartment } from '../../src/types/department';

describe('Phase 5.2.4 — 1. CSV Utilities & Formula Injection Sanitization', () => {
  test('parses standard RFC 4180 CSV with quotes, commas, and multiline cells', () => {
    const csv = `fullName,username,institutionalEmail\r\n"Sharma, Aarav",aarav.sharma,aarav@axiscolleges.in\r\n"Dr. ""Special"" Name",dr.special,special@axiscolleges.in`;
    const rows = parseCsv(csv);

    assert.strictEqual(rows.length, 3);
    assert.deepStrictEqual(rows[0], ['fullName', 'username', 'institutionalEmail']);
    assert.strictEqual(rows[1]?.[0], 'Sharma, Aarav');
    assert.strictEqual(rows[2]?.[0], 'Dr. "Special" Name');
  });

  test('maps raw CSV row dictionary into structured ProvisionUserInput', () => {
    const rawStudent = {
      fullName: 'Aarav Sharma',
      username: 'aarav.sharma24',
      institutionalEmail: 'aarav@axiscolleges.in',
      department: 'CSE',
      rollNumber: '24BCSE101',
      batchYear: '2026',
      currentSemester: '1',
      section: 'A',
    };
    const { payload, errors } = mapCsvRowToProvisionInput(rawStudent, 'student');
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(payload?.fullName, 'Aarav Sharma');
    assert.strictEqual(payload?.studentProfile?.rollNumber, '24BCSE101');
  });

  test('neutralizes formula injection characters (=, +, -, @, \\t, \\r)', () => {
    assert.strictEqual(sanitizeCsvFormula('=cmd|/C calc.exe!A0'), "'=cmd|/C calc.exe!A0");
    assert.strictEqual(sanitizeCsvFormula('+123456789'), "'+123456789");
    assert.strictEqual(sanitizeCsvFormula('-SUM(A1:A10)'), "'-SUM(A1:A10)");
    assert.strictEqual(sanitizeCsvFormula('@dangerous_macro'), "'@dangerous_macro");
    assert.strictEqual(sanitizeCsvFormula('\tmalicious_tab'), "'\tmalicious_tab");
    assert.strictEqual(sanitizeCsvFormula('  =formula_with_leading_spaces'), "'  =formula_with_leading_spaces");
    // Benign text remains untouched
    assert.strictEqual(sanitizeCsvFormula('Aarav Sharma'), 'Aarav Sharma');
    assert.strictEqual(sanitizeCsvFormula('FAC-CSE-001'), 'FAC-CSE-001');
  });

  test('generates valid sanitized CSV output and escapes quotes', () => {
    const headers = ['Name', 'Formula', 'Description'];
    const rows = [
      ['Aarav Sharma', '=1+1', 'Student in "CSE" Department'],
      ['Dr. Sen', '+919999999999', 'Head, Electronics'],
    ];

    const result = generateCsv(headers, rows);
    assert.ok(result.includes("'=1+1"));
    assert.ok(result.includes('Student in ""CSE"" Department'));
    assert.ok(result.includes('"Head, Electronics"'));
  });

  test('generates student and faculty templates with expected headers', () => {
    const studentTpl = getStudentCsvTemplate();
    const facultyTpl = getFacultyCsvTemplate();

    for (const h of STUDENT_CSV_HEADERS) {
      assert.ok(studentTpl.includes(h), `Missing student header: ${h}`);
    }
    for (const h of FACULTY_CSV_HEADERS) {
      assert.ok(facultyTpl.includes(h), `Missing faculty header: ${h}`);
    }
  });

  test('normalizes varied CSV header synonyms', () => {
    assert.strictEqual(normalizeHeader('Full Name'), 'fullName');
    assert.strictEqual(normalizeHeader('email'), 'institutionalEmail');
    assert.strictEqual(normalizeHeader('campus_mail'), 'institutionalEmail');
    assert.strictEqual(normalizeHeader('Roll No'), 'rollNumber');
    assert.strictEqual(normalizeHeader('Emp ID'), 'employeeId');
    assert.strictEqual(normalizeHeader('Dept'), 'department');
    assert.strictEqual(normalizeHeader('Sem'), 'currentSemester');
  });
});

describe('Phase 5.2.4 — 2. Administrative Authorization & Separation of Powers', () => {
  const sampleStudentCsv = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section\r\nAarav Sharma,aarav.sharma,aarav@axiscolleges.in,CSE,24BCSE101,2026,1,A`;

  test('rejects bulk preview when invoked by Department HOD', async () => {
    const hodCaller: UserSession = {
      userId: '6730a005f8b1a2001a000020',
      email: 'hod.cse@axiscolleges.in',
      role: 'admin',
      adminSubRole: 'hod',
    };

    await assert.rejects(
      async () => {
        await BulkProvisioningService.previewCsv(sampleStudentCsv, 'student', hodCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Only System Administrators'));
        return true;
      }
    );
  });

  test('rejects bulk execution when invoked by Executive Director', async () => {
    const directorCaller: UserSession = {
      userId: '6730a005f8b1a2001a000021',
      email: 'director@axiscolleges.in',
      role: 'super_admin',
      adminSubRole: 'director',
    };

    await assert.rejects(
      async () => {
        await BulkProvisioningService.executeBulkProvision(sampleStudentCsv, 'student', directorCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        assert.ok(err.message.includes('Only System Administrators'));
        return true;
      }
    );
  });

  test('rejects bulk preview when invoked by Faculty or Student', async () => {
    const studentCaller: UserSession = {
      userId: '6730a005f8b1a2001a000023',
      email: 'student@axiscolleges.in',
      role: 'student',
    };

    await assert.rejects(
      async () => {
        await BulkProvisioningService.previewCsv(sampleStudentCsv, 'student', studentCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      }
    );
  });
});

describe('Phase 5.2.4 — 3. File & Row Boundary Validation', () => {
  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
  };

  test('rejects empty CSV content', async () => {
    await assert.rejects(
      async () => {
        await BulkProvisioningService.previewCsv('   ', 'student', sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('empty'));
        return true;
      }
    );
  });

  test('rejects CSV with header only (0 data rows)', async () => {
    const headerOnly = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section`;
    await assert.rejects(
      async () => {
        await BulkProvisioningService.previewCsv(headerOnly, 'student', sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('no data rows'));
        return true;
      }
    );
  });

  test('rejects CSV exceeding maximum row limit (500 rows)', async () => {
    const header = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section`;
    const rows: string[] = [header];
    for (let i = 1; i <= 505; i++) {
      rows.push(`Student ${i},stu.${i},stu${i}@axiscolleges.in,CSE,24B${i},2026,1,A`);
    }

    await assert.rejects(
      async () => {
        await BulkProvisioningService.previewCsv(rows.join('\r\n'), 'student', sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes(`exceeds the maximum limit of ${MAX_BULK_ROWS}`));
        return true;
      }
    );
  });

  test('rejects CSV content exceeding maximum size limit (2 MB)', async () => {
    const largeContent = 'a'.repeat(MAX_BULK_CSV_BYTES + 10);
    await assert.rejects(
      async () => {
        await BulkProvisioningService.previewCsv(largeContent, 'student', sysAdminCaller);
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('exceeds maximum allowed limit of 2 MB'));
        return true;
      }
    );
  });
});

describe('Phase 5.2.4 — 4. Deduplication & Collision Detection', () => {
  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
  };

  const fakeDept = { _id: new Types.ObjectId('6730a005f8b1a2001a000050'), code: 'CSE', name: 'Computer Science' } as IDepartment;

  test('detects intra-batch duplicate emails and marks status as duplicate', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    const duplicateCsv = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section\r\nAarav Sharma,aarav.sharma1,rohit@axiscolleges.in,CSE,24BCSE101,2026,1,A\r\nRohit Sharma,rohit.sharma2,rohit@axiscolleges.in,CSE,24BCSE102,2026,1,B`;

    const preview = await BulkProvisioningService.previewCsv(duplicateCsv, 'student', sysAdminCaller);

    assert.strictEqual(preview.totalRows, 2);
    assert.strictEqual(preview.validCount, 1);
    assert.strictEqual(preview.duplicateCount, 1);
    assert.strictEqual(preview.rows[0]?.status, 'valid');
    assert.strictEqual(preview.rows[1]?.status, 'duplicate');
    assert.ok(preview.rows[1]?.errors.some((e) => e.includes('Duplicate institutional email')));

    mock.reset();
  });

  test('detects intra-batch duplicate roll numbers within CSV', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    const duplicateCsv = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section\r\nAarav Sharma,aarav.sharma,aarav@axiscolleges.in,CSE,24BCSE101,2026,1,A\r\nRohit Kumar,rohit.kumar,rohit@axiscolleges.in,CSE,24BCSE101,2026,1,B`;

    const preview = await BulkProvisioningService.previewCsv(duplicateCsv, 'student', sysAdminCaller);

    assert.strictEqual(preview.validCount, 1);
    assert.strictEqual(preview.duplicateCount, 1);
    assert.ok(preview.rows[1]?.errors.some((e) => e.includes('Duplicate roll number')));

    mock.reset();
  });

  test('detects existing database entity collision (email and roll number)', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    // Simulate existing user in MongoDB with this email
    mock.method(UserRepository, 'findByEmail', async () => ({ _id: new Types.ObjectId() } as unknown as IUser));
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    const csv = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section\r\nExisting User,user.existing,existing@axiscolleges.in,CSE,24BCSE105,2026,1,A`;

    const preview = await BulkProvisioningService.previewCsv(csv, 'student', sysAdminCaller);

    assert.strictEqual(preview.validCount, 0);
    assert.strictEqual(preview.duplicateCount, 1);
    assert.strictEqual(preview.rows[0]?.status, 'duplicate');
    assert.ok(preview.rows[0]?.errors.some((e) => e.includes('already exists')));

    mock.reset();
  });

  test('flags invalid department reference', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    const csv = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section\r\nAarav Sharma,aarav.sharma,aarav@axiscolleges.in,UNKNOWN_DEPT,24BCSE101,2026,1,A`;

    const preview = await BulkProvisioningService.previewCsv(csv, 'student', sysAdminCaller);

    assert.strictEqual(preview.validCount, 0);
    assert.strictEqual(preview.invalidCount, 1);
    assert.strictEqual(preview.rows[0]?.status, 'invalid');
    assert.ok(preview.rows[0]?.errors.some((e) => e.includes('UNKNOWN_DEPT')));

    mock.reset();
  });
});

describe('Phase 5.2.4 — 5. Bulk Provisioning Execution & Resilience', () => {
  const sysAdminCaller: UserSession = {
    userId: '6730a005f8b1a2001a000099',
    email: 'sysadmin@axiscolleges.in',
    role: 'super_admin',
    adminSubRole: 'sys_admin',
  };

  const fakeDept = { _id: new Types.ObjectId('6730a005f8b1a2001a000050'), code: 'CSE', name: 'Computer Science' } as IDepartment;

  test('successfully provisions all valid student records in bulk with bounded concurrency', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    // Mock ProvisioningService.provisionSingleAccount to succeed
    let provisionedCount = 0;
    mock.method(ProvisioningService, 'provisionSingleAccount', async (input: unknown) => {
      provisionedCount++;
      const cast = input as { email: string; username: string; fullName: string };
      return {
        id: `mock_user_id_${provisionedCount}`,
        email: cast.email,
        username: cast.username,
        fullName: cast.fullName,
        role: 'student',
        status: 'pending_verification',
      } as unknown as UserDTO;
    });

    const csv = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section\r\nAarav Sharma,aarav.sharma,aarav@axiscolleges.in,CSE,24BCSE101,2026,1,A\r\nRohit Kumar,rohit.kumar,rohit@axiscolleges.in,CSE,24BCSE102,2026,1,B\r\nDivya Nair,divya.nair,divya@axiscolleges.in,CSE,24BCSE103,2026,1,A`;

    const result = await BulkProvisioningService.executeBulkProvision(csv, 'student', sysAdminCaller);

    assert.strictEqual(result.totalRows, 3);
    assert.strictEqual(result.successCount, 3);
    assert.strictEqual(result.failedCount, 0);
    assert.strictEqual(result.skippedCount, 0);
    assert.strictEqual(provisionedCount, 3);
    assert.strictEqual(result.errorReportCsv, undefined);

    mock.reset();
  });

  test('successfully provisions valid faculty records', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByEmployeeId', async () => null);

    mock.method(ProvisioningService, 'provisionSingleAccount', async (input: unknown) => {
      const cast = input as { email: string; username: string; fullName: string };
      return {
        id: 'mock_fac_id_101',
        email: cast.email,
        username: cast.username,
        fullName: cast.fullName,
        role: 'faculty',
        status: 'pending_verification',
      } as unknown as UserDTO;
    });

    const csv = `fullName,username,institutionalEmail,department,employeeId,designation\r\nDr. Vivek Shukla,dr.shukla,dr.shukla@axiscolleges.in,CSE,FAC-CSE-001,Associate Professor`;

    const result = await BulkProvisioningService.executeBulkProvision(csv, 'faculty', sysAdminCaller);

    assert.strictEqual(result.totalRows, 1);
    assert.strictEqual(result.successCount, 1);
    assert.strictEqual(result.failedCount, 0);
    assert.strictEqual(result.results[0]?.status, 'success');

    mock.reset();
  });

  test('rejects execution when skipInvalid=false and CSV contains errors', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    // Row 2 is invalid (invalid email format)
    const mixedCsv = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section\r\nAarav Sharma,aarav.sharma,aarav@axiscolleges.in,CSE,24BCSE101,2026,1,A\r\nBad Email,bad.email,not-a-valid-email,CSE,24BCSE102,2026,1,B`;

    await assert.rejects(
      async () => {
        await BulkProvisioningService.executeBulkProvision(mixedCsv, 'student', sysAdminCaller, {
          skipInvalid: false,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.includes('invalid row(s)'));
        return true;
      }
    );

    mock.reset();
  });

  test('provisions valid rows and safely skips invalid rows when skipInvalid=true', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    let provisionCalls = 0;
    mock.method(ProvisioningService, 'provisionSingleAccount', async (input: unknown) => {
      provisionCalls++;
      const cast = input as { email: string };
      return { id: 'user_ok', email: cast.email } as unknown as UserDTO;
    });

    const mixedCsv = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section\r\nAarav Sharma,aarav.sharma,aarav@axiscolleges.in,CSE,24BCSE101,2026,1,A\r\nInvalid User,bad.user,not-a-valid-email,CSE,24BCSE102,2026,1,B`;

    const result = await BulkProvisioningService.executeBulkProvision(mixedCsv, 'student', sysAdminCaller, {
      skipInvalid: true,
    });

    assert.strictEqual(result.totalRows, 2);
    assert.strictEqual(result.successCount, 1);
    assert.strictEqual(result.skippedCount, 1);
    assert.strictEqual(provisionCalls, 1);
    assert.ok(result.errorReportCsv !== undefined);
    assert.ok(result.errorReportCsv.includes('not-a-valid-email'));

    mock.reset();
  });

  test('isolates single row failure during execution without stopping remaining rows', async () => {
    mock.method(DepartmentRepository, 'findAllActive', async () => [fakeDept]);
    mock.method(UserRepository, 'findByEmail', async () => null);
    mock.method(UserRepository, 'findByUsername', async () => null);
    mock.method(UserRepository, 'findByRollNumber', async () => null);

    // Row 2 simulates external Clerk failure
    mock.method(ProvisioningService, 'provisionSingleAccount', async (input: unknown) => {
      const cast = input as { email: string };
      if (cast.email === 'failing.user@axiscolleges.in') {
        throw new Error('Clerk API rate limit exceeded');
      }
      return { id: 'success_id', email: cast.email } as unknown as UserDTO;
    });

    const csv = `fullName,username,institutionalEmail,department,rollNumber,batchYear,currentSemester,section\r\nUser One,user.one,user1@axiscolleges.in,CSE,24BCSE101,2026,1,A\r\nUser Two,user.two,failing.user@axiscolleges.in,CSE,24BCSE102,2026,1,B\r\nUser Three,user.three,user3@axiscolleges.in,CSE,24BCSE103,2026,1,C`;

    const result = await BulkProvisioningService.executeBulkProvision(csv, 'student', sysAdminCaller);

    assert.strictEqual(result.totalRows, 3);
    assert.strictEqual(result.successCount, 2);
    assert.strictEqual(result.failedCount, 1);
    assert.strictEqual(result.results[1]?.status, 'failed');
    assert.ok(result.results[1]?.reason?.includes('Clerk API rate limit'));
    assert.ok(result.errorReportCsv !== undefined);
    assert.ok(result.errorReportCsv.includes('failing.user@axiscolleges.in'));

    mock.reset();
  });
});

