# Architecture Decision Record (ADR)
## ADR-009: Data Modeling — Reference vs. Embedding Strategy

> **Status:** Approved Baseline (Phase 1, Part 1.4)  
> **Date:** November 2026  
> **Deciders:** Senior Database Architect, Engineering Lead  
> **Target System:** Axis LinkUp MongoDB Persistence Engine  

---

## 1. Context & Problem Statement

MongoDB is a document database offering two primary mechanisms for representing entity relationships: **Embedding** (storing child data directly inside parent documents) and **Referencing** (storing related entities in separate collections and linking them via `ObjectId`).

In Axis LinkUp, we must establish a consistent, deterministic data modeling strategy that prevents two catastrophic anti-patterns:
1. **The Unbounded Array Anti-Pattern:** Embedding collections that grow indefinitely (e.g., chat messages in a channel, notice read receipts), which would breach MongoDB's 16MB document size limit and cause severe write contention.
2. **The "Relational MongoDB" Anti-Pattern:** Normalizing every single entity into tiny collections, resulting in excessive application-level queries and slow aggregate joins.

---

## 2. Decision Drivers

- **Document Size Ceiling:** Strict 16MB BSON document limit.
- **Write Performance & Lock Contention:** High-frequency updates (e.g., 50 students sending messages in a course chat room) must not block each other.
- **Atomic Read Efficiency:** Common views (e.g., opening a notice with its attachments or opening a ticket with its comment thread) should require only one database read operation.
- **Memory Optimization:** Avoid loading unnecessary multi-megabyte child arrays when only high-level parent metadata is needed.

---

## 3. Options Considered

### Option 1: Aggressive Normalization (Relational Reference Everything)
- Place every sub-entity in its own collection (e.g., `NoticeAttachments`, `RequestComments`, `PollOptions`).
- **Pros:** Zero risk of document size bloat; clean relational parity.
- **Cons:** Destroys MongoDB's primary performance advantage; requires multiple queries or expensive `$lookup` aggregation stages for even the simplest UI screens.

### Option 2: Aggressive Embedding (Document Centric Everything)
- Embed everything inside root documents (e.g., embed all `chat_messages` inside `chat_channels`, embed all `submissions` inside `assignments`).
- **Pros:** Single-document reads for entire feature suites.
- **Cons:** Fatal failure mode: chat channels and assignment submissions grow unbounded, rapidly degrading performance and crashing once document size exceeds 16MB.

### Option 3: Balanced Bounded Strategy (Recommended & Approved)
- Apply strict criteria: **Embed only when child arrays are bounded ($N \le 15$) and always co-queried with the parent. Reference whenever growth is unbounded, updated concurrently, or managed independently.**

---

## 4. Decision

**Adopt Option 3: The Balanced Bounded Strategy.**

- **Embedded Entities:**
  - Notice attachments (`notices.attachments[]`, max 5).
  - Service request timeline comments (`service_requests.comments[]`, max 15).
  - Poll choices (`polls.options[]`, max 10).
  - Student and Faculty role-specific profile metadata.
- **Referenced Collections:**
  - Chat messages (`chat_messages` referencing `channelId`).
  - Notice read receipts (`notice_receipts` referencing `noticeId` and `userId`).
  - Assignment submissions (`submissions` referencing `assignmentId` and `studentId`).
  - Room reservations (`room_reservations` referencing `roomId`).

---

## 5. Advantages & Positive Consequences

1. **Safety from 16MB Ceiling:** Zero chance of any document exceeding BSON size boundaries.
2. **Optimal Query Latency:** Notices and service requests load their immediate child metadata in a single read query.
3. **Write Isolation:** Individual student chat messages and submissions write to independent documents, eliminating document-level write lock bottlenecks.

---

## 6. Disadvantages & Negative Consequences

1. **No Cascading Relational Deletions:** Deleting a parent notice or channel requires the application to explicitly clean up or soft-delete child records.

---

## 7. Mitigation Strategies & Future Considerations

- **Mongoose Middleware Hooks:** Implement `pre('deleteOne')` and `pre('deleteMany')` hooks in Mongoose schemas to automatically cascade deletions to referenced child collections.
- **Archival Jobs:** Scheduled TTL indexes and cleanup tasks automate the deletion of orphaned receipts and temporary data.

