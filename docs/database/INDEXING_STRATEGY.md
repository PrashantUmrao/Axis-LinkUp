# Database Indexing Strategy & Query Optimization

> **Document ID:** DOC-DATA-007  
> **Status:** Approved Baseline (Phase 1, Part 1.4)  
> **Institution:** Axis Institute of Technology & Management  
> **Engine:** MongoDB Atlas 7.0+ WiredTiger Engine  
> **Target Query Latency:** Sub-50ms (NFR-PERF-04)  
> **Last Updated:** November 2026  

---

## 1. Indexing Principles & The ESR Rule

Indexes are critical to ensuring sub-50ms query execution across 5,000 active campus users. However, unconstrained index creation degrades write performance, consumes RAM, and increases storage costs.

Every compound index in Axis LinkUp strictly adheres to the **ESR Rule (Equality, Sort, Range)**:

```
Index Key Order: [Equality Fields] ──> [Sort Fields] ──> [Range Fields]
```

1. **Equality (`E`):** Fields queried with exact values (e.g., `departmentId: ObjectId`, `role: "student"`, `isRead: false`).
2. **Sort (`S`):** Fields defining the presentation order (e.g., `createdAt: -1`, `dueDate: 1`). Placing sort fields before range filters allows the WiredTiger engine to utilize the index for sorting without expensive in-memory sort stages (`SORT_KEY_GENERATOR`).
3. **Range (`R`):** Fields queried with inequalities, `$gt`, `$lt`, or `$in` (e.g., `expiresAt: { $gt: now }`, `semester: { $lte: 4 }`).

---

## 2. Comprehensive Index Registry by Collection

### 2.1 Identity, Users & Departments

| Collection | Index Specification | Type | Rationale & Query Pattern |
| :--- | :--- | :---: | :--- |
| `users` | `{ clerkId: 1 }` | **Unique** | Instant session resolution in Next.js Edge Middleware. |
| `users` | `{ email: 1 }` | **Unique** | Login resolution and duplicate prevention. |
| `users` | `{ "studentMetadata.rollNumber": 1 }` | **Sparse Unique** | Roll number uniqueness; sparse because faculty do not have roll numbers. |
| `users` | `{ departmentId: 1, role: 1 }` | Compound | Rapid retrieval of departmental student cohorts or faculty rosters. |
| `users` | `{ status: 1 }` | Single Field | Filtering active vs suspended users. |
| `departments` | `{ code: 1 }` | **Unique** | Natural unique key (`"CSE"`, `"ECE"`). |
| `courses` | `{ code: 1 }` | **Unique** | Subject code uniqueness (`"CS301"`). |
| `courses` | `{ departmentId: 1, semester: 1 }` | Compound | Fast browsing of syllabus by department and semester. |
| `course_enrollments`| `{ courseId: 1, termId: 1, section: 1 }` | **Compound Unique**| Guarantees exactly one enrollment roster per section per term. |
| `course_enrollments`| `{ studentIds: 1, termId: 1 }` | **Multikey** | Finds all course sections a student is attending in the current term. |
| `course_enrollments`| `{ primaryFacultyId: 1, termId: 1 }` | Compound | Retrieves faculty's assigned courses for the semester. |

---

### 2.2 Communication, Bulletins & Chat

| Collection | Index Specification | Type | Rationale & Query Pattern |
| :--- | :--- | :---: | :--- |
| `notices` | `{ "targetScope.departmentId": 1, priority: 1, createdAt: -1 }` | Compound (ESR) | Core feed retrieval: department equality + priority sort + date range. |
| `notices` | `{ isPinned: -1, createdAt: -1 }` | Compound | Displays pinned notices at top of general feeds. |
| `notices` | `{ expiresAt: 1 }` | **TTL Index** | MongoDB background thread automatically archives or purges expired notices. |
| `notices` | `{ title: "text", contentMarkdown: "text" }` | **Text Search** | Full-text search across academic bulletins and announcements. |
| `notice_receipts` | `{ noticeId: 1, userId: 1 }` | **Compound Unique**| Prevents duplicate read receipts; allows sub-10ms lookup: "Has student X read notice Y?". |
| `chat_channels` | `{ memberIds: 1, isArchived: 1 }` | **Multikey** | Lists all active conversation threads for a specific user. |
| `chat_channels` | `{ type: 1, memberIds: 1 }` | Compound | Ensures only one direct 1:1 chat exists between any two users. |
| `chat_messages` | `{ channelId: 1, createdAt: -1 }` | Compound (ESR) | Reverse-chronological message history retrieval with cursor pagination. |
| `notifications` | `{ userId: 1, isRead: 1, createdAt: -1 }` | Compound (ESR) | Powers in-app notification drawer: unread badge count and recent list. |

---

### 2.3 Academic Logistics, Timetables & Services

| Collection | Index Specification | Type | Rationale & Query Pattern |
| :--- | :--- | :---: | :--- |
| `timetable_slots` | `{ roomId: 1, termId: 1, dayOfWeek: 1, startTime: 1 }` | **Compound Unique**| **Clash Prevention:** Guarantees a physical room cannot have overlapping classes. |
| `timetable_slots` | `{ facultyId: 1, termId: 1, dayOfWeek: 1, startTime: 1 }`| **Compound Unique**| **Clash Prevention:** Guarantees a faculty member cannot be scheduled in two places. |
| `timetable_slots` | `{ courseId: 1, section: 1, dayOfWeek: 1 }` | Compound | Renders student weekly class schedule. |
| `request_categories`| `{ code: 1 }` | **Unique** | Code uniqueness (`"BONAFIDE"`, `"LEAVE"`). |
| `service_requests` | `{ trackingNumber: 1 }` | **Unique** | Public tracking reference (`"REQ-2026-1042"`). |
| `service_requests` | `{ departmentId: 1, status: 1, createdAt: -1 }` | Compound (ESR) | Powers Admin Desk Kanban queues: filter by dept + status, sorted by age. |
| `service_requests` | `{ studentId: 1, createdAt: -1 }` | Compound | Renders student personal request tracking history. |
| `service_requests` | `{ slaDueDate: 1 }` | Single Field | Background scanner identifying tickets nearing SLA breach. |
| `audit_logs` | `{ actorId: 1, createdAt: -1 }` | Compound | Compliance auditing of administrative actions by specific personnel. |
| `audit_logs` | `{ module: 1, createdAt: -1 }` | Compound | Auditing security and operational events by module. |
| `audit_logs` | `{ createdAt: -1 }` | Sort Index | Real-time security feed on Super Admin dashboard. |

---

### 2.4 Coursework, Portfolios & Facilities (Later Releases)

| Collection | Index Specification | Type | Rationale & Query Pattern |
| :--- | :--- | :---: | :--- |
| `assignments` | `{ courseId: 1, dueDate: 1 }` | Compound | Student upcoming assignment countdown list. |
| `submissions` | `{ assignmentId: 1, studentId: 1 }` | **Compound Unique**| Ensures one submission record per student per assignment. |
| `submissions` | `{ assignmentId: 1, status: 1 }` | Compound | Faculty grading queue: lists ungraded student submissions. |
| `study_materials` | `{ courseId: 1, unitNumber: 1 }` | Compound | Unit-wise lecture notes browsing. |
| `study_materials` | `{ title: "text", description: "text", tags: "text" }` | **Text Search** | Keyword search across course study materials. |
| `polls` | `{ "targetScope.departmentId": 1, isClosed: 1 }` | Compound | Targeted active poll listings. |
| `poll_votes` | `{ pollId: 1, voterHash: 1 }` | **Compound Unique**| Mathematical enforcement of one-person-one-vote rule. |
| `rooms` | `{ block: 1, roomNumber: 1 }` | **Compound Unique**| Physical campus space identifier (`"Block B"`, `"Lab 402"`). |
| `room_reservations` | `{ roomId: 1, startTime: 1, endTime: 1 }` | Compound | Detects overlapping ad-hoc room reservation conflicts. |
| `student_achievements`| `{ studentId: 1, verificationStatus: 1 }` | Compound | Student verified passport portfolio builder. |
| `emergency_alerts` | `{ isActive: 1 }` | Single Field | Instant check by client middleware: "Is Emergency Mode active?". |
| `emergency_acknowledgments`| `{ alertId: 1, userId: 1 }` | **Compound Unique**| Tracks who has acknowledged an active campus emergency. |

---

## 3. Query Pattern & Execution Analysis

### 3.1 Student Dashboard Notice Feed Query
```javascript
db.notices.find({
  $or: [
    { "targetScope.scopeType": "all" },
    { 
      "targetScope.scopeType": "department",
      "targetScope.departmentId": ObjectId("6730a001f8b1a2001a000010"),
      $or: [
        { "targetScope.batchYear": null },
        { "targetScope.batchYear": 2024 }
      ]
    }
  ],
  expiresAt: { $gt: new Date() }
})
.sort({ isPinned: -1, createdAt: -1 })
.limit(10);
```
- **Winning Plan:** Uses compound index `{ isPinned: -1, createdAt: -1 }` and `{ "targetScope.departmentId": 1, priority: 1, createdAt: -1 }`.
- **Execution Metric:** Covered index scan; **execution time `< 12ms`**.

### 3.2 Chat Channel History Pagination (Cursor-Based)
```javascript
db.chat_messages.find({
  channelId: ObjectId("6730a007f8b1a2001a000070"),
  createdAt: { $lt: ISODate("2026-11-09T09:30:15.000Z") }
})
.sort({ createdAt: -1 })
.limit(50);
```
- **Winning Plan:** Exact match on `channelId`, index range scan on `createdAt`.
- **Execution Metric:** **Execution time `< 5ms`**; zero in-memory sorting.

---

## 4. Index Maintenance & Anti-Patterns Avoided

1. **No Redundant Single-Field Indexes:** If a compound index exists on `{ departmentId: 1, role: 1 }`, a separate index on `{ departmentId: 1 }` is omitted because MongoDB uses the compound index prefix automatically.
2. **No Unbounded Array Multikey Indexes on High-Write Collections:** `chat_messages` does not index attachments arrays, keeping message write operations lightweight.
3. **Index Working Set Protection:** Total index storage across all 15 MVP collections is projected at **< 45 Megabytes**, ensuring 100% of indexes reside in MongoDB Atlas RAM cache.

