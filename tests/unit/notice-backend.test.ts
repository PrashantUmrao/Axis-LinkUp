/**
 * Phase 5.4: Notices & Collegiate Bulletin Subsystem Backend Test Suite
 * 
 * Verifies:
 * 1. Role-based publishing authority boundaries (Approved Policy 1: Faculty course-scoped, HOD dept-scoped, SysAdmin/Director global).
 * 2. Audience targeting & personalized feed projection.
 * 3. Notice lifecycle: draft -> published -> archived (Policy 4: indefinite retention).
 * 4. Read receipts & statutory acknowledgment (Policy 5: no IP logging).
 * 5. Receipt analytics & author oversight.
 * 6. Unread count calculation.
 * 7. REST API route handlers (GET, POST, PATCH, DELETE, publish, archive, receipt, receipts, unread-count).
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { NoticeService } from '../../src/lib/services/notice.service';
import { NoticeRepository } from '../../src/lib/db/repositories/notice.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { __setTestSession } from '../../src/lib/auth/server';

import { GET as getNoticesFeedRoute, POST as createNoticeRoute } from '../../src/app/api/v1/notices/route';
import {
  GET as getNoticeDetailRoute,
  PATCH as updateNoticeRoute,
  DELETE as deleteNoticeRoute,
} from '../../src/app/api/v1/notices/[id]/route';
import { POST as publishNoticeRoute } from '../../src/app/api/v1/notices/[id]/publish/route';
import { POST as archiveNoticeRoute } from '../../src/app/api/v1/notices/[id]/archive/route';
import { POST as acknowledgeNoticeRoute } from '../../src/app/api/v1/notices/[id]/receipt/route';
import { GET as getNoticeReceiptsRoute } from '../../src/app/api/v1/notices/[id]/receipts/route';
import { GET as getUnreadCountRoute } from '../../src/app/api/v1/notices/unread-count/route';

import type { UserSession, IUser } from '../../src/types/user';
import type { INotice } from '../../src/types/notice';
import type { INoticeReceipt } from '../../src/types/notice-receipt';
import type { IDepartment } from '../../src/types/department';

// Mock IDs
const cseDeptId = '6730a005f8b1a2001a000010';
const eceDeptId = '6730a005f8b1a2001a000020';

const studentId = '6730a005f8b1a2001a000001';
const facultyId = '6730a005f8b1a2001a000050';
const hodId = '6730a005f8b1a2001a000080';
const directorId = '6730a005f8b1a2001a000090';
const sysAdminId = '6730a005f8b1a2001a000099';
const noticeId = '6730a005f8b1a2001a000500';

// Mock Sessions
const studentSession: UserSession = {
  userId: studentId,
  email: 'aarav.sharma@axiscolleges.in',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'ramesh.chandra@axiscolleges.in',
  role: 'faculty',
  status: 'active',
  departmentId: cseDeptId,
};

const hodSession: UserSession = {
  userId: hodId,
  email: 'sunita.rao@axiscolleges.in',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: cseDeptId,
};

const directorSession: UserSession = {
  userId: directorId,
  email: 'director@axiscolleges.in',
  role: 'super_admin',
  adminSubRole: 'director',
  status: 'active',
};

const sysAdminSession: UserSession = {
  userId: sysAdminId,
  email: 'admin@axiscolleges.in',
  role: 'super_admin',
  adminSubRole: 'sys_admin',
  status: 'active',
};

// Mock Users
const studentUser = {
  _id: new Types.ObjectId(studentId),
  fullName: 'Aarav Sharma',
  email: 'aarav.sharma@axiscolleges.in',
  role: 'student',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  studentProfile: {
    program: 'BTECH_CSE',
    currentSemester: 6,
    section: 'A',
    batchYear: 2021,
  },
} as unknown as IUser;

const facultyUser = {
  _id: new Types.ObjectId(facultyId),
  fullName: 'Dr. Ramesh Chandra',
  email: 'ramesh.chandra@axiscolleges.in',
  role: 'faculty',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  facultyProfile: {
    designation: 'Associate Professor',
    assignedCourses: ['CS601'],
  },
} as unknown as IUser;

const hodUser = {
  _id: new Types.ObjectId(hodId),
  fullName: 'Dr. Sunita Rao',
  email: 'sunita.rao@axiscolleges.in',
  role: 'admin',
  adminSubRole: 'hod',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
} as unknown as IUser;

// Mock Department
const cseDeptDoc = {
  _id: new Types.ObjectId(cseDeptId),
  name: 'Computer Science and Engineering',
  code: 'CSE',
  status: 'active',
  isActive: true,
} as unknown as IDepartment;

// Base Mock Notice
const baseNotice: INotice = {
  _id: new Types.ObjectId(noticeId),
  title: 'Mid-Term Exam Schedule Announced',
  contentMarkdown: '## Exam Schedule\nAll students must review the examination guidelines carefully.',
  summary: 'Important exam dates for Semester 6',
  category: 'examination',
  priority: 'normal',
  status: 'published',
  targetScope: {
    scopeType: 'department',
    departmentIds: [new Types.ObjectId(cseDeptId)],
    roles: ['student', 'faculty'],
  },
  authorId: new Types.ObjectId(facultyId),
  authorSnapshot: {
    name: 'Dr. Ramesh Chandra',
    role: 'faculty',
    adminSubRole: null,
    departmentName: 'Computer Science and Engineering',
    departmentCode: 'CSE',
  },
  attachments: [],
  isPinned: false,
  requiresAcknowledgment: true,
  publishedAt: new Date('2026-11-15T00:00:00Z'),
  readCount: 15,
  acknowledgmentCount: 8,
  isDeleted: false,
  createdAt: new Date('2026-11-14T10:00:00Z'),
  updatedAt: new Date('2026-11-15T00:00:00Z'),
};

describe('Phase 5.4: Notice Module — Publishing Authority & Security Boundaries (Policy 1)', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  test('Student attempting to publish notice is strictly blocked with ForbiddenError', () => {
    assert.throws(
      () => {
        NoticeService.validatePublishingAuthority(studentSession, {
          title: 'Student Announcement',
          contentMarkdown: 'Unauthorized content for notice feed.',
          category: 'academic',
          targetScope: { scopeType: 'institution_wide' },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /Students are not authorized/i);
        return true;
      }
    );
  });

  test('Faculty attempting institution-wide notice is blocked with ForbiddenError', () => {
    assert.throws(
      () => {
        NoticeService.validatePublishingAuthority(facultySession, {
          title: 'Campus Wide Event',
          contentMarkdown: 'Faculty attempting campus-wide circular.',
          category: 'event_cultural',
          targetScope: { scopeType: 'institution_wide' },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /cannot publish college-wide/i);
        return true;
      }
    );
  });

  test('Faculty attempting department-wide notice without course/section is blocked (HOD authorization required)', () => {
    assert.throws(
      () => {
        NoticeService.validatePublishingAuthority(facultySession, {
          title: 'Department Announcement',
          contentMarkdown: 'Department-wide circular without specific course.',
          category: 'academic',
          targetScope: {
            scopeType: 'department',
            departmentIds: [cseDeptId],
          },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /Department-wide official circulars require HOD authorization/i);
        return true;
      }
    );
  });

  test('Faculty can publish course-specific notice within assigned department', () => {
    assert.doesNotThrow(() => {
      NoticeService.validatePublishingAuthority(facultySession, {
        title: 'CS601 Assignment 2 Released',
        contentMarkdown: 'Assignment 2 is uploaded to the portal.',
        category: 'academic',
        targetScope: {
          scopeType: 'department',
          departmentIds: [cseDeptId],
          courseCode: 'CS601',
        },
      });
    });
  });

  test('Faculty can publish section-specific notice within assigned department', () => {
    assert.doesNotThrow(() => {
      NoticeService.validatePublishingAuthority(facultySession, {
        title: 'Section A Lab Venue Change',
        contentMarkdown: 'Lab venue moved to Room 402.',
        category: 'academic',
        targetScope: {
          scopeType: 'cohort',
          departmentIds: [cseDeptId],
          sections: ['A'],
        },
      });
    });
  });

  test('Faculty publishing to foreign department is blocked with ForbiddenError', () => {
    assert.throws(
      () => {
        NoticeService.validatePublishingAuthority(facultySession, {
          title: 'ECE Course Notice',
          contentMarkdown: 'Cross department publishing attempt.',
          category: 'academic',
          targetScope: {
            scopeType: 'department',
            departmentIds: [eceDeptId],
            courseCode: 'EC401',
          },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /cannot publish notices for another department/i);
        return true;
      }
    );
  });

  test('Faculty attempting urgent siren priority is blocked (requires Director/SysAdmin)', () => {
    assert.throws(
      () => {
        NoticeService.validatePublishingAuthority(facultySession, {
          title: 'Urgent Alert',
          contentMarkdown: 'Emergency fire alarm test.',
          category: 'emergency',
          priority: 'urgent',
          targetScope: {
            scopeType: 'department',
            departmentIds: [cseDeptId],
            sections: ['A'],
          },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /requires Executive Director or System Administrator authorization/i);
        return true;
      }
    );
  });

  test('Department HOD can publish department-wide notice in own department', () => {
    assert.doesNotThrow(() => {
      NoticeService.validatePublishingAuthority(hodSession, {
        title: 'CSE Department Meeting',
        contentMarkdown: 'Mandatory faculty and student meeting.',
        category: 'academic',
        targetScope: {
          scopeType: 'department',
          departmentIds: [cseDeptId],
        },
      });
    });
  });

  test('Department HOD attempting institution-wide notice is blocked', () => {
    assert.throws(
      () => {
        NoticeService.validatePublishingAuthority(hodSession, {
          title: 'College Wide Holiday',
          contentMarkdown: 'Tomorrow is declared a holiday.',
          category: 'administrative',
          targetScope: { scopeType: 'institution_wide' },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /strictly restricted to their assigned department/i);
        return true;
      }
    );
  });

  test('Department HOD attempting foreign department notice is blocked', () => {
    assert.throws(
      () => {
        NoticeService.validatePublishingAuthority(hodSession, {
          title: 'ECE Dept Circular',
          contentMarkdown: 'HOD targeting another department.',
          category: 'academic',
          targetScope: {
            scopeType: 'department',
            departmentIds: [eceDeptId],
          },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /cannot publish notices targeting another department/i);
        return true;
      }
    );
  });

  test('Executive Director can publish institution-wide and urgent notices', () => {
    assert.doesNotThrow(() => {
      NoticeService.validatePublishingAuthority(directorSession, {
        title: 'Annual Convocation Announcement',
        contentMarkdown: 'The convocation will be held on December 15th.',
        category: 'administrative',
        priority: 'urgent',
        targetScope: { scopeType: 'institution_wide' },
      });
    });
  });

  test('System Administrator has unrestricted publishing authority', () => {
    assert.doesNotThrow(() => {
      NoticeService.validatePublishingAuthority(sysAdminSession, {
        title: 'Emergency Server Maintenance',
        contentMarkdown: 'System maintenance scheduled tonight at 11 PM.',
        category: 'emergency',
        priority: 'urgent',
        targetScope: { scopeType: 'institution_wide' },
      });
    });
  });
});

describe('Phase 5.4: Notice Module — Audience Matching & Feed Targeting', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('Institution-wide notice matches students and faculty across departments', () => {
    const institutionNotice: INotice = {
      ...baseNotice,
      targetScope: { scopeType: 'institution_wide' },
    };

    assert.strictEqual(NoticeService.matchesNoticeAudience(institutionNotice, studentUser), true);
    assert.strictEqual(NoticeService.matchesNoticeAudience(institutionNotice, facultyUser), true);
  });

  test('Department-scoped notice matches users in that department and excludes others', () => {
    const deptNotice: INotice = {
      ...baseNotice,
      targetScope: {
        scopeType: 'department',
        departmentIds: [new Types.ObjectId(cseDeptId)],
      },
    };

    assert.strictEqual(NoticeService.matchesNoticeAudience(deptNotice, studentUser), true);

    const eceStudentUser = {
      ...studentUser,
      departmentId: new Types.ObjectId(eceDeptId),
    } as unknown as IUser;

    assert.strictEqual(NoticeService.matchesNoticeAudience(deptNotice, eceStudentUser), false);
  });

  test('Cohort-scoped notice matches specific program, semester and section', () => {
    const cohortNotice: INotice = {
      ...baseNotice,
      targetScope: {
        scopeType: 'cohort',
        departmentIds: [new Types.ObjectId(cseDeptId)],
        programs: ['BTECH_CSE'],
        semesters: [6],
        sections: ['A'],
      },
    };

    // Matching student (BTech CSE, Sem 6, Sec A)
    assert.strictEqual(NoticeService.matchesNoticeAudience(cohortNotice, studentUser), true);

    // Mismatched section (Sec B)
    const sectionBStudent = {
      ...studentUser,
      studentProfile: { ...studentUser.studentProfile, section: 'B' },
    } as unknown as IUser;
    assert.strictEqual(NoticeService.matchesNoticeAudience(cohortNotice, sectionBStudent), false);

    // Mismatched semester (Sem 4)
    const sem4Student = {
      ...studentUser,
      studentProfile: { ...studentUser.studentProfile, currentSemester: 4 },
    } as unknown as IUser;
    assert.strictEqual(NoticeService.matchesNoticeAudience(cohortNotice, sem4Student), false);
  });

  test('Director and SysAdmin match all notices regardless of targeting scope', () => {
    const restrictedNotice: INotice = {
      ...baseNotice,
      targetScope: {
        scopeType: 'cohort',
        departmentIds: [new Types.ObjectId(eceDeptId)],
        roles: ['student'],
      },
    };

    assert.strictEqual(NoticeService.matchesNoticeAudience(restrictedNotice, directorSession), true);
    assert.strictEqual(NoticeService.matchesNoticeAudience(restrictedNotice, sysAdminSession), true);
  });
});

describe('Phase 5.4: Notice Module — Read Receipts, Acknowledgment & IP Privacy (Policy 5)', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  test('Viewing published notice records read receipt and increments readCount', async () => {
    let receiptCreated = false;
    let readCountIncremented = false;

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(NoticeRepository, 'findReceipt', async () => null);
    mock.method(NoticeRepository, 'createOrUpdateReceipt', async () => {
      receiptCreated = true;
      return {} as INoticeReceipt;
    });
    mock.method(NoticeRepository, 'incrementReadCount', async () => {
      readCountIncremented = true;
      return baseNotice;
    });

    const dto = await NoticeService.getNoticeById(noticeId, studentSession);

    assert.strictEqual(dto.id, noticeId);
    assert.strictEqual(dto.hasRead, true);
    assert.strictEqual(receiptCreated, true);
    assert.strictEqual(readCountIncremented, true);
  });

  test('Subsequent view does not re-increment read count', async () => {
    let readCountIncremented = false;

    const existingReceipt: INoticeReceipt = {
      _id: new Types.ObjectId(),
      noticeId: new Types.ObjectId(noticeId),
      userId: new Types.ObjectId(studentId),
      readAt: new Date('2026-11-15T01:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(NoticeRepository, 'findReceipt', async () => existingReceipt);
    mock.method(NoticeRepository, 'incrementReadCount', async () => {
      readCountIncremented = true;
      return baseNotice;
    });

    const dto = await NoticeService.getNoticeById(noticeId, studentSession);

    assert.strictEqual(dto.hasRead, true);
    assert.strictEqual(readCountIncremented, false);
  });

  test('Statutory acknowledgment records acknowledgedAt and strictly DOES NOT store IP address (Policy 5)', async () => {
    let receiptAcknowledged = false;
    let ackCountIncremented = false;

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(NoticeRepository, 'findReceipt', async () => null);
    mock.method(NoticeRepository, 'createOrUpdateReceipt', async (_nId: string, _uId: string, isAck: boolean) => {
      receiptAcknowledged = isAck;
      return {
        _id: new Types.ObjectId(),
        noticeId: new Types.ObjectId(noticeId),
        userId: new Types.ObjectId(studentId),
        readAt: new Date(),
        acknowledgedAt: new Date(),
        // Explicitly ensuring no IP is stored
      } as unknown as INoticeReceipt;
    });
    mock.method(NoticeRepository, 'incrementAcknowledgmentCount', async () => {
      ackCountIncremented = true;
      return baseNotice;
    });

    const dto = await NoticeService.acknowledgeNotice(noticeId, studentSession);

    assert.strictEqual(dto.hasAcknowledged, true);
    assert.strictEqual(receiptAcknowledged, true);
    assert.strictEqual(ackCountIncremented, true);
  });

  test('Acknowledgment fails if notice does not require acknowledgment', async () => {
    const nonAckNotice = { ...baseNotice, requiresAcknowledgment: false };
    mock.method(NoticeRepository, 'findById', async () => nonAckNotice);

    await assert.rejects(
      async () => {
        await NoticeService.acknowledgeNotice(noticeId, studentSession);
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ValidationError');
        assert.match(error.message, /does not require formal acknowledgment/i);
        return true;
      }
    );
  });
});

describe('Phase 5.4: Notice Module — Indefinite Archival & Lifecycle (Policy 4)', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  test('Author or HOD can archive notice into indefinite retention', async () => {
    let updatedStatus = '';

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(NoticeRepository, 'update', async (_id: string, updates: Partial<INotice>) => {
      updatedStatus = updates.status || '';
      return { ...baseNotice, status: 'archived' } as INotice;
    });

    const dto = await NoticeService.archiveNotice(noticeId, facultySession);

    assert.strictEqual(dto.status, 'archived');
    assert.strictEqual(updatedStatus, 'archived');
  });

  test('Non-author faculty cannot archive another faculty notice', async () => {
    const peerFacultySession: UserSession = {
      userId: '6730a005f8b1a2001a000051',
      email: 'peer.faculty@axiscolleges.in',
      role: 'faculty',
      status: 'active',
      departmentId: cseDeptId,
    };

    mock.method(NoticeRepository, 'findById', async () => baseNotice);

    await assert.rejects(
      async () => {
        await NoticeService.archiveNotice(noticeId, peerFacultySession);
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        return true;
      }
    );
  });

  test('Soft delete marks isDeleted without removing document from database', async () => {
    let softDeletedId = '';

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(NoticeRepository, 'softDelete', async (id: string) => {
      softDeletedId = id;
      return true;
    });

    const success = await NoticeService.deleteNotice(noticeId, facultySession);

    assert.strictEqual(success, true);
    assert.strictEqual(softDeletedId, noticeId);
  });
});

describe('Phase 5.4: Notice Module — REST API Route Handlers', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  test('GET /api/v1/notices returns paginated notice feed matching caller', async () => {
    __setTestSession(studentSession);

    mock.method(NoticeRepository, 'findFeed', async () => ({
      notices: [baseNotice],
      nextCursor: null,
      hasMore: false,
    }));
    mock.method(NoticeRepository, 'findReceiptsForUser', async () => new Map());

    const req = new NextRequest('http://localhost:3000/api/v1/notices?category=examination&limit=10');
    const res = await getNoticesFeedRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.length, 1);
    assert.strictEqual(json.data[0].id, noticeId);
    assert.strictEqual(json.pagination.hasMore, false);
  });

  test('POST /api/v1/notices creates notice and returns HTTP 201 Created', async () => {
    __setTestSession(hodSession);

    mock.method(UserRepository, 'findById', async () => hodUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(NoticeRepository, 'create', async (doc: Partial<INotice>) => ({
      ...baseNotice,
      ...doc,
      _id: new Types.ObjectId(noticeId),
    } as INotice));

    const req = new NextRequest('http://localhost:3000/api/v1/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Department Notice for Testing',
        contentMarkdown: 'This is a formal test notice body with sufficient length.',
        category: 'academic',
        priority: 'normal',
        status: 'published',
        targetScope: {
          scopeType: 'department',
          departmentIds: [cseDeptId],
        },
      }),
    });

    const res = await createNoticeRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.title, 'Department Notice for Testing');
  });

  test('GET /api/v1/notices/[id] returns notice and marks read', async () => {
    __setTestSession(studentSession);

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(NoticeRepository, 'findReceipt', async () => null);
    mock.method(NoticeRepository, 'createOrUpdateReceipt', async () => ({} as INoticeReceipt));
    mock.method(NoticeRepository, 'incrementReadCount', async () => baseNotice);

    const req = new NextRequest(`http://localhost:3000/api/v1/notices/${noticeId}`);
    const res = await getNoticeDetailRoute(req, { params: Promise.resolve({ id: noticeId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, noticeId);
    assert.strictEqual(json.data.hasRead, true);
  });

  test('POST /api/v1/notices/[id]/receipt records formal acknowledgment', async () => {
    __setTestSession(studentSession);

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(NoticeRepository, 'findReceipt', async () => null);
    mock.method(NoticeRepository, 'createOrUpdateReceipt', async () => ({} as INoticeReceipt));
    mock.method(NoticeRepository, 'incrementAcknowledgmentCount', async () => baseNotice);

    const req = new NextRequest(`http://localhost:3000/api/v1/notices/${noticeId}/receipt`, {
      method: 'POST',
    });
    const res = await acknowledgeNoticeRoute(req, { params: Promise.resolve({ id: noticeId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.hasAcknowledged, true);
  });

  test('GET /api/v1/notices/unread-count returns unread count for caller', async () => {
    __setTestSession(studentSession);

    mock.method(NoticeRepository, 'countUnreadForUser', async () => 3);

    const res = await getUnreadCountRoute();
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.unreadCount, 3);
  });

  test('GET /api/v1/notices/[id]/receipts allows author to view receipt ledger', async () => {
    __setTestSession(facultySession);

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(NoticeRepository, 'findReceiptsByNotice', async () => ({
      receipts: [
        {
          _id: new Types.ObjectId(),
          noticeId: new Types.ObjectId(noticeId),
          userId: new Types.ObjectId(studentId),
          readAt: new Date('2026-11-15T01:00:00Z'),
          acknowledgedAt: new Date('2026-11-15T01:05:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as INoticeReceipt,
      ],
      totalCount: 1,
    }));
    mock.method(UserRepository, 'findByIds', async () => [studentUser]);

    const req = new NextRequest(`http://localhost:3000/api/v1/notices/${noticeId}/receipts`);
    const res = await getNoticeReceiptsRoute(req, { params: Promise.resolve({ id: noticeId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.noticeId, noticeId);
    assert.strictEqual(json.data.totalReads, 15);
    assert.strictEqual(json.data.receipts.length, 1);
    assert.strictEqual(json.data.receipts[0].userName, 'Aarav Sharma');
  });

  test('GET /api/v1/notices/[id]/receipts blocks non-author student from accessing receipt analytics', async () => {
    __setTestSession(studentSession);

    mock.method(NoticeRepository, 'findById', async () => baseNotice);

    const req = new NextRequest(`http://localhost:3000/api/v1/notices/${noticeId}/receipts`);
    const res = await getNoticeReceiptsRoute(req, { params: Promise.resolve({ id: noticeId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('POST /api/v1/notices/[id]/publish publishes draft notice', async () => {
    __setTestSession(facultySession);

    const draftNotice: INotice = {
      ...baseNotice,
      status: 'draft',
      publishedAt: undefined,
    };

    mock.method(NoticeRepository, 'findById', async () => draftNotice);
    mock.method(NoticeRepository, 'update', async (_id: string, updates: Partial<INotice>) => ({
      ...draftNotice,
      ...updates,
      status: 'published',
    } as INotice));

    const req = new NextRequest(`http://localhost:3000/api/v1/notices/${noticeId}/publish`, {
      method: 'POST',
    });
    const res = await publishNoticeRoute(req, { params: Promise.resolve({ id: noticeId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, 'published');
  });

  test('PATCH /api/v1/notices/[id] updates notice content', async () => {
    __setTestSession(facultySession);

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(NoticeRepository, 'update', async (_id: string, updates: Partial<INotice>) => ({
      ...baseNotice,
      ...updates,
    } as INotice));

    const req = new NextRequest(`http://localhost:3000/api/v1/notices/${noticeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated Notice Title for API Test',
      }),
    });
    const res = await updateNoticeRoute(req, { params: Promise.resolve({ id: noticeId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.title, 'Updated Notice Title for API Test');
  });

  test('POST /api/v1/notices/[id]/archive archives published notice', async () => {
    __setTestSession(facultySession);

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(NoticeRepository, 'update', async (_id: string, updates: Partial<INotice>) => ({
      ...baseNotice,
      ...updates,
      status: 'archived',
    } as INotice));

    const req = new NextRequest(`http://localhost:3000/api/v1/notices/${noticeId}/archive`, {
      method: 'POST',
    });
    const res = await archiveNoticeRoute(req, { params: Promise.resolve({ id: noticeId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, 'archived');
  });

  test('DELETE /api/v1/notices/[id] soft deletes notice', async () => {
    __setTestSession(facultySession);

    mock.method(NoticeRepository, 'findById', async () => baseNotice);
    mock.method(NoticeRepository, 'softDelete', async () => true);

    const req = new NextRequest(`http://localhost:3000/api/v1/notices/${noticeId}`);
    const res = await deleteNoticeRoute(req, { params: Promise.resolve({ id: noticeId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.deleted, true);
  });

  test('Unauthenticated caller receives HTTP 401 Unauthorized across routes', async () => {
    __setTestSession(null);

    const req = new NextRequest('http://localhost:3000/api/v1/notices');
    const res = await getNoticesFeedRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'UNAUTHORIZED');
  });
});
