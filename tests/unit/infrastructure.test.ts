/**
 * Isolated unit test suite for core infrastructure and shared utilities.
 * Demonstrates API responses, errors, pagination, formatting, and logging.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSuccessPayload,
  createErrorPayload,
  createOffsetPaginationMeta,
  createCursorPaginationMeta,
} from '../../src/lib/api/api-response';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from '../../src/lib/errors/app-error';
import { ERROR_CODES } from '../../src/lib/errors/error-codes';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toISODateString,
} from '../../src/lib/utils/format-date';
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatCompactNumber,
} from '../../src/lib/utils/format-number';
import { formatFileSize } from '../../src/lib/utils/format-file-size';
import { sanitizeLogData } from '../../src/lib/logging/logger';
import {
  objectIdSchema,
  paginationQuerySchema,
  emailSchema,
  studentRollNumberSchema,
} from '../../src/lib/validations/common-schemas';

describe('1. API Response Helpers', () => {
  test('generates standardized success payload', () => {
    const data = { noticeId: '6730a005f8b1a2001a000050', title: 'Mid-Term Exam' };
    const payload = createSuccessPayload(data, 'Notice retrieved');

    assert.strictEqual(payload.success, true);
    assert.strictEqual(payload.message, 'Notice retrieved');
    assert.deepStrictEqual(payload.data, data);
    assert.strictEqual(payload.error, null);
    assert.ok(typeof payload.timestamp === 'string');
    assert.ok(!Number.isNaN(Date.parse(payload.timestamp)));
  });

  test('generates standardized error payload', () => {
    const payload = createErrorPayload('Notice not found', ERROR_CODES.NOT_FOUND, { id: '123' });

    assert.strictEqual(payload.success, false);
    assert.strictEqual(payload.message, 'Notice not found');
    assert.strictEqual(payload.data, null);
    assert.strictEqual(payload.error.code, ERROR_CODES.NOT_FOUND);
    assert.deepStrictEqual(payload.error.details, { id: '123' });
    assert.ok(typeof payload.timestamp === 'string');
  });
});

describe('2. Standardized Application Errors', () => {
  test('instantiates AppError with correct defaults', () => {
    const err = new AppError('General failure');
    assert.strictEqual(err.statusCode, 500);
    assert.strictEqual(err.code, ERROR_CODES.INTERNAL_ERROR);
    assert.strictEqual(err.isOperational, true);
  });

  test('instantiates specialized ValidationError with 400 status', () => {
    const details = [{ field: 'title', message: 'Title required' }];
    const err = new ValidationError('Payload invalid', details);
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.code, ERROR_CODES.VALIDATION_ERROR);
    assert.deepStrictEqual(err.details, details);
  });

  test('instantiates NotFoundError and UnauthorizedError correctly', () => {
    const notFound = new NotFoundError('Course', 'CS301');
    assert.strictEqual(notFound.statusCode, 404);
    assert.strictEqual(notFound.code, ERROR_CODES.NOT_FOUND);
    assert.ok(notFound.message.includes('CS301'));

    const unauth = new UnauthorizedError();
    assert.strictEqual(unauth.statusCode, 401);
    assert.strictEqual(unauth.code, ERROR_CODES.UNAUTHORIZED);
  });
});

describe('3. Pagination Helpers', () => {
  test('calculates offset pagination metadata accurately', () => {
    // 95 items with 20 items per page = 5 pages
    const metaPage1 = createOffsetPaginationMeta(1, 20, 95);
    assert.strictEqual(metaPage1.currentPage, 1);
    assert.strictEqual(metaPage1.pageSize, 20);
    assert.strictEqual(metaPage1.totalItems, 95);
    assert.strictEqual(metaPage1.totalPages, 5);
    assert.strictEqual(metaPage1.hasMore, true);

    const metaPage5 = createOffsetPaginationMeta(5, 20, 95);
    assert.strictEqual(metaPage5.currentPage, 5);
    assert.strictEqual(metaPage5.hasMore, false);
  });

  test('creates cursor pagination metadata', () => {
    const meta = createCursorPaginationMeta(25, 'cursor_abc123', true);
    assert.strictEqual(meta.limit, 25);
    assert.strictEqual(meta.nextCursor, 'cursor_abc123');
    assert.strictEqual(meta.hasMore, true);
  });
});

describe('4. Formatting Utilities', () => {
  test('formats dates with Indian locale standards', () => {
    const testDate = new Date('2026-11-12T10:30:00.000Z');
    const formatted = formatDate(testDate);
    assert.ok(formatted.includes('2026'));

    const formattedTime = formatDateTime(testDate);
    assert.ok(formattedTime.includes('2026'));

    const iso = toISODateString(testDate);
    assert.strictEqual(iso, '2026-11-12T10:30:00.000Z');

    // Invalid input fallback
    assert.strictEqual(formatDate(null), '');
    assert.strictEqual(formatDate('invalid-date'), '');
  });

  test('formats relative time accurately', () => {
    const now = new Date();
    assert.strictEqual(formatRelativeTime(now), 'just now');

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    assert.strictEqual(formatRelativeTime(tenMinutesAgo), '10m ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    assert.strictEqual(formatRelativeTime(twoHoursAgo), '2h ago');
  });

  test('formats numbers and currencies with Indian grouping', () => {
    assert.strictEqual(formatNumber(125000), '1,25,000');
    assert.strictEqual(formatNumber(null), '0');

    const currency = formatCurrency(150000);
    assert.ok(currency.includes('1,50,000'));

    assert.strictEqual(formatPercentage(0.785), '78.5%');
    assert.strictEqual(formatPercentage(78.5), '78.5%');

    assert.strictEqual(formatCompactNumber(1200), '1.2K');
  });

  test('formats file sizes into human-readable binary units', () => {
    assert.strictEqual(formatFileSize(0), '0 Bytes');
    assert.strictEqual(formatFileSize(500), '500 Bytes');
    assert.strictEqual(formatFileSize(1024), '1.00 KB');
    assert.strictEqual(formatFileSize(1048576), '1.00 MB');
    assert.strictEqual(formatFileSize(1073741824), '1.00 GB');
    assert.strictEqual(formatFileSize(null), '0 Bytes');
  });
});

describe('5. Logger Data Redaction & Sanitization', () => {
  test('automatically redacts sensitive credentials and retains normal fields', () => {
    const rawPayload = {
      username: 'student_raghav',
      password: 'SuperSecretPassword123!',
      sessionToken: 'clerk_session_xyz',
      apiKey: 'ably_key_secret',
      nested: {
        authorization: 'Bearer token_abc',
        safeProperty: 'hello',
      },
    };

    const sanitized = sanitizeLogData(rawPayload) as typeof rawPayload;

    assert.strictEqual(sanitized.username, 'student_raghav');
    assert.strictEqual(sanitized.password, '[REDACTED]');
    assert.strictEqual(sanitized.sessionToken, '[REDACTED]');
    assert.strictEqual(sanitized.apiKey, '[REDACTED]');
    assert.strictEqual(sanitized.nested.authorization, '[REDACTED]');
    assert.strictEqual(sanitized.nested.safeProperty, 'hello');
  });
});

describe('6. Common Validation Schemas', () => {
  test('validates 24-character hexadecimal MongoDB ObjectIds', () => {
    assert.strictEqual(objectIdSchema.safeParse('6730a005f8b1a2001a000050').success, true);
    assert.strictEqual(objectIdSchema.safeParse('invalid-id').success, false);
    assert.strictEqual(objectIdSchema.safeParse('12345').success, false);
  });

  test('validates pagination query defaults', () => {
    const result = paginationQuerySchema.parse({});
    assert.strictEqual(result.page, 1);
    assert.strictEqual(result.limit, 20);
    assert.strictEqual(result.sortBy, 'createdAt');
    assert.strictEqual(result.sortOrder, 'desc');
  });

  test('validates institutional student roll numbers', () => {
    assert.strictEqual(studentRollNumberSchema.safeParse('22BCSE101').success, true);
    assert.strictEqual(studentRollNumberSchema.safeParse('23BECE-045').success, true);
    assert.strictEqual(studentRollNumberSchema.safeParse('bad').success, false);
  });

  test('validates emails normalized to lowercase', () => {
    const parsed = emailSchema.parse('Student.Name@AxisColleges.in ');
    assert.strictEqual(parsed, 'student.name@axiscolleges.in');
  });
});
