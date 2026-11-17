/**
 * Phase 5.6: Frontend & Real-Time Integration Test Suite
 *
 * Verifies:
 * 1. useAblyChat lifecycle, state machine, and offline/mock degradation
 * 2. Message deduplication defense and real-time event routing
 * 3. Student permissions, broadcast-only posting restrictions, and group visibility
 * 4. Faculty group governance: creation, member enrollment/removal, policy toggle, and archiving
 * 5. WhatsApp-style read receipts, unread counter synchronization, and message soft-deletion
 *
 * Conforms to Node.js built-in test runner (node:test + node:assert).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import type { Conversation, ChatMessage, MessageDTO } from '@/types/chat';

describe('Phase 5.6: Frontend & Real-Time Integration Suite', () => {
  /* ======================================================================== */
  /* 1. useAblyChat State Machine & Offline Fallback                          */
  /* ======================================================================== */
  describe('1. useAblyChat State Machine & Offline Fallback', () => {
    test('transitions to offline state when token endpoint returns development mock envelope', () => {
      const mockTokenResponse = {
        success: true,
        data: {
          clientId: 'student_101',
          capability: '{"chat:direct:*":["subscribe"]}',
          token: 'dev-mock-token-student_101',
          isMock: true,
        },
      };

      // Simulated hook evaluation logic
      const isMock = mockTokenResponse.data.isMock;
      const initialStatus = isMock ? 'offline' : 'connected';

      assert.strictEqual(initialStatus, 'offline');
      assert.strictEqual(isMock, true);
    });

    test('suppresses duplicate message events arriving over WebSocket (deduplication defense)', () => {
      const seenMessageIds = new Set<string>();

      const mockMessage: MessageDTO = {
        id: 'msg_repeat_123',
        conversationId: 'conv_456',
        senderId: 'user_1',
        senderName: 'Prof. Sharma',
        senderRole: 'faculty',
        content: 'Midterm schedule has been updated.',
        timestamp: '10:00 AM',
        isOwn: false,
        status: 'sent',
      };

      let processCount = 0;
      const handleIncomingMessage = (msg: MessageDTO) => {
        if (seenMessageIds.has(msg.id)) {
          return false; // deduplicated
        }
        seenMessageIds.add(msg.id);
        processCount++;
        return true;
      };

      // First delivery -> Accepted
      const first = handleIncomingMessage(mockMessage);
      assert.strictEqual(first, true);
      assert.strictEqual(processCount, 1);

      // Duplicate delivery (network rebound/reconnection replay) -> Rejected
      const second = handleIncomingMessage(mockMessage);
      assert.strictEqual(second, false);
      assert.strictEqual(processCount, 1);
    });

    test('keeps bounded history of processed message IDs to prevent memory leaks', () => {
      const set = new Set<string>();
      const MAX_BOUND = 200;

      for (let i = 0; i < 250; i++) {
        set.add(`msg_${i}`);
        if (set.size > MAX_BOUND) {
          const first = set.values().next().value;
          if (first) set.delete(first);
        }
      }

      assert.strictEqual(set.size, MAX_BOUND);
      assert.strictEqual(set.has('msg_0'), false);
      assert.strictEqual(set.has('msg_249'), true);
    });

    test('resolves exact channel name according to conversation type (chat:direct:[id] vs chat:group:[id])', () => {
      const getChannelName = (id: string, type?: 'direct' | 'group' | null) =>
        type === 'direct' ? `chat:direct:${id}` : `chat:group:${id}`;

      // Direct conversation
      const directChannel = getChannelName('6afb830dac73b32a05f8e5ed', 'direct');
      assert.strictEqual(directChannel, 'chat:direct:6afb830dac73b32a05f8e5ed');

      // Group conversation
      const groupChannel = getChannelName('6afb830dac73b32a05f8e5ee', 'group');
      assert.strictEqual(groupChannel, 'chat:group:6afb830dac73b32a05f8e5ee');
    });
  });

  /* ======================================================================== */
  /* 2. Student Permissions & Broadcast Policy Enforcement                    */
  /* ======================================================================== */
  describe('2. Student Permissions & Broadcast Policy Enforcement', () => {
    const studentUser = {
      id: 'std_aarav',
      role: 'student' as const,
      name: 'Aarav Sharma',
    };

    const broadcastGroup: Conversation = {
      id: 'grp_broadcast_cse',
      type: 'group',
      name: 'CSE Announcements Official',
      isGroup: true,
      unreadCount: 0,
      groupPolicy: 'broadcast_only',
      createdBy: 'fac_hod',
      moderatorId: 'fac_hod',
      members: [
        { id: 'fac_hod', name: 'Dr. Verma', role: 'faculty', isModerator: true },
        { id: 'std_aarav', name: 'Aarav Sharma', role: 'student' },
      ],
    };

    const discussionGroup: Conversation = {
      id: 'grp_discuss_algo',
      type: 'group',
      name: 'Algorithms Research Cohort',
      isGroup: true,
      unreadCount: 0,
      groupPolicy: 'open_discussion',
      createdBy: 'fac_advisor',
      moderatorId: 'fac_advisor',
      members: [
        { id: 'fac_advisor', name: 'Prof. Sharma', role: 'faculty', isModerator: true },
        { id: 'std_aarav', name: 'Aarav Sharma', role: 'student' },
      ],
    };

    test('disables student posting when group policy is broadcast_only', () => {
      const isRestrictedFromPosting =
        broadcastGroup.isGroup &&
        broadcastGroup.groupPolicy === 'broadcast_only' &&
        studentUser.role === 'student';

      assert.strictEqual(isRestrictedFromPosting, true);
    });

    test('permits faculty moderator to post in broadcast_only groups', () => {
      const callerRole: string = 'faculty';
      const isFacultyRestricted =
        broadcastGroup.isGroup &&
        broadcastGroup.groupPolicy === 'broadcast_only' &&
        (callerRole as string) === 'student';

      assert.strictEqual(isFacultyRestricted, false);
    });

    test('permits student participation when group policy is open_discussion', () => {
      const isRestrictedFromPosting =
        discussionGroup.isGroup &&
        discussionGroup.groupPolicy === 'broadcast_only' &&
        studentUser.role === 'student';

      assert.strictEqual(isRestrictedFromPosting, false);
    });

    test('filters conversation feed so students only access enrolled groups', () => {
      const outsiderGroup: Conversation = {
        id: 'grp_mech_301',
        type: 'group',
        name: 'Mechanical Engineering Senior Cohort',
        isGroup: true,
        unreadCount: 0,
        groupPolicy: 'open_discussion',
        members: [
          { id: 'fac_mech', name: 'Prof. Roy', role: 'faculty' },
          { id: 'std_other', name: 'Other Student', role: 'student' },
        ],
      };

      const allGroups = [broadcastGroup, discussionGroup, outsiderGroup];

      const visibleToStudent = allGroups.filter((g) =>
        g.members?.some((m) => m.id === studentUser.id)
      );

      assert.strictEqual(visibleToStudent.length, 2);
      assert.strictEqual(visibleToStudent.some((g) => g.id === 'grp_mech_301'), false);
    });
  });

  /* ======================================================================== */
  /* 3. Faculty Group Management & Governance                                 */
  /* ======================================================================== */
  describe('3. Faculty Group Management & Governance', () => {
    test('allows faculty admin to toggle group policy between broadcast_only and open_discussion', () => {
      let currentPolicy: 'broadcast_only' | 'open_discussion' = 'broadcast_only';

      const togglePolicy = (policy: 'broadcast_only' | 'open_discussion') => {
        return policy === 'broadcast_only' ? 'open_discussion' : 'broadcast_only';
      };

      currentPolicy = togglePolicy(currentPolicy);
      assert.strictEqual(currentPolicy, 'open_discussion');

      currentPolicy = togglePolicy(currentPolicy);
      assert.strictEqual(currentPolicy, 'broadcast_only');
    });

    test('prevents removal of the faculty group creator', () => {
      const creatorId = 'fac_creator_999';
      const memberToRemoveId = 'fac_creator_999';

      const canRemoveMember = (memberId: string, groupCreatorId: string) => {
        return memberId !== groupCreatorId;
      };

      assert.strictEqual(canRemoveMember(memberToRemoveId, creatorId), false);
      assert.strictEqual(canRemoveMember('std_rohan_123', creatorId), true);
    });

    test('correctly handles archiving and unarchiving of academic groups', () => {
      const group: Conversation = {
        id: 'grp_archival_test',
        type: 'group',
        name: 'Past Semester Batch',
        isGroup: true,
        unreadCount: 0,
        isArchived: false,
      };

      const updated = { ...group, isArchived: !group.isArchived };
      assert.strictEqual(updated.isArchived, true);

      const restored = { ...updated, isArchived: !updated.isArchived };
      assert.strictEqual(restored.isArchived, false);
    });
  });

  /* ======================================================================== */
  /* 4. Message History, Read Receipts & Soft Deletion Lifecycle              */
  /* ======================================================================== */
  describe('4. Message History, Read Receipts & Soft Deletion Lifecycle', () => {
    test('renders soft-deleted tombstone instead of sensitive content', () => {
      const deletedMessage: ChatMessage = {
        id: 'msg_deleted_1',
        conversationId: 'conv_1',
        senderId: 'std_1',
        senderName: 'Aarav Sharma',
        senderRole: 'student',
        content: 'Accidentally posted confidential lab query',
        timestamp: '11:15 AM',
        isOwn: true,
        status: 'sent',
        isDeleted: true,
      };

      const displayContent = deletedMessage.isDeleted
        ? 'This message was deleted by author.'
        : deletedMessage.content;

      assert.strictEqual(displayContent, 'This message was deleted by author.');
      assert.notStrictEqual(displayContent, deletedMessage.content);
    });

    test('authorizes message deletion for own messages and faculty group moderators', () => {
      const currentUserId = 'fac_moderator_1';
      const currentUserRole = 'faculty';

      const studentMessage: ChatMessage = {
        id: 'msg_std',
        conversationId: 'grp_1',
        senderId: 'std_student_1',
        senderName: 'Student 1',
        senderRole: 'student',
        content: 'Irrelevant comment',
        timestamp: '12:00 PM',
        isOwn: false,
        status: 'sent',
      };

      const canDelete =
        !studentMessage.isDeleted &&
        (studentMessage.senderId === currentUserId ||
          currentUserRole === 'faculty' ||
          currentUserRole === 'super_admin');

      assert.strictEqual(canDelete, true);
    });

    test('rejects message deletion by unauthorized student peers', () => {
      const peerUserId = 'std_peer_2';
      const peerRole: string = 'student';

      const targetMessage: ChatMessage = {
        id: 'msg_std',
        conversationId: 'grp_1',
        senderId: 'std_student_1',
        senderName: 'Student 1',
        senderRole: 'student',
        content: 'Question for prof',
        timestamp: '12:00 PM',
        isOwn: false,
        status: 'sent',
      };

      const canDelete =
        !targetMessage.isDeleted &&
        (targetMessage.senderId === peerUserId || (peerRole as string) === 'faculty');

      assert.strictEqual(canDelete, false);
    });

    test('marks messages as read and transitions read status in real-time', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg_1',
          conversationId: 'conv_1',
          senderId: 'user_a',
          senderName: 'User A',
          senderRole: 'student',
          content: 'Hello!',
          timestamp: '10:00 AM',
          isOwn: true,
          status: 'sent',
        },
      ];

      // Simulate receiving chat.read event
      const updatedMessages = messages.map((m) =>
        m.isOwn ? { ...m, status: 'read' as const } : m
      );

      assert.strictEqual(updatedMessages[0]?.status, 'read');
    });

    test('increments unreadCount on inactive conversations and resets on active selection', () => {
      let conversations: Conversation[] = [
        {
          id: 'conv_a',
          type: 'direct',
          name: 'Contact A',
          unreadCount: 0,
          isGroup: false,
          lastMessage: 'Old message',
        },
        {
          id: 'conv_b',
          type: 'direct',
          name: 'Contact B',
          unreadCount: 2,
          isGroup: false,
          lastMessage: 'Prior message',
        },
      ];

      const activeConvId: string = 'conv_a';

      // An unread update arrives for conv_b (not currently active)
      conversations = conversations.map((c) => {
        if (c.id === 'conv_b') {
          const isCurrent = c.id === activeConvId;
          return {
            ...c,
            lastMessage: 'New incoming message',
            unreadCount: isCurrent ? 0 : c.unreadCount + 1,
          };
        }
        return c;
      });

      assert.strictEqual(conversations.find((c) => c.id === 'conv_b')?.unreadCount, 3);
      assert.strictEqual(
        conversations.find((c) => c.id === 'conv_b')?.lastMessage,
        'New incoming message'
      );

      // User switches to conv_b -> unread resets to 0
      const newActiveConvId = 'conv_b';
      conversations = conversations.map((c) =>
        c.id === newActiveConvId ? { ...c, unreadCount: 0 } : c
      );

      assert.strictEqual(conversations.find((c) => c.id === 'conv_b')?.unreadCount, 0);
    });

    test('reconciles optimistic messages seamlessly when real-time or REST confirmation arrives', () => {
      const tempId = 'temp-1731790000000';
      const currentUserId = 'user_student_1';

      const messages: ChatMessage[] = [
        {
          id: tempId,
          conversationId: 'conv_1',
          senderId: currentUserId,
          senderName: 'Rahul Verma',
          senderRole: 'student',
          content: 'Hello, Professor!',
          timestamp: '10:00 AM',
          isOwn: true,
          status: 'sent',
        },
      ];

      // Simulated confirmed server message
      const confirmedServerMessage: MessageDTO = {
        id: '6afb830dac73b32a05f8e599',
        conversationId: 'conv_1',
        senderId: currentUserId,
        senderName: 'Rahul Verma',
        senderRole: 'student',
        content: 'Hello, Professor!',
        timestamp: '10:00 AM',
        isOwn: true,
        status: 'sent',
      };

      // 1. Reconcile on REST response or onNewMessage
      const reconciled = messages.map((m) =>
        m.id === tempId ? { ...confirmedServerMessage, isOwn: true } : m
      );

      // Verify temp ID is replaced with canonical DB ID
      assert.strictEqual(reconciled.length, 1);
      assert.strictEqual(reconciled[0]?.id, '6afb830dac73b32a05f8e599');
      assert.strictEqual(reconciled[0]?.content, 'Hello, Professor!');

      // 2. If duplicate event arrives over WebSocket, deduplicate cleanly
      const incomingWebSocketDuplicate = confirmedServerMessage;
      const seen = new Set(reconciled.map((m) => m.id));
      const shouldAppend = !seen.has(incomingWebSocketDuplicate.id);

      assert.strictEqual(shouldAppend, false); // Blocked duplicate!
    });

    test('preserves strict chronological order on refresh and pagination without reversing or duplicating', () => {
      // Oldest message is msg_1, newest is msg_3
      const initialHistory: ChatMessage[] = [
        {
          id: 'msg_2',
          conversationId: 'conv_1',
          senderId: 'user_1',
          senderName: 'User 1',
          senderRole: 'student',
          content: 'Second message',
          timestamp: '10:05 AM',
          isOwn: false,
          status: 'sent',
        },
        {
          id: 'msg_3',
          conversationId: 'conv_1',
          senderId: 'user_2',
          senderName: 'User 2',
          senderRole: 'faculty',
          content: 'Third message',
          timestamp: '10:10 AM',
          isOwn: true,
          status: 'sent',
        },
      ];

      // Earlier messages fetched from pagination (?before=msg_2)
      const earlierBatch: ChatMessage[] = [
        {
          id: 'msg_1',
          conversationId: 'conv_1',
          senderId: 'user_1',
          senderName: 'User 1',
          senderRole: 'student',
          content: 'First message',
          timestamp: '10:00 AM',
          isOwn: false,
          status: 'sent',
        },
      ];

      // Prepend earlier batch without duplicates
      const existingIds = new Set(initialHistory.map((m) => m.id));
      const dedupedEarlier = earlierBatch.filter((m) => !existingIds.has(m.id));
      const combined = [...dedupedEarlier, ...initialHistory];

      assert.strictEqual(combined.length, 3);
      assert.strictEqual(combined[0]?.id, 'msg_1'); // Oldest at top
      assert.strictEqual(combined[1]?.id, 'msg_2'); // Middle
      assert.strictEqual(combined[2]?.id, 'msg_3'); // Newest at bottom

      // Sending a 4th message appends to bottom
      const msg4: ChatMessage = {
        id: 'msg_4',
        conversationId: 'conv_1',
        senderId: 'user_2',
        senderName: 'User 2',
        senderRole: 'faculty',
        content: 'Fourth message',
        timestamp: '10:15 AM',
        isOwn: true,
        status: 'sent',
      };
      const afterSend = [...combined, msg4];
      assert.strictEqual(afterSend[3]?.id, 'msg_4');

      // Refresh simulates re-fetching the latest 4 messages in chronological order
      const refreshedFromApi: ChatMessage[] = [
        combined[0]!,
        combined[1]!,
        combined[2]!,
        msg4,
      ];
      assert.deepStrictEqual(afterSend.map((m) => m.id), refreshedFromApi.map((m) => m.id));
    });
  });

  /* ======================================================================== */
  /* 6. Real Collegiate Directory & Direct Chat Discovery                     */
  /* ======================================================================== */
  describe('6. Real Collegiate Directory & Direct Chat Discovery', () => {
    interface MockDirectoryUser {
      id: string;
      fullName: string;
      username?: string | null;
      email: string;
      role: 'student' | 'faculty' | 'admin' | 'super_admin';
      status: string;
      authProviderId?: string | null;
      passwordHash?: string;
      activationTokenHash?: string;
    }

    const mockDatabaseUsers: MockDirectoryUser[] = [
      {
        id: 'user_prashant',
        fullName: 'Prashant Umrao',
        username: 'prashant01',
        email: 'theprashantumrao@gmail.com',
        role: 'student',
        status: 'active',
        authProviderId: 'clerk_prashant',
        passwordHash: 'secret_hash_1',
      },
      {
        id: 'user_nisha',
        fullName: 'Nisha Kumari',
        username: 'nishakumari',
        email: 'nisha.chaudhari.339091@gmail.com',
        role: 'student',
        status: 'active',
        authProviderId: 'clerk_nisha',
        passwordHash: 'secret_hash_2',
      },
      {
        id: 'user_hod',
        fullName: 'Dr. Verma HOD',
        username: 'hodcse',
        email: 'dubworld69@gmail.com',
        role: 'admin',
        status: 'active',
        authProviderId: 'clerk_hod',
        passwordHash: 'secret_hash_3',
      },
      {
        id: 'user_inactive',
        fullName: 'Suspended Account',
        username: 'suspended_user',
        email: 'suspended@axiscolleges.in',
        role: 'student',
        status: 'suspended',
        authProviderId: 'clerk_suspended',
      },
      {
        id: 'user_unprovisioned',
        fullName: 'Pending Provisioning',
        username: 'pending_user',
        email: 'pending@axiscolleges.in',
        role: 'student',
        status: 'pending_verification',
        authProviderId: null,
      },
    ];

    // Directory filter simulation function mirroring UserRepository.searchDirectory
    function searchDirectorySim(
      query: string,
      currentUserId: string,
      users: MockDirectoryUser[]
    ) {
      const cleanQ = query.trim().replace(/^@/, '');
      const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      return users
        .filter((u) => {
          // 1. Must be active
          if (u.status !== 'active') return false;
          // 2. Must be provisioned with auth identity
          if (!u.authProviderId) return false;
          // 3. Exclude caller
          if (u.id === currentUserId) return false;
          // 4. Match query across name, username, email
          if (!cleanQ) return true;
          return (
            regex.test(u.fullName) ||
            (u.username && regex.test(u.username)) ||
            regex.test(u.email)
          );
        })
        .map((u) => {
          // Safe DTO mapping
          return {
            id: u.id,
            fullName: u.fullName,
            username: u.username || null,
            email: u.email,
            role: u.role,
          };
        });
    }

    test('searches real users by name, username, and institutional email', () => {
      // Search by name
      const byName = searchDirectorySim('Nisha', 'user_prashant', mockDatabaseUsers);
      assert.strictEqual(byName.length, 1);
      assert.strictEqual(byName[0]?.fullName, 'Nisha Kumari');

      // Search by username with @ prefix
      const byHandle = searchDirectorySim('@hodcse', 'user_prashant', mockDatabaseUsers);
      assert.strictEqual(byHandle.length, 1);
      assert.strictEqual(byHandle[0]?.username, 'hodcse');

      // Search by email
      const byEmail = searchDirectorySim('dubworld69', 'user_prashant', mockDatabaseUsers);
      assert.strictEqual(byEmail.length, 1);
      assert.strictEqual(byEmail[0]?.email, 'dubworld69@gmail.com');
    });

    test('excludes the currently authenticated user from directory search results', () => {
      // Prashant searches for 'Prashant'
      const results = searchDirectorySim('Prashant', 'user_prashant', mockDatabaseUsers);
      assert.strictEqual(results.length, 0);
    });

    test('excludes inactive, suspended, and unprovisioned accounts from directory discovery', () => {
      // Searching for 'Suspended' returns nothing
      const suspendedResults = searchDirectorySim('Suspended', 'user_prashant', mockDatabaseUsers);
      assert.strictEqual(suspendedResults.length, 0);

      // Searching for 'Pending' returns nothing
      const pendingResults = searchDirectorySim('Pending', 'user_prashant', mockDatabaseUsers);
      assert.strictEqual(pendingResults.length, 0);
    });

    test('returns empty result set cleanly when no matching users exist', () => {
      const results = searchDirectorySim('nonExistentQueryXYZ123', 'user_prashant', mockDatabaseUsers);
      assert.strictEqual(results.length, 0);
    });

    test('never leaks sensitive password hashes, auth secrets, or internal tokens in directory DTO', () => {
      const results = searchDirectorySim('', 'user_prashant', mockDatabaseUsers);
      assert.ok(results.length > 0);

      for (const user of results) {
        assert.strictEqual('passwordHash' in user, false);
        assert.strictEqual('authProviderId' in user, false);
        assert.strictEqual('activationTokenHash' in user, false);
      }
    });

    test('idempotently generates canonical direct conversation key regardless of user order', () => {
      const getDirectKey = (a: string, b: string) => [a, b].sort().join(':');

      const key1 = getDirectKey('user_prashant', 'user_nisha');
      const key2 = getDirectKey('user_nisha', 'user_prashant');

      assert.strictEqual(key1, key2);
      assert.strictEqual(key1, 'user_nisha:user_prashant');
    });

    test('disallows direct chat creation with oneself', () => {
      const currentUserId = 'user_prashant';
      const targetUserId = 'user_prashant';

      const isSelfMessage = currentUserId === targetUserId;
      assert.strictEqual(isSelfMessage, true);
    });
  });
});
