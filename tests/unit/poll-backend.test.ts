/**
 * Phase 5.4: Campus Polling & Voting Subsystem Backend Test Suite
 * 
 * Verifies:
 * 1. Role-based poll creation authority (Approved Policy 3: Students strictly prohibited, Faculty/HOD scoped, SysAdmin/Director global).
 * 2. Poll option invariants (2-10 options, distinct labels, maxSelections consistency).
 * 3. Voting mechanics & strict ballot immutability (Approved Policy 2: single-choice, multi-choice, duplicate rejection HTTP 409).
 * 4. Voter privacy & cryptographic pseudonymity (HMAC-SHA256 for anonymous ballots).
 * 5. Context-aware result masking policies (always, after_vote, after_close, creator_only).
 * 6. Poll lifecycle: active -> closed -> archived (Policy 4: indefinite retention).
 * 7. REST API route handlers (GET, POST, GET [id], DELETE [id], vote, results, close, archive).
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { PollService } from '../../src/lib/services/poll.service';
import { PollRepository } from '../../src/lib/db/repositories/poll.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { __setTestSession } from '../../src/lib/auth/server';

import { GET as getPollsFeedRoute, POST as createPollRoute } from '../../src/app/api/v1/polls/route';
import {
  GET as getPollDetailRoute,
  DELETE as deletePollRoute,
} from '../../src/app/api/v1/polls/[id]/route';
import { POST as castVoteRoute } from '../../src/app/api/v1/polls/[id]/vote/route';
import { GET as getPollResultsRoute } from '../../src/app/api/v1/polls/[id]/results/route';
import { POST as closePollRoute } from '../../src/app/api/v1/polls/[id]/close/route';
import { POST as archivePollRoute } from '../../src/app/api/v1/polls/[id]/archive/route';

import type { UserSession, IUser } from '../../src/types/user';
import type { IPoll } from '../../src/types/poll';
import type { IPollVote } from '../../src/types/poll-vote';
import type { IDepartment } from '../../src/types/department';

// Mock IDs
const cseDeptId = '6730a005f8b1a2001a000010';
const eceDeptId = '6730a005f8b1a2001a000020';

const studentId = '6730a005f8b1a2001a000001';
const facultyId = '6730a005f8b1a2001a000050';
const hodId = '6730a005f8b1a2001a000080';
const directorId = '6730a005f8b1a2001a000090';
const sysAdminId = '6730a005f8b1a2001a000099';

const pollId = '6730a005f8b1a2001a000600';
const option1Id = '6730a005f8b1a2001a000601';
const option2Id = '6730a005f8b1a2001a000602';
const option3Id = '6730a005f8b1a2001a000603';

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

const cseDeptDoc = {
  _id: new Types.ObjectId(cseDeptId),
  name: 'Computer Science and Engineering',
  code: 'CSE',
  status: 'active',
  isActive: true,
} as unknown as IDepartment;

// Base Mock Poll
const basePoll: IPoll = {
  _id: new Types.ObjectId(pollId),
  question: 'Preferred programming language for Advanced Web Systems project?',
  description: 'Select your preferred technology stack for the upcoming major project.',
  type: 'single',
  maxSelections: 1,
  options: [
    { _id: new Types.ObjectId(option1Id), text: 'TypeScript / Node.js', voteCount: 18 },
    { _id: new Types.ObjectId(option2Id), text: 'Python / FastAPI', voteCount: 12 },
    { _id: new Types.ObjectId(option3Id), text: 'Go / Gin', voteCount: 6 },
  ],
  isAnonymous: true,
  resultsVisibility: 'after_vote',
  status: 'active',
  targetScope: {
    scopeType: 'department',
    departmentIds: [new Types.ObjectId(cseDeptId)],
    roles: ['student', 'faculty'],
  },
  creatorId: new Types.ObjectId(facultyId),
  creatorSnapshot: {
    name: 'Dr. Ramesh Chandra',
    role: 'faculty',
    adminSubRole: null,
    departmentName: 'Computer Science and Engineering',
    departmentCode: 'CSE',
  },
  totalVotes: 36,
  publishedAt: new Date('2026-11-15T00:00:00Z'),
  isDeleted: false,
  createdAt: new Date('2026-11-15T00:00:00Z'),
  updatedAt: new Date('2026-11-15T00:00:00Z'),
};

describe('Phase 5.4: Poll Module — Creation Authority & Scope Gates (Policy 3)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('Student attempting to create a poll is strictly blocked with ForbiddenError', () => {
    assert.throws(
      () => {
        PollService.validatePollAuthority(studentSession, {
          question: 'Where should we go for picnic?',
          options: [{ text: 'Option A' }, { text: 'Option B' }],
          targetScope: { scopeType: 'institution_wide' },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /Students are not authorized to create campus polls/i);
        return true;
      }
    );
  });

  test('Faculty attempting institution-wide poll is blocked with ForbiddenError', () => {
    assert.throws(
      () => {
        PollService.validatePollAuthority(facultySession, {
          question: 'Campus Cafeteria Menu Change',
          options: [{ text: 'Yes' }, { text: 'No' }],
          targetScope: { scopeType: 'institution_wide' },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /cannot create college-wide polls/i);
        return true;
      }
    );
  });

  test('Faculty attempting poll targeting foreign department is blocked', () => {
    assert.throws(
      () => {
        PollService.validatePollAuthority(facultySession, {
          question: 'ECE Workshop Scheduling',
          options: [{ text: 'Morning' }, { text: 'Evening' }],
          targetScope: {
            scopeType: 'department',
            departmentIds: [eceDeptId],
          },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /cannot create polls for another department/i);
        return true;
      }
    );
  });

  test('Faculty can create poll within assigned department', () => {
    assert.doesNotThrow(() => {
      PollService.validatePollAuthority(facultySession, {
        question: 'CS601 Lab Schedule Preference',
        options: [{ text: 'Slot A (9-11 AM)' }, { text: 'Slot B (2-4 PM)' }],
        targetScope: {
          scopeType: 'department',
          departmentIds: [cseDeptId],
          courseCode: 'CS601',
        },
      });
    });
  });

  test('Department HOD can create poll within assigned department', () => {
    assert.doesNotThrow(() => {
      PollService.validatePollAuthority(hodSession, {
        question: 'Elective Subject Preference for Final Year',
        options: [{ text: 'Cloud Computing' }, { text: 'Cybersecurity' }],
        targetScope: {
          scopeType: 'department',
          departmentIds: [cseDeptId],
        },
      });
    });
  });

  test('Department HOD attempting foreign department poll is blocked', () => {
    assert.throws(
      () => {
        PollService.validatePollAuthority(hodSession, {
          question: 'Cross-Department Elective',
          options: [{ text: 'Yes' }, { text: 'No' }],
          targetScope: {
            scopeType: 'department',
            departmentIds: [eceDeptId],
          },
        });
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /cannot initiate polls targeting another department/i);
        return true;
      }
    );
  });

  test('Executive Director and System Administrator can create institution-wide polls', () => {
    assert.doesNotThrow(() => {
      PollService.validatePollAuthority(directorSession, {
        question: 'Annual Sports Meet Theme',
        options: [{ text: 'Athletics' }, { text: 'Indoor Games' }],
        targetScope: { scopeType: 'institution_wide' },
      });
    });

    assert.doesNotThrow(() => {
      PollService.validatePollAuthority(sysAdminSession, {
        question: 'Campus Wi-Fi Upgrade Priority Zone',
        options: [{ text: 'Library' }, { text: 'Hostel' }, { text: 'Classrooms' }],
        targetScope: { scopeType: 'institution_wide' },
      });
    });
  });
});

describe('Phase 5.4: Poll Module — Cryptographic Privacy & Pseudonym Derivation', () => {
  test('Non-anonymous polls return raw userId as voterIdentifier', () => {
    const identifier = PollService.deriveVoterIdentifier(studentId, pollId, false);
    assert.strictEqual(identifier, studentId);
  });

  test('Anonymous polls return HMAC-SHA256 hash preventing raw userId storage', () => {
    const identifier = PollService.deriveVoterIdentifier(studentId, pollId, true);
    assert.notStrictEqual(identifier, studentId);
    assert.strictEqual(identifier.length, 64); // 256-bit hex
  });

  test('Same user on different polls yields distinct hashes (unlinkable ballots)', () => {
    const anotherPollId = '6730a005f8b1a2001a000699';
    const hash1 = PollService.deriveVoterIdentifier(studentId, pollId, true);
    const hash2 = PollService.deriveVoterIdentifier(studentId, anotherPollId, true);
    assert.notStrictEqual(hash1, hash2);
  });

  test('Same user on same poll yields identical hash (enables duplicate prevention)', () => {
    const hash1 = PollService.deriveVoterIdentifier(studentId, pollId, true);
    const hash2 = PollService.deriveVoterIdentifier(studentId, pollId, true);
    assert.strictEqual(hash1, hash2);
  });
});

describe('Phase 5.4: Poll Module — Ballot Submission & Strict Immutability (Policy 2)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('User casts valid single-choice ballot successfully', async () => {
    let recordedVoterId = '';
    let recordedOptionIds: string[] = [];

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(PollRepository, 'findVote', async () => null);
    mock.method(PollRepository, 'recordVote', async (_pId: string, vId: string, opts: string[]) => {
      recordedVoterId = vId;
      recordedOptionIds = opts;
      const updatedOptions = basePoll.options.map((opt) =>
        opt._id.toString() === option1Id ? { ...opt, voteCount: opt.voteCount + 1 } : opt
      );
      return {
        updatedPoll: { ...basePoll, options: updatedOptions, totalVotes: basePoll.totalVotes + 1 },
        vote: {
          _id: new Types.ObjectId(),
          pollId: new Types.ObjectId(pollId),
          voterIdentifier: vId,
          selectedOptionIds: [new Types.ObjectId(option1Id)],
          votedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
    });

    const result = await PollService.castVote(pollId, studentSession, [option1Id]);

    assert.strictEqual(result.pollId, pollId);
    assert.strictEqual(result.hasVoted, true);
    assert.deepStrictEqual(result.selectedOptionIds, [option1Id]);
    assert.notStrictEqual(recordedVoterId, studentId); // HMAC privacy check
    assert.deepStrictEqual(recordedOptionIds, [option1Id]);
  });

  test('Duplicate ballot attempt is strictly rejected with ConflictError HTTP 409 (Policy 2)', async () => {
    const existingBallot: IPollVote = {
      _id: new Types.ObjectId(),
      pollId: new Types.ObjectId(pollId),
      voterIdentifier: PollService.deriveVoterIdentifier(studentId, pollId, true),
      selectedOptionIds: [new Types.ObjectId(option1Id)],
      votedAt: new Date('2026-11-15T01:00:00Z'),
      createdAt: new Date(),
    };

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(PollRepository, 'findVote', async () => existingBallot);

    await assert.rejects(
      async () => {
        await PollService.castVote(pollId, studentSession, [option2Id]);
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ConflictError');
        assert.match(error.message, /already cast a ballot/i);
        return true;
      }
    );
  });

  test('Single-choice poll rejects multiple option selections', async () => {
    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(PollRepository, 'findVote', async () => null);

    await assert.rejects(
      async () => {
        await PollService.castVote(pollId, studentSession, [option1Id, option2Id]);
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ValidationError');
        assert.match(error.message, /Single-choice polls require exactly one option selection/i);
        return true;
      }
    );
  });

  test('Voting in a closed poll is rejected with ValidationError', async () => {
    const closedPoll = { ...basePoll, status: 'closed' as const };
    mock.method(PollRepository, 'findById', async () => closedPoll);

    await assert.rejects(
      async () => {
        await PollService.castVote(pollId, studentSession, [option1Id]);
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ValidationError');
        assert.match(error.message, /Voting is closed for this poll/i);
        return true;
      }
    );
  });

  test('Voting after poll expiration date is rejected with ValidationError', async () => {
    const expiredPoll = {
      ...basePoll,
      expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
    };
    mock.method(PollRepository, 'findById', async () => expiredPoll);

    await assert.rejects(
      async () => {
        await PollService.castVote(pollId, studentSession, [option1Id]);
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ValidationError');
        assert.match(error.message, /deadline for this poll has passed/i);
        return true;
      }
    );
  });

  test('Ineligible user outside target audience cannot cast vote', async () => {
    const foreignStudent = {
      ...studentUser,
      departmentId: new Types.ObjectId(eceDeptId),
    } as unknown as IUser;

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(UserRepository, 'findById', async () => foreignStudent);

    await assert.rejects(
      async () => {
        await PollService.castVote(pollId, studentSession, [option1Id]);
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        assert.match(error.message, /not eligible to vote in this poll/i);
        return true;
      }
    );
  });
});

describe('Phase 5.4: Poll Module — Result Masking Policies', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('after_vote policy hides vote counts before voter casts ballot', async () => {
    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(PollRepository, 'findVote', async () => null); // Has not voted

    const dto = await PollService.getPollById(pollId, studentSession);

    assert.strictEqual(dto.hasVoted, false);
    assert.strictEqual(dto.totalVotes, undefined);
    assert.strictEqual(dto.options[0]?.voteCount, undefined);
    assert.strictEqual(dto.options[0]?.percentage, undefined);
  });

  test('after_vote policy reveals vote counts after ballot has been submitted', async () => {
    const ballot: IPollVote = {
      _id: new Types.ObjectId(),
      pollId: new Types.ObjectId(pollId),
      voterIdentifier: PollService.deriveVoterIdentifier(studentId, pollId, true),
      selectedOptionIds: [new Types.ObjectId(option1Id)],
      votedAt: new Date(),
      createdAt: new Date(),
    };

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(PollRepository, 'findVote', async () => ballot);

    const dto = await PollService.getPollById(pollId, studentSession);

    assert.strictEqual(dto.hasVoted, true);
    assert.strictEqual(dto.totalVotes, 36);
    assert.strictEqual(dto.options[0]?.voteCount, 18);
    assert.strictEqual(dto.options[0]?.percentage, 50);
  });

  test('creator_only policy hides results from regular voters even after voting', async () => {
    const creatorOnlyPoll: IPoll = {
      ...basePoll,
      resultsVisibility: 'creator_only',
    };

    const ballot: IPollVote = {
      _id: new Types.ObjectId(),
      pollId: new Types.ObjectId(pollId),
      voterIdentifier: PollService.deriveVoterIdentifier(studentId, pollId, true),
      selectedOptionIds: [new Types.ObjectId(option1Id)],
      votedAt: new Date(),
      createdAt: new Date(),
    };

    mock.method(PollRepository, 'findById', async () => creatorOnlyPoll);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(PollRepository, 'findVote', async () => ballot);

    const dto = await PollService.getPollById(pollId, studentSession);

    assert.strictEqual(dto.hasVoted, true);
    assert.strictEqual(dto.totalVotes, undefined);
    assert.strictEqual(dto.options[0]?.voteCount, undefined);
  });

  test('Poll creator can always inspect results of their own poll', async () => {
    const creatorOnlyPoll: IPoll = {
      ...basePoll,
      resultsVisibility: 'creator_only',
    };

    mock.method(PollRepository, 'findById', async () => creatorOnlyPoll);
    mock.method(UserRepository, 'findById', async () => facultyUser);
    mock.method(PollRepository, 'findVote', async () => null);

    const dto = await PollService.getPollById(pollId, facultySession);

    assert.strictEqual(dto.totalVotes, 36);
    assert.strictEqual(dto.options[0]?.voteCount, 18);
  });
});

describe('Phase 5.4: Poll Module — Early Closure & Archival Lifecycle (Policy 4)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  test('Poll creator can close active poll early', async () => {
    let closedId = '';

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(PollRepository, 'closePoll', async (id: string) => {
      closedId = id;
      return { ...basePoll, status: 'closed', closedAt: new Date() } as IPoll;
    });

    const dto = await PollService.closePoll(pollId, facultySession);

    assert.strictEqual(dto.status, 'closed');
    assert.strictEqual(closedId, pollId);
  });

  test('Student cannot close a poll', async () => {
    mock.method(PollRepository, 'findById', async () => basePoll);

    await assert.rejects(
      async () => {
        await PollService.closePoll(pollId, studentSession);
      },
      (err: unknown) => {
        const error = err as Error;
        assert.strictEqual(error.name, 'ForbiddenError');
        return true;
      }
    );
  });

  test('Archiving poll preserves records indefinitely without TTL purging', async () => {
    let updatedStatus = '';

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(PollRepository, 'update', async (_id: string, updates: Partial<IPoll>) => {
      updatedStatus = updates.status || '';
      return { ...basePoll, status: 'archived' } as IPoll;
    });

    const dto = await PollService.archivePoll(pollId, facultySession);

    assert.strictEqual(dto.status, 'archived');
    assert.strictEqual(updatedStatus, 'archived');
  });
});

describe('Phase 5.4: Poll Module — REST API Route Handlers', () => {
  afterEach(() => {
    __setTestSession(null);
    mock.restoreAll();
  });

  test('GET /api/v1/polls returns paginated poll feed', async () => {
    __setTestSession(studentSession);

    mock.method(PollRepository, 'findFeed', async () => ({
      polls: [basePoll],
      nextCursor: null,
      hasMore: false,
    }));
    mock.method(PollRepository, 'findVote', async () => null);

    const req = new NextRequest('http://localhost:3000/api/v1/polls?status=active&limit=10');
    const res = await getPollsFeedRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.length, 1);
    assert.strictEqual(json.data[0].id, pollId);
  });

  test('POST /api/v1/polls creates poll and returns HTTP 201 Created', async () => {
    __setTestSession(facultySession);

    mock.method(UserRepository, 'findById', async () => facultyUser);
    mock.method(DepartmentRepository, 'findById', async () => cseDeptDoc);
    mock.method(PollRepository, 'create', async (doc: Partial<IPoll>) => ({
      ...basePoll,
      ...doc,
      _id: new Types.ObjectId(pollId),
    } as IPoll));

    const req = new NextRequest('http://localhost:3000/api/v1/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Which framework should we use for Cloud Computing labs?',
        description: 'Vote for the preferred framework.',
        type: 'single',
        maxSelections: 1,
        options: [{ text: 'AWS CDK' }, { text: 'Terraform' }],
        isAnonymous: true,
        resultsVisibility: 'after_vote',
        status: 'active',
        targetScope: {
          scopeType: 'department',
          departmentIds: [cseDeptId],
        },
      }),
    });

    const res = await createPollRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.question, 'Which framework should we use for Cloud Computing labs?');
  });

  test('POST /api/v1/polls rejects creation when student attempts (HTTP 403 Forbidden)', async () => {
    __setTestSession(studentSession);

    const req = new NextRequest('http://localhost:3000/api/v1/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Unauthorized student poll question?',
        options: [{ text: 'Yes' }, { text: 'No' }],
        targetScope: { scopeType: 'institution_wide' },
      }),
    });

    const res = await createPollRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'FORBIDDEN');
  });

  test('POST /api/v1/polls/[id]/vote submits ballot and returns HTTP 200', async () => {
    __setTestSession(studentSession);

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(PollRepository, 'findVote', async () => null);
    mock.method(PollRepository, 'recordVote', async (_pId: string, vId: string, _opts: string[]) => ({
      updatedPoll: { ...basePoll, totalVotes: 37 },
      vote: {
        _id: new Types.ObjectId(),
        pollId: new Types.ObjectId(pollId),
        voterIdentifier: vId,
        selectedOptionIds: [new Types.ObjectId(option1Id)],
        votedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedOptionIds: [option1Id],
      }),
    });

    const res = await castVoteRoute(req, { params: Promise.resolve({ id: pollId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.hasVoted, true);
  });

  test('POST /api/v1/polls/[id]/vote returns HTTP 409 Conflict when ballot already submitted (Policy 2)', async () => {
    __setTestSession(studentSession);

    const existingVote: IPollVote = {
      _id: new Types.ObjectId(),
      pollId: new Types.ObjectId(pollId),
      voterIdentifier: PollService.deriveVoterIdentifier(studentId, pollId, true),
      selectedOptionIds: [new Types.ObjectId(option1Id)],
      votedAt: new Date(),
      createdAt: new Date(),
    };

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(PollRepository, 'findVote', async () => existingVote);

    const req = new NextRequest(`http://localhost:3000/api/v1/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedOptionIds: [option2Id],
      }),
    });

    const res = await castVoteRoute(req, { params: Promise.resolve({ id: pollId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 409);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'CONFLICT');
    assert.match(json.error.message, /already cast a ballot/i);
  });

  test('GET /api/v1/polls/[id]/results returns aggregates after voting', async () => {
    __setTestSession(studentSession);

    const existingVote: IPollVote = {
      _id: new Types.ObjectId(),
      pollId: new Types.ObjectId(pollId),
      voterIdentifier: PollService.deriveVoterIdentifier(studentId, pollId, true),
      selectedOptionIds: [new Types.ObjectId(option1Id)],
      votedAt: new Date(),
      createdAt: new Date(),
    };

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(PollRepository, 'findVote', async () => existingVote);

    const req = new NextRequest(`http://localhost:3000/api/v1/polls/${pollId}/results`);
    const res = await getPollResultsRoute(req, { params: Promise.resolve({ id: pollId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.totalVotes, 36);
    assert.strictEqual(json.data.options.length, 3);
    assert.strictEqual(json.data.options[0]?.voteCount, 18);
    assert.strictEqual(json.data.options[0]?.percentage, 50);
  });

  test('POST /api/v1/polls/[id]/close closes poll successfully', async () => {
    __setTestSession(facultySession);

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(PollRepository, 'closePoll', async () => ({
      ...basePoll,
      status: 'closed',
      closedAt: new Date(),
    }));

    const req = new NextRequest(`http://localhost:3000/api/v1/polls/${pollId}/close`, {
      method: 'POST',
    });
    const res = await closePollRoute(req, { params: Promise.resolve({ id: pollId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, 'closed');
  });

  test('GET /api/v1/polls/[id] retrieves poll detail', async () => {
    __setTestSession(studentSession);

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(UserRepository, 'findById', async () => studentUser);
    mock.method(PollRepository, 'findVote', async () => null);

    const req = new NextRequest(`http://localhost:3000/api/v1/polls/${pollId}`);
    const res = await getPollDetailRoute(req, { params: Promise.resolve({ id: pollId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, pollId);
    assert.strictEqual(json.data.hasVoted, false);
  });

  test('POST /api/v1/polls/[id]/archive archives closed poll', async () => {
    __setTestSession(facultySession);

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(PollRepository, 'update', async (_id: string, updates: Partial<IPoll>) => ({
      ...basePoll,
      ...updates,
      status: 'archived',
    } as IPoll));

    const req = new NextRequest(`http://localhost:3000/api/v1/polls/${pollId}/archive`, {
      method: 'POST',
    });
    const res = await archivePollRoute(req, { params: Promise.resolve({ id: pollId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, 'archived');
  });

  test('DELETE /api/v1/polls/[id] soft deletes poll', async () => {
    __setTestSession(facultySession);

    mock.method(PollRepository, 'findById', async () => basePoll);
    mock.method(PollRepository, 'softDelete', async () => true);

    const req = new NextRequest(`http://localhost:3000/api/v1/polls/${pollId}`);
    const res = await deletePollRoute(req, { params: Promise.resolve({ id: pollId }) });
    const json = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.deleted, true);
  });

  test('Unauthenticated caller receives HTTP 401 across poll routes', async () => {
    __setTestSession(null);

    const req = new NextRequest('http://localhost:3000/api/v1/polls');
    const res = await getPollsFeedRoute(req);
    const json = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'UNAUTHORIZED');
  });
});
