# Phase 5.6 — Real-time Chat & Faculty Academic Groups: Backend Implementation Report

**Document Reference:** `DOC-PHASE5-6-BACKEND-001`  
**Date:** November 17, 2026  
**Status:** IMPLEMENTED & VERIFIED  
**Architecture Alignment:** `ADR-007` (Stateless Realtime Broker & Ably Edge Pub/Sub), `DOC-ARCH-006`  
**Test Verification:** 601/601 Tests Passing (36 new dedicated unit & integration tests)  
**Quality Suite:** TypeScript (Clean), ESLint (0 errors, 0 warnings), Next.js Production Build (Clean)

---

## 1. Executive Summary

Phase 5.6 establishes the collegiate real-time communication backbone for **Axis LinkUp**, introducing:
1. **Direct One-to-One Messaging** between authorized collegiate participants (Faculty-to-Student, Faculty-to-Faculty, Student-to-Student) with deterministic indexing and duplicate collision defense.
2. **Faculty-Managed Academic Groups** scoped to academic departments and instructional sections (course code, semester, section, batch year).
3. **Zero-Trust Access Control & Group Policies** (`broadcast_only` announcement groups vs. `open_discussion` cohorts), strictly restricting group creation and membership alterations to Faculty and Administrative roles.
4. **Stateless Ably Broker Integration** adhering to serverless Next.js edge constraints, publishing via stateless REST endpoints and minting short-lived Ably token requests with least-privilege capability maps.
5. **Robust Messaging Lifecycle**: Timestamping, unread count tracking, paginated history cursoring, read receipts, and soft-deletion preserves audit trails.

---

## 2. Architecture & Domain Models

### 2.1 Database Models (`src/lib/db/models/`)

#### 1. Conversation Model (`conversation.model.ts`)
- **Document Type:** `IConversation`
- **Fields:**
  - `type`: `'direct' | 'group'`
  - `name`: string (required for groups)
  - `description`: optional string
  - `departmentId`: optional `ObjectId` ref `'Department'`
  - `academicContext`: `{ courseCode, courseName, semester, section, batchYear }`
  - `groupPolicy`: `'broadcast_only' | 'open_discussion'` (defaults to `'open_discussion'`)
  - `createdBy`: `ObjectId` ref `'User'`
  - `directKey`: sparse string `[min(userA, userB), max(userA, userB)].join(':')`
  - `participants`: array of `ObjectId` refs `'User'`
  - `members`: array of subdocuments `{ userId, role: 'faculty_admin' | 'moderator' | 'member', joinedAt }`
  - `lastMessage`: subdocument `{ messageId, senderId, senderName, content, createdAt }`
  - `isArchived`: boolean (default `false`)
- **Indexes:**
  - `{ directKey: 1, type: 1 }` (Unique, Sparse) — Prevents duplicate direct conversation creation.
  - `{ participants: 1, updatedAt: -1 }` — Optimizes user inbox loading and sorting.
  - `{ departmentId: 1, type: 1, isArchived: 1 }` — Enables department-scoped group listings.

#### 2. Message Model (`message.model.ts`)
- **Document Type:** `IMessage`
- **Fields:**
  - `conversationId`: `ObjectId` ref `'Conversation'`
  - `senderId`: `ObjectId` ref `'User'`
  - `senderSnapshot`: `{ fullName, role, avatarUrl }` (audit preservation)
  - `content`: string (1-4000 chars)
  - `attachments`: array of `{ url, fileType, fileName, fileSize }`
  - `readBy`: array of `{ userId, readAt }`
  - `isDeleted`: boolean (soft delete flag)
  - `deletedAt`: optional `Date`
- **Indexes:**
  - `{ conversationId: 1, createdAt: -1 }` — Optimizes chronologically reversed message queries.
  - `{ conversationId: 1, _id: -1 }` — Cursor pagination index.

---

## 3. Data Access & Domain Service Layer

### 3.1 Chat Repository (`src/lib/db/repositories/chat.repository.ts`)
- `getDirectKey(userIdA, userIdB)`: Deterministic ordering key generator.
- `findOrCreateDirectConversation(userIdA, userIdB, creatorUserId)`: Atomic find-or-create with retry logic for `E11000` duplicate key race conditions.
- `createGroupConversation(params)`: Persists academic group with initial members and creator as `faculty_admin`.
- `findConversationById(id)`: Fetches conversation by ID.
- `findUserConversations(userId, options)`: Returns paginated user conversations with unread indicators.
- `updateGroup(id, updates)`: Updates name, description, policy, or archive flag.
- `addMembersToGroup(id, userIds)`: Atomically appends member subdocuments and updates participants array without duplicates.
- `removeMembersFromGroup(id, userIds)`: Removes members, strictly rejecting removal of group creator.
- `saveMessage(params)`: Inserts message and updates conversation `lastMessage` and `updatedAt`.
- `getConversationMessages(conversationId, options)`: Returns paginated message list using cursor-based or limit/offset pagination.
- `markMessagesAsRead(conversationId, userId)`: Pushes user read receipts to unread messages.
- `countUnreadMessages(conversationId, userId)`: Aggregates unread message count for a user.
- `softDeleteMessage(messageId, deletedByUserId)`: Sets `isDeleted: true` while preserving audit record.

### 3.2 Domain Service (`src/lib/services/chat.service.ts`)
Zero-trust validation engine enforcing collegiate security policies:
- **Direct Chat Gate:** Requires active provisioned session; rejects self-messaging; verifies counterparty exists and is active.
- **Academic Group Creation Gate:** Strictly restricted to `faculty`, `admin`, or `super-admin`. Students attempting group creation receive `ForbiddenError (HTTP 403)`.
- **Broadcast-Only Policy Gate:** If `groupPolicy === 'broadcast_only'`, only callers with `role === 'faculty_admin'` or `role === 'moderator'` are authorized to dispatch messages. Regular members receive `ForbiddenError (HTTP 403)`.
- **Soft Delete Permissions:** Messages can only be deleted by the original author or by the faculty administrator of the group.

### 3.3 Stateless Realtime Broker (`src/lib/realtime/ably-broker.ts`)
- **Architecture:** Zero persistent daemon dependency. Dispatches events statelessly via Ably REST API (`https://rest.ably.io/channels/...`) using HTTP basic auth.
- **Resilience:** Gracefully falls back to offline/mock mode if `ABLY_API_KEY` is omitted, logging warnings while guaranteeing database transactions remain atomic and succeed.
- **Channel Architecture:**
  - Direct Chat: `chat:direct:[min(userA, userB)]_[max(userA, userB)]`
  - Group Chat: `chat:group:[conversationId]`
  - User Ingress / Unread Badge: `user:[userId]:notifications`
- **Capabilities & Token Minting:** Generates scoped Ably tokens granting `subscribe` and `history` only to channels belonging to the user's active conversations.

---

## 4. REST API Route Handlers

All endpoints reside in `src/app/api/v1/chat/`:

| Method | Endpoint | Description | RBAC / Auth Gate |
|---|---|---|---|
| `GET` | `/api/v1/chat/conversations` | List caller's conversations with unread counts | Authenticated, Active |
| `POST` | `/api/v1/chat/conversations` | Create direct chat or academic group | Direct: All; Group: Faculty/Admin |
| `GET` | `/api/v1/chat/conversations/[id]` | Get detailed conversation metadata & members | Conversation Participant |
| `PATCH` | `/api/v1/chat/conversations/[id]` | Update group metadata, policy, or archive | Faculty Admin / Moderator |
| `POST` | `/api/v1/chat/conversations/[id]/members` | Add or remove members (`action: 'add' \| 'remove'`) | Faculty Admin |
| `GET` | `/api/v1/chat/conversations/[id]/messages` | Paginated message history (cursor or offset) | Conversation Participant |
| `POST` | `/api/v1/chat/conversations/[id]/messages` | Dispatch message & trigger real-time pub/sub | Conversation Participant (Policy gated) |
| `DELETE`| `/api/v1/chat/conversations/[id]/messages/[messageId]` | Soft-delete message | Author or Faculty Admin |
| `POST` | `/api/v1/chat/conversations/[id]/read` | Mark conversation messages as read | Conversation Participant |
| `GET` | `/api/v1/chat/token` | Mint scoped Ably auth token request | Authenticated, Active |

---

## 5. Test Verification & Quality Gates

### 5.1 Focused Chat Test Suite (`tests/unit/chat-backend.test.ts`)
- **Total Test Cases:** 36
- **Result:** **36/36 Passing** (0 failures)
- **Coverage Highlights:**
  - Direct conversation creation and race-condition idempotency.
  - Faculty academic group creation with course/semester/section context.
  - Student group creation attempt rejection (`ForbiddenError: HTTP 403`).
  - Broadcast-only group enforcement (student message rejected, faculty message accepted).
  - Member addition and removal with protection against creator expulsion.
  - Cursor-based message pagination and unread counts.
  - Message soft-deletion authorization checks.
  - Ably broker deterministic channel naming and graceful degradation when API key is missing.
  - Comprehensive coverage of all 7 REST API route handlers.

### 5.2 Full Test Suite Regression (`npm test`)
- **Total Tests:** 601
- **Total Test Suites:** 172
- **Pass Rate:** **100% (601 passed, 0 failed, 0 skipped)**
- **Duration:** 125s

### 5.3 Quality Verifications
- **TypeScript (`npm run typecheck`):** Exited with code 0 (no type errors).
- **ESLint (`npm run lint`):** Exited with code 0 (0 warnings, 0 errors).
- **Production Build (`npm run build`):** Exited with code 0. All 27 static and dynamic routes compiled successfully, including all 7 new chat API endpoints.

---

## 6. Implementation Status Distinction

### Implemented & Ready (Backend Foundation)
- [x] Full database schemas, compound indexes, and domain types (`IConversation`, `IMessage`).
- [x] Data repository layer with atomic operations and collision handling.
- [x] Zero-trust service layer with collegiate RBAC rules.
- [x] All 7 REST API route handlers (`/api/v1/chat/*`).
- [x] Stateless Ably broker with deterministic channels and capability token minting.
- [x] 36 dedicated unit and integration tests passing.

### Planned for Phase 5.6 Prompt 2 (Frontend & Client Integration)
- [ ] Client-side Ably WebSocket connection hook (`useAblyChat`).
- [ ] Responsive Chat Split-View Layout (Conversations Sidebar + Message Thread).
- [ ] Group Management Dialog for Faculty (add/remove students, configure broadcast mode).
- [ ] Real-time presence indicators and typing indicators.
- [ ] Live unread badge updates in collegiate navigation.
