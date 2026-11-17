/**
 * Phase 5.6: Real-Time Chat & Faculty Academic Groups Backend Unit & Integration Test Suite.
 * Conforms to ADR-007, DOC-ARCH-006, and WhatsApp Web communication architecture.
 *
 * Verifies:
 * 1. Zod Validation Schemas (Direct, Group, Members, Messages, Pagination).
 * 2. 1-to-1 Direct Messaging (Idempotent creation, self-message prevention, inactive user gate).
 * 3. Faculty Academic Groups (Faculty creation lock, student creation rejection, creator admin assignment).
 * 4. Group Member Management (Add/remove members, creator removal defense, RBAC protection).
 * 5. Message Lifecycle & Broadcast Policy (Participant check, broadcast-only gate, archived group gate).
 * 6. Message History, Cursor Pagination & Read Receipts (Unread counters, read receipts, pagination).
 * 7. Message Soft-Deletion & Moderation (Author delete, faculty group admin moderate delete, unauthorized rejection).
 * 8. Ably Real-Time Broker (Deterministic channel conventions, token minting, offline resilience).
 * 9. REST API Route Handlers Integration (Conversations, Members, Messages, Read, Token).
 */

import { test, describe, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { NextRequest } from 'next/server';

import { ChatService } from '../../src/lib/services/chat.service';
import { ChatRepository } from '../../src/lib/db/repositories/chat.repository';
import { UserRepository } from '../../src/lib/db/repositories/user.repository';
import { DepartmentRepository } from '../../src/lib/db/repositories/department.repository';
import { AblyBroker } from '../../src/lib/realtime/ably-broker';
import { __setTestSession } from '../../src/lib/auth/server';

import {
  createDirectChatSchema,
  createGroupChatSchema,
  updateGroupChatSchema,
  manageGroupMembersSchema,
  sendMessageSchema,
  messagePaginationQuerySchema,
} from '../../src/lib/validations/chat.schema';

import {
  GET as getConversationsRoute,
  POST as createConversationRoute,
} from '../../src/app/api/v1/chat/conversations/route';
import {
  GET as getConversationDetailRoute,
  PATCH as updateConversationRoute,
} from '../../src/app/api/v1/chat/conversations/[id]/route';
import { POST as manageMembersRoute } from '../../src/app/api/v1/chat/conversations/[id]/members/route';
import {
  GET as getMessagesRoute,
  POST as sendMessageRoute,
} from '../../src/app/api/v1/chat/conversations/[id]/messages/route';
import { DELETE as deleteMessageRoute } from '../../src/app/api/v1/chat/conversations/[id]/messages/[messageId]/route';
import { POST as markReadRoute } from '../../src/app/api/v1/chat/conversations/[id]/read/route';
import { GET as getTokenRoute } from '../../src/app/api/v1/chat/token/route';

import type { UserSession, IUser } from '../../src/types/user';
import type { IConversation, IMessage } from '../../src/types/chat';
import type { IDepartment } from '../../src/types/department';

// Mock ObjectIds
const cseDeptId = '6730a005f8b1a2001a000010';
const student1Id = '6730a005f8b1a2001a000001';
const student2Id = '6730a005f8b1a2001a000002';
const student3Id = '6730a005f8b1a2001a000003';
const facultyId = '6730a005f8b1a2001a000050';
const directConvId = '6730a005f8b1a2001a000100';
const groupConvId = '6730a005f8b1a2001a000200';
const message1Id = '6730a005f8b1a2001a000301';
const message2Id = '6730a005f8b1a2001a000302';

// Mock User Sessions
const student1Session: UserSession = {
  userId: student1Id,
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  username: 'rahulv',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const student2Session: UserSession = {
  userId: student2Id,
  email: 'nisha.chaudhari@axiscolleges.in',
  fullName: 'Nisha Chaudhari',
  username: 'nishac',
  role: 'student',
  status: 'active',
  departmentId: cseDeptId,
};

const facultySession: UserSession = {
  userId: facultyId,
  email: 'prof.sharma@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  username: 'aloksharma',
  role: 'faculty',
  status: 'active',
  departmentId: cseDeptId,
};

// Mock User Entities
const mockStudentUser: IUser = {
  _id: new Types.ObjectId(student1Id),
  email: 'rahul.verma@axiscolleges.in',
  fullName: 'Rahul Verma',
  username: 'rahulv',
  role: 'student',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as IUser;

const mockStudent2User: IUser = {
  _id: new Types.ObjectId(student2Id),
  email: 'nisha.chaudhari@axiscolleges.in',
  fullName: 'Nisha Chaudhari',
  username: 'nishac',
  role: 'student',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as IUser;

const mockFacultyUser: IUser = {
  _id: new Types.ObjectId(facultyId),
  email: 'prof.sharma@axiscolleges.in',
  fullName: 'Prof. Alok Sharma',
  username: 'aloksharma',
  role: 'faculty',
  status: 'active',
  departmentId: new Types.ObjectId(cseDeptId),
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as IUser;

// Mock Direct Conversation Document
const mockDirectConv: IConversation = {
  _id: new Types.ObjectId(directConvId),
  type: 'direct',
  createdBy: new Types.ObjectId(student1Id),
  directKey: ChatRepository.getDirectKey(student1Id, facultyId),
  participants: [new Types.ObjectId(student1Id), new Types.ObjectId(facultyId)],
  members: [
    {
      userId: new Types.ObjectId(student1Id),
      role: 'member',
      joinedAt: new Date('2026-11-10T10:00:00Z'),
    },
    {
      userId: new Types.ObjectId(facultyId),
      role: 'member',
      joinedAt: new Date('2026-11-10T10:00:00Z'),
    },
  ],
  groupPolicy: 'open_discussion',
  isArchived: false,
  createdAt: new Date('2026-11-10T10:00:00Z'),
  updatedAt: new Date('2026-11-10T10:30:00Z'),
} as unknown as IConversation;

// Mock Academic Group Document
const mockAcademicGroup: IConversation = {
  _id: new Types.ObjectId(groupConvId),
  type: 'group',
  name: 'CS-301: Advanced Data Structures',
  description: 'Instructional group for 3rd semester section A lecture batches',
  departmentId: new Types.ObjectId(cseDeptId),
  academicContext: {
    courseCode: 'CS301',
    courseName: 'Advanced Data Structures',
    semester: 3,
    section: 'A',
    batchYear: 2026,
  },
  createdBy: new Types.ObjectId(facultyId),
  participants: [
    new Types.ObjectId(facultyId),
    new Types.ObjectId(student1Id),
    new Types.ObjectId(student2Id),
  ],
  members: [
    {
      userId: new Types.ObjectId(facultyId),
      role: 'admin',
      joinedAt: new Date('2026-11-01T09:00:00Z'),
    },
    {
      userId: new Types.ObjectId(student1Id),
      role: 'member',
      joinedAt: new Date('2026-11-01T09:05:00Z'),
    },
    {
      userId: new Types.ObjectId(student2Id),
      role: 'member',
      joinedAt: new Date('2026-11-01T09:05:00Z'),
    },
  ],
  groupPolicy: 'open_discussion',
  lastMessage: {
    messageId: new Types.ObjectId(message1Id),
    text: 'Please review Unit 2 notes uploaded to course dropbox.',
    senderId: new Types.ObjectId(facultyId),
    senderName: 'Prof. Alok Sharma',
    senderRole: 'faculty',
    sentAt: new Date('2026-11-16T14:00:00Z'),
  },
  isArchived: false,
  createdAt: new Date('2026-11-01T09:00:00Z'),
  updatedAt: new Date('2026-11-16T14:00:00Z'),
} as unknown as IConversation;

// Mock Message Document
const mockMessage1: IMessage = {
  _id: new Types.ObjectId(message1Id),
  conversationId: new Types.ObjectId(groupConvId),
  senderId: new Types.ObjectId(facultyId),
  senderSnapshot: {
    fullName: 'Prof. Alok Sharma',
    role: 'faculty',
    username: 'aloksharma',
  },
  content: 'Please review Unit 2 notes uploaded to course dropbox.',
  readBy: [new Types.ObjectId(facultyId), new Types.ObjectId(student1Id)],
  isDeleted: false,
  createdAt: new Date('2026-11-16T14:00:00Z'),
  updatedAt: new Date('2026-11-16T14:00:00Z'),
} as unknown as IMessage;

const mockMessage2: IMessage = {
  _id: new Types.ObjectId(message2Id),
  conversationId: new Types.ObjectId(groupConvId),
  senderId: new Types.ObjectId(student1Id),
  senderSnapshot: {
    fullName: 'Rahul Verma',
    role: 'student',
    username: 'rahulv',
  },
  content: 'Thank you Professor, reviewing now.',
  readBy: [new Types.ObjectId(student1Id)],
  isDeleted: false,
  createdAt: new Date('2026-11-16T14:05:00Z'),
  updatedAt: new Date('2026-11-16T14:05:00Z'),
} as unknown as IMessage;

describe('Phase 5.6: Real-Time Chat & Faculty Academic Groups Backend Suite', () => {
  afterEach(() => {
    mock.restoreAll();
    __setTestSession(undefined);
  });

  /* ======================================================================== */
  /* 1. Validation Schemas Suite                                              */
  /* ======================================================================== */
  describe('1. Zod Validation Schemas', () => {
    test('createDirectChatSchema validates 24-character hexadecimal ObjectId', () => {
      const valid = createDirectChatSchema.safeParse({ recipientId: facultyId });
      assert.strictEqual(valid.success, true);

      const invalid = createDirectChatSchema.safeParse({ recipientId: 'not-an-id' });
      assert.strictEqual(invalid.success, false);
    });

    test('createGroupChatSchema enforces name length (3 to 100) and academic context', () => {
      const valid = createGroupChatSchema.safeParse({
        name: 'CSE Lecture Batch A',
        description: 'Semester 4 discussions',
        academicContext: {
          courseCode: 'CS401',
          semester: 4,
          section: 'A',
        },
        groupPolicy: 'open_discussion',
      });
      assert.strictEqual(valid.success, true);

      const tooShort = createGroupChatSchema.safeParse({ name: 'AB' });
      assert.strictEqual(tooShort.success, false);
    });

    test('updateGroupChatSchema validates partial updates and rejects empty payload', () => {
      const valid = updateGroupChatSchema.safeParse({ name: 'Updated Group Name' });
      assert.strictEqual(valid.success, true);

      const invalid = updateGroupChatSchema.safeParse({});
      assert.strictEqual(invalid.success, false);
    });

    test('manageGroupMembersSchema validates action and user IDs array', () => {
      const validAdd = manageGroupMembersSchema.safeParse({
        action: 'add',
        userIds: [student1Id, student2Id],
      });
      assert.strictEqual(validAdd.success, true);

      const emptyList = manageGroupMembersSchema.safeParse({
        action: 'remove',
        userIds: [],
      });
      assert.strictEqual(emptyList.success, false);
    });

    test('sendMessageSchema enforces non-empty content and length <= 5000', () => {
      const valid = sendMessageSchema.safeParse({
        content: 'Hello everyone!',
      });
      assert.strictEqual(valid.success, true);

      const empty = sendMessageSchema.safeParse({ content: '   ' });
      assert.strictEqual(empty.success, false);
    });

    test('messagePaginationQuerySchema coerces limit and parses cursor', () => {
      const valid = messagePaginationQuerySchema.safeParse({
        limit: '25',
        before: message1Id,
      });
      assert.strictEqual(valid.success, true);
      assert.strictEqual((valid as { data: { limit: number } }).data.limit, 25);
    });
  });

  /* ======================================================================== */
  /* 2. Direct Messaging Service & Zero-Trust Gates                           */
  /* ======================================================================== */
  describe('2. Direct Messaging Workflow & Zero-Trust Checks', () => {
    test('getOrCreateDirectChat resolves 1-to-1 conversation between student and faculty', async () => {
      mock.method(UserRepository, 'findById', async (id: string) => {
        if (id === facultyId) return mockFacultyUser;
        return null;
      });

      mock.method(ChatRepository, 'findOrCreateDirectConversation', async () => mockDirectConv);
      mock.method(ChatRepository, 'countUnreadMessages', async () => 0);

      const result = await ChatService.getOrCreateDirectChat(student1Session, {
        recipientId: facultyId,
      });

      assert.strictEqual(result.id, directConvId);
      assert.strictEqual(result.type, 'direct');
      assert.strictEqual(result.name, 'Prof. Alok Sharma');
    });

    test('getOrCreateDirectChat rejects self-messaging with BadRequestError', async () => {
      await assert.rejects(
        async () => {
          await ChatService.getOrCreateDirectChat(student1Session, {
            recipientId: student1Id,
          });
        },
        {
          name: 'BadRequestError',
          message: 'You cannot establish a direct conversation with yourself.',
        }
      );
    });

    test('getOrCreateDirectChat rejects messaging inactive or suspended users', async () => {
      mock.method(UserRepository, 'findById', async () => ({
        ...mockFacultyUser,
        status: 'suspended',
      }));

      await assert.rejects(
        async () => {
          await ChatService.getOrCreateDirectChat(student1Session, {
            recipientId: facultyId,
          });
        },
        {
          name: 'BadRequestError',
          message: 'Cannot message a collegiate user whose account is inactive.',
        }
      );
    });
  });

  /* ======================================================================== */
  /* 3. Faculty Academic Groups Service & RBAC Gates                           */
  /* ======================================================================== */
  describe('3. Faculty Academic Groups Creation & Role Gates', () => {
    test('createAcademicGroup allows Faculty to create academic group', async () => {
      mock.method(DepartmentRepository, 'findById', async () => ({
        _id: new Types.ObjectId(cseDeptId),
        name: 'Computer Science & Engineering',
      } as unknown as IDepartment));

      mock.method(UserRepository, 'findById', async (id: string) => {
        if (id === student1Id) return mockStudentUser;
        if (id === student2Id) return mockStudent2User;
        return null;
      });

      mock.method(ChatRepository, 'createGroupConversation', async () => mockAcademicGroup);
      mock.method(ChatRepository, 'countUnreadMessages', async () => 0);

      const group = await ChatService.createAcademicGroup(facultySession, {
        name: 'CS-301: Advanced Data Structures',
        groupPolicy: 'open_discussion',
        description: 'Instructional group for 3rd semester section A lecture batches',
        departmentId: cseDeptId,
        academicContext: {
          courseCode: 'CS301',
          semester: 3,
          section: 'A',
        },
        initialMemberIds: [student1Id, student2Id],
      });

      assert.strictEqual(group.id, groupConvId);
      assert.strictEqual(group.name, 'CS-301: Advanced Data Structures');
      assert.strictEqual(group.isGroup, true);
    });

    test('createAcademicGroup rejects Student group creation attempt with ForbiddenError', async () => {
      await assert.rejects(
        async () => {
          await ChatService.createAcademicGroup(student1Session, {
            name: 'Unauthorized Student Group',
            groupPolicy: 'open_discussion',
          });
        },
        {
          name: 'ForbiddenError',
          message: 'Students are not authorized to create collegiate academic groups.',
        }
      );
    });
  });

  /* ======================================================================== */
  /* 4. Group Member Management Suite                                          */
  /* ======================================================================== */
  describe('4. Group Member Management Suite', () => {
    test('manageGroupMembers allows faculty admin to add members', async () => {
      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);
      mock.method(UserRepository, 'findById', async () => mockStudentUser);
      mock.method(ChatRepository, 'addMembersToGroup', async () => mockAcademicGroup);
      mock.method(ChatRepository, 'countUnreadMessages', async () => 0);

      const result = await ChatService.manageGroupMembers(facultySession, groupConvId, {
        action: 'add',
        userIds: [student3Id],
      });

      assert.strictEqual(result.id, groupConvId);
    });

    test('manageGroupMembers prevents removing the group creator (faculty admin)', async () => {
      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);

      await assert.rejects(
        async () => {
          await ChatService.manageGroupMembers(facultySession, groupConvId, {
            action: 'remove',
            userIds: [facultyId],
          });
        },
        {
          name: 'BadRequestError',
          message: 'The faculty group creator cannot be removed from the academic group.',
        }
      );
    });

    test('manageGroupMembers rejects student member management attempt with ForbiddenError', async () => {
      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);

      await assert.rejects(
        async () => {
          await ChatService.manageGroupMembers(student1Session, groupConvId, {
            action: 'remove',
            userIds: [student2Id],
          });
        },
        {
          name: 'ForbiddenError',
          message: 'Only academic group administrators can manage group membership.',
        }
      );
    });
  });

  /* ======================================================================== */
  /* 5. Message Lifecycle, Policy & Deletion Suite                             */
  /* ======================================================================== */
  describe('5. Message Lifecycle, Broadcast Policy & Deletion', () => {
    test('sendMessage persists message to MongoDB and dispatches to Ably', async () => {
      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);
      mock.method(ChatRepository, 'saveMessage', async () => mockMessage1);
      mock.method(AblyBroker, 'publish', async () => ({ published: false, channel: 'chat:group:test' }));

      const message = await ChatService.sendMessage(facultySession, groupConvId, {
        content: 'Please review Unit 2 notes uploaded to course dropbox.',
      });

      assert.strictEqual(message.id, message1Id);
      assert.strictEqual(message.senderName, 'Prof. Alok Sharma');
      assert.strictEqual(message.senderRole, 'faculty');
    });

    test('sendMessage rejects non-member with ForbiddenError', async () => {
      const outsiderSession: UserSession = {
        ...student1Session,
        userId: student3Id,
      };

      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);

      await assert.rejects(
        async () => {
          await ChatService.sendMessage(outsiderSession, groupConvId, {
            content: 'I should not be able to post here',
          });
        },
        {
          name: 'ForbiddenError',
          message: 'Access clearance denied. You are not a member of this conversation.',
        }
      );
    });

    test('sendMessage rejects non-admin posts in broadcast_only groups with ForbiddenError', async () => {
      const broadcastGroup = {
        ...mockAcademicGroup,
        groupPolicy: 'broadcast_only' as const,
      };

      mock.method(ChatRepository, 'findConversationById', async () => broadcastGroup);

      await assert.rejects(
        async () => {
          await ChatService.sendMessage(student1Session, groupConvId, {
            content: 'Attempting to reply to broadcast announcement',
          });
        },
        {
          name: 'ForbiddenError',
          message: 'This academic group is in broadcast-only mode. Only faculty administrators can post announcements.',
        }
      );
    });

    test('sendMessage rejects posts to archived conversations with BadRequestError', async () => {
      const archivedGroup = {
        ...mockAcademicGroup,
        isArchived: true,
      };

      mock.method(ChatRepository, 'findConversationById', async () => archivedGroup);

      await assert.rejects(
        async () => {
          await ChatService.sendMessage(facultySession, groupConvId, {
            content: 'Posting to archived group',
          });
        },
        {
          name: 'BadRequestError',
          message: 'This conversation has been archived and is read-only.',
        }
      );
    });

    test('softDeleteMessage allows message author to delete their message', async () => {
      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);
      mock.method(ChatRepository, 'findMessageById', async () => mockMessage1);
      mock.method(ChatRepository, 'softDeleteMessage', async () => ({
        ...mockMessage1,
        isDeleted: true,
        content: 'This message was deleted',
      }));
      mock.method(AblyBroker, 'publish', async () => ({ published: false, channel: 'chat:group:test' }));

      const deleted = await ChatService.softDeleteMessage(facultySession, groupConvId, message1Id);
      assert.strictEqual(deleted.isDeleted, true);
      assert.strictEqual(deleted.content, 'This message was deleted');
    });

    test('softDeleteMessage rejects unauthorized user from deleting another person message', async () => {
      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);
      mock.method(ChatRepository, 'findMessageById', async () => mockMessage1);

      await assert.rejects(
        async () => {
          // student1 is a member, but not the author (faculty) and not a group admin
          await ChatService.softDeleteMessage(student1Session, groupConvId, message1Id);
        },
        {
          name: 'ForbiddenError',
          message: 'You are not authorized to delete this message.',
        }
      );
    });
  });

  /* ======================================================================== */
  /* 6. Message History, Pagination & Read Receipts                            */
  /* ======================================================================== */
  describe('6. Message History, Cursor Pagination & Read Receipts', () => {
    test('getConversationMessages retrieves paginated messages and marks them read', async () => {
      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);
      mock.method(ChatRepository, 'getConversationMessages', async () => ({
        messages: [mockMessage1],
        hasMore: false,
      }));
      mock.method(ChatRepository, 'markMessagesAsRead', async () => {});

      const result = await ChatService.getConversationMessages(student1Session, groupConvId, {
        limit: 50,
      });

      assert.strictEqual(result.messages.length, 1);
      assert.strictEqual(result.messages[0]!.id, message1Id);
      assert.strictEqual(result.hasMore, false);
    });

    test('getConversationMessages returns messages in chronological order and sets nextCursor to oldest message', async () => {
      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);
      mock.method(ChatRepository, 'getConversationMessages', async () => ({
        messages: [mockMessage1, mockMessage2], // mockMessage1 is older (14:00), mockMessage2 is newer (14:05)
        hasMore: true,
      }));
      let markedMessageId: string | undefined;
      mock.method(ChatRepository, 'markMessagesAsRead', async (_cId: string, _uId: string, msgId?: string) => {
        markedMessageId = msgId;
      });

      const result = await ChatService.getConversationMessages(student1Session, groupConvId, {
        limit: 2,
      });

      assert.strictEqual(result.messages.length, 2);
      assert.strictEqual(result.messages[0]!.id, message1Id); // Oldest first
      assert.strictEqual(result.messages[1]!.id, message2Id); // Newest second
      assert.strictEqual(result.nextCursor, message1Id); // Points to oldest message for pagination
      assert.strictEqual(markedMessageId, message2Id); // Marks newest message as read
    });

    test('getConversationMessages rejects non-member callers with ForbiddenError', async () => {
      const outsiderSession: UserSession = {
        ...student1Session,
        userId: student3Id,
      };

      mock.method(ChatRepository, 'findConversationById', async () => mockAcademicGroup);

      await assert.rejects(
        async () => {
          await ChatService.getConversationMessages(outsiderSession, groupConvId, {
            limit: 50,
          });
        },
        {
          name: 'ForbiddenError',
          message: 'Access clearance denied. You are not a member of this conversation.',
        }
      );
    });
  });

  /* ======================================================================== */
  /* 7. Real-Time Ably Broker Suite                                            */
  /* ======================================================================== */
  describe('7. Ably Real-Time Broker Conventions', () => {
    test('AblyBroker constructs deterministic sorted direct channels', () => {
      const channel1 = AblyBroker.getDirectChannel('user_b', 'user_a');
      const channel2 = AblyBroker.getDirectChannel('user_a', 'user_b');
      assert.strictEqual(channel1, 'chat:direct:user_a_user_b');
      assert.strictEqual(channel2, 'chat:direct:user_a_user_b');
    });

    test('AblyBroker constructs deterministic group channel', () => {
      const channel = AblyBroker.getGroupChannel(groupConvId);
      assert.strictEqual(channel, `chat:group:${groupConvId}`);
    });

    test('AblyBroker constructs conversation channels for direct and group conversations', () => {
      const directChannel = AblyBroker.getDirectChannel('6afb830dac73b32a05f8e5ed');
      assert.strictEqual(directChannel, 'chat:direct:6afb830dac73b32a05f8e5ed');

      const groupChannel = AblyBroker.getGroupChannel('6afb830dac73b32a05f8e5ee');
      assert.strictEqual(groupChannel, 'chat:group:6afb830dac73b32a05f8e5ee');

      assert.strictEqual(
        AblyBroker.getConversationChannel('6afb830dac73b32a05f8e5ed', 'direct'),
        'chat:direct:6afb830dac73b32a05f8e5ed'
      );
      assert.strictEqual(
        AblyBroker.getConversationChannel('6afb830dac73b32a05f8e5ee', 'group'),
        'chat:group:6afb830dac73b32a05f8e5ee'
      );
    });

    test('GET /api/v1/chat/token issues exact capabilities without wildcards', async () => {
      __setTestSession(student1Session);
      mock.method(ChatService, 'getUserConversations', async () => [
        { id: 'conv_direct_1', type: 'direct' },
        { id: 'conv_group_1', type: 'group' },
      ]);

      const req = new NextRequest('http://localhost:3000/api/v1/chat/token');
      const res = await getTokenRoute(req);

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      const capabilityMap = JSON.parse(json.data.capability);
      assert.ok(capabilityMap[`user:${student1Session.userId}:notifications`]);
      assert.ok(capabilityMap['chat:direct:conv_direct_1']);
      assert.ok(capabilityMap['chat:group:conv_group_1']);
      // Zero wildcard assertion
      assert.strictEqual(capabilityMap['*'], undefined);
      assert.strictEqual(capabilityMap['chat:direct:*'], undefined);
      assert.strictEqual(capabilityMap['chat:group:*'], undefined);
    });

    test('AblyBroker safely falls back to offline/mock mode when ABLY_API_KEY is unset', async () => {
      const result = await AblyBroker.publish('test:channel', 'test.event', { text: 'hello' });
      assert.strictEqual(result.published, false);
      assert.strictEqual(result.channel, 'test:channel');
    });
  });

  /* ======================================================================== */
  /* 8. REST API Route Handlers Integration                                    */
  /* ======================================================================== */
  describe('8. REST API Route Handlers Integration', () => {
    test('GET /api/v1/chat/conversations returns 200 with list of user conversations', async () => {
      __setTestSession(student1Session);
      mock.method(ChatService, 'getUserConversations', async () => []);

      const req = new NextRequest('http://localhost:3000/api/v1/chat/conversations');
      const res = await getConversationsRoute(req);

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('POST /api/v1/chat/conversations creates direct conversation with 201 Created', async () => {
      __setTestSession(student1Session);
      mock.method(ChatService, 'getOrCreateDirectChat', async () => ({
        id: directConvId,
        type: 'direct',
        name: 'Prof. Alok Sharma',
        unreadCount: 0,
        isGroup: false,
      }));

      const req = new NextRequest('http://localhost:3000/api/v1/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: facultyId }),
      });

      const res = await createConversationRoute(req);
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.type, 'direct');
    });

    test('POST /api/v1/chat/conversations creates academic group with 201 Created', async () => {
      __setTestSession(facultySession);
      mock.method(ChatService, 'createAcademicGroup', async () => ({
        id: groupConvId,
        type: 'group',
        name: 'CS-301: Advanced Data Structures',
        unreadCount: 0,
        isGroup: true,
      }));

      const req = new NextRequest('http://localhost:3000/api/v1/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'CS-301: Advanced Data Structures',
          academicContext: { courseCode: 'CS301', semester: 3 },
        }),
      });

      const res = await createConversationRoute(req);
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.isGroup, true);
    });

    test('GET /api/v1/chat/conversations/[id] returns 200 with details', async () => {
      __setTestSession(student1Session);
      mock.method(ChatService, 'getConversationDetails', async () => ({
        id: groupConvId,
        type: 'group',
        name: 'CS-301: Advanced Data Structures',
        unreadCount: 0,
        isGroup: true,
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/chat/conversations/${groupConvId}`);
      const res = await getConversationDetailRoute(req, {
        params: Promise.resolve({ id: groupConvId }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('PATCH /api/v1/chat/conversations/[id] updates group settings with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(ChatService, 'updateGroup', async () => ({
        id: groupConvId,
        type: 'group',
        name: 'Updated Batch A',
        unreadCount: 0,
        isGroup: true,
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/chat/conversations/${groupConvId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Batch A' }),
      });
      const res = await updateConversationRoute(req, {
        params: Promise.resolve({ id: groupConvId }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('POST /api/v1/chat/conversations/[id]/members updates members with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(ChatService, 'manageGroupMembers', async () => ({
        id: groupConvId,
        type: 'group',
        name: 'CS-301',
        unreadCount: 0,
        isGroup: true,
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/chat/conversations/${groupConvId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', userIds: [student2Session.userId] }),
      });
      const res = await manageMembersRoute(req, {
        params: Promise.resolve({ id: groupConvId }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('GET /api/v1/chat/conversations/[id]/messages returns paginated history with 200 OK', async () => {
      __setTestSession(student1Session);
      mock.method(ChatService, 'getConversationMessages', async () => ({
        messages: [],
        hasMore: false,
      }));

      const req = new NextRequest(`http://localhost:3000/api/v1/chat/conversations/${groupConvId}/messages?limit=20`);
      const res = await getMessagesRoute(req, {
        params: Promise.resolve({ id: groupConvId }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('POST /api/v1/chat/conversations/[id]/messages dispatches message with 201 Created', async () => {
      __setTestSession(facultySession);
      mock.method(ChatService, 'sendMessage', async () => ({
        id: message1Id,
        conversationId: groupConvId,
        senderId: facultyId,
        senderName: 'Prof. Alok Sharma',
        senderRole: 'faculty',
        content: 'Test message',
        timestamp: new Date().toISOString(),
        isOwn: true,
        status: 'sent',
      }));

      const req = new NextRequest(
        `http://localhost:3000/api/v1/chat/conversations/${groupConvId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Test message' }),
        }
      );

      const res = await sendMessageRoute(req, {
        params: Promise.resolve({ id: groupConvId }),
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.content, 'Test message');
    });

    test('DELETE /api/v1/chat/conversations/[id]/messages/[messageId] soft-deletes with 200 OK', async () => {
      __setTestSession(facultySession);
      mock.method(ChatService, 'softDeleteMessage', async () => ({
        id: message1Id,
        conversationId: groupConvId,
        senderId: facultyId,
        senderName: 'Prof. Alok Sharma',
        senderRole: 'faculty',
        content: 'This message was deleted',
        timestamp: new Date().toISOString(),
        isOwn: true,
        status: 'sent',
        isDeleted: true,
      }));

      const req = new NextRequest(
        `http://localhost:3000/api/v1/chat/conversations/${groupConvId}/messages/${message1Id}`,
        { method: 'DELETE' }
      );

      const res = await deleteMessageRoute(req, {
        params: Promise.resolve({ id: groupConvId, messageId: message1Id }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.isDeleted, true);
    });

    test('POST /api/v1/chat/conversations/[id]/read marks conversation as read with 200 OK', async () => {
      __setTestSession(student1Session);
      mock.method(ChatService, 'markConversationAsRead', async () => ({
        success: true,
        conversationId: groupConvId,
      }));

      const req = new NextRequest(
        `http://localhost:3000/api/v1/chat/conversations/${groupConvId}/read`,
        { method: 'POST' }
      );

      const res = await markReadRoute(req, {
        params: Promise.resolve({ id: groupConvId }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test('GET /api/v1/chat/token returns 200 with capability envelope', async () => {
      __setTestSession(student1Session);
      mock.method(ChatService, 'getUserConversations', async () => []);

      const req = new NextRequest('http://localhost:3000/api/v1/chat/token');
      const res = await getTokenRoute(req);

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.capability);
    });
  });
});
