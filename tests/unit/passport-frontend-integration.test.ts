/**
 * Phase 5.12: Skill & Achievement Passport Frontend & Portal Integration Suite (MOD-15).
 *
 * Verifies:
 * 1. StudentPassportView: Verified cryptographic seal vs pending/rejected badges, Resubmit Proof CTA, public share controls.
 * 2. PassportVerificationView: Triage tabs, Admin NAAC/NIRF Export CSV button vs Faculty view without export.
 * 3. PublicPassportView: Recruiter portfolio rendering verified points, AXP seals, and zero private contact leakage.
 * 4. AchievementSubmitModal & AchievementVerifyModal: Clean mounting.
 * 5. Server Pages RBAC: StudentPassportPage, FacultyPassportPage, AdminPassportPage authorization gates.
 */

import { describe, test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  StudentPassportView,
  PassportVerificationView,
  PublicPassportView,
  AchievementSubmitModal,
  AchievementVerifyModal,
} from '../../src/components/passport';
import StudentPassportPage from '../../src/app/(student)/student/passport/page';
import FacultyPassportPage from '../../src/app/(faculty)/faculty/passport/page';
import AdminPassportPage from '../../src/app/(admin)/admin/passport/page';
import { PassportService } from '../../src/lib/services/passport.service';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { __setTestSession } from '../../src/lib/auth/server';
import { ForbiddenError } from '../../src/lib/errors/app-error';

import type { UserSession } from '../../src/types/user';
import type {
  PassportShareDTO,
  PassportVerificationStatsDTO,
  PublicPassportDTO,
  StudentAchievementDTO,
  StudentPassportStatsDTO,
} from '../../src/types/passport';

const studentId = '6730a005f8b1a2001a000201';
const facultyId = '6730a005f8b1a2001a000202';
const adminId = '6730a005f8b1a2001a000203';

const studentSession: UserSession = {
  userId: studentId,
  email: 'student@axiscolleges.in',
  fullName: 'Ananya Verma',
  role: 'student',
  status: 'active',
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'faculty@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  role: 'faculty',
  status: 'active',
};

const adminSession: UserSession = {
  userId: adminId,
  email: 'admin@axiscolleges.in',
  fullName: 'Dr. S. K. Gupta',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
};

const verifiedClaim: StudentAchievementDTO = {
  id: '6730a005f8b1a2001a000210',
  claimCode: 'AXP-2026-100001',
  studentId,
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
  issuingOrganization: 'Ministry of Education',
  issueDate: new Date(Date.now() - 10 * 86400000).toISOString(),
  description: 'National hackathon winner building AI campus energy optimizer.',
  skills: ['Next.js', 'AI/ML'],
  credentialUrl: 'https://sih.gov.in/verify/cert',
  proofAttachment: null,
  verificationStatus: 'verified',
  resubmissionCount: 0,
  verifiedBy: facultyId,
  verifiedBySnapshot: {
    fullName: 'Prof. Alok Sharma',
    role: 'faculty',
    department: 'Computer Science & Engineering',
  },
  verifiedAt: new Date().toISOString(),
  verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  reviewRemarks: 'Verified with official certificate.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const rejectedResubmittableClaim: StudentAchievementDTO = {
  ...verifiedClaim,
  id: '6730a005f8b1a2001a000211',
  claimCode: 'AXP-2026-100002',
  title: 'AWS Cloud Practitioner Certification',
  verificationStatus: 'rejected',
  resubmissionCount: 0,
  verificationHash: null,
  verifiedAt: null,
  reviewRemarks: 'Uploaded PDF was cropped; please resubmit full certificate.',
};

const pendingClaim: StudentAchievementDTO = {
  ...verifiedClaim,
  id: '6730a005f8b1a2001a000212',
  claimCode: 'AXP-2026-100003',
  title: 'IEEE Conference Paper Publication',
  category: 'paper_publication',
  pointsWeight: 30,
  verificationStatus: 'pending',
  verificationHash: null,
  verifiedAt: null,
  reviewRemarks: null,
};

const mockStudentStats: StudentPassportStatsDTO = {
  totalClaims: 3,
  verifiedCount: 1,
  pendingCount: 1,
  rejectedCount: 1,
  resubmittableCount: 1,
  totalVerifiedPoints: 25,
  byCategory: {
    technical_certification: 0,
    hackathon_competition: 1,
    paper_publication: 0,
    club_leadership: 0,
    community_service: 0,
  },
};

const mockShare: PassportShareDTO = {
  id: '6730a005f8b1a2001a000220',
  studentId,
  shareToken: 'abcd1234abcd1234abcd1234abcd1234',
  isEnabled: true,
  headline: 'B.Tech CSE — Full-Stack & Cloud',
  viewCount: 12,
  lastRotatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockQueueStats: PassportVerificationStatsDTO = {
  total: 3,
  pending: 1,
  verified: 1,
  rejected: 1,
  totalVerifiedPoints: 25,
};

const mockPublicPortfolio: PublicPassportDTO = {
  shareToken: mockShare.shareToken,
  headline: mockShare.headline,
  viewCount: 12,
  student: {
    fullName: 'Ananya Verma',
    department: 'Computer Science & Engineering',
    branch: 'B.TECH',
    semester: 6,
  },
  totalVerifiedPoints: 25,
  verifiedCount: 1,
  skills: ['Next.js', 'AI/ML'],
  achievements: [
    {
      claimCode: 'AXP-2026-100001',
      category: 'hackathon_competition',
      pointsWeight: 25,
      title: '1st Place — Smart India Hackathon 2026',
      issuingOrganization: 'Ministry of Education',
      issueDate: verifiedClaim.issueDate,
      description: verifiedClaim.description,
      skills: ['Next.js', 'AI/ML'],
      credentialUrl: 'https://sih.gov.in/verify/cert',
      verifiedByName: 'Prof. Alok Sharma',
      verifiedByRole: 'faculty',
      verifiedAt: new Date().toISOString(),
      verificationHash: verifiedClaim.verificationHash || '',
    },
  ],
  generatedAt: new Date().toISOString(),
};

describe('Phase 5.12: Skill & Achievement Passport Frontend Integration Suite', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  test('1. StudentPassportView renders verified seal ONLY on verified claims, plus Resubmit Proof CTA', () => {
    const html = renderToStaticMarkup(
      React.createElement(StudentPassportView, {
        initialAchievements: [verifiedClaim, rejectedResubmittableClaim, pendingClaim],
        initialStats: mockStudentStats,
        initialShare: mockShare,
      })
    );

    assert.ok(html.includes('Skill &amp; Achievement Passport'));
    assert.ok(html.includes('Verified by Axis Institute • AXP-2026-100001'));
    assert.ok(!html.includes('Verified by Axis Institute • AXP-2026-100002'));
    assert.ok(!html.includes('Verified by Axis Institute • AXP-2026-100003'));
    assert.ok(html.includes('Resubmit Proof'));
    assert.ok(html.includes('Public Link Active'));
    assert.ok(html.includes('Print Transcript'));
  });

  test('2. PassportVerificationView shows NAAC/NIRF CSV Export only when canExportCsv is true', () => {
    const adminHtml = renderToStaticMarkup(
      React.createElement(PassportVerificationView, {
        canExportCsv: true,
        departmentScope: 'Computer Science & Engineering',
        initialAchievements: [pendingClaim],
        initialStats: mockQueueStats,
      })
    );
    assert.ok(adminHtml.includes('Export Verified CSV (NAAC/NIRF)'));
    assert.ok(adminHtml.includes('AXP-2026-100003'));
    assert.ok(adminHtml.includes('Review &amp; Verify'));

    const facultyHtml = renderToStaticMarkup(
      React.createElement(PassportVerificationView, {
        canExportCsv: false,
        initialAchievements: [pendingClaim],
        initialStats: mockQueueStats,
      })
    );
    assert.ok(!facultyHtml.includes('Export Verified CSV (NAAC/NIRF)'));
    assert.ok(facultyHtml.includes('Faculty Skill Verification Desk'));
  });

  test('3. PublicPassportView displays verified recruiter portfolio without private email exposure', () => {
    const html = renderToStaticMarkup(
      React.createElement(PublicPassportView, { portfolio: mockPublicPortfolio })
    );

    assert.ok(html.includes('Official Verified Portfolio • Axis Colleges'));
    assert.ok(html.includes('Ananya Verma'));
    assert.ok(html.includes('AXP-2026-100001'));
    assert.ok(html.includes('Verified by Axis Institute'));
    assert.ok(!html.includes('student@axiscolleges.in'));
  });

  test('4. AchievementSubmitModal and AchievementVerifyModal mount cleanly', () => {
    const submitHtml = renderToStaticMarkup(
      React.createElement(AchievementSubmitModal, {
        isOpen: false,
        resubmittingClaim: rejectedResubmittableClaim,
        onClose: () => {},
        onSuccess: () => {},
      })
    );
    assert.equal(typeof submitHtml, 'string');

    const verifyHtml = renderToStaticMarkup(
      React.createElement(AchievementVerifyModal, {
        claim: pendingClaim,
        isOpen: false,
        onClose: () => {},
        onSuccess: () => {},
      })
    );
    assert.equal(typeof verifyHtml, 'string');
  });

  test('5. Portal Server Pages enforce strict RBAC boundaries', async () => {
    // StudentPassportPage blocks faculty
    __setTestSession(facultySession);
    await assert.rejects(() => StudentPassportPage(), ForbiddenError);

    // StudentPassportPage mounts for student
    __setTestSession(studentSession);
    mock.method(PassportService, 'getStudentPassport', async () => ({
      achievements: [verifiedClaim],
      stats: mockStudentStats,
      share: mockShare,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasMore: false },
    }));
    const stuHtml = renderToStaticMarkup(await StudentPassportPage());
    assert.ok(stuHtml.includes('Skill &amp; Achievement Passport'));

    // FacultyPassportPage blocks student & mounts for faculty
    __setTestSession(studentSession);
    await assert.rejects(() => FacultyPassportPage(), ForbiddenError);

    __setTestSession(facultySession);
    mock.method(DepartmentRepository, 'findById', async () => null);
    mock.method(PassportService, 'listVerificationQueue', async () => ({
      achievements: [pendingClaim],
      stats: mockQueueStats,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasMore: false },
    }));
    const facHtml = renderToStaticMarkup(await FacultyPassportPage());
    assert.ok(facHtml.includes('Faculty Skill Verification Desk'));

    // AdminPassportPage blocks faculty & mounts for admin
    __setTestSession(facultySession);
    await assert.rejects(() => AdminPassportPage(), ForbiddenError);

    __setTestSession(adminSession);
    const admHtml = renderToStaticMarkup(await AdminPassportPage());
    assert.ok(admHtml.includes('Export Verified CSV (NAAC/NIRF)'));
  });
});
