/**
 * P0 Remediation Batch 3 — MongoDB Partial Unique Indexes, Real Resend Email Dispatch,
 * Hardened File Uploads, Facility Concurrency, Audit Chain Serialization,
 * Broadcast Pagination & Ably Token Revocation Regression Suite.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { ConversationModel } from '@/lib/db/models/conversation.model';
import { UserModel } from '@/lib/db/models/user.model';
import { AuditLogModel } from '@/lib/db/models/audit-log.model';
import {
  identifyLegacyIndexesToDrop,
  TARGET_CONVERSATION_LEGACY_INDEXES,
  TARGET_USER_LEGACY_INDEXES,
} from '../../scripts/migrate-p0-indexes';
import { EmailService, RESEND_API_URL } from '@/lib/services/email.service';
import {
  AssignmentService,
  ALLOWED_UPLOAD_FORMATS,
  MAX_UPLOAD_FILE_SIZE_BYTES,
} from '@/lib/services/assignment.service';
import { GET as GET_UPLOAD_SIGNATURE } from '@/app/api/v1/assignments/upload-signature/route';
import { accumulateUploadedFiles } from '@/components/assignments/file-uploader';
import { FacilityService } from '@/lib/services/facility.service';
import { FacilityRepository } from '@/lib/db/repositories/facility.repository';
import { FacilityBookingRepository } from '@/lib/db/repositories/facility-booking.repository';
import { AuditService } from '@/lib/services/audit.service';
import { AuditLogRepository } from '@/lib/db/repositories/audit-log.repository';
import { NotificationService } from '@/lib/services/notification.service';
import { NotificationRepository } from '@/lib/db/repositories/notification.repository';
import { NotificationPreferenceRepository } from '@/lib/db/repositories/notification-preference.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { ChatService } from '@/lib/services/chat.service';
import { ChatRepository } from '@/lib/db/repositories/chat.repository';
import { IamGovernanceService } from '@/lib/services/iam-governance.service';
import { UserService } from '@/lib/services/user.service';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { AblyBroker, ABLY_TOKEN_TTL_MS } from '@/lib/realtime/ably-broker';
import { GET as GET_CHAT_TOKEN } from '@/app/api/v1/chat/token/route';
import { __setTestSession } from '@/lib/auth/server';
import { resetRateLimiter } from '@/lib/security/rate-limiter';
import { AppError, ConflictError, ValidationError } from '@/lib/errors/app-error';
import type { UserSession } from '@/types/user';
import type { AssignmentAttachment } from '@/types/assignment';
import type { IFacility, IFacilityBooking } from '@/types/facility';
import type { IAuditLog } from '@/types/governance';
import type { INotification } from '@/types/notification';

const SUPER_ADMIN_ID = new Types.ObjectId('66000000000000000000a001');
const FACULTY_ID = new Types.ObjectId('66000000000000000000a002');
const STUDENT_ID = new Types.ObjectId('66000000000000000000a003');
const FACILITY_ID = new Types.ObjectId('66000000000000000000b001');
const GROUP_CONV_ID = new Types.ObjectId('66000000000000000000c001');

const superAdminSession: UserSession = {
  userId: SUPER_ADMIN_ID.toString(),
  email: 'sysadmin@axiscolleges.in',
  fullName: 'Campus System Admin',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

const facultySession: UserSession = {
  userId: FACULTY_ID.toString(),
  email: 'faculty@axiscolleges.in',
  fullName: 'Dr. Faculty Member',
  role: 'faculty',
  status: 'active',
};

const origFetch = globalThis.fetch;
const origNodeEnv = process.env.NODE_ENV;
const origResendKey = process.env.RESEND_API_KEY;
const origEmailFrom = process.env.EMAIL_FROM;
const origCloudinaryKey = process.env.CLOUDINARY_API_KEY;
const origCloudinarySecret = process.env.CLOUDINARY_API_SECRET;
const origCloudinaryCloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const origAblyKey = process.env.ABLY_API_KEY;

// Snapshot original repository/service methods
const origFacilityFindById = FacilityRepository.findById;
const origBookingFindById = FacilityBookingRepository.findById;
const origBookingFindConflicting = FacilityBookingRepository.findConflictingBookings;
const origBookingUpdate = FacilityBookingRepository.update;
const origBookingRunTx = FacilityBookingRepository.runInTransaction;
const origAuditFindLatest = AuditLogRepository.findLatestEntry;
const origAuditNextEventId = AuditLogRepository.getNextEventId;
const origAuditCreate = AuditLogRepository.create;
const origAuditGetRecentChain = AuditLogRepository.getRecentChain;
const origAuditRecordEvent = AuditService.recordEvent;
const origUserFindGoverned = UserRepository.findGovernedUsers;
const origUserFindById = UserRepository.findById;
const origUserCountByRole = UserRepository.countByRole;
const origUserUpdateStatus = UserService.updateUserStatus;
const origDeptFindById = DepartmentRepository.findById;
const origNotifCreateMany = NotificationRepository.createMany;
const origNotifFindDup = NotificationRepository.findRecentDuplicate;
const origNotifPrefFind = NotificationPreferenceRepository.findByUserId;
const origAblyPublish = AblyBroker.publish;
const origAblyRevoke = AblyBroker.revokeUserTokens;
const origChatFindConv = ChatRepository.findConversationById;
const origChatRemoveMembers = ChatRepository.removeMembersFromGroup;
const origChatCountUnread = ChatRepository.countUnreadMessages;
const origChatGetUserConvs = ChatService.getUserConversations;

function restoreAll() {
  globalThis.fetch = origFetch;
  (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
  if (origResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = origResendKey;
  if (origEmailFrom === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = origEmailFrom;
  if (origCloudinaryKey === undefined) delete process.env.CLOUDINARY_API_KEY;
  else process.env.CLOUDINARY_API_KEY = origCloudinaryKey;
  if (origCloudinarySecret === undefined) delete process.env.CLOUDINARY_API_SECRET;
  else process.env.CLOUDINARY_API_SECRET = origCloudinarySecret;
  if (origCloudinaryCloud === undefined) delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  else process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = origCloudinaryCloud;
  if (origAblyKey === undefined) delete process.env.ABLY_API_KEY;
  else process.env.ABLY_API_KEY = origAblyKey;

  FacilityRepository.findById = origFacilityFindById;
  FacilityBookingRepository.findById = origBookingFindById;
  FacilityBookingRepository.findConflictingBookings = origBookingFindConflicting;
  FacilityBookingRepository.update = origBookingUpdate;
  FacilityBookingRepository.runInTransaction = origBookingRunTx;
  AuditLogRepository.findLatestEntry = origAuditFindLatest;
  AuditLogRepository.getNextEventId = origAuditNextEventId;
  AuditLogRepository.create = origAuditCreate;
  AuditLogRepository.getRecentChain = origAuditGetRecentChain;
  AuditService.recordEvent = origAuditRecordEvent;
  UserRepository.findGovernedUsers = origUserFindGoverned;
  UserRepository.findById = origUserFindById;
  UserRepository.countByRole = origUserCountByRole;
  UserService.updateUserStatus = origUserUpdateStatus;
  DepartmentRepository.findById = origDeptFindById;
  NotificationRepository.createMany = origNotifCreateMany;
  NotificationRepository.findRecentDuplicate = origNotifFindDup;
  NotificationPreferenceRepository.findByUserId = origNotifPrefFind;
  AblyBroker.publish = origAblyPublish;
  AblyBroker.revokeUserTokens = origAblyRevoke;
  ChatRepository.findConversationById = origChatFindConv;
  ChatRepository.removeMembersFromGroup = origChatRemoveMembers;
  ChatRepository.countUnreadMessages = origChatCountUnread;
  ChatService.getUserConversations = origChatGetUserConvs;

  __setTestSession(null);
  resetRateLimiter();
}

describe('P0 Remediation Batch 3: Infrastructure, Uploads, Email, Concurrency & Ably', () => {
  beforeEach(() => {
    restoreAll();
  });

  afterEach(() => {
    restoreAll();
  });

  // =========================================================================
  // 1. AUD-C06 & AUD-C07: MongoDB Partial Unique Indexes + Migration Helper
  // =========================================================================
  describe('AUD-C06 & AUD-C07: Partial Unique Indexes & Migration Classifier', () => {
    it('ConversationModel defines partial unique index on { directKey, type } and omits directKey for groups', async () => {
      const indexes = ConversationModel.schema.indexes();
      const directIdx = indexes.find(
        ([fields]) => fields.directKey === 1 && fields.type === 1
      );
      assert.ok(directIdx, 'Expected compound index { directKey: 1, type: 1 }');
      const [, options] = directIdx;
      assert.equal(options.unique, true);
      assert.equal(options.sparse, undefined, 'Legacy sparse option must be removed');
      assert.deepEqual(options.partialFilterExpression, {
        type: 'direct',
        directKey: { $type: 'string' },
      });

      // Validate that group conversations strip directKey even if accidentally supplied
      const groupDoc = new ConversationModel({
        type: 'group',
        name: 'CS-301 Algorithms Group',
        createdBy: FACULTY_ID,
        participants: [FACULTY_ID, STUDENT_ID],
        directKey: null as unknown as string,
      });
      await groupDoc.validate();
      assert.equal(groupDoc.directKey, undefined, 'Group conversation must never persist directKey: null');
    });

    it('UserModel replaces sparse unique indexes with partialFilterExpression on all optional unique identifiers', () => {
      const indexes = UserModel.schema.indexes();
      const expectedPartialFields = [
        'username',
        'authProviderId',
        'studentProfile.rollNumber',
        'studentProfile.enrollmentNumber',
        'facultyProfile.employeeId',
        'adminProfile.adminStaffId',
      ];

      for (const field of expectedPartialFields) {
        const match = indexes.find(([fields]) => fields[field] === 1);
        assert.ok(match, `Expected index on User.${field}`);
        const [, options] = match;
        assert.equal(options.unique, true, `User.${field} must remain unique`);
        assert.equal(options.sparse, undefined, `User.${field} must NOT use broken sparse index`);
        assert.deepEqual(options.partialFilterExpression, {
          [field]: { $type: 'string', $gt: '' },
        });
      }
    });

    it('AuditLogModel defines unique index on previousHash to prevent linear chain forks', () => {
      const indexes = AuditLogModel.schema.indexes();
      const prevHashIdx = indexes.find(([fields]) => fields.previousHash === 1);
      assert.ok(prevHashIdx, 'Expected index on AuditLog.previousHash');
      assert.equal(prevHashIdx[1].unique, true);
    });

    it('migration script classifier identifies legacy sparse indexes and is idempotent on migrated partial indexes', () => {
      const legacyConvIndexes = [
        { name: '_id_', key: { _id: 1 } },
        { name: 'directKey_1', key: { directKey: 1 }, sparse: true },
        { name: 'directKey_1_type_1', key: { directKey: 1, type: 1 }, unique: true, sparse: true },
      ];
      assert.deepEqual(
        identifyLegacyIndexesToDrop(legacyConvIndexes, TARGET_CONVERSATION_LEGACY_INDEXES),
        ['directKey_1', 'directKey_1_type_1']
      );

      const migratedConvIndexes = [
        { name: '_id_', key: { _id: 1 } },
        {
          name: 'directKey_1_type_1',
          key: { directKey: 1, type: 1 },
          unique: true,
          partialFilterExpression: { type: 'direct', directKey: { $type: 'string' } },
        },
      ];
      assert.deepEqual(
        identifyLegacyIndexesToDrop(migratedConvIndexes, TARGET_CONVERSATION_LEGACY_INDEXES),
        []
      );

      const legacyUserIndexes = [
        { name: 'email_1', key: { email: 1 }, unique: true },
        { name: 'username_1', key: { username: 1 }, unique: true, sparse: true },
        { name: 'authProviderId_1', key: { authProviderId: 1 }, unique: true, sparse: true },
        {
          name: 'studentProfile.rollNumber_1',
          key: { 'studentProfile.rollNumber': 1 },
          unique: true,
          partialFilterExpression: { 'studentProfile.rollNumber': { $type: 'string', $gt: '' } },
        },
      ];
      assert.deepEqual(
        identifyLegacyIndexesToDrop(legacyUserIndexes, TARGET_USER_LEGACY_INDEXES),
        ['username_1', 'authProviderId_1']
      );
    });
  });

  // =========================================================================
  // 2. AUD-C08: Real Resend Email Dispatch
  // =========================================================================
  describe('AUD-C08: Real Resend Email Dispatch', () => {
    it('dispatches real HTTP POST to Resend REST API with Bearer auth when RESEND_API_KEY is configured', async () => {
      process.env.RESEND_API_KEY = 're_test_secret_key_xyz';
      process.env.EMAIL_FROM = 'Axis LinkUp <verify@axiscolleges.in>';

      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};
      let capturedBody: Record<string, unknown> = {};

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        capturedBody = JSON.parse(String(init?.body || '{}'));
        return new Response(JSON.stringify({ id: 're_msg_987654' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch;

      const res = await EmailService.sendOtpEmail({
        to: 'student@axiscolleges.in',
        otpCode: '482910',
        purpose: 'password_recovery',
        expiresInMinutes: 5,
        recipientName: 'Aarav <Admin>',
      });

      assert.equal(res.success, true);
      assert.equal(res.provider, 'resend');
      assert.equal(res.messageId, 're_msg_987654');
      assert.equal(capturedUrl, RESEND_API_URL);
      assert.equal(capturedHeaders.Authorization, 'Bearer re_test_secret_key_xyz');
      assert.equal(capturedBody.from, 'Axis LinkUp <verify@axiscolleges.in>');
      assert.deepEqual(capturedBody.to, ['student@axiscolleges.in']);
      assert.ok(String(capturedBody.html).includes('482910'));
      assert.ok(
        String(capturedBody.html).includes('Aarav &lt;Admin&gt;'),
        'Recipient name must be HTML-escaped'
      );
    });

    it('throws HTTP 503 AppError when Resend returns non-2xx instead of returning fake success', async () => {
      process.env.RESEND_API_KEY = 're_test_bad_key';
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ message: 'Invalid API key' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch;

      await assert.rejects(
        () =>
          EmailService.sendOtpEmail({
            to: 'student@axiscolleges.in',
            otpCode: '123456',
            purpose: 'email_verification',
          }),
        (err: unknown) => err instanceof AppError && err.statusCode === 503
      );
    });

    it('fails closed in production when RESEND_API_KEY is absent', async () => {
      delete process.env.RESEND_API_KEY;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      await assert.rejects(
        () =>
          EmailService.sendOtpEmail({
            to: 'student@axiscolleges.in',
            otpCode: '123456',
            purpose: 'account_activation',
          }),
        (err: unknown) => err instanceof AppError && err.statusCode === 503
      );
    });
  });

  // =========================================================================
  // 3. AUD-C09 + AUD-H13 + AUD-H14: File Uploads, Signatures & Rate Limit
  // =========================================================================
  describe('AUD-C09 / AUD-H13 / AUD-H14: File Uploads, Signed Scope Isolation & Rate Limiting', () => {
    it('accumulateUploadedFiles preserves all N uploaded files without stale-closure overwrite', async () => {
      const initial: AssignmentAttachment[] = [
        {
          name: 'existing.pdf',
          url: 'https://res.cloudinary.com/demo/existing.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          publicId: 'p0',
          uploadedAt: new Date().toISOString(),
        },
      ];
      const fakeFiles = [
        { name: 'file1.pdf', size: 2048, type: 'application/pdf' } as File,
        { name: 'file2.png', size: 4096, type: 'image/png' } as File,
        { name: 'file3.docx', size: 8192, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as File,
      ];

      const snapshots: number[] = [];
      const finalList = await accumulateUploadedFiles(
        initial,
        fakeFiles,
        async (file) => ({
          name: file.name,
          url: `https://res.cloudinary.com/demo/${file.name}`,
          sizeBytes: file.size,
          mimeType: file.type,
          publicId: `id_${file.name}`,
          uploadedAt: new Date().toISOString(),
        }),
        (updated) => snapshots.push(updated.length)
      );

      assert.deepEqual(snapshots, [2, 3, 4], 'Each progressive update must retain all prior uploads');
      assert.equal(finalList.length, 4);
      assert.deepEqual(
        finalList.map((f) => f.name),
        ['existing.pdf', 'file1.pdf', 'file2.png', 'file3.docx']
      );
    });

    it('signs Cloudinary uploads with user-isolated folder, allowed_formats, and max_file_size', () => {
      process.env.CLOUDINARY_API_KEY = 'cld_key_test';
      process.env.CLOUDINARY_API_SECRET = 'cld_secret_test';
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'axis_test_cloud';

      const envelope = AssignmentService.getUploadSignature(facultySession, 'complaints');
      assert.equal(envelope.isMock, false);
      assert.equal(envelope.folder, `axis-linkup/complaints/${FACULTY_ID.toString()}`);
      assert.equal(envelope.allowedFormats, ALLOWED_UPLOAD_FORMATS);
      assert.equal(envelope.maxFileSize, MAX_UPLOAD_FILE_SIZE_BYTES);

      const expectedSig = crypto
        .createHash('sha1')
        .update(
          `allowed_formats=${ALLOWED_UPLOAD_FORMATS}&folder=${envelope.folder}&max_file_size=${MAX_UPLOAD_FILE_SIZE_BYTES}&timestamp=${envelope.timestamp}cld_secret_test`
        )
        .digest('hex');
      assert.equal(envelope.signature, expectedSig);

      assert.throws(
        () => AssignmentService.getUploadSignature(facultySession, 'invalid_scope' as never),
        ValidationError
      );
    });

    it('GET /api/v1/assignments/upload-signature validates scope and enforces 429 rate limiting', async () => {
      __setTestSession(facultySession);
      delete process.env.CLOUDINARY_API_KEY;

      // Invalid scope returns 400
      const badScopeRes = await GET_UPLOAD_SIGNATURE(
        new NextRequest('http://localhost:3000/api/v1/assignments/upload-signature?scope=../../etc')
      );
      assert.equal(badScopeRes.status, 400);

      // Exhaust rate limit window (30 requests allowed, 31st returns 429)
      resetRateLimiter();
      for (let i = 0; i < 30; i++) {
        const res = await GET_UPLOAD_SIGNATURE(
          new NextRequest('http://localhost:3000/api/v1/assignments/upload-signature?scope=requests')
        );
        assert.equal(res.status, 200);
      }

      const throttledRes = await GET_UPLOAD_SIGNATURE(
        new NextRequest('http://localhost:3000/api/v1/assignments/upload-signature?scope=requests')
      );
      assert.equal(throttledRes.status, 429);
    });

    it('ComplaintComposeForm and StudentRequestComposeModal contain zero fabricated internal or blob: URLs', () => {
      const complaintFormSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/components/complaints/complaint-compose-form.tsx'),
        'utf8'
      );
      const requestModalSrc = fs.readFileSync(
        path.join(process.cwd(), 'src/components/requests/student-request-compose-modal.tsx'),
        'utf8'
      );

      assert.equal(
        complaintFormSrc.includes('storage.axislinkup.internal'),
        false,
        'ComplaintComposeForm must not fabricate storage.axislinkup.internal URLs'
      );
      assert.equal(
        complaintFormSrc.includes('<FileUploader'),
        true,
        'ComplaintComposeForm must use signed FileUploader'
      );
      assert.equal(
        requestModalSrc.includes('createObjectURL'),
        false,
        'StudentRequestComposeModal must not persist ephemeral blob: URLs'
      );
      assert.equal(
        requestModalSrc.includes('<FileUploader'),
        true,
        'StudentRequestComposeModal must use signed FileUploader'
      );
    });
  });

  // =========================================================================
  // 4. AUD-C10: Facility Concurrency, Audit Chain, Broadcast Pagination & Ably
  // =========================================================================
  describe('AUD-C10: Facility Double-Booking Race Prevention', () => {
    it('prevents two concurrent approvals for overlapping pending bookings from both succeeding', async () => {
      const booking1Id = new Types.ObjectId();
      const booking2Id = new Types.ObjectId();
      const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const end = new Date(Date.now() + 4 * 60 * 60 * 1000);

      const store = new Map<string, IFacilityBooking>();
      const makeBooking = (id: Types.ObjectId, code: string): IFacilityBooking =>
        ({
          _id: id,
          bookingCode: code,
          facilityId: FACILITY_ID,
          facilitySnapshot: {
            code: 'LAB-AI-01',
            name: 'AI Research Lab',
            building: 'Block A',
            type: 'computer_lab',
            capacity: 40,
          },
          requestedBy: FACULTY_ID,
          requesterSnapshot: {
            fullName: 'Dr. Faculty',
            email: 'faculty@axiscolleges.in',
            role: 'faculty',
            department: 'CSE',
            employeeId: 'FAC-101',
          },
          title: `Workshop ${code}`,
          purpose: 'Departmental workshop session',
          expectedAttendees: 30,
          startTime: start,
          endTime: end,
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          reviewRemarks: null,
          cancellationReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as unknown as IFacilityBooking;

      store.set(booking1Id.toString(), makeBooking(booking1Id, 'BKG-2026-10001'));
      store.set(booking2Id.toString(), makeBooking(booking2Id, 'BKG-2026-10002'));

      FacilityRepository.findById = async () =>
        ({
          _id: FACILITY_ID,
          code: 'LAB-AI-01',
          name: 'AI Research Lab',
          status: 'available',
          capacity: 40,
        }) as unknown as IFacility;

      FacilityBookingRepository.runInTransaction = async (work) => await work(undefined);

      FacilityBookingRepository.findById = async (id) => store.get(String(id)) ?? null;

      FacilityBookingRepository.findConflictingBookings = async (
        facilityId,
        s,
        e,
        excludeId
      ) => {
        // Introduce async delay to widen race window
        await new Promise((r) => setTimeout(r, 10));
        return Array.from(store.values()).filter(
          (b) =>
            b.facilityId.toString() === String(facilityId) &&
            b.status === 'approved' &&
            b._id.toString() !== String(excludeId || '') &&
            b.startTime < e &&
            b.endTime > s
        );
      };

      let observedExpectedStatus: string | undefined;
      FacilityBookingRepository.update = async (id, updates, options) => {
        if (options?.expectedStatus) observedExpectedStatus = options.expectedStatus;
        const current = store.get(String(id));
        if (!current) return null;
        if (options?.expectedStatus && current.status !== options.expectedStatus) {
          return null;
        }
        const next = { ...current, ...updates } as IFacilityBooking;
        store.set(String(id), next);
        return next;
      };

      AblyBroker.publish = async (channel) => ({ published: false, channel });

      // Fire BOTH approvals concurrently
      const results = await Promise.allSettled([
        FacilityService.reviewBooking(superAdminSession, booking1Id.toString(), {
          action: 'approve',
          remarks: 'Approved first',
        }),
        FacilityService.reviewBooking(superAdminSession, booking2Id.toString(), {
          action: 'approve',
          remarks: 'Approved competing second',
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.equal(observedExpectedStatus, 'pending', 'Update must enforce atomic expectedStatus: pending');
      assert.equal(fulfilled.length, 1, 'Exactly ONE competing approval may succeed');
      assert.equal(rejected.length, 1, 'Competing overlapping approval MUST fail with ConflictError');
      assert.ok((rejected[0] as PromiseRejectedResult).reason instanceof ConflictError);
    });
  });

  describe('AUD-C10: Audit Hash-Chain Serialization, Retry & ActorId Normalization', () => {
    it('serializes concurrent recordEvent calls, retries E11000 collisions, normalizes actorId, and passes verifyHashChain', async () => {
      const chainStore: IAuditLog[] = [];
      let injectedDuplicateOnce = false;

      AuditLogRepository.findLatestEntry = async () =>
        chainStore.length > 0 ? chainStore[chainStore.length - 1]! : null;

      AuditLogRepository.getNextEventId = async () =>
        `AUD-2026-${String(100001 + chainStore.length).padStart(6, '0')}`;

      AuditLogRepository.create = async (data) => {
        // Simulate a single cross-instance E11000 previousHash collision on the 2nd write
        if (chainStore.length === 1 && !injectedDuplicateOnce) {
          injectedDuplicateOnce = true;
          const dupErr = Object.assign(new Error('E11000 duplicate key error collection: audit_logs index: previousHash_1'), {
            code: 11000,
          });
          throw dupErr;
        }

        // Enforce unique previousHash invariant just like MongoDB index
        if (chainStore.some((entry) => entry.previousHash === data.previousHash)) {
          throw Object.assign(new Error('E11000 duplicate key error on previousHash'), {
            code: 11000,
          });
        }

        const doc = {
          _id: new Types.ObjectId(),
          ...data,
        } as unknown as IAuditLog;
        chainStore.push(doc);
        return doc;
      };

      AuditLogRepository.getRecentChain = async () => ({
        entries: [...chainStore],
        totalCount: chainStore.length,
      });

      // Fire 5 concurrent audit writes including a non-ObjectId actorId
      const results = await Promise.all([
        AuditService.recordEvent({
          actorId: 'non-objectid-test-actor',
          actorSnapshot: { fullName: 'Test Actor', email: 'test@axiscolleges.in', role: 'super_admin' },
          action: 'ROLE_UPDATED',
          module: 'IAM',
          targetEntityType: 'User',
          targetEntityId: 'u1',
        }),
        AuditService.recordEvent({
          actorId: SUPER_ADMIN_ID.toString(),
          actorSnapshot: { fullName: 'Admin', email: 'sysadmin@axiscolleges.in', role: 'super_admin' },
          action: 'ACCOUNT_STATUS_CHANGED',
          module: 'IAM',
          targetEntityType: 'User',
          targetEntityId: 'u2',
        }),
        AuditService.recordEvent({
          actorId: SUPER_ADMIN_ID.toString(),
          actorSnapshot: { fullName: 'Admin', email: 'sysadmin@axiscolleges.in', role: 'super_admin' },
          action: 'EMERGENCY_ACTIVATED',
          module: 'EMERGENCY',
          targetEntityType: 'EmergencyAlert',
          targetEntityId: 'e1',
        }),
        AuditService.recordEvent({
          actorId: SUPER_ADMIN_ID.toString(),
          actorSnapshot: { fullName: 'Admin', email: 'sysadmin@axiscolleges.in', role: 'super_admin' },
          action: 'EMERGENCY_DEACTIVATED',
          module: 'EMERGENCY',
          targetEntityType: 'EmergencyAlert',
          targetEntityId: 'e1',
        }),
        AuditService.recordEvent({
          actorId: SUPER_ADMIN_ID.toString(),
          actorSnapshot: { fullName: 'Admin', email: 'sysadmin@axiscolleges.in', role: 'super_admin' },
          action: 'SECURITY_POLICY_EVENT',
          module: 'SYSTEM',
          targetEntityType: 'Policy',
          targetEntityId: 'p1',
        }),
      ]);

      assert.equal(results.length, 5);
      assert.equal(injectedDuplicateOnce, true, 'Retry path must have handled the simulated E11000 collision');
      assert.equal(chainStore[0]!.previousHash, 'GENESIS');
      assert.equal(
        Types.ObjectId.isValid(results[0]!.actorId),
        true,
        'Non-ObjectId actorId must normalize to valid ObjectId before hashing'
      );

      const verification = await AuditService.verifyHashChain(superAdminSession);
      assert.equal(verification.valid, true, 'All 5 concurrent entries must form a valid unbroken SHA-256 chain');
      assert.equal(verification.checkedCount, 5);
    });
  });

  describe('AUD-C10: Notification Broadcast Full Pagination & Batch Insertion', () => {
    it('paginates through ALL 250 recipients across 3 pages and batch-inserts via createMany', async () => {
      const allUserIds = Array.from({ length: 250 }, () => new Types.ObjectId());
      const fetchedPages: number[] = [];
      const batchSizes: number[] = [];

      UserRepository.findGovernedUsers = async (_filter, page = 1, limit = 100) => {
        fetchedPages.push(page);
        const start = (page - 1) * limit;
        const slice = allUserIds.slice(start, start + limit).map((_id) => ({
          _id,
          status: 'active',
          role: 'student',
        }));
        return { users: slice as never, total: allUserIds.length };
      };

      NotificationPreferenceRepository.findByUserId = async () => null;
      NotificationRepository.findRecentDuplicate = async () => null;
      NotificationRepository.createMany = async (items) => {
        batchSizes.push(items.length);
        return items.map((item) => ({
          _id: new Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...item,
        })) as unknown as INotification[];
      };

      AblyBroker.publish = async (channel) => ({ published: false, channel });
      AuditService.recordEvent = async () => ({}) as never;

      const result = await NotificationService.broadcastAlert(superAdminSession, {
        title: 'Campus Convocation Notice',
        message: 'All students and faculty should assemble in the main auditorium by 9:00 AM.',
        category: 'notice',
        priority: 'high',
        targetScope: 'all_users',
      });

      assert.deepEqual(fetchedPages, [1, 2, 3], 'Must paginate through all 3 pages of 250 users');
      assert.deepEqual(batchSizes, [200, 50], 'Must bulk-insert in bounded batches via createMany');
      assert.equal(result.recipientCount, 250);
      assert.equal(result.dispatchedCount, 250);
      assert.equal(result.skippedCount, 0);
    });
  });

  describe('AUD-C10: Ably Token TTL, 503 Fail-Closed & Active Token Revocation', () => {
    it('mints 10-minute TTL tokens in dev mode and returns HTTP 503 without leaking keyName on Ably errors', async () => {
      __setTestSession(facultySession);
      ChatService.getUserConversations = async () => [];

      // 1. Non-production mock envelope uses 10-minute TTL
      delete process.env.ABLY_API_KEY;
      const devRes = await GET_CHAT_TOKEN(new NextRequest('http://localhost:3000/api/v1/chat/token'));
      assert.equal(devRes.status, 200);
      const devJson = (await devRes.json()) as { data: { ttl: number; isMock: boolean } };
      assert.equal(devJson.data.ttl, ABLY_TOKEN_TTL_MS);
      assert.equal(ABLY_TOKEN_TTL_MS, 10 * 60 * 1000);

      // 2. Well-formed ABLY_API_KEY mints signed 10-minute TokenRequest
      process.env.ABLY_API_KEY = 'appId.keyId:testAblySecret123';
      const signedRes = await GET_CHAT_TOKEN(
        new NextRequest('http://localhost:3000/api/v1/chat/token')
      );
      assert.equal(signedRes.status, 200);
      const signedJson = (await signedRes.json()) as { data: { ttl: number; mac: string } };
      assert.equal(signedJson.data.ttl, ABLY_TOKEN_TTL_MS);
      assert.ok(typeof signedJson.data.mac === 'string' && signedJson.data.mac.length > 0);

      // 3. Ably SDK failure (malformed key) fails closed with HTTP 503 and NEVER leaks keyName
      process.env.ABLY_API_KEY = 'secretKeyName123_missing_colon';
      const errRes = await GET_CHAT_TOKEN(new NextRequest('http://localhost:3000/api/v1/chat/token'));
      assert.equal(errRes.status, 503);
      const errText = await errRes.text();
      assert.equal(
        errText.includes('secretKeyName123'),
        false,
        'Response must NEVER leak Ably keyName'
      );
    });

    it('AblyBroker.revokeUserTokens calls Ably REST revokeTokens endpoint with Basic auth', async () => {
      process.env.ABLY_API_KEY = 'appId.keyId:superSecretVal';

      let capturedUrl = '';
      let capturedAuth = '';
      let capturedBody: { targets?: string[]; issuedBefore?: number } = {};

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedAuth = (init?.headers as Record<string, string>)?.Authorization || '';
        capturedBody = JSON.parse(String(init?.body || '{}'));
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch;

      const res = await AblyBroker.revokeUserTokens(STUDENT_ID.toString());
      assert.equal(res.revoked, true);
      assert.equal(capturedUrl, 'https://rest.ably.io/keys/appId.keyId/revokeTokens');
      assert.equal(
        capturedAuth,
        `Basic ${Buffer.from('appId.keyId:superSecretVal').toString('base64')}`
      );
      assert.deepEqual(capturedBody.targets, [`clientId:${STUDENT_ID.toString()}`]);
      assert.ok(typeof capturedBody.issuedBefore === 'number');
    });

    it('invokes AblyBroker.revokeUserTokens on group member removal and user suspension', async () => {
      const revokedUsers: string[] = [];
      AblyBroker.revokeUserTokens = async (uid) => {
        revokedUsers.push(uid);
        return { revoked: true, userId: uid };
      };

      // 1. Group member removal via ChatService.manageGroupMembers
      const mockGroup = {
        _id: GROUP_CONV_ID,
        type: 'group',
        name: 'CS-301 Group',
        createdBy: FACULTY_ID,
        participants: [FACULTY_ID, STUDENT_ID],
        members: [
          { userId: FACULTY_ID, role: 'admin', joinedAt: new Date() },
          { userId: STUDENT_ID, role: 'member', joinedAt: new Date() },
        ],
        groupPolicy: 'open_discussion',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      ChatRepository.findConversationById = async () => mockGroup as never;
      ChatRepository.removeMembersFromGroup = async () =>
        ({ ...mockGroup, participants: [FACULTY_ID], members: [mockGroup.members[0]] }) as never;
      ChatRepository.countUnreadMessages = async () => 0;

      await ChatService.manageGroupMembers(facultySession, GROUP_CONV_ID.toString(), {
        action: 'remove',
        userIds: [STUDENT_ID.toString()],
      });

      assert.deepEqual(revokedUsers, [STUDENT_ID.toString()]);

      // 2. Account suspension via IamGovernanceService.changeUserStatus
      UserRepository.findById = async () =>
        ({
          _id: STUDENT_ID,
          email: 'student@axiscolleges.in',
          fullName: 'Student User',
          role: 'student',
          status: 'active',
          authProviderId: null,
          departmentId: null,
        }) as never;
      UserService.updateUserStatus = async () =>
        ({
          id: STUDENT_ID.toString(),
          email: 'student@axiscolleges.in',
          fullName: 'Student User',
          role: 'student',
          status: 'suspended',
          isProfileComplete: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }) as never;
      AuditService.recordEvent = async () => ({ id: 'aud1', eventId: 'AUD-2026-100001' }) as never;

      await IamGovernanceService.changeUserStatus(superAdminSession, STUDENT_ID.toString(), {
        status: 'suspended',
        reason: 'Disciplinary suspension pending inquiry resolution.',
      });

      assert.deepEqual(revokedUsers, [STUDENT_ID.toString(), STUDENT_ID.toString()]);
    });
  });
});
