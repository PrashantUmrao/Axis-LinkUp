/**
 * Phase 6.1 — Cross-Module Platform Integration Verification Suite.
 * Exercises 5 end-to-end multi-module workflows with deterministic in-memory stores:
 * 1. Service Request -> Notification Handoff (MOD-13 -> MOD-17 + Ably)
 * 2. Facility Booking -> Atomic Double-Booking Defense -> Notification (MOD-14 -> MOD-17)
 * 3. Skill Passport -> Faculty Endorsement -> Public Recruiter Privacy + Audit (MOD-15 -> MOD-19 -> MOD-17)
 * 4. IAM Governance -> Immutable SHA-256 Audit Hash-Chain Verification & Tamper Detection (RBAC -> MOD-19)
 * 5. Emergency Trigger -> Critical Audit Log -> Idempotent Acknowledgment -> Deactivation (MOD-16 -> MOD-19)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

import { ServiceRequestService } from '@/lib/services/service-request.service';
import { FacilityService } from '@/lib/services/facility.service';
import { PassportService } from '@/lib/services/passport.service';
import { IamGovernanceService } from '@/lib/services/iam-governance.service';
import { AuditService } from '@/lib/services/audit.service';
import { EmergencyService } from '@/lib/services/emergency.service';

import { ServiceRequestRepository } from '@/lib/db/repositories/service-request.repository';
import { NotificationRepository } from '@/lib/db/repositories/notification.repository';
import { NotificationPreferenceRepository } from '@/lib/db/repositories/notification-preference.repository';
import { FacilityRepository } from '@/lib/db/repositories/facility.repository';
import { FacilityBookingRepository } from '@/lib/db/repositories/facility-booking.repository';
import { StudentAchievementRepository } from '@/lib/db/repositories/student-achievement.repository';
import { PassportShareRepository } from '@/lib/db/repositories/passport-share.repository';
import { AuditLogRepository } from '@/lib/db/repositories/audit-log.repository';
import { EmergencyAlertRepository } from '@/lib/db/repositories/emergency-alert.repository';
import { EmergencyAcknowledgmentRepository } from '@/lib/db/repositories/emergency-acknowledgment.repository';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { AblyBroker } from '@/lib/realtime/ably-broker';
import { ConflictError } from '@/lib/errors/app-error';

import type { UserSession } from '@/types/user';
import type { IServiceRequest } from '@/types/service-request';
import type { INotification } from '@/types/notification';
import type { IFacility, IFacilityBooking } from '@/types/facility';
import type { IPassportShare, IStudentAchievement } from '@/types/passport';
import type { IAuditLog } from '@/types/governance';
import type { IEmergencyAcknowledgment, IEmergencyAlert } from '@/types/emergency';

const CSE_DEPT_ID = new Types.ObjectId().toString();
const STUDENT_ID = new Types.ObjectId().toString();
const FACULTY_1_ID = new Types.ObjectId().toString();
const FACULTY_2_ID = new Types.ObjectId().toString();
const ADMIN_ID = new Types.ObjectId().toString();
const SUPER_ADMIN_ID = new Types.ObjectId().toString();

const studentSession: UserSession = {
  userId: STUDENT_ID,
  authProviderId: 'clerk_int_stu',
  email: 'aarav.verma@axiscolleges.in',
  fullName: 'Aarav Verma',
  role: 'student',
  status: 'active',
  departmentId: CSE_DEPT_ID,
};

const faculty1Session: UserSession = {
  userId: FACULTY_1_ID,
  authProviderId: 'clerk_int_fac1',
  email: 'prof.sharma@axiscolleges.in',
  fullName: 'Prof. Ankit Sharma',
  role: 'faculty',
  status: 'active',
  departmentId: CSE_DEPT_ID,
};

const faculty2Session: UserSession = {
  userId: FACULTY_2_ID,
  authProviderId: 'clerk_int_fac2',
  email: 'prof.iyer@axiscolleges.in',
  fullName: 'Prof. Meera Iyer',
  role: 'faculty',
  status: 'active',
  departmentId: CSE_DEPT_ID,
};

const adminSession: UserSession = {
  userId: ADMIN_ID,
  authProviderId: 'clerk_int_adm',
  email: 'hod.cse@axiscolleges.in',
  fullName: 'Dr. Kavita Rao',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: CSE_DEPT_ID,
};

const superAdminSession: UserSession = {
  userId: SUPER_ADMIN_ID,
  authProviderId: 'clerk_int_sa',
  email: 'director@axiscolleges.in',
  fullName: 'Dr. Vikram Mehta',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

describe('Phase 6.1 — Cross-Module Platform Integration Workflows', () => {
  // Snapshots of original repository/broker implementations
  const origServiceRequestRepo = { ...ServiceRequestRepository };
  const origNotificationRepo = { ...NotificationRepository };
  const origNotificationPrefRepo = { ...NotificationPreferenceRepository };
  const origFacilityRepo = { ...FacilityRepository };
  const origFacilityBookingRepo = { ...FacilityBookingRepository };
  const origAchievementRepo = { ...StudentAchievementRepository };
  const origPassportShareRepo = { ...PassportShareRepository };
  const origAuditLogRepo = { ...AuditLogRepository };
  const origEmergencyAlertRepo = { ...EmergencyAlertRepository };
  const origEmergencyAckRepo = { ...EmergencyAcknowledgmentRepository };
  const origUserRepo = { ...UserRepository };
  const origDeptRepo = { ...DepartmentRepository };
  const origAblyPublish = AblyBroker.publish;
  const origMongoUri = process.env.MONGODB_URI;

  let requestsStore: IServiceRequest[] = [];
  let notificationsStore: INotification[] = [];
  let facilitiesStore: IFacility[] = [];
  let bookingsStore: IFacilityBooking[] = [];
  let achievementsStore: IStudentAchievement[] = [];
  let sharesStore: IPassportShare[] = [];
  let auditStore: IAuditLog[] = [];
  let alertsStore: IEmergencyAlert[] = [];
  let acksStore: IEmergencyAcknowledgment[] = [];
  let usersStore: Map<string, Record<string, unknown>> = new Map();
  let ablyEvents: Array<{ channel: string; event: string; data: unknown }> = [];

  beforeEach(() => {
    // Enable NotificationService.safeDispatchCrossModule during integration tests (backed by mocked repo)
    process.env.MONGODB_URI = 'mongodb://mock-integration-suite';

    requestsStore = [];
    notificationsStore = [];
    facilitiesStore = [];
    bookingsStore = [];
    achievementsStore = [];
    sharesStore = [];
    auditStore = [];
    alertsStore = [];
    acksStore = [];
    ablyEvents = [];

    usersStore = new Map([
      [
        STUDENT_ID,
        {
          _id: new Types.ObjectId(STUDENT_ID),
          authProviderId: 'clerk_int_stu',
          fullName: 'Aarav Verma',
          email: 'aarav.verma@axiscolleges.in',
          phone: '+91-9876543210',
          role: 'student',
          status: 'active',
          departmentId: new Types.ObjectId(CSE_DEPT_ID),
          studentProfile: {
            enrollmentNumber: 'AITM-2024-CSE-042',
            rollNumber: '240101042',
            program: 'B.Tech CSE',
            section: 'A',
            currentSemester: 6,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        FACULTY_1_ID,
        {
          _id: new Types.ObjectId(FACULTY_1_ID),
          authProviderId: 'clerk_int_fac1',
          fullName: 'Prof. Ankit Sharma',
          email: 'prof.sharma@axiscolleges.in',
          role: 'faculty',
          adminSubRole: null,
          status: 'active',
          departmentId: new Types.ObjectId(CSE_DEPT_ID),
          facultyProfile: { employeeId: 'FAC-CSE-101' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        FACULTY_2_ID,
        {
          _id: new Types.ObjectId(FACULTY_2_ID),
          authProviderId: 'clerk_int_fac2',
          fullName: 'Prof. Meera Iyer',
          email: 'prof.iyer@axiscolleges.in',
          role: 'faculty',
          adminSubRole: null,
          status: 'active',
          departmentId: new Types.ObjectId(CSE_DEPT_ID),
          facultyProfile: { employeeId: 'FAC-CSE-102' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    ]);

    // Common mocks
    DepartmentRepository.findById = async (id) => {
      if (id.toString() === CSE_DEPT_ID) {
        return {
          _id: new Types.ObjectId(CSE_DEPT_ID),
          name: 'Computer Science & Engineering',
          code: 'CSE',
        } as never;
      }
      return null;
    };

    DepartmentRepository.findActiveByIdOrCode = async (identifier) => {
      if (identifier === CSE_DEPT_ID || identifier.toUpperCase() === 'CSE') {
        return {
          _id: new Types.ObjectId(CSE_DEPT_ID),
          name: 'Computer Science & Engineering',
          code: 'CSE',
        } as never;
      }
      return null;
    };

    UserRepository.findById = async (id) => {
      return (usersStore.get(id.toString()) ?? null) as never;
    };

    UserRepository.updateRole = async (id, role) => {
      const existing = usersStore.get(id.toString());
      if (!existing) return null;
      const merged = { ...existing, role, updatedAt: new Date() };
      usersStore.set(id.toString(), merged);
      return merged as never;
    };

    UserRepository.updateAdminSubRole = async (id, adminSubRole) => {
      const existing = usersStore.get(id.toString());
      if (!existing) return null;
      const merged = { ...existing, adminSubRole, updatedAt: new Date() };
      usersStore.set(id.toString(), merged);
      return merged as never;
    };

    UserRepository.updateDepartment = async (id, departmentId) => {
      const existing = usersStore.get(id.toString());
      if (!existing) return null;
      const merged = {
        ...existing,
        departmentId: departmentId ? new Types.ObjectId(departmentId.toString()) : null,
        updatedAt: new Date(),
      };
      usersStore.set(id.toString(), merged);
      return merged as never;
    };

    UserRepository.countByRole = async (role) => {
      let count = 0;
      for (const u of usersStore.values()) {
        if (u.role === role) count += 1;
      }
      return count;
    };

    AblyBroker.publish = async (channel, event, data) => {
      ablyEvents.push({ channel, event, data });
      return { published: true, channel, eventName: event, provider: 'mock' };
    };

    // Notification Center repository mocks (MOD-17)
    NotificationPreferenceRepository.findByUserId = async () => null;
    NotificationRepository.findRecentDuplicate = async (userId, dedupeKey, windowMs = 60_000) => {
      const cutoff = Date.now() - windowMs;
      return (
        notificationsStore.find(
          (n) =>
            n.userId.toString() === userId.toString() &&
            n.dedupeKey === dedupeKey &&
            n.createdAt.getTime() >= cutoff
        ) ?? null
      );
    };
    NotificationRepository.create = async (data) => {
      const now = new Date();
      const doc = {
        _id: new Types.ObjectId(),
        userId: data.userId as Types.ObjectId,
        title: data.title || '',
        message: data.message || '',
        category: data.category || 'system',
        priority: data.priority || 'normal',
        linkUrl: data.linkUrl ?? null,
        dedupeKey: data.dedupeKey ?? null,
        metadata: data.metadata ?? null,
        isRead: false,
        readAt: null,
        isArchived: false,
        expiresAt: data.expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      } as unknown as INotification;
      notificationsStore.push(doc);
      return doc;
    };

    // Audit Log repository mocks (MOD-19)
    let auditCounter = 1;
    AuditLogRepository.findLatestEntry = async () => {
      return auditStore.length > 0 ? auditStore[auditStore.length - 1]! : null;
    };
    AuditLogRepository.getNextEventId = async () => {
      return `AUD-2026-${String(auditCounter++).padStart(6, '0')}`;
    };
    AuditLogRepository.create = async (data) => {
      const doc = {
        _id: new Types.ObjectId(),
        ...data,
      } as unknown as IAuditLog;
      auditStore.push(doc);
      return doc;
    };
    AuditLogRepository.getRecentChain = async () => {
      return {
        entries: [...auditStore],
        totalCount: auditStore.length,
      };
    };
  });

  afterEach(() => {
    Object.assign(ServiceRequestRepository, origServiceRequestRepo);
    Object.assign(NotificationRepository, origNotificationRepo);
    Object.assign(NotificationPreferenceRepository, origNotificationPrefRepo);
    Object.assign(FacilityRepository, origFacilityRepo);
    Object.assign(FacilityBookingRepository, origFacilityBookingRepo);
    Object.assign(StudentAchievementRepository, origAchievementRepo);
    Object.assign(PassportShareRepository, origPassportShareRepo);
    Object.assign(AuditLogRepository, origAuditLogRepo);
    Object.assign(EmergencyAlertRepository, origEmergencyAlertRepo);
    Object.assign(EmergencyAcknowledgmentRepository, origEmergencyAckRepo);
    Object.assign(UserRepository, origUserRepo);
    Object.assign(DepartmentRepository, origDeptRepo);
    AblyBroker.publish = origAblyPublish;

    if (origMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = origMongoUri;
    }
  });

  it('Workflow 1: Service Request -> Admin Approval -> Persistent Notification & Ably Dispatch', async () => {
    let ticketSeq = 1;
    ServiceRequestRepository.countActiveByCategory = async () => 0;
    ServiceRequestRepository.getNextTicketNumber = async () =>
      `REQ-2026-${String(ticketSeq++).padStart(4, '0')}`;
    ServiceRequestRepository.create = async (data) => {
      const now = new Date();
      const doc = {
        _id: new Types.ObjectId(),
        ...data,
        createdAt: now,
        updatedAt: now,
      } as unknown as IServiceRequest;
      requestsStore.push(doc);
      return doc;
    };
    ServiceRequestRepository.findById = async (id) => {
      return requestsStore.find((r) => r._id.toString() === id.toString()) ?? null;
    };
    ServiceRequestRepository.recordAction = async (
      id,
      action,
      actorId,
      actorRole,
      actorName,
      remarks,
      extraUpdates
    ) => {
      const target = requestsStore.find((r) => r._id.toString() === id.toString());
      if (!target) return null;
      target.status = action;
      Object.assign(target, extraUpdates);
      target.reviewHistory.push({
        action,
        actorId: new Types.ObjectId(actorId.toString()),
        actorRole,
        actorName,
        remarks,
        timestamp: new Date(),
      });
      target.updatedAt = new Date();
      return target;
    };

    // Step 1: Student submits Bonafide Certificate request
    const submitted = await ServiceRequestService.submitRequest(studentSession, {
      category: 'bonafide',
      subject: 'Bonafide Certificate for Educational Loan',
      priority: 'standard',
      details: { purpose: 'Bank loan verification' },
      attachments: [],
    });
    assert.equal(submitted.status, 'submitted');

    // Step 2: Department Admin approves & fulfills the request
    const approved = await ServiceRequestService.processRequestAction(adminSession, submitted.id, {
      action: 'approved',
      remarks: 'Verified enrollment records with Academic Office.',
    });
    assert.equal(approved.status, 'approved');

    // Step 3: Verify persisted notification in MOD-17 + Ably real-time push
    assert.equal(notificationsStore.length, 1);
    assert.equal(notificationsStore[0]?.userId.toString(), STUDENT_ID);
    assert.equal(notificationsStore[0]?.category, 'service_request');
    assert.equal(notificationsStore[0]?.linkUrl, '/student/requests');
    assert.ok(
      ablyEvents.some(
        (e) =>
          e.channel === `user:${STUDENT_ID}:notifications` &&
          e.event === 'notification.created'
      )
    );
  });

  it('Workflow 2: Facility Booking -> Atomic Double-Booking Defense (409) -> Adjacent Slot & Notification', async () => {
    const auditoriumId = new Types.ObjectId();
    facilitiesStore.push({
      _id: auditoriumId,
      code: 'AUD-MAIN',
      name: 'Main Auditorium',
      building: 'Academic Block A',
      floor: 'Ground',
      type: 'auditorium',
      department: 'Central Administration',
      capacity: 300,
      amenities: ['Projector', 'Audio System'],
      pcCount: 0,
      status: 'available',
      description: 'Main campus auditorium',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as IFacility);

    let bookingSeq = 1;
    FacilityRepository.findById = async (id) => {
      return facilitiesStore.find((f) => f._id.toString() === id.toString()) ?? null;
    };
    FacilityBookingRepository.getNextBookingCode = async () =>
      `BKG-2026-${String(bookingSeq++).padStart(4, '0')}`;
    FacilityBookingRepository.create = async (data) => {
      const now = new Date();
      const doc = {
        _id: new Types.ObjectId(),
        ...data,
        createdAt: now,
        updatedAt: now,
      } as unknown as IFacilityBooking;
      bookingsStore.push(doc);
      return doc;
    };
    FacilityBookingRepository.findById = async (id) => {
      return bookingsStore.find((b) => b._id.toString() === id.toString()) ?? null;
    };
    FacilityBookingRepository.update = async (id, updates) => {
      const target = bookingsStore.find((b) => b._id.toString() === id.toString());
      if (!target) return null;
      Object.assign(target, updates, { updatedAt: new Date() });
      return target;
    };
    FacilityBookingRepository.findConflictingBookings = async (
      facilityId,
      startTime,
      endTime,
      excludeBookingId
    ) => {
      return bookingsStore.filter(
        (b) =>
          b.facilityId.toString() === facilityId.toString() &&
          b.status === 'approved' &&
          (!excludeBookingId || b._id.toString() !== excludeBookingId.toString()) &&
          b.startTime.getTime() < endTime.getTime() &&
          b.endTime.getTime() > startTime.getTime()
      );
    };

    const dayBase = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const slot1Start = new Date(dayBase.getTime());
    const slot1End = new Date(dayBase.getTime() + 2 * 60 * 60 * 1000); // [T, T+2h]
    const overlapStart = new Date(dayBase.getTime() + 60 * 60 * 1000); // [T+1h, T+3h]
    const overlapEnd = new Date(dayBase.getTime() + 3 * 60 * 60 * 1000);
    const adjacentStart = new Date(slot1End.getTime()); // [T+2h, T+4h] (exact boundary touch)
    const adjacentEnd = new Date(slot1End.getTime() + 2 * 60 * 60 * 1000);

    // Competing pending requests from 2 faculty members for overlapping times
    const req1 = await FacilityService.createBooking(faculty1Session, {
      facilityId: auditoriumId.toString(),
      title: 'AI Symposium Keynote',
      purpose: 'Annual department symposium on applied AI research.',
      expectedAttendees: 200,
      startTime: slot1Start,
      endTime: slot1End,
      autoApprove: false,
    });
    const req2 = await FacilityService.createBooking(faculty2Session, {
      facilityId: auditoriumId.toString(),
      title: 'Robotics Workshop',
      purpose: 'Hands-on embedded robotics showcase for B.Tech students.',
      expectedAttendees: 150,
      startTime: overlapStart,
      endTime: overlapEnd,
      autoApprove: false,
    });

    // Admin approves Request 1 -> succeeds & notifies Faculty 1
    const approved1 = await FacilityService.reviewBooking(adminSession, req1.id, {
      action: 'approve',
      remarks: 'Approved for AI Symposium.',
    });
    assert.equal(approved1.status, 'approved');
    assert.equal(notificationsStore.length, 1);
    assert.equal(notificationsStore[0]?.userId.toString(), FACULTY_1_ID);
    assert.equal(notificationsStore[0]?.category, 'facility_booking');

    // Admin tries to approve competing overlapping Request 2 -> blocked with HTTP 409 ConflictError
    await assert.rejects(
      () =>
        FacilityService.reviewBooking(adminSession, req2.id, {
          action: 'approve',
          remarks: 'Attempting conflicting approval.',
        }),
      (err: unknown) => err instanceof ConflictError && err.statusCode === 409
    );

    // Adjacent back-to-back booking [T+2h, T+4h] succeeds cleanly
    const adjacent = await FacilityService.createBooking(faculty2Session, {
      facilityId: auditoriumId.toString(),
      title: 'Evening Seminar',
      purpose: 'Post-symposium industry interaction session.',
      expectedAttendees: 100,
      startTime: adjacentStart,
      endTime: adjacentEnd,
      autoApprove: false,
    });
    const approvedAdjacent = await FacilityService.reviewBooking(adminSession, adjacent.id, {
      action: 'approve',
      remarks: 'Adjacent slot confirmed without conflict.',
    });
    assert.equal(approvedAdjacent.status, 'approved');
  });

  it('Workflow 3: Skill Passport -> Faculty Endorsement -> Public Recruiter Privacy + Audit + Notification', async () => {
    let claimSeq = 1;
    StudentAchievementRepository.getNextClaimCode = async () =>
      `SKL-2026-${String(claimSeq++).padStart(4, '0')}`;
    StudentAchievementRepository.create = async (data) => {
      const now = new Date();
      const doc = {
        _id: new Types.ObjectId(),
        ...data,
        createdAt: now,
        updatedAt: now,
      } as unknown as IStudentAchievement;
      achievementsStore.push(doc);
      return doc;
    };
    StudentAchievementRepository.findById = async (id) => {
      return achievementsStore.find((a) => a._id.toString() === id.toString()) ?? null;
    };
    StudentAchievementRepository.updateClaim = async (id, updates) => {
      const target = achievementsStore.find((a) => a._id.toString() === id.toString());
      if (!target) return null;
      Object.assign(target, updates, { updatedAt: new Date() });
      return target;
    };
    StudentAchievementRepository.findByStudent = async (studentId, filter = {}) => {
      const list = achievementsStore.filter((a) => {
        if (a.studentId.toString() !== studentId.toString()) return false;
        if (filter.verificationStatus && a.verificationStatus !== filter.verificationStatus) {
          return false;
        }
        return true;
      });
      return { achievements: list, total: list.length };
    };

    PassportShareRepository.upsertByStudentId = async (studentId, updates) => {
      let existing = sharesStore.find((s) => s.studentId.toString() === studentId.toString());
      if (!existing) {
        existing = {
          _id: new Types.ObjectId(),
          studentId: new Types.ObjectId(studentId.toString()),
          shareToken: 'tok_recruiter_safe_123456',
          isEnabled: updates.isEnabled ?? false,
          headline: updates.headline ?? null,
          viewsCount: 0,
          lastViewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as IPassportShare;
        sharesStore.push(existing);
      } else {
        if (updates.isEnabled !== undefined) existing.isEnabled = updates.isEnabled;
        if (updates.headline !== undefined) existing.headline = updates.headline;
      }
      return existing;
    };
    PassportShareRepository.findByShareToken = async (token) => {
      return sharesStore.find((s) => s.shareToken === token) ?? null;
    };
    PassportShareRepository.incrementViewCount = async (token) => {
      const target = sharesStore.find((s) => s.shareToken === token && s.isEnabled);
      if (target) target.viewCount = (target.viewCount ?? 0) + 1;
      return target ?? null;
    };

    // Step 1: Student enables public share link and submits a claim
    const share = await PassportService.updateShareSettings(studentSession, {
      isEnabled: true,
      headline: 'Full-Stack Distributed Systems Engineer',
    });
    const claim = await PassportService.submitAchievement(studentSession, {
      category: 'hackathon_competition',
      title: 'Smart India Hackathon National Finalist',
      issuingOrganization: 'AICTE & Ministry of Education',
      issueDate: '2026-02-15',
      description: 'Built an offline-resilient campus safety telemetry platform in 36 hours.',
      skills: ['TypeScript', 'Next.js', 'MongoDB'],
      credentialUrl: 'https://sih.gov.in/certificates/2026-finalist-042',
    });
    assert.equal(claim.verificationStatus, 'pending');

    // Step 2: Public link hides pending claim
    const publicBefore = await PassportService.getPublicPassportByToken(share.shareToken);
    assert.equal(publicBefore.achievements.length, 0);

    // Step 3: Faculty endorses claim -> SHA-256 hash stamped + Audit + Notification
    const verified = await PassportService.verifyOrRejectAchievement(faculty1Session, claim.id, {
      decision: 'verify',
      remarks: 'Verified original AICTE finalist certificate.',
    });
    assert.equal(verified.verificationStatus, 'verified');
    assert.ok(verified.verificationHash && verified.verificationHash.length === 64);
    assert.equal(auditStore.length, 1);
    assert.equal(notificationsStore.length, 1);
    assert.equal(notificationsStore[0]?.category, 'passport');

    // Step 4: Verified claim now appears on public portfolio WITHOUT private email/phone
    const publicAfter = await PassportService.getPublicPassportByToken(share.shareToken);
    assert.equal(publicAfter.achievements.length, 1);
    assert.equal(publicAfter.achievements[0]?.verificationHash, verified.verificationHash);
    const serialized = JSON.stringify(publicAfter);
    assert.ok(!serialized.includes('aarav.verma@axiscolleges.in'));
    assert.ok(!serialized.includes('+91-9876543210'));
  });

  it('Workflow 4: IAM Governance -> Immutable SHA-256 Hash-Chain Verification & Tamper Detection', async () => {
    // Super Admin promotes Faculty 1 to Department Admin (HOD)
    const result = await IamGovernanceService.changeUserRole(superAdminSession, FACULTY_1_ID, {
      role: 'admin',
      adminSubRole: 'hod',
      department: 'CSE',
      reason: 'Appointed Head of Department for Computer Science & Engineering.',
    });

    assert.equal(result.user.role, 'admin');
    assert.equal(auditStore.length, 1);
    assert.equal(auditStore[0]?.action, 'ROLE_CHANGED');

    // Chain integrity verifies cleanly
    const validCheck = await AuditService.verifyHashChain(superAdminSession);
    assert.equal(validCheck.valid, true);
    assert.equal(validCheck.checkedCount, 1);

    // Simulate unauthorized database tampering of an audit record
    auditStore[0]!.reason = 'Tampered justification string';
    auditStore[0]!.newState = { role: 'super_admin' };

    const tamperedCheck = await AuditService.verifyHashChain(superAdminSession);
    assert.equal(tamperedCheck.valid, false);
    assert.equal(tamperedCheck.brokenAtEventId, auditStore[0]?.eventId);
  });

  it('Workflow 5: Emergency Trigger -> Critical Audit Log -> Idempotent Acknowledgment -> Deactivation', async () => {
    let alertSeq = 1;
    EmergencyAlertRepository.findActiveAlert = async () => {
      return alertsStore.find((a) => a.isActive) ?? null;
    };
    EmergencyAlertRepository.getNextAlertCode = async () =>
      `EMG-2026-${String(alertSeq++).padStart(4, '0')}`;
    EmergencyAlertRepository.create = async (data) => {
      const now = new Date();
      const doc = {
        _id: new Types.ObjectId(),
        ...data,
        createdAt: now,
        updatedAt: now,
      } as unknown as IEmergencyAlert;
      alertsStore.push(doc);
      return doc;
    };
    EmergencyAlertRepository.findById = async (id) => {
      return alertsStore.find((a) => a._id.toString() === id.toString()) ?? null;
    };
    EmergencyAlertRepository.deactivate = async (
      id,
      deactivatedBy,
      deactivatedBySnapshot,
      deactivationNotes
    ) => {
      const target = alertsStore.find((a) => a._id.toString() === id.toString());
      if (!target) return null;
      target.isActive = false;
      target.deactivatedBy = new Types.ObjectId(deactivatedBy.toString());
      target.deactivatedBySnapshot = deactivatedBySnapshot;
      target.deactivatedAt = new Date();
      target.deactivationNotes = deactivationNotes;
      return target;
    };
    EmergencyAlertRepository.incrementAcknowledgmentCount = async (id) => {
      const target = alertsStore.find((a) => a._id.toString() === id.toString());
      if (!target) return null;
      target.acknowledgmentCount += 1;
      return target;
    };

    EmergencyAcknowledgmentRepository.findByAlertAndUser = async (alertId, userId) => {
      return (
        acksStore.find(
          (a) =>
            a.alertId.toString() === alertId.toString() &&
            a.userId.toString() === userId.toString()
        ) ?? null
      );
    };
    EmergencyAcknowledgmentRepository.recordAcknowledgment = async (input) => {
      const existing = acksStore.find(
        (a) =>
          a.alertId.toString() === input.alertId.toString() &&
          a.userId.toString() === input.userId.toString()
      );
      if (existing) {
        return { record: existing, created: false };
      }
      const doc = {
        _id: new Types.ObjectId(),
        alertId: new Types.ObjectId(input.alertId.toString()),
        userId: new Types.ObjectId(input.userId.toString()),
        userSnapshot: input.userSnapshot,
        acknowledgedAt: new Date(),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as IEmergencyAcknowledgment;
      acksStore.push(doc);
      return { record: doc, created: true };
    };

    // Step 1: Super Admin triggers RED alert with dual-confirmation phrase
    const triggered = await EmergencyService.triggerAlert(superAdminSession, {
      title: 'Severe Thunderstorm Campus Closure',
      message: 'All classes suspended immediately; shelter inside Academic Blocks A & B.',
      severity: 'red',
      category: 'weather',
      affectedScope: 'all_campus',
      instructions: ['Move away from glass corridors', 'Await official all-clear signal'],
      confirmationPhrase: 'CONFIRM EMERGENCY',
    });
    assert.equal(triggered.isActive, true);
    assert.equal(auditStore.length, 1);
    assert.equal(auditStore[0]?.action, 'EMERGENCY_TRIGGERED');
    assert.equal(auditStore[0]?.severity, 'critical');

    // Step 2: Student acknowledges twice -> remains strictly idempotent (count stays 1)
    const ack1 = await EmergencyService.acknowledgeAlert(studentSession, triggered.id);
    const ack2 = await EmergencyService.acknowledgeAlert(studentSession, triggered.id);
    assert.equal(ack1.alreadyAcknowledged, false);
    assert.equal(ack2.alreadyAcknowledged, true);
    assert.equal(alertsStore[0]?.acknowledgmentCount, 1);

    // Step 3: Super Admin deactivates -> writes EMERGENCY_DEACTIVATED audit entry
    const deactivated = await EmergencyService.deactivateAlert(superAdminSession, triggered.id, {
      deactivationNotes: 'Weather advisory lifted by Kanpur district administration.',
    });
    assert.equal(deactivated.isActive, false);
    assert.equal(auditStore.length, 2);
    assert.equal(auditStore[1]?.action, 'EMERGENCY_DEACTIVATED');

    // Hash chain across both critical emergency audit events verifies intact
    const chainCheck = await AuditService.verifyHashChain(superAdminSession);
    assert.equal(chainCheck.valid, true);
    assert.equal(chainCheck.checkedCount, 2);
  });
});
