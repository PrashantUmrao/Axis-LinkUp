# Phase 5.4 Backend Implementation Report: Database + Notices + Polls
**Axis LinkUp — Official Campus Communication & Productivity Platform**  
*Axis Institute of Technology and Management (AITM), Kanpur*  
**Date:** November 15, 2026 | **Status:** COMPLETED & VERIFIED | **Quality Gate:** PASS (466/466 Tests)

---

## 1. Executive Summary

Phase 5.4 Backend Implementation delivers a robust, highly secure, and context-aware foundation for the **Notices & Collegiate Bulletins** and **Campus Polling & Cryptographic Voting** subsystems. Designed to replace informal, fragmented messaging channels with an official, audited institutional record, the architecture strictly upholds all five institutional policy decisions frozen by university leadership.

### Quality Gate Summary
- **Unit & Integration Tests:** **466 / 466 PASSING** across 142 test suites (0 failed, 0 skipped).
- **Notices Subsystem Test Suite:** 32 comprehensive tests passing in [notice-backend.test.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/tests/unit/notice-backend.test.ts).
- **Polls Subsystem Test Suite:** 33 comprehensive tests passing in [poll-backend.test.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/tests/unit/poll-backend.test.ts).
- **TypeScript Static Verification:** `tsc --noEmit` exited with **0 errors**.
- **ESLint Code Quality:** ESLint exited with **0 errors and 0 warnings**.
- **Next.js App Router Production Build:** **23 static / 31 dynamic route segments compiled cleanly**.

---

## 2. Institutional Policy Compliance & Security Invariants

| Policy ID | Institutional Invariant | Technical Implementation | Verification Method |
| :--- | :--- | :--- | :--- |
| **Policy 1** | **Faculty Publishing Scopes** | Faculty members are permitted to publish course/section-specific notices within their assigned department. Department-wide circulars require HOD authorization. College-wide and urgent notices require Director or SysAdmin authorization. | `NoticeService.validatePublishingAuthority()` enforces strict scope hierarchies. Verified in `tests/unit/notice-backend.test.ts` (Subtests 1-12). |
| **Policy 2** | **Immutable Voting Ballots** | Student ballots are strictly immutable upon submission. No revoting, altering choices, or revoking ballots is permitted. | Unique index `{ pollId: 1, voterIdentifier: 1 }` blocks replay. Attempting duplicate vote triggers `ConflictError` (HTTP 409). |
| **Policy 3** | **Student Poll Prohibition** | Students are strictly prohibited from initiating campus polls. Only authorized Faculty, HOD, Director, and SysAdmin roles may create polls within approved scopes. | Hard authorization gate in `PollService.validatePollAuthority()`. Rejects students with `ForbiddenError` (HTTP 403). |
| **Policy 4** | **Indefinite Archival Retention** | Notices and polls are never purged after 90 days. Documents are transitioned to status `'archived'` and retained indefinitely. | No TTL expiry index defined on `notices` or `polls`. Status transitions to `'archived'` are preserved for compliance auditing. |
| **Policy 5** | **Read Receipts & IP Privacy** | Notices support optional statutory acknowledgment (`requiresAcknowledgment: boolean`), recording `acknowledgedAt: Date`. **No IP addresses are collected, logged, or stored**. | `NoticeReceiptModel` schema strictly excludes IP fields. `acknowledgeNotice()` records timestamp only. Verified via unit assertion. |

---

## 3. Database Schema & Index Architecture

Four high-performance Mongoose collections were implemented with compound indexes and sparse lookups:

### 3.1. Notices Collection (`notices`)
- **File:** [notice.model.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/models/notice.model.ts)
- **Key Fields:** `title`, `contentMarkdown`, `summary`, `category`, `priority` (`normal`, `important`, `urgent`), `status` (`draft`, `published`, `archived`), `targetScope`, `authorId`, `authorSnapshot`, `isPinned`, `requiresAcknowledgment`, `publishedAt`, `expiresAt`, `readCount`, `acknowledgmentCount`, `isDeleted`.
- **Compound & Search Indexes:**
  - `idx_notices_feed_scope`: `{ 'targetScope.scopeType': 1, status: 1, isPinned: -1, publishedAt: -1 }` (Optimizes default feed delivery)
  - `idx_notices_dept_feed`: `{ 'targetScope.departmentIds': 1, status: 1, publishedAt: -1 }` (Optimizes departmental filtering)
  - `idx_notices_author_desk`: `{ authorId: 1, status: 1, createdAt: -1 }` (Optimizes desk dashboard lookups)
  - `idx_notices_text_search`: Text index on `{ title: 'text', contentMarkdown: 'text', summary: 'text' }` with weights `{ title: 10, summary: 5, contentMarkdown: 1 }` (High-speed collegiate search)

### 3.2. Notice Receipts Collection (`notice_receipts`)
- **File:** [notice-receipt.model.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/models/notice-receipt.model.ts)
- **Key Fields:** `noticeId`, `userId`, `readAt`, `acknowledgedAt`. **No IP address or device fingerprinting fields**.
- **Indexes:**
  - Compound Unique Index: `{ noticeId: 1, userId: 1 }` (Guarantees one receipt document per user-notice pair)
  - `{ userId: 1, readAt: -1 }` (Powers unread count aggregations and personal activity logs)

### 3.3. Polls Collection (`polls`)
- **File:** [poll.model.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/models/poll.model.ts)
- **Key Fields:** `question`, `description`, `type` (`single`, `multiple`), `maxSelections`, `options` (Embedded subdocuments: `_id`, `text`, `voteCount`), `isAnonymous`, `resultsVisibility` (`always`, `after_vote`, `after_close`, `creator_only`), `status` (`draft`, `active`, `closed`, `archived`), `targetScope`, `creatorId`, `creatorSnapshot`, `totalVotes`, `publishedAt`, `closedAt`, `expiresAt`, `isDeleted`.
- **Indexes:**
  - `idx_polls_feed_active`: `{ status: 1, createdAt: -1 }`
  - `idx_polls_dept_feed`: `{ 'targetScope.departmentIds': 1, status: 1, createdAt: -1 }`
  - `idx_polls_creator_desk`: `{ creatorId: 1, status: 1, createdAt: -1 }`

### 3.4. Poll Votes Collection (`poll_votes`)
- **File:** [poll-vote.model.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/models/poll-vote.model.ts)
- **Key Fields:** `pollId`, `voterIdentifier`, `selectedOptionIds`, `votedAt`, `createdAt`.
- **Unique Constraint:**
  - Compound Unique Index: `{ pollId: 1, voterIdentifier: 1 }` (Enforces one-vote-per-identity at MongoDB database engine level).

---

## 4. Cryptographic Voter Privacy & ACID Voting Engine

### 4.1. Cryptographic Anonymization (HMAC-SHA256)
To satisfy student privacy while guaranteeing electoral integrity:
- When `isAnonymous: true`, the system derives:
  $$\text{voterIdentifier} = \text{HMAC-SHA256}(\text{userId} + \text{":"} + \text{pollId}, \text{secret})$$
- **Privacy Guarantees:**
  1. The raw `userId` is never persisted in `poll_votes`.
  2. The hash is unique per poll; ballots cast across different polls cannot be correlated or linked to de-anonymize the voter.
  3. The database compound unique index `{ pollId: 1, voterIdentifier: 1 }` natively prevents double-voting without knowing who voted for which option.

### 4.2. Atomic Ballot Recording & Fallback Resilience
- In production (MongoDB Atlas Replica Set), `PollRepository.recordVote()` executes within a multi-document ACID transaction:
  1. Inserts the ballot in `poll_votes`.
  2. Increments option tallies in `polls.options.$[elem].voteCount` using array filters.
  3. Increments `polls.totalVotes`.
- In non-replica set or standalone environments (e.g., local mock runners), the repository falls back to sequential atomic execution, trapping MongoServerError code `11000` (duplicate key) and translating it into a `ConflictError` (HTTP 409).

---

## 5. REST API Specifications & Routing Matrix

### Notices Module Endpoints
| HTTP Method | Route | Description | Auth & Scoping Rules |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notices` | Cursor-paginated notice feed | Authenticated users; filtered by target audience and role. |
| `POST` | `/api/v1/notices` | Create draft or published notice | Faculty (course/section only), HOD (department only), Director/SysAdmin (global). Students blocked (403). Returns 201. |
| `GET` | `/api/v1/notices/unread-count` | Caller's unread published notice count | Authenticated users; calculates audience targeting delta against receipts. |
| `GET` | `/api/v1/notices/[id]` | Notice detail; auto-marks read | Audience verification; records read receipt and increments `readCount`. |
| `PATCH` | `/api/v1/notices/[id]` | Update notice | Notice author, assigned HOD, or System Administrator. |
| `DELETE` | `/api/v1/notices/[id]` | Soft-delete notice | Notice author, assigned HOD, or System Administrator. |
| `POST` | `/api/v1/notices/[id]/publish` | Publish draft notice | Notice author, assigned HOD, or System Administrator. |
| `POST` | `/api/v1/notices/[id]/archive` | Archive notice | Notice author, assigned HOD, or System Administrator. |
| `POST` | `/api/v1/notices/[id]/receipt` | Statutory acknowledgment | Target audience member. Rejects if not required. Records timestamp (no IP). |
| `GET` | `/api/v1/notices/[id]/receipts` | Receipt ledger and reader stats | Notice author, assigned HOD, Director, or System Administrator. |

### Polls Module Endpoints
| HTTP Method | Route | Description | Auth & Scoping Rules |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/polls` | Cursor-paginated poll feed | Audience matching; applies context-aware masking policies. |
| `POST` | `/api/v1/polls` | Create new poll | Faculty (department only), HOD (department only), Director/SysAdmin (global). Students blocked (403). Returns 201. |
| `GET` | `/api/v1/polls/[id]` | Poll details with masked results | Context-aware projection based on ballot status and visibility rule. |
| `DELETE` | `/api/v1/polls/[id]` | Soft-delete poll | Poll creator, assigned HOD, or System Administrator. |
| `POST` | `/api/v1/polls/[id]/vote` | Cast immutable ballot | Audience matching; checks expiration; enforces one ballot (409 on duplicate). |
| `GET` | `/api/v1/polls/[id]/results` | Aggregated percentage breakdown | Accessible according to visibility policy (`always`, `after_vote`, `after_close`, `creator_only`). |
| `POST` | `/api/v1/polls/[id]/close` | Early closure of active poll | Poll creator, assigned HOD, Director, or System Administrator. |
| `POST` | `/api/v1/polls/[id]/archive` | Archive closed poll | Poll creator, assigned HOD, or System Administrator. |

---

## 6. Implementation Verification File Index

### Models, Schemas & Types
- Types: [notice.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/types/notice.ts), [notice-receipt.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/types/notice-receipt.ts), [poll.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/types/poll.ts), [poll-vote.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/types/poll-vote.ts)
- Validations: [notice.schema.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/validations/notice.schema.ts), [poll.schema.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/validations/poll.schema.ts)
- Models: [notice.model.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/models/notice.model.ts), [notice-receipt.model.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/models/notice-receipt.model.ts), [poll.model.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/models/poll.model.ts), [poll-vote.model.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/models/poll-vote.model.ts)
- Repositories: [notice.repository.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/repositories/notice.repository.ts), [poll.repository.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/repositories/poll.repository.ts), [user.repository.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/db/repositories/user.repository.ts)
- Services: [notice.service.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/services/notice.service.ts), [poll.service.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/lib/services/poll.service.ts)

### Route Handlers
- Notices: [feed/create route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/notices/route.ts), [unread-count route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/notices/unread-count/route.ts), [[id] route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/notices/[id]/route.ts), [publish route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/notices/[id]/publish/route.ts), [archive route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/notices/[id]/archive/route.ts), [receipt route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/notices/[id]/receipt/route.ts), [receipts stats route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/notices/[id]/receipts/route.ts)
- Polls: [feed/create route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/polls/route.ts), [[id] route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/polls/[id]/route.ts), [vote route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/polls/[id]/vote/route.ts), [results route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/polls/[id]/results/route.ts), [close route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/polls/[id]/close/route.ts), [archive route.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/api/v1/polls/[id]/archive/route.ts)

### Test Suites
- Notices Backend: [notice-backend.test.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/tests/unit/notice-backend.test.ts) (32 tests passing)
- Polls Backend: [poll-backend.test.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/tests/unit/poll-backend.test.ts) (33 tests passing)
- Complete Suite: 466 tests passing across 142 suites.

---

## 7. Sign-off & Next Phase Readiness

The backend implementation for Phase 5.4 is complete, verified, and adheres strictly to all institutional governance requirements:
- **No fake or mock data** has been injected into application code.
- **Zero UI modifications** have been introduced in this phase, leaving frontend dashboards cleanly separated for Phase 5.4.2 UI integration.
- All institutional policies (1 through 5) are codified at the service, schema, and database engine levels.
- The project is fully primed to proceed to **Phase 5.4.2: Frontend UI & Interactive Notice Board / Voting Client Integration**.

