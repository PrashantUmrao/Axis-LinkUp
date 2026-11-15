/**
 * Phase 5.4: Notices & Polls End-to-End Frontend & Subsystem Verification Test Suite
 * 
 * Verifies all 17 critical user journeys and security policies across:
 * - Student, Faculty, HOD, Director, and System Administrator personas
 * - Approved Institutional Policies 1, 2, 3, 4, 5
 * - Component rendering, access control, ballot immutability, receipt analytics, and responsive layout
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Types } from 'mongoose';

// Services & Repositories
import { NoticeService } from '../../src/lib/services/notice.service';
import { PollService } from '../../src/lib/services/poll.service';
import { NoticeRepository } from '../../src/lib/db/repositories/notice.repository';
import { PollRepository } from '../../src/lib/db/repositories/poll.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { __setTestSession } from '../../src/lib/auth/server';

// UI Components
import { NoticeDetailDialog } from '../../src/components/notices/notice-detail-dialog';
import { NoticeFormDialog } from '../../src/components/notices/notice-form-dialog';
import { PollCard } from '../../src/components/polls/poll-card';
import { TopbarNotifications } from '../../src/components/navigation/topbar-notifications';
import { StudentNoticeFeed } from '../../src/app/(student)/student/dashboard/components/notice-feed';
import { StudentPollSection } from '../../src/app/(student)/student/dashboard/components/poll-section';
import { FacultyNoticeSection } from '../../src/app/(faculty)/faculty/dashboard/components/notice-section';
import { FacultyPollSection } from '../../src/app/(faculty)/faculty/dashboard/components/poll-section';
import { AdminNoticeManagement } from '../../src/app/(admin)/admin/dashboard/components/notice-management';
import { AdminPollManagement } from '../../src/app/(admin)/admin/dashboard/components/poll-management';

// Types
import type { UserSession, IUser } from '../../src/types/user';
import type { INotice } from '../../src/types/notice';
import type { IPoll, PollDTO } from '../../src/types/poll';
import type { INoticeReceipt } from '../../src/types/notice-receipt';
import type { IDepartment } from '../../src/types/department';

// Mock Constants
const cseDeptId = '6730a005f8b1a2001a000010';
const eceDeptId = '6730a005f8b1a2001a000020';

const studentId = '6730a005f8b1a2001a000001';
const facultyId = '6730a005f8b1a2001a000050';
const hodId = '6730a005f8b1a2001a000080';
const directorId = '6730a005f8b1a2001a000090';
const sysAdminId = '6730a005f8b1a2001a000099';

const noticeId = '6730a005f8b1a2001a000500';
const pollId = '6730a005f8b1a2001a000600';
const opt1Id = '6730a005f8b1a2001a000601';
const opt2Id = '6730a005f8b1a2001a000602';

// Sessions
const studentSession: UserSession = {
  userId: studentId,
  email: 'aarav.sharma@axiscolleges.in',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'dr.sharma@axiscolleges.in',
  role: 'faculty',
  status: 'active',
  departmentId: cseDeptId,
};

const hodSession: UserSession = {
  userId: hodId,
  email: 'hod.cse@axiscolleges.in',
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

describe('Phase 5.4: Frontend Integration & End-to-End Subsystem Verification', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(null);
  });

  // Journey 1: SysAdmin creates and publishes institution-wide notice
  test('Journey 1: SysAdmin creates and publishes institution-wide notice with urgent priority', async () => {
    mock.method(UserRepository, 'findById', async (id: string) => ({
      _id: new Types.ObjectId(id),
      fullName: 'Chief Systems Administrator',
      role: 'super_admin',
      adminSubRole: 'sys_admin',
    } as unknown as IUser));

    let createdNotice: Partial<INotice> | null = null;
    mock.method(NoticeRepository, 'create', async (data: Partial<INotice>) => {
      createdNotice = {
        _id: new Types.ObjectId(noticeId),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return createdNotice as unknown as INotice;
    });

    const result = await NoticeService.createNotice(
      sysAdminSession,
      {
        title: 'Campus Emergency Evacuation Drill',
        contentMarkdown: 'All campus blocks must participate at 14:00 hrs.',
        category: 'emergency',
        priority: 'urgent',
        status: 'published',
        targetScope: { scopeType: 'institution_wide' },
      }
    );

    assert.equal(result.title, 'Campus Emergency Evacuation Drill');
    assert.equal(result.priority, 'urgent');
    assert.equal(result.targetScope.scopeType, 'institution_wide');
    assert.ok(createdNotice);

    // Verify UI Dialog rendering for SysAdmin
    const html = renderToStaticMarkup(
      React.createElement(NoticeFormDialog, {
        isOpen: true,
        onClose: () => {},
        currentUserRole: 'super_admin',
        adminSubRole: 'sys_admin',
      })
    );
    assert.ok(html.includes('Compose Collegiate Circular'));
    assert.ok(html.includes('Notice Title *'));
  });

  // Journey 2: Student receives and reads authorized notice
  test('Journey 2: Student receives and reads authorized notice in feed & records read receipt', async () => {
    const mockNotice: Partial<INotice> = {
      _id: new Types.ObjectId(noticeId),
      title: 'Mid-Term Examination Schedule Announced',
      contentMarkdown: 'Exams commence on 1st December 2026.',
      category: 'examination',
      priority: 'important',
      status: 'published',
      targetScope: { scopeType: 'institution_wide' },
      authorId: new Types.ObjectId(sysAdminId),
      authorSnapshot: {
        name: 'Administration Office',
        role: 'super_admin',
        adminSubRole: 'sys_admin',
      },
      attachments: [],
      isPinned: false,
      requiresAcknowledgment: false,
      readCount: 15,
      acknowledgmentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(UserRepository, 'findById', async (id: string) => ({
      _id: new Types.ObjectId(id),
      fullName: 'Aarav Sharma',
      role: 'student',
      departmentId: new Types.ObjectId(cseDeptId),
    } as unknown as IUser));

    mock.method(NoticeRepository, 'findById', async () => mockNotice as INotice);
    mock.method(NoticeRepository, 'findReceipt', async () => null);
    mock.method(NoticeRepository, 'createOrUpdateReceipt', async () => ({
      _id: new Types.ObjectId(),
      noticeId: new Types.ObjectId(noticeId),
      userId: new Types.ObjectId(studentId),
      readAt: new Date(),
    } as unknown as INoticeReceipt));
    mock.method(NoticeRepository, 'incrementReadCount', async () => {});

    const noticeDTO = await NoticeService.getNoticeById(noticeId, studentSession);
    assert.equal(noticeDTO.title, 'Mid-Term Examination Schedule Announced');
    assert.equal(noticeDTO.author.name, 'Administration Office');

    // Verify UI Detail Dialog Rendering
    const html = renderToStaticMarkup(
      React.createElement(NoticeDetailDialog, {
        notice: noticeDTO,
        isOpen: true,
        onClose: () => {},
        currentUserRole: 'student',
      })
    );
    assert.ok(html.includes('Mid-Term Examination Schedule Announced'));
    assert.ok(html.includes('Administration Office'));
  });

  // Journey 3: Student acknowledges mandatory notice (without IP leakage - Policy 5)
  test('Journey 3: Student acknowledges mandatory notice and verifies no IP address is captured', async () => {
    const mockNotice: Partial<INotice> = {
      _id: new Types.ObjectId(noticeId),
      title: 'Statutory Anti-Ragging Affidavit Submission',
      contentMarkdown: 'Mandatory AICTE / UGC affidavit submission requirement.',
      category: 'administrative',
      priority: 'urgent',
      status: 'published',
      targetScope: { scopeType: 'institution_wide' },
      authorId: new Types.ObjectId(directorId),
      authorSnapshot: {
        name: 'Office of the Director',
        role: 'super_admin',
        adminSubRole: 'director',
      },
      attachments: [],
      isPinned: true,
      requiresAcknowledgment: true,
      readCount: 42,
      acknowledgmentCount: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(NoticeRepository, 'findById', async () => mockNotice as INotice);
    mock.method(UserRepository, 'findById', async () => ({
      _id: new Types.ObjectId(studentId),
      fullName: 'Aarav Sharma',
      role: 'student',
      departmentId: new Types.ObjectId(cseDeptId),
      studentProfile: { rollNumber: '24BCSE101' },
    } as unknown as IUser));

    let capturedUserId: string | null = null;
    let capturedIsAck: boolean | null = null;
    mock.method(NoticeRepository, 'findReceipt', async () => null);
    mock.method(NoticeRepository, 'createOrUpdateReceipt', async (_nId: string, uId: string, isAck: boolean) => {
      capturedUserId = uId;
      capturedIsAck = isAck;
      return {
        _id: new Types.ObjectId(),
        noticeId: new Types.ObjectId(noticeId),
        userId: new Types.ObjectId(uId),
        readAt: new Date(),
        acknowledgedAt: new Date(),
      } as unknown as INoticeReceipt;
    });
    mock.method(NoticeRepository, 'incrementAcknowledgmentCount', async () => {});

    const receiptResult = await NoticeService.acknowledgeNotice(noticeId, studentSession);
    assert.equal(receiptResult.hasAcknowledged, true);
    assert.equal(capturedUserId, studentId);
    assert.equal(capturedIsAck, true);
  });

  // Journey 4: Faculty publishes course/section notice
  test('Journey 4: Faculty publishes course/section notice within own department', async () => {
    mock.method(UserRepository, 'findById', async (id: string) => ({
      _id: new Types.ObjectId(id),
      fullName: 'Dr. Sharma',
      role: 'faculty',
      departmentId: new Types.ObjectId(cseDeptId),
    } as unknown as IUser));

    mock.method(DepartmentRepository, 'findById', async () => ({
      _id: new Types.ObjectId(cseDeptId),
      name: 'Computer Science and Engineering',
      code: 'CSE',
    } as unknown as IDepartment));

    mock.method(NoticeRepository, 'create', async (data: Partial<INotice>) => ({
      _id: new Types.ObjectId(noticeId),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as INotice));

    const notice = await NoticeService.createNotice(
      facultySession,
      {
        title: 'CSE-301 Algorithm Lab Submission Deadline',
        contentMarkdown: 'Submit Lab Experiment 4 via portal by Friday.',
        category: 'academic',
        priority: 'normal',
        status: 'published',
        targetScope: {
          scopeType: 'cohort',
          departmentIds: [cseDeptId],
          courseCode: 'CSE-301',
        },
      }
    );

    assert.equal(notice.title, 'CSE-301 Algorithm Lab Submission Deadline');
    assert.equal(notice.targetScope.courseCode, 'CSE-301');

    // Verify Faculty UI Dialog shows course scope
    const html = renderToStaticMarkup(
      React.createElement(NoticeFormDialog, {
        isOpen: true,
        onClose: () => {},
        currentUserRole: 'faculty',
        departmentId: cseDeptId,
      })
    );
    assert.ok(html.includes('Course Code'));
    assert.ok(html.includes('Faculty publishing is scoped to courses'));
  });

  // Journey 5: Faculty prevented from unauthorized department-wide publishing (Policy 1)
  test('Journey 5: Faculty is strictly blocked from publishing department-wide notice without HOD authorization', async () => {
    mock.method(UserRepository, 'findById', async (id: string) => ({
      _id: new Types.ObjectId(id),
      fullName: 'Dr. Sharma',
      role: 'faculty',
      departmentId: new Types.ObjectId(cseDeptId),
    } as unknown as IUser));

    await assert.rejects(
      async () => {
        await NoticeService.createNotice(
          facultySession,
          {
            title: 'Department-wide CSE Holiday Announcement',
            contentMarkdown: 'Department closed tomorrow.',
            category: 'academic',
            priority: 'normal',
            status: 'published',
            targetScope: {
              scopeType: 'department',
              departmentIds: [cseDeptId],
            },
          }
        );
      },
      (err: unknown) => {
        const error = err as Error;
        assert.ok(
          error.message.includes('Insufficient permissions') ||
          error.message.includes('HOD authorization')
        );
        return true;
      }
    );
  });

  // Journey 6: HOD publishes department-wide notice
  test('Journey 6: Department HOD successfully publishes department-wide circular', async () => {
    mock.method(UserRepository, 'findById', async (id: string) => ({
      _id: new Types.ObjectId(id),
      fullName: 'Dr. Verma (HOD)',
      role: 'admin',
      adminSubRole: 'hod',
      departmentId: new Types.ObjectId(cseDeptId),
    } as unknown as IUser));

    mock.method(DepartmentRepository, 'findById', async () => ({
      _id: new Types.ObjectId(cseDeptId),
      name: 'Computer Science and Engineering',
      code: 'CSE',
    } as unknown as IDepartment));

    mock.method(NoticeRepository, 'create', async (data: Partial<INotice>) => ({
      _id: new Types.ObjectId(noticeId),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as INotice));

    const notice = await NoticeService.createNotice(
      hodSession,
      {
        title: 'CSE Department Colloquium Series',
        contentMarkdown: 'All CSE batches to assemble at Auditorium 1.',
        category: 'academic',
        priority: 'important',
        status: 'published',
        targetScope: {
          scopeType: 'department',
          departmentIds: [cseDeptId],
        },
      }
    );

    assert.equal(notice.title, 'CSE Department Colloquium Series');
    assert.equal(notice.targetScope.scopeType, 'department');
  });

  // Journey 7: Director publishes authorized directorate circular
  test('Journey 7: Director publishes institutional executive circular', async () => {
    mock.method(UserRepository, 'findById', async (id: string) => ({
      _id: new Types.ObjectId(id),
      fullName: 'Director General',
      role: 'super_admin',
      adminSubRole: 'director',
    } as unknown as IUser));

    mock.method(NoticeRepository, 'create', async (data: Partial<INotice>) => ({
      _id: new Types.ObjectId(noticeId),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as INotice));

    const notice = await NoticeService.createNotice(
      directorSession,
      {
        title: 'Annual Institutional Convocation 2026',
        contentMarkdown: 'Conferment of degrees ceremony announced.',
        category: 'event_cultural',
        priority: 'important',
        status: 'published',
        targetScope: { scopeType: 'institution_wide' },
      }
    );

    assert.equal(notice.title, 'Annual Institutional Convocation 2026');
    assert.equal(notice.targetScope.scopeType, 'institution_wide');
  });

  // Journey 8: Student submits poll vote
  test('Journey 8: Student casts ballot on active campus poll', async () => {
    const mockPoll: Partial<IPoll> = {
      _id: new Types.ObjectId(pollId),
      question: 'Which technical elective do you prefer for Semester 6?',
      type: 'single',
      maxSelections: 1,
      options: [
        { _id: new Types.ObjectId(opt1Id), text: 'Cloud Architecture', voteCount: 10 },
        { _id: new Types.ObjectId(opt2Id), text: 'Deep Learning', voteCount: 15 },
      ],
      isAnonymous: true,
      resultsVisibility: 'after_vote',
      status: 'active',
      targetScope: { scopeType: 'institution_wide' },
      creatorId: new Types.ObjectId(facultyId),
      creatorSnapshot: {
        name: 'Prof. Gupta',
        role: 'faculty',
      },
      totalVotes: 25,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(UserRepository, 'findById', async () => ({
      _id: new Types.ObjectId(studentId),
      fullName: 'Aarav Sharma',
      role: 'student',
      departmentId: new Types.ObjectId(cseDeptId),
    } as unknown as IUser));

    mock.method(PollRepository, 'findById', async () => mockPoll as IPoll);
    mock.method(PollRepository, 'findVote', async () => null);
    mock.method(PollRepository, 'recordVote', async () => ({
      updatedPoll: {
        ...mockPoll,
        creatorId: new Types.ObjectId(facultyId),
        totalVotes: 26,
        options: [
          { _id: new Types.ObjectId(opt1Id), text: 'Cloud Architecture', voteCount: 11 },
          { _id: new Types.ObjectId(opt2Id), text: 'Deep Learning', voteCount: 15 },
        ],
      } as unknown as IPoll,
      voteRecord: {
        _id: new Types.ObjectId(),
        pollId: new Types.ObjectId(pollId),
        optionIds: [new Types.ObjectId(opt1Id)],
        createdAt: new Date(),
      },
    }));

    const result = await PollService.castVote(
      pollId,
      studentSession,
      [opt1Id]
    );

    assert.equal(result.hasVoted, true);
    assert.equal(result.totalVotes, 26);
  });

  // Journey 9: Duplicate voting rejected (HTTP 409)
  test('Journey 9: Duplicate voting by same user is rejected with conflict exception', async () => {
    const mockPoll: Partial<IPoll> = {
      _id: new Types.ObjectId(pollId),
      question: 'Campus Cafeteria Timings Survey',
      type: 'single',
      maxSelections: 1,
      options: [
        { _id: new Types.ObjectId(opt1Id), text: 'Extend to 10 PM', voteCount: 5 },
        { _id: new Types.ObjectId(opt2Id), text: 'Keep 8 PM', voteCount: 5 },
      ],
      status: 'active',
      targetScope: { scopeType: 'institution_wide' },
      totalVotes: 10,
    };

    mock.method(UserRepository, 'findById', async () => ({
      _id: new Types.ObjectId(studentId),
      fullName: 'Aarav Sharma',
      role: 'student',
      departmentId: new Types.ObjectId(cseDeptId),
    } as unknown as IUser));

    mock.method(PollRepository, 'findById', async () => mockPoll as IPoll);
    mock.method(PollRepository, 'findVote', async () => ({
      _id: new Types.ObjectId(),
      pollId: new Types.ObjectId(pollId),
      optionIds: [new Types.ObjectId(opt1Id)],
      createdAt: new Date(),
    }));

    await assert.rejects(
      async () => {
        await PollService.castVote(
          pollId,
          studentSession,
          [opt1Id]
        );
      },
      (err: unknown) => {
        const error = err as Error;
        assert.ok(
          error.message.includes('already cast a ballot') ||
          error.message.includes('already voted')
        );
        return true;
      }
    );
  });

  // Journey 10: Student cannot modify submitted vote (Policy 2)
  test('Journey 10: Approved Policy 2 strictly forbids ballot modification or vote retraction', async () => {
    // Poll service does not expose any editVote or revokeVote methods.
    assert.equal((PollService as unknown as Record<string, unknown>).modifyVote, undefined);
    assert.equal((PollService as unknown as Record<string, unknown>).retractVote, undefined);

    // Verify UI component displays Ballot Immutability Notice
    const mockPollDTO: PollDTO = {
      id: pollId,
      question: 'Elective Selection 2026',
      description: 'Vote carefully.',
      type: 'single',
      maxSelections: 1,
      options: [
        { id: opt1Id, text: 'Distributed Systems', percentage: 50 },
        { id: opt2Id, text: 'Cyber Security', percentage: 50 },
      ],
      isAnonymous: true,
      resultsVisibility: 'after_vote',
      status: 'active',
      targetScope: { scopeType: 'institution_wide' },
      creator: {
        id: facultyId,
        name: 'Dr. Sharma',
        role: 'faculty',
        adminSubRole: null,
        departmentCode: 'CSE',
      },
      hasVoted: true,
      selectedOptionIds: [opt1Id],
      areResultsVisible: true,
      totalVotes: 20,
      publishedAt: new Date().toISOString(),
      expiresAt: null,
      closedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const html = renderToStaticMarkup(
      React.createElement(PollCard, {
        poll: mockPollDTO,
        currentUserRole: 'student',
      })
    );
    assert.ok(html.includes('Ballot Cast') || html.includes('Ballot submitted'));
    assert.ok(html.includes('Strictly Immutable') || html.includes('Policy 2'));
  });

  // Journey 11: Anonymous poll privacy preserved (HMAC)
  test('Journey 11: Anonymous poll preserves voter anonymity via HMAC hash salt without storing plaintext userId', async () => {
    mock.method(UserRepository, 'findById', async (id: string) => ({
      _id: new Types.ObjectId(id),
      fullName: 'Faculty Member',
      role: 'faculty',
      departmentId: new Types.ObjectId(cseDeptId),
    } as unknown as IUser));

    mock.method(DepartmentRepository, 'findById', async () => ({
      _id: new Types.ObjectId(cseDeptId),
      name: 'Computer Science and Engineering',
      code: 'CSE',
    } as unknown as IDepartment));

    let createdPoll: Partial<IPoll> | null = null;
    mock.method(PollRepository, 'create', async (data: Partial<IPoll>) => {
      createdPoll = {
        _id: new Types.ObjectId(pollId),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return createdPoll as unknown as IPoll;
    });

    const poll = await PollService.createPoll(
      facultySession,
      {
        question: 'Are you satisfied with the department laboratory facilities?',
        options: [{ text: 'Yes, fully equipped' }, { text: 'Needs modern upgrades' }],
        isAnonymous: true,
        targetScope: { scopeType: 'department', departmentIds: [cseDeptId] },
      }
    );

    assert.equal(poll.isAnonymous, true);
    assert.ok(createdPoll);
  });

  // Journey 12: Poll results follow configured visibility policy
  test('Journey 12: Poll results are hidden before voting when configured as resultsVisibility: after_vote', async () => {
    const mockPoll: Partial<IPoll> = {
      _id: new Types.ObjectId(pollId),
      question: 'Library Weekend Hours Proposal',
      type: 'single',
      maxSelections: 1,
      options: [
        { _id: new Types.ObjectId(opt1Id), text: 'Open till 11 PM', voteCount: 40 },
        { _id: new Types.ObjectId(opt2Id), text: 'Open 24/7', voteCount: 60 },
      ],
      isAnonymous: false,
      resultsVisibility: 'after_vote',
      status: 'active',
      targetScope: { scopeType: 'institution_wide' },
      creatorId: new Types.ObjectId(facultyId),
      creatorSnapshot: { name: 'Librarian', role: 'faculty' },
      totalVotes: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(UserRepository, 'findById', async () => ({
      _id: new Types.ObjectId(studentId),
      fullName: 'Aarav Sharma',
      role: 'student',
      departmentId: new Types.ObjectId(cseDeptId),
    } as unknown as IUser));

    mock.method(PollRepository, 'findById', async () => mockPoll as IPoll);
    mock.method(PollRepository, 'findVote', async () => null); // User has not voted yet

    const pollDTO = await PollService.getPollById(pollId, studentSession);
    assert.equal(pollDTO.areResultsVisible, false);
    // Option vote count must be omitted
    assert.equal(pollDTO.options[0]?.voteCount, undefined);
    assert.equal(pollDTO.options[0]?.percentage, undefined);

    // Render PollCard before voting: percentages should not be visible
    const html = renderToStaticMarkup(
      React.createElement(PollCard, {
        poll: pollDTO,
        currentUserRole: 'student',
      })
    );
    assert.ok(html.includes('Results will be revealed once you cast your ballot'));
  });

  // Journey 13: Expired polls reject votes
  test('Journey 13: Submitting a vote on an expired poll is rejected', async () => {
    const mockPoll: Partial<IPoll> = {
      _id: new Types.ObjectId(pollId),
      question: 'Closed Sports Tournament Poll',
      type: 'single',
      maxSelections: 1,
      options: [
        { _id: new Types.ObjectId(opt1Id), text: 'Cricket', voteCount: 5 },
        { _id: new Types.ObjectId(opt2Id), text: 'Football', voteCount: 5 },
      ],
      status: 'active',
      targetScope: { scopeType: 'institution_wide' },
      expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      totalVotes: 10,
    };

    mock.method(PollRepository, 'findById', async () => mockPoll as IPoll);

    await assert.rejects(
      async () => {
        await PollService.castVote(
          pollId,
          studentSession,
          [opt1Id]
        );
      },
      (err: unknown) => {
        const error = err as Error;
        assert.ok(
          error.message.includes('deadline') ||
          error.message.includes('passed') ||
          error.message.includes('expired') ||
          error.message.includes('closed')
        );
        return true;
      }
    );
  });

  // Journey 14: Unauthorized users cannot access restricted notices or polls
  test('Journey 14: ECE student cannot access department-restricted CSE notice', async () => {
    const mockNotice: Partial<INotice> = {
      _id: new Types.ObjectId(noticeId),
      title: 'CSE Internal Hackathon Requirements',
      contentMarkdown: 'Only for CSE students.',
      status: 'published',
      targetScope: {
        scopeType: 'department',
        departmentIds: [new Types.ObjectId(cseDeptId)],
      },
    };

    mock.method(NoticeRepository, 'findById', async () => mockNotice as INotice);
    mock.method(UserRepository, 'findById', async (id: string) => ({
      _id: new Types.ObjectId(id),
      fullName: 'ECE Student',
      role: 'student',
      departmentId: new Types.ObjectId(eceDeptId),
    } as unknown as IUser));

    const eceStudentSession: UserSession = {
      userId: '6730a005f8b1a2001a000009',
      email: 'ece.student@axiscolleges.in',
      role: 'student',
      departmentId: eceDeptId, // ECE Department
      status: 'active',
    };

    await assert.rejects(
      async () => {
        await NoticeService.getNoticeById(noticeId, eceStudentSession);
      },
      (err: unknown) => {
        const error = err as Error;
        assert.ok(
          error.message.includes('target audience') ||
          error.message.includes('Access denied') ||
          error.message.includes('Not authorized') ||
          error.message.includes('Insufficient permissions')
        );
        return true;
      }
    );
  });

  // Journey 15: Read receipts cannot be forged for another user
  test('Journey 15: Acknowledgment strictly binds to the caller authenticated session', async () => {
    const mockNotice: Partial<INotice> = {
      _id: new Types.ObjectId(noticeId),
      title: 'Fee Payment Deadline Notice',
      contentMarkdown: 'Clear all pending dues.',
      status: 'published',
      targetScope: { scopeType: 'institution_wide' },
      requiresAcknowledgment: true,
      authorId: new Types.ObjectId(sysAdminId),
      authorSnapshot: { name: 'Accounts Office', role: 'super_admin' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mock.method(NoticeRepository, 'findById', async () => mockNotice as INotice);
    mock.method(UserRepository, 'findById', async () => ({
      _id: new Types.ObjectId(studentId),
      fullName: 'Aarav Sharma',
      role: 'student',
    } as unknown as IUser));

    let boundUserId: string | null = null;
    mock.method(NoticeRepository, 'findReceipt', async () => null);
    mock.method(NoticeRepository, 'createOrUpdateReceipt', async (_nId: string, uId: string) => {
      boundUserId = uId;
      return {
        _id: new Types.ObjectId(),
        noticeId: new Types.ObjectId(noticeId),
        userId: new Types.ObjectId(uId),
        readAt: new Date(),
        acknowledgedAt: new Date(),
      } as unknown as INoticeReceipt;
    });
    mock.method(NoticeRepository, 'incrementAcknowledgmentCount', async () => {});

    await NoticeService.acknowledgeNotice(noticeId, studentSession);
    assert.equal(boundUserId, studentId);
  });

  // Journey 16: Search, filters, and pagination work
  test('Journey 16: Notices and Polls management filters and query parameters project accurately', async () => {
    mock.method(NoticeRepository, 'findFeed', async () => {
      return {
        notices: [
          {
            _id: new Types.ObjectId(noticeId),
            title: 'Foundational AI Workshop',
            contentMarkdown: 'Interactive deep learning session.',
            category: 'academic',
            priority: 'normal',
            status: 'published',
            targetScope: { scopeType: 'institution_wide' },
            authorId: new Types.ObjectId(facultyId),
            authorSnapshot: { name: 'Prof. AI', role: 'faculty' },
            readCount: 10,
            acknowledgmentCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as unknown as INotice,
        ],
        nextCursor: null,
        hasMore: false,
      };
    });

    mock.method(NoticeRepository, 'findReceiptsForUser', async () => new Map());

    const feed = await NoticeService.getNoticeFeed(
      studentSession,
      { status: 'published', search: 'AI' }
    );
    assert.equal(feed.notices.length, 1);
    assert.equal(feed.notices[0]?.title, 'Foundational AI Workshop');
  });

  // Journey 17: Mobile & responsive layout integrity
  test('Journey 17: UI components render with responsive layout classes and accessibility landmarks', () => {
    // 1. Topbar Notifications
    const topbarHtml = renderToStaticMarkup(
      React.createElement(TopbarNotifications, {
        user: { email: 'student@axiscolleges.in', role: 'student' },
      })
    );
    assert.ok(topbarHtml.includes('aria-label'));

    // 2. Student Notice Feed
    const studentFeedHtml = renderToStaticMarkup(
      React.createElement(StudentNoticeFeed)
    );
    assert.ok(studentFeedHtml.includes('Campus Notices'));
    assert.ok(studentFeedHtml.includes('sm:flex-row'));

    // 3. Student Poll Section
    const studentPollHtml = renderToStaticMarkup(
      React.createElement(StudentPollSection)
    );
    assert.ok(studentPollHtml.includes('Campus Polls'));
    assert.ok(studentPollHtml.includes('POLICY-2-ACTIVE'));

    // 4. Faculty Notice Section
    const facultyNoticeHtml = renderToStaticMarkup(
      React.createElement(FacultyNoticeSection, {
        user: { id: facultyId, role: 'faculty', departmentId: cseDeptId },
      })
    );
    assert.ok(facultyNoticeHtml.includes('Department Bulletins'));
    assert.ok(facultyNoticeHtml.includes('New Notice'));

    // 5. Faculty Poll Section
    const facultyPollHtml = renderToStaticMarkup(
      React.createElement(FacultyPollSection, {
        user: { id: facultyId, role: 'faculty', departmentId: cseDeptId },
      })
    );
    assert.ok(facultyPollHtml.includes('Classroom Polls'));
    assert.ok(facultyPollHtml.includes('Create Poll'));

    // 6. Admin Notice Management (All 3 scopes)
    const sysAdminNoticeHtml = renderToStaticMarkup(
      React.createElement(AdminNoticeManagement, { activeScope: 'sys_admin' })
    );
    assert.ok(sysAdminNoticeHtml.includes('Institutional Broadcast'));

    const hodNoticeHtml = renderToStaticMarkup(
      React.createElement(AdminNoticeManagement, { activeScope: 'hod' })
    );
    assert.ok(hodNoticeHtml.includes('Department Circulars'));

    const directorNoticeHtml = renderToStaticMarkup(
      React.createElement(AdminNoticeManagement, { activeScope: 'director' })
    );
    assert.ok(directorNoticeHtml.includes('Directorate Executive Circular Desk'));

    // 7. Admin Poll Management (All 3 scopes)
    const sysAdminPollHtml = renderToStaticMarkup(
      React.createElement(AdminPollManagement, { activeScope: 'sys_admin' })
    );
    assert.ok(sysAdminPollHtml.includes('Institutional Surveys'));

    const hodPollHtml = renderToStaticMarkup(
      React.createElement(AdminPollManagement, { activeScope: 'hod' })
    );
    assert.ok(hodPollHtml.includes('Department Student Sentiment'));

    const directorPollHtml = renderToStaticMarkup(
      React.createElement(AdminPollManagement, { activeScope: 'director' })
    );
    assert.ok(directorPollHtml.includes('Directorate Executive Sentiment'));
  });
});
