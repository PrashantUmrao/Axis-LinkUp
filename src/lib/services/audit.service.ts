/**
 * Immutable Security Audit Log Service (MOD-19 / Phase 5.10).
 * Implements deterministic SHA-256 cryptographic hash chaining, recursive secret
 * redaction, tamper verification, RBAC-scoped log querying, and formula-injection-safe
 * CSV/JSON compliance exports.
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import { AuditLogRepository } from '@/lib/db/repositories/audit-log.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { toAuditLogDTO } from '@/lib/db/models/audit-log.model';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { getPermissionScope } from '@/lib/auth/rbac';
import { ForbiddenError } from '@/lib/errors/app-error';
import type { UserSession } from '@/types/user';
import type {
  AuditAction,
  AuditChainVerificationDTO,
  AuditHashPayload,
  AuditLogDTO,
  AuditModule,
  AuditSeverity,
  AuditStatsDTO,
  IAuditActorSnapshot,
  PaginatedAuditLogsDTO,
} from '@/types/governance';
import type {
  AuditExportQueryParams,
  AuditLogQueryParams,
} from '@/lib/validations/governance.schema';

const SENSITIVE_KEY_PATTERN =
  /password|passphrase|token|secret|otp|apikey|api_key|privatekey|private_key|authorization|cookie|credential|hash/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recursively canonicalizes values with lexicographically sorted object keys
 * for deterministic SHA-256 hashing across runtimes and serialization boundaries.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const val = obj[key];
      if (val !== undefined) {
        sorted[key] = canonicalize(val);
      }
    }
    return sorted;
  }
  return value;
}

export interface RecordAuditEventInput {
  actorId: string;
  actorSnapshot: IAuditActorSnapshot;
  action: AuditAction | string;
  module: AuditModule;
  severity?: AuditSeverity;
  targetEntityType: string;
  targetEntityId: string;
  targetLabel?: string | null;
  department?: string | null;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Recursively strips sensitive credential/token/secret fields from state snapshots
   * before persistence in the immutable audit trail.
   */
  public static sanitizeState(
    state: Record<string, unknown> | null | undefined
  ): Record<string, unknown> | null {
    if (!state || typeof state !== 'object') return null;

    const cleanValue = (val: unknown): unknown => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val.toISOString();
      if (Array.isArray(val)) return val.map(cleanValue);
      if (typeof val === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(val as Record<string, unknown>)) {
          if (SENSITIVE_KEY_PATTERN.test(key)) {
            continue;
          }
          result[key] = cleanValue(nested);
        }
        return result;
      }
      return val;
    };

    const sanitized = cleanValue(state) as Record<string, unknown>;
    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }

  /**
   * Computes a deterministic SHA-256 hex digest over the canonical audit hash payload.
   */
  public static computeEntryHash(payload: AuditHashPayload): string {
    const canonicalPayload = canonicalize({
      eventId: payload.eventId,
      actorId: payload.actorId,
      action: payload.action,
      module: payload.module,
      targetEntityId: payload.targetEntityId,
      oldState: payload.oldState ?? null,
      newState: payload.newState ?? null,
      previousHash: payload.previousHash,
      createdAt: payload.createdAt,
    });

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalPayload))
      .digest('hex');
  }

  /**
   * Escapes a single CSV cell per RFC 4180 and neutralizes spreadsheet formula injection
   * (=, +, -, @, tab, CR prefixes).
   */
  public static escapeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    let str = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Neutralize formula injection prefixes
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Appends a cryptographically hash-chained immutable event to the AuditLog collection.
   */
  public static async recordEvent(input: RecordAuditEventInput): Promise<AuditLogDTO> {
    const [latestEntry, eventId] = await Promise.all([
      AuditLogRepository.findLatestEntry(),
      AuditLogRepository.getNextEventId(),
    ]);

    const previousHash = latestEntry?.entryHash || 'GENESIS';
    const createdAt = new Date();
    const sanitizedOld = this.sanitizeState(input.oldState);
    const sanitizedNew = this.sanitizeState(input.newState);

    const normalizedAction = input.action.trim().toUpperCase();
    const entryHash = this.computeEntryHash({
      eventId,
      actorId: String(input.actorId),
      action: normalizedAction,
      module: input.module,
      targetEntityId: String(input.targetEntityId),
      oldState: sanitizedOld,
      newState: sanitizedNew,
      previousHash,
      createdAt: createdAt.toISOString(),
    });

    const actorObjId = Types.ObjectId.isValid(input.actorId)
      ? new Types.ObjectId(input.actorId)
      : new Types.ObjectId();

    const created = await AuditLogRepository.create({
      eventId,
      actorId: actorObjId,
      actorSnapshot: {
        fullName: input.actorSnapshot.fullName || 'System Actor',
        email: input.actorSnapshot.email || 'system@axiscolleges.in',
        role: input.actorSnapshot.role || 'super_admin',
        department: input.actorSnapshot.department ?? null,
      },
      action: normalizedAction,
      module: input.module,
      severity: input.severity || 'info',
      targetEntityType: input.targetEntityType,
      targetEntityId: String(input.targetEntityId),
      targetLabel: input.targetLabel ?? null,
      department: input.department ?? null,
      oldState: sanitizedOld,
      newState: sanitizedNew,
      reason: input.reason ? input.reason.trim() : null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ? input.userAgent.slice(0, 500) : null,
      previousHash,
      entryHash,
      createdAt,
    });

    return toAuditLogDTO(created);
  }

  /**
   * Resolves the RBAC-enforced MongoDB query scope for audit viewing.
   * - super_admin: global access
   * - admin: strictly department-scoped
   * - student / faculty: 403 Forbidden
   */
  private static async buildAccessScopedFilter(
    session: UserSession,
    query: Partial<AuditLogQueryParams> = {}
  ): Promise<Record<string, unknown>> {
    const scope = getPermissionScope(session.role, PERMISSIONS.AUDIT_VIEW_LOGS);
    if (scope === 'DENY') {
      throw new ForbiddenError(
        'Access denied. You do not have permission to view institutional security audit logs.'
      );
    }

    const filter: Record<string, unknown> = {};

    if (scope === 'DEPT' && session.role === 'admin') {
      if (!session.departmentId) {
        throw new ForbiddenError(
          'Departmental scope required: your administrator account is not assigned to a department.'
        );
      }
      const dept = await DepartmentRepository.findById(session.departmentId);
      if (!dept) {
        throw new ForbiddenError(
          'Departmental scope could not be verified for audit log access.'
        );
      }
      filter.department = dept.name;
    } else if (query.department && query.department.trim()) {
      filter.department = { $regex: escapeRegex(query.department.trim()), $options: 'i' };
    }

    if (query.module) filter.module = query.module;
    if (query.severity) filter.severity = query.severity;
    if (query.action && query.action.trim()) {
      filter.action = query.action.trim().toUpperCase();
    }
    if (query.actorId && Types.ObjectId.isValid(query.actorId)) {
      filter.actorId = new Types.ObjectId(query.actorId);
    }
    if (query.targetEntityId && query.targetEntityId.trim()) {
      filter.targetEntityId = query.targetEntityId.trim();
    }

    if (query.dateFrom || query.dateTo) {
      const range: Record<string, Date> = {};
      if (query.dateFrom) range.$gte = new Date(query.dateFrom);
      if (query.dateTo) range.$lte = new Date(query.dateTo);
      filter.createdAt = range;
    }

    if (query.search && query.search.trim()) {
      const term = escapeRegex(query.search.trim());
      filter.$or = [
        { eventId: { $regex: term, $options: 'i' } },
        { action: { $regex: term, $options: 'i' } },
        { targetLabel: { $regex: term, $options: 'i' } },
        { targetEntityId: { $regex: term, $options: 'i' } },
        { reason: { $regex: term, $options: 'i' } },
        { 'actorSnapshot.fullName': { $regex: term, $options: 'i' } },
        { 'actorSnapshot.email': { $regex: term, $options: 'i' } },
      ];
    }

    return filter;
  }

  /**
   * Retrieves paginated security audit logs with RBAC departmental isolation.
   */
  public static async listAuditLogs(
    session: UserSession,
    query: Partial<AuditLogQueryParams> = {}
  ): Promise<PaginatedAuditLogsDTO> {
    const filter = await this.buildAccessScopedFilter(session, query);
    const page = query.page || 1;
    const limit = query.limit || 25;

    const { logs, total } = await AuditLogRepository.findLogs(filter, page, limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      logs: logs.map(toAuditLogDTO),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Computes summary audit metrics scoped by caller RBAC authority.
   */
  public static async getAuditStats(session: UserSession): Promise<AuditStatsDTO> {
    const filter = await this.buildAccessScopedFilter(session, {});
    return await AuditLogRepository.getStats(filter);
  }

  /**
   * Recomputes SHA-256 hashes sequentially across the audit log chain to detect
   * any out-of-band database tampering, field modification, or record deletion.
   * Strictly restricted to super_admin.
   */
  public static async verifyHashChain(
    session: UserSession,
    limit = 500
  ): Promise<AuditChainVerificationDTO> {
    if (session.role !== 'super_admin') {
      throw new ForbiddenError(
        'Only Super Administrators may run cryptographic audit hash-chain verification.'
      );
    }

    const { entries, totalCount } = await AuditLogRepository.getRecentChain(limit);
    const verifiedAt = new Date().toISOString();

    if (entries.length === 0) {
      return { valid: true, checkedCount: 0, verifiedAt };
    }

    const includesGenesis = entries.length === totalCount;

    for (let i = 0; i < entries.length; i++) {
      const current = entries[i]!;
      const dto = toAuditLogDTO(current);

      // 1. Validate chain linkage
      if (i === 0) {
        if (includesGenesis && dto.previousHash !== 'GENESIS') {
          return {
            valid: false,
            checkedCount: i + 1,
            brokenAtEventId: dto.eventId,
            verifiedAt,
          };
        }
      } else {
        const prevDto = toAuditLogDTO(entries[i - 1]!);
        if (dto.previousHash !== prevDto.entryHash) {
          return {
            valid: false,
            checkedCount: i + 1,
            brokenAtEventId: dto.eventId,
            verifiedAt,
          };
        }
      }

      // 2. Recompute deterministic SHA-256 entryHash and compare
      const recomputedHash = this.computeEntryHash({
        eventId: dto.eventId,
        actorId: dto.actorId,
        action: dto.action,
        module: dto.module,
        targetEntityId: dto.targetEntityId,
        oldState: dto.oldState,
        newState: dto.newState,
        previousHash: dto.previousHash,
        createdAt: dto.createdAt,
      });

      if (recomputedHash !== dto.entryHash) {
        return {
          valid: false,
          checkedCount: i + 1,
          brokenAtEventId: dto.eventId,
          verifiedAt,
        };
      }
    }

    return {
      valid: true,
      checkedCount: entries.length,
      verifiedAt,
    };
  }

  /**
   * Generates a compliance export (CSV with formula-injection protection or JSON).
   * Strictly restricted to super_admin.
   */
  public static async exportAuditLogs(
    session: UserSession,
    query: Partial<AuditExportQueryParams> = {}
  ): Promise<{ contentType: string; filename: string; body: string; count: number }> {
    if (session.role !== 'super_admin') {
      throw new ForbiddenError(
        'Only Super Administrators may export institutional security audit logs.'
      );
    }

    const filter = await this.buildAccessScopedFilter(session, query);
    const limit = query.limit || 500;
    const { logs } = await AuditLogRepository.findLogs(filter, 1, limit);
    const dtos = logs.map(toAuditLogDTO);
    const timestamp = new Date().toISOString().slice(0, 10);
    const format = query.format || 'csv';

    if (format === 'json') {
      return {
        contentType: 'application/json; charset=utf-8',
        filename: `axis-linkup-audit-logs-${timestamp}.json`,
        body: JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            exportedBy: session.email,
            count: dtos.length,
            logs: dtos,
          },
          null,
          2
        ),
        count: dtos.length,
      };
    }

    const headers = [
      'eventId',
      'createdAt',
      'module',
      'severity',
      'action',
      'actorName',
      'actorEmail',
      'actorRole',
      'department',
      'targetEntityType',
      'targetEntityId',
      'targetLabel',
      'reason',
      'ipAddress',
      'previousHash',
      'entryHash',
    ];

    const rows = dtos.map((log) =>
      [
        log.eventId,
        log.createdAt,
        log.module,
        log.severity,
        log.action,
        log.actorSnapshot.fullName,
        log.actorSnapshot.email,
        log.actorSnapshot.role,
        log.department || '',
        log.targetEntityType,
        log.targetEntityId,
        log.targetLabel || '',
        log.reason || '',
        log.ipAddress || '',
        log.previousHash,
        log.entryHash,
      ]
        .map((cell) => this.escapeCsvCell(cell))
        .join(',')
    );

    const csvBody = [headers.join(','), ...rows].join('\n');

    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `axis-linkup-audit-logs-${timestamp}.csv`,
      body: csvBody,
      count: dtos.length,
    };
  }
}
