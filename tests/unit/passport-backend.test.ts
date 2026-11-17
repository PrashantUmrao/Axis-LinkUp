/**
 * Phase 5.12: Skill & Achievement Passport & Faculty Endorsement Backend Suite (MOD-15).
 *
 * Verifies:
 * 1. Zod Validation Layer (future issueDate rejected, missing proof rejected, javascript: URI rejected, short rejection remarks).
 * 2. Strict RBAC Matrix Enforcement (Student blocked from verify/export; Faculty blocked from submit/export; Admin dept isolation).
 * 3. Verification Integrity (SHA-256 verificationHash stamped ONLY on verify; verified claims permanently locked).
 * 4. Single Resubmission Rule (1st resubmission succeeds; 2nd resubmission permanently blocked with HTTP 400).
 * 5. Public Recruiter Share Privacy (disabled token -> 404; active token returns ONLY verified claims and zero private contact data).
 * 6. NAAC/NIRF Formula-Injection-Safe Verified CSV Export.
 * 7. REST API Route Handler Integration across all /api/v1/passport/* routes.
 */

import { describe, test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import {
  createAchievementSchema,
  verifyAchievementSchema,
} from '../../src/lib/validations/passport.schema';
import { PassportService } from '../../src/lib/services/passport.service';
import { StudentAchievementRepository } from '../../src/lib/db/repositories/student-achievement.repository';
import { PassportShareRepository } from '../../src/lib/db/repositories/passport-share.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { AuditService } from '../../src/lib/services/audit.service';
import { AblyBroker } from '../../src/lib/realtime/ably-broker';
import { __setTestSession } from '../../src/lib/auth/server';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../src/lib/errors/app-error';

// API Route Handlers
import {
  GET as getPassportRoute,
  POST as submitPassportRoute,
} from '../../src/app/api/v1/passport/route';
import {
  GET as getClaimRoute,
  PATCH as resubmitClaimRoute,
  DELETE as deleteClaimRoute,
} from '../../src/app/api/v1/passport/[id]/route';
import { POST as verifyClaimRoute } from '../../src/app/api/v1/passport/[id]/verify/route';
import {
  GET as getShareRoute,
  PATCH as updateShareRoute,
} from '../../src/app/api/v1/passport/share/route';
import { GET as exportPassportRoute } from '../../src/app/api/v1/passport/export/route';
import { GET as getPublicPassportRoute } from '../../src/app/api/v1/passport/public/[shareToken]/route';

import type { UserSession, IUser } from '../../src/types/user';
import type { IDepartment } from '../../src/types/department';
import type { IStudentAchievement, IPassportShare } from '../../src/types/passport';
import type { AuditLogDTO } from '../../src/types/governance';

const studentId = '6730a005f8b1a2001a000301';
const facultyId = '6730a005f8b1a2001a000302';
const cseAdminId = '6730a005f8b1a2001a000303';
const eceAdminId = '6730a005f8b1a2001a000304';
const superAdminId = '6730a005f8b1a2001a000305';
const cseDeptId = '6730a005f8b1a2001a000310';
const eceDeptId = '6730a005f8b1a2001a000311';
const claimId = '6730a005f8b1a2001a000320';
const shareToken = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

const studentSession: UserSession = {
  userId: studentId,
  email: 'student.cse@axiscolleges.in',
  fullName: 'Ananya Verma',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'prof.sharma@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  role: 'faculty',
  status: 'active',
  departmentId: cseDeptId,
};

const cseAdminSession: UserSession = {
  userId: cseAdminId,
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. S. K. Gupta',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: cseDeptId,
};

const eceAdminSession: UserSession = {
  userId: eceAdminId,
  email: 'hod.ece@axiscolleges.in',
  fullName: 'Dr. R. Mishra',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: eceDeptId,
};

const superAdminSession: UserSession = {
  userId: superAdminId,
  email: 'sysadmin@axiscolleges.in',
  fullName: 'Executive System Admin',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

function createMockClaim(overrides: Partial<IStudentAchievement> = {}): IStudentAchievement {
  const now = new Date();
  const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  return {
    _id: new Types.ObjectId(claimId),
    claimCode: 'AXP-2026-100001',
    studentId: new Types.ObjectId(studentId),
    studentSnapshot: {
      fullName: 'Ananya Verma',
      enrollmentNo: 'AXIS2024CSE042',
      department: 'Computer Science & Engineering',
      branch: 'B.TECH',
      section: 'A',
      semester: 6,
    },
    category: 'hackathon_competition',
    pointsWeight: 25,
    title: '1st Place — Smart India Hackathon 2026',
    issuingOrganization: 'Ministry of Education Innovation Cell',
    issueDate: pastDate,
    description: 'Built an AI-assisted campus energy optimizer winning national finals.',
    skills: ['Next.js', 'AI/ML', 'System Design'],
    credentialUrl: 'https://sih.gov.in/verify/cert-2026',
    proofAttachment: null,
    verificationStatus: 'pending',
    resubmissionCount: 0,
    verifiedBy: null,
    verifiedBySnapshot: null,
    verifiedAt: null,
    verificationHash: null,
    reviewRemarks: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as IStudentAchievement;
}

function createMockShare(overrides: Partial<IPassportShare> = {}): IPassportShare {
  const now = new Date();
  return {
    _id: new Types.ObjectId(),
    studentId: new Types.ObjectId(studentId),
    shareToken,
    isEnabled: true,
    headline: 'B.Tech CSE Final Year — Full-Stack & Cloud Enthusiast',
    viewCount: 5,
    lastRotatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as IPassportShare;
}

const dummyAudit: AuditLogDTO = {
  id: '6730a005f8b1a2001a000399',
  eventId: 'AUD-2026-100001',
  actorId: facultyId,
  actorSnapshot: { fullName: 'Prof. Alok Sharma', email: 'prof.sharma@axiscolleges.in', role: 'faculty' },
  action: 'PASSPORT_CLAIM_VERIFIED',
  module: 'SYSTEM',
  severity: 'info',
  targetEntityType: 'StudentAchievement',
  targetEntityId: claimId,
  targetLabel: 'AXP-2026-100001',
  department: 'Computer Science & Engineering',
  oldState: null,
  newState: null,
  reason: 'Verified',
  ipAddress: null,
  userAgent: null,
  previousHash: 'GENESIS',
  entryHash: 'c'.repeat(64),
  createdAt: new Date().toISOString(),
};

describe('Phase 5.12: Skill & Achievement Passport Backend Suite (MOD-15)', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  /* ======================================================================== */
  /* 1. Zod Validation Edge Cases                                             */
  /* ======================================================================== */
  describe('1. Zod Validation & Security Hygiene', () => {
    test('rejects future issueDate, missing proof, javascript: URL, and short rejection remarks', () => {
      const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      // Future date rejected
      const futureRes = createAchievementSchema.safeParse({
        category: 'technical_certification',
        title: 'AWS Solutions Architect',
        issuingOrganization: 'Amazon Web Services',
        issueDate: tomorrow.toISOString(),
        description: 'Earned professional cloud architecture certification with distinction.',
        credentialUrl: 'https://aws.amazon.com/verify/123',
      });
      assert.equal(futureRes.success, false);

      // Missing both credentialUrl and proofAttachment rejected
      const noProofRes = createAchievementSchema.safeParse({
        category: 'technical_certification',
        title: 'AWS Solutions Architect',
        issuingOrganization: 'Amazon Web Services',
        issueDate: past.toISOString(),
        description: 'Earned professional cloud architecture certification with distinction.',
      });
      assert.equal(noProofRes.success, false);

      // javascript: XSS URI rejected
      const xssUrlRes = createAchievementSchema.safeParse({
        category: 'technical_certification',
        title: 'XSS Attempt Certificate',
        issuingOrganization: 'Evil Org',
        issueDate: past.toISOString(),
        description: 'Attempting to inject javascript pseudo protocol into credential link.',
        credentialUrl: 'javascript:alert(1)',
      });
      assert.equal(xssUrlRes.success, false);

      // Short rejection remarks rejected
      const shortReject = verifyAchievementSchema.safeParse({
        decision: 'reject',
        remarks: 'Invalid',
      });
      assert.equal(shortReject.success, false);

      const validVerify = verifyAchievementSchema.safeParse({ decision: 'verify' });
      assert.equal(validVerify.success, true);
    });
  });

  /* ======================================================================== */
  /* 2. Strict RBAC Enforcement & Departmental Isolation                      */
  /* ======================================================================== */
  describe('2. Strict RBAC & Departmental Isolation', () => {
    test('blocks student from verifying/exporting and blocks faculty from submitting/exporting (403)', async () => {
      await assert.rejects(
        () => PassportService.verifyOrRejectAchievement(studentSession, claimId, { decision: 'verify' }),
        ForbiddenError
      );
      await assert.rejects(
        () => PassportService.exportVerifiedAchievementsCsv(studentSession),
        ForbiddenError
      );

      await assert.rejects(
        () =>
          PassportService.submitAchievement(facultySession, {
            category: 'paper_publication',
            title: 'Faculty Paper Claim',
            issuingOrganization: 'IEEE',
            issueDate: new Date(Date.now() - 86400000).toISOString(),
            description: 'Faculty should not submit into student passport claims.',
            credentialUrl: 'https://ieee.org/paper/1',
          }),
        ForbiddenError
      );

      await assert.rejects(
        () => PassportService.exportVerifiedAchievementsCsv(facultySession),
        ForbiddenError
      );
    });

    test('enforces cross-department isolation when admin attempts to verify another department claim (403)', async () => {
      mock.method(StudentAchievementRepository, 'findById', async () => createMockClaim());
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(eceDeptId),
        code: 'ECE',
        name: 'Electronics & Communication Engineering',
      }) as unknown as IDepartment);

      await assert.rejects(
        () =>
          PassportService.verifyOrRejectAchievement(eceAdminSession, claimId, {
            decision: 'verify',
          }),
        ForbiddenError
      );
    });
  });

  /* ======================================================================== */
  /* 3. Verification Integrity & Single Resubmission Rule                     */
  /* ======================================================================== */
  describe('3. Verification Integrity & Single Resubmission Invariant', () => {
    test('stamps SHA-256 verificationHash ONLY on verify and keeps hash null on reject', async () => {
      const pending = createMockClaim({ verificationStatus: 'pending' });
      mock.method(StudentAchievementRepository, 'findById', async () => pending);
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        code: 'CSE',
        name: 'Computer Science & Engineering',
      }) as unknown as IDepartment);
      mock.method(AblyBroker, 'publish', async (channel: string) => ({
        published: true,
        channel,
      }));
      mock.method(AuditService, 'recordEvent', async () => dummyAudit);

      // Verify path
      mock.method(
        StudentAchievementRepository,
        'updateClaim',
        async (_id: string | Types.ObjectId, updates: Partial<IStudentAchievement>) =>
          createMockClaim({ ...updates })
      );

      const verified = await PassportService.verifyOrRejectAchievement(facultySession, claimId, {
        decision: 'verify',
        remarks: 'Verified against official SIH portal.',
      });
      assert.equal(verified.verificationStatus, 'verified');
      assert.ok(verified.verificationHash && verified.verificationHash.length === 64);

      // Reject path
      const rejected = await PassportService.verifyOrRejectAchievement(facultySession, claimId, {
        decision: 'reject',
        remarks: 'Uploaded certificate scan is illegible; please upload clear PDF.',
      });
      assert.equal(rejected.verificationStatus, 'rejected');
      assert.equal(rejected.verificationHash, null);
    });

    test('locks verified claims against student resubmission and deletion (400)', async () => {
      const verifiedClaim = createMockClaim({
        verificationStatus: 'verified',
        verificationHash: 'a'.repeat(64),
      });
      mock.method(StudentAchievementRepository, 'findById', async () => verifiedClaim);

      await assert.rejects(
        () =>
          PassportService.resubmitAchievement(studentSession, claimId, {
            category: 'hackathon_competition',
            title: 'Attempted Tamper Title',
            issuingOrganization: 'SIH',
            issueDate: new Date(Date.now() - 86400000).toISOString(),
            description: 'Trying to alter an already verified achievement record.',
            credentialUrl: 'https://sih.gov.in/verify/new',
          }),
        BadRequestError
      );

      await assert.rejects(
        () => PassportService.deleteOwnPendingAchievement(studentSession, claimId),
        BadRequestError
      );
    });

    test('allows 1st resubmission of rejected claim and permanently blocks 2nd resubmission (400)', async () => {
      const validPayload = {
        category: 'hackathon_competition' as const,
        title: '1st Place — Smart India Hackathon 2026',
        issuingOrganization: 'Ministry of Education',
        issueDate: new Date(Date.now() - 86400000).toISOString(),
        description: 'Updated with official Ministry of Education digital certificate URL.',
        skills: ['Next.js', 'AI/ML'],
        credentialUrl: 'https://sih.gov.in/verify/official-cert',
      };

      // 1st resubmission (resubmissionCount === 0) -> allowed
      mock.method(StudentAchievementRepository, 'findById', async () =>
        createMockClaim({ verificationStatus: 'rejected', resubmissionCount: 0 })
      );
      mock.method(
        StudentAchievementRepository,
        'updateClaim',
        async (_id: string | Types.ObjectId, updates: Partial<IStudentAchievement>) =>
          createMockClaim({ ...updates })
      );

      const resubmitted = await PassportService.resubmitAchievement(
        studentSession,
        claimId,
        validPayload
      );
      assert.equal(resubmitted.verificationStatus, 'pending');
      assert.equal(resubmitted.resubmissionCount, 1);
      assert.equal(resubmitted.reviewRemarks, null);

      // 2nd resubmission after second rejection (resubmissionCount === 1) -> blocked (400)
      mock.method(StudentAchievementRepository, 'findById', async () =>
        createMockClaim({ verificationStatus: 'rejected', resubmissionCount: 1 })
      );
      await assert.rejects(
        () => PassportService.resubmitAchievement(studentSession, claimId, validPayload),
        BadRequestError
      );
    });
  });

  /* ======================================================================== */
  /* 4. Public Share Privacy & Formula-Safe NAAC/NIRF CSV Export              */
  /* ======================================================================== */
  describe('4. Public Share Privacy & NAAC/NIRF CSV Export', () => {
    test('returns 404 for disabled token and exposes ONLY verified achievements without private email/phone', async () => {
      // Disabled share -> 404
      mock.method(PassportShareRepository, 'findByShareToken', async () =>
        createMockShare({ isEnabled: false })
      );
      await assert.rejects(() => PassportService.getPublicPassportByToken(shareToken), NotFoundError);

      // Enabled share -> strictly verified achievements only & zero private contact data
      mock.method(PassportShareRepository, 'findByShareToken', async () =>
        createMockShare({ isEnabled: true })
      );
      mock.method(PassportShareRepository, 'incrementViewCount', async () =>
        createMockShare({ isEnabled: true, viewCount: 6 })
      );
      mock.method(StudentAchievementRepository, 'findByStudent', async () => ({
        achievements: [
          createMockClaim({
            claimCode: 'AXP-2026-100001',
            verificationStatus: 'verified',
            verificationHash: 'b'.repeat(64),
          }),
          createMockClaim({
            claimCode: 'AXP-2026-100002',
            verificationStatus: 'pending',
          }),
          createMockClaim({
            claimCode: 'AXP-2026-100003',
            verificationStatus: 'rejected',
          }),
        ],
        total: 3,
      }));
      mock.method(UserRepository, 'findById', async () => ({
        _id: new Types.ObjectId(studentId),
        fullName: 'Ananya Verma',
        email: 'private.student@axiscolleges.in',
        phoneNumber: '+91-9999999999',
        departmentId: new Types.ObjectId(cseDeptId),
        studentProfile: { program: 'B.TECH', currentSemester: 6 },
      }) as unknown as IUser);
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        code: 'CSE',
        name: 'Computer Science & Engineering',
      }) as unknown as IDepartment);

      const pub = await PassportService.getPublicPassportByToken(shareToken);
      assert.equal(pub.verifiedCount, 1);
      assert.equal(pub.achievements.length, 1);
      assert.equal(pub.achievements[0]?.claimCode, 'AXP-2026-100001');
      const serialized = JSON.stringify(pub);
      assert.ok(!serialized.includes('private.student@axiscolleges.in'));
      assert.ok(!serialized.includes('9999999999'));
      assert.ok(!serialized.includes('AXP-2026-100002'));
      assert.ok(!serialized.includes('AXP-2026-100003'));
    });

    test('exports formula-injection-safe NAAC/NIRF CSV of verified achievements for admin', async () => {
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        code: 'CSE',
        name: 'Computer Science & Engineering',
      }) as unknown as IDepartment);
      mock.method(StudentAchievementRepository, 'findForVerificationQueue', async () => ({
        achievements: [
          createMockClaim({
            title: '=HYPERLINK("http://evil.com","Click")',
            verificationStatus: 'verified',
            verificationHash: 'e'.repeat(64),
          }),
        ],
        total: 1,
      }));

      const csv = await PassportService.exportVerifiedAchievementsCsv(cseAdminSession);
      assert.equal(csv.count, 1);
      assert.ok(csv.body.includes(`"'=HYPERLINK(""http://evil.com"",""Click"")"`));
    });
  });

  /* ======================================================================== */
  /* 5. REST API Route Handlers Integration                                   */
  /* ======================================================================== */
  describe('5. REST API Route Handlers Integration (/api/v1/passport/*)', () => {
    test('serves all passport endpoints with strict RBAC and public token gating', async () => {
      // Student GET & POST /api/v1/passport
      __setTestSession(studentSession);
      mock.method(StudentAchievementRepository, 'findByStudent', async () => ({
        achievements: [createMockClaim()],
        total: 1,
      }));
      mock.method(StudentAchievementRepository, 'getStudentSummaryStats', async () => ({
        totalClaims: 1,
        verifiedCount: 0,
        pendingCount: 1,
        rejectedCount: 0,
        resubmittableCount: 0,
        totalVerifiedPoints: 0,
        byCategory: {
          technical_certification: 0,
          hackathon_competition: 0,
          paper_publication: 0,
          club_leadership: 0,
          community_service: 0,
        },
      }));
      mock.method(PassportShareRepository, 'upsertByStudentId', async () => createMockShare());

      const stuGetRes = await getPassportRoute(new NextRequest('http://localhost/api/v1/passport'));
      assert.equal(stuGetRes.status, 200);

      mock.method(UserRepository, 'findById', async () => null);
      mock.method(DepartmentRepository, 'findById', async () => null);
      mock.method(StudentAchievementRepository, 'getNextClaimCode', async () => 'AXP-2026-100001');
      mock.method(StudentAchievementRepository, 'create', async () => createMockClaim());

      const stuPostRes = await submitPassportRoute(
        new NextRequest('http://localhost/api/v1/passport', {
          method: 'POST',
          body: JSON.stringify({
            category: 'hackathon_competition',
            title: '1st Place — Smart India Hackathon 2026',
            issuingOrganization: 'Ministry of Education',
            issueDate: new Date(Date.now() - 86400000).toISOString(),
            description: 'Built an AI-assisted campus energy optimizer winning national finals.',
            credentialUrl: 'https://sih.gov.in/verify/cert-2026',
          }),
        })
      );
      assert.equal(stuPostRes.status, 201);

      // Share GET & PATCH
      const shareGetRes = await getShareRoute();
      assert.equal(shareGetRes.status, 200);

      const sharePatchRes = await updateShareRoute(
        new NextRequest('http://localhost/api/v1/passport/share', {
          method: 'PATCH',
          body: JSON.stringify({ isEnabled: true, headline: 'Cloud Engineer', rotateToken: true }),
        })
      );
      assert.equal(sharePatchRes.status, 200);

      // Claim GET, PATCH (resubmit), DELETE (pending)
      mock.method(StudentAchievementRepository, 'findById', async () =>
        createMockClaim({ verificationStatus: 'rejected', resubmissionCount: 0 })
      );
      mock.method(StudentAchievementRepository, 'updateClaim', async () =>
        createMockClaim({ verificationStatus: 'pending', resubmissionCount: 1 })
      );

      const claimGetRes = await getClaimRoute(
        new NextRequest(`http://localhost/api/v1/passport/${claimId}`),
        { params: Promise.resolve({ id: claimId }) }
      );
      assert.equal(claimGetRes.status, 200);

      const resubRes = await resubmitClaimRoute(
        new NextRequest(`http://localhost/api/v1/passport/${claimId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            category: 'hackathon_competition',
            title: '1st Place — Smart India Hackathon 2026',
            issuingOrganization: 'Ministry of Education',
            issueDate: new Date(Date.now() - 86400000).toISOString(),
            description: 'Updated with clear verified digital certificate URL from SIH.',
            credentialUrl: 'https://sih.gov.in/verify/cert-updated',
          }),
        }),
        { params: Promise.resolve({ id: claimId }) }
      );
      assert.equal(resubRes.status, 200);

      mock.method(StudentAchievementRepository, 'findById', async () =>
        createMockClaim({ verificationStatus: 'pending' })
      );
      mock.method(StudentAchievementRepository, 'deleteClaim', async () => true);
      const delRes = await deleteClaimRoute(
        new NextRequest(`http://localhost/api/v1/passport/${claimId}`, { method: 'DELETE' }),
        { params: Promise.resolve({ id: claimId }) }
      );
      assert.equal(delRes.status, 200);

      // Faculty verifies claim -> 200
      __setTestSession(facultySession);
      mock.method(AblyBroker, 'publish', async (channel: string) => ({
        published: true,
        channel,
      }));
      mock.method(AuditService, 'recordEvent', async () => dummyAudit);
      mock.method(StudentAchievementRepository, 'updateClaim', async () =>
        createMockClaim({
          verificationStatus: 'verified',
          verificationHash: 'd'.repeat(64),
        })
      );

      const verifyRes = await verifyClaimRoute(
        new NextRequest(`http://localhost/api/v1/passport/${claimId}/verify`, {
          method: 'POST',
          body: JSON.stringify({ decision: 'verify', remarks: 'Confirmed with organizer.' }),
        }),
        { params: Promise.resolve({ id: claimId }) }
      );
      assert.equal(verifyRes.status, 200);

      // Faculty blocked from CSV export -> 403
      const facExportRes = await exportPassportRoute(
        new NextRequest('http://localhost/api/v1/passport/export')
      );
      assert.equal(facExportRes.status, 403);

      // Super Admin CSV export -> 200 text/csv
      __setTestSession(superAdminSession);
      mock.method(StudentAchievementRepository, 'findForVerificationQueue', async () => ({
        achievements: [
          createMockClaim({ verificationStatus: 'verified', verificationHash: 'd'.repeat(64) }),
        ],
        total: 1,
      }));
      const adminExportRes = await exportPassportRoute(
        new NextRequest('http://localhost/api/v1/passport/export')
      );
      assert.equal(adminExportRes.status, 200);
      assert.ok(adminExportRes.headers.get('content-type')?.includes('text/csv'));

      // Public recruiter endpoint (unauthenticated guest) -> 200
      __setTestSession(null);
      mock.method(PassportShareRepository, 'findByShareToken', async () => createMockShare());
      mock.method(PassportShareRepository, 'incrementViewCount', async () => createMockShare());
      mock.method(StudentAchievementRepository, 'findByStudent', async () => ({
        achievements: [
          createMockClaim({ verificationStatus: 'verified', verificationHash: 'd'.repeat(64) }),
        ],
        total: 1,
      }));

      const pubRes = await getPublicPassportRoute(
        new NextRequest(`http://localhost/api/v1/passport/public/${shareToken}`),
        { params: Promise.resolve({ shareToken }) }
      );
      assert.equal(pubRes.status, 200);
    });
  });
});
