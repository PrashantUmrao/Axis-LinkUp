# Detailed Collection Schema Specifications

> **Document ID:** DOC-DATA-005  
> **Status:** Approved Baseline (Phase 1, Part 1.4)  
> **Institution:** Axis Institute of Technology & Management  
> **Total Collections Detailed:** 25 Collections  
> **Schema Standard:** Mongoose 8+ / MongoDB BSON Schema  
> **Last Updated:** November 2026  

---

## Table of Contents
1. [Core Academic & Identity Collections (MVP)](#1-core-academic--identity-collections-mvp)
   - `users`, `departments`, `courses`, `academic_terms`, `course_enrollments`
2. [Communication & Notice Collections (MVP)](#2-communication--notice-collections-mvp)
   - `notices`, `notice_receipts`, `chat_channels`, `chat_messages`, `notifications`
3. [Academic Scheduling & Timetable Collections (MVP)](#3-academic-scheduling--timetable-collections-mvp)
   - `calendar_events`, `timetable_slots`
4. [Administrative & Governance Collections (MVP)](#4-administrative--governance-collections-mvp)
   - `request_categories`, `service_requests`, `audit_logs`
5. [Coursework, Spaces & Portfolios Collections (Later Releases)](#5-coursework-spaces--portfolios-collections-later-releases)
   - `assignments`, `submissions`, `study_materials`, `polls`, `poll_votes`, `rooms`, `room_reservations`, `student_achievements`, `emergency_alerts`, `emergency_acknowledgments`

---

## 1. Core Academic & Identity Collections (MVP)

### 1.1 Collection: `users`
- **Purpose:** Primary user profile and role record, synchronized with Clerk.
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key (`_id: 1`) |
| `clerkId` | `String` | Yes | None | Must start with `user_` | — | **Unique Index** (`{ clerkId: 1 }`) |
| `email` | `String` | Yes | None | Lowercase, valid RFC 5322 email regex | — | **Unique Index** (`{ email: 1 }`) |
| `fullName` | `String` | Yes | None | Trimmed, 2–100 chars | — | Standard Index |
| `role` | `String` | Yes | None | Enum: `['student', 'faculty', 'admin', 'super_admin']` | — | Compound (`{ departmentId: 1, role: 1 }`) |
| `departmentId` | `ObjectId` | Optional | None | Valid ObjectId | `departments` | Compound Index |
| `phone` | `String` | Optional | None | Regex: `^\+?[1-9]\d{9,14}$` (E.164 format) | — | None (PII protected) |
| `avatarUrl` | `String` | Optional | None | Valid Cloudinary URL | — | None |
| `status` | `String` | Yes | `'active'` | Enum: `['invited', 'active', 'suspended', 'archived']` | — | Standard Index (`{ status: 1 }`) |
| `studentMetadata` | `Subdocument` | Optional | `null` | Only present if `role === 'student'` | — | Embedded Object |
| `studentMetadata.rollNumber`| `String` | Optional | None | Uppercase alphanumeric (e.g., `"24BCSE104"`) | — | **Sparse Unique Index** |
| `studentMetadata.batchYear` | `Number` | Optional | None | Range: `2020` to `2035` | — | Compound Index |
| `studentMetadata.currentSemester`| `Number` | Optional | None | Range: `1` to `8` | — | None |
| `studentMetadata.section` | `String` | Optional | None | Uppercase single char / string (e.g., `"A"`) | — | Compound Index |
| `facultyMetadata` | `Subdocument` | Optional | `null` | Only present if `role === 'faculty'` | — | Embedded Object |
| `facultyMetadata.designation` | `String` | Optional | None | e.g., `"Associate Professor"` | — | None |
| `facultyMetadata.cabinRoom` | `String` | Optional | None | Max 50 chars | — | None |
| `facultyMetadata.officeHours`| `Subdocument` | Optional | `null` | Office hours schedule | — | Embedded Object |
| `facultyMetadata.officeHours.start` | `String` | Optional | `"10:00"` | Regex: `^([01]\d\|2[0-3]):([0-5]\d)$` | — | None |
| `facultyMetadata.officeHours.end` | `String` | Optional | `"12:00"` | Regex: `^([01]\d\|2[0-3]):([0-5]\d)$` | — | None |
| `facultyMetadata.officeHours.isAcceptingDMs` | `Boolean` | Yes | `true` | Boolean flag | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | Sort Index |
| `updatedAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 1.2 Collection: `departments`
- **Purpose:** Academic branches within the institution.
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `code` | `String` | Yes | None | Uppercase, 2–10 chars (e.g., `"CSE"`, `"ME"`) | — | **Unique Index** (`{ code: 1 }`) |
| `name` | `String` | Yes | None | Trimmed, 3–150 chars | — | Standard Index |
| `hodId` | `ObjectId` | Optional | `null` | User must have `faculty` or `admin` role | `users` | Standard Index |
| `isActive` | `Boolean` | Yes | `true` | Boolean | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |
| `updatedAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 1.3 Collection: `courses`
- **Purpose:** Academic subject catalog offered by departments.
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `code` | `String` | Yes | None | Uppercase alphanumeric (e.g., `"CS301"`) | — | **Unique Index** (`{ code: 1 }`) |
| `title` | `String` | Yes | None | Trimmed, 3–150 chars | — | Text Index |
| `departmentId` | `ObjectId` | Yes | None | Must reference active Department | `departments` | Compound (`{ departmentId: 1, semester: 1 }`) |
| `semester` | `Number` | Yes | None | Range: `1` to `8` | — | Compound Index |
| `credits` | `Number` | Yes | `3` | Range: `1` to `6` | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |
| `updatedAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 1.4 Collection: `academic_terms`
- **Purpose:** Institutional semester date boundaries.
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `name` | `String` | Yes | None | e.g., `"Odd Semester 2026-27"` | — | **Unique Index** (`{ name: 1 }`) |
| `startDate` | `Date` | Yes | None | Must be earlier than `endDate` | — | Sort Index |
| `endDate` | `Date` | Yes | None | Must be later than `startDate` | — | None |
| `isCurrent` | `Boolean` | Yes | `false` | Only one term can have `true` | — | Standard Index (`{ isCurrent: 1 }`) |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 1.5 Collection: `course_enrollments`
- **Purpose:** Connects course sections to instructors and enrolled student rosters.
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `courseId` | `ObjectId` | Yes | None | Must reference Course | `courses` | Compound Index |
| `termId` | `ObjectId` | Yes | None | Must reference AcademicTerm | `academic_terms` | Compound Index |
| `section` | `String` | Yes | `"A"` | Uppercase, max 5 chars | — | Compound Index |
| `primaryFacultyId` | `ObjectId` | Yes | None | Must reference Faculty User | `users` | Standard Index (`{ primaryFacultyId: 1 }`) |
| `coFacultyIds` | `Array<ObjectId>` | Optional | `[]` | Array of Faculty User ObjectIds | `users` | None |
| `studentIds` | `Array<ObjectId>` | Optional | `[]` | Array of Student User ObjectIds | `users` | Multikey Index (`{ studentIds: 1 }`) |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

## 2. Communication & Notice Collections (MVP)

### 2.1 Collection: `notices`
- **Purpose:** Official bulletins and targeted announcements (MOD-07).
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `title` | `String` | Yes | None | Trimmed, 5–200 chars | — | Text Index |
| `contentMarkdown` | `String` | Yes | None | Sanitized Markdown, max 10,000 chars | — | Text Index |
| `authorId` | `ObjectId` | Yes | None | Must reference User | `users` | Standard Index |
| `priority` | `String` | Yes | `'normal'` | Enum: `['normal', 'important', 'urgent']` | — | Compound Index |
| `targetScope` | `Subdocument` | Yes | None | Embedded targeting criteria | — | Embedded Object |
| `targetScope.scopeType` | `String` | Yes | `'all'` | Enum: `['all', 'department', 'year', 'section']` | — | Compound Index |
| `targetScope.departmentId` | `ObjectId` | Optional | `null` | Required if scope is not `'all'` | `departments` | Compound Index |
| `targetScope.batchYear` | `Number` | Optional | `null` | e.g., `2024` | — | Compound Index |
| `targetScope.section` | `String` | Optional | `null` | e.g., `"A"` | — | None |
| `attachments` | `Array<Subdocument>`| Optional | `[]` | Max 5 attachments per notice | — | Embedded Array |
| `attachments.$.name` | `String` | Yes | None | File display name | — | None |
| `attachments.$.url` | `String` | Yes | None | Cloudinary secure delivery URL | — | None |
| `attachments.$.sizeBytes` | `Number` | Yes | None | Max 52,428,800 bytes (50MB) | — | None |
| `attachments.$.mimeType` | `String` | Yes | None | e.g., `"application/pdf"` | — | None |
| `isPinned` | `Boolean` | Yes | `false` | Pin notice to top of feed | — | Compound Index |
| `requiresAcknowledgment` | `Boolean` | Yes | `false` | Requires explicit student receipt click | — | None |
| `expiresAt` | `Date` | Yes | None | Date in future | — | **TTL Index** (`{ expiresAt: 1 }`) |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | Compound Index |

---

### 2.2 Collection: `notice_receipts`
- **Purpose:** Acknowledgment tracking for targeted bulletins.
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `noticeId` | `ObjectId` | Yes | None | Must reference Notice | `notices` | Compound Unique (`{ noticeId: 1, userId: 1 }`) |
| `userId` | `ObjectId` | Yes | None | Must reference User | `users` | Compound Unique Index |
| `readAt` | `Date` | Yes | Auto | Timestamp when notice was opened | — | None |
| `acknowledgedAt` | `Date` | Optional | `null` | Timestamp when user confirmed receipt | — | None |

---

### 2.3 Collection: `chat_channels`
- **Purpose:** Messaging spaces (DMs, course channels, department desks).
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `name` | `String` | Yes | None | Channel title, 2–100 chars | — | Standard Index |
| `type` | `String` | Yes | None | Enum: `['direct', 'course', 'department', 'custom']` | — | Compound Index |
| `courseId` | `ObjectId` | Optional | `null` | Present if `type === 'course'` | `courses` | Standard Index |
| `departmentId` | `ObjectId` | Optional | `null` | Present if `type === 'department'` | `departments` | Standard Index |
| `memberIds` | `Array<ObjectId>` | Yes | `[]` | Array of participant User ObjectIds | `users` | **Multikey Index** (`{ memberIds: 1 }`) |
| `isArchived` | `Boolean` | Yes | `false` | Archived channels are read-only | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 2.4 Collection: `chat_messages`
- **Purpose:** Real-time messages within chat channels.
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `channelId` | `ObjectId` | Yes | None | Must reference ChatChannel | `chat_channels` | Compound Index (`{ channelId: 1, createdAt: -1 }`) |
| `senderId` | `ObjectId` | Yes | None | Must reference User | `users` | Standard Index |
| `messageBody` | `String` | Yes | None | Max 4,000 chars, trimmed | — | None |
| `attachments` | `Array<Subdocument>`| Optional | `[]` | Max 3 attachments per message | — | Embedded Array |
| `attachments.$.url` | `String` | Yes | None | Cloudinary delivery URL | — | None |
| `attachments.$.name` | `String` | Yes | None | File display name | — | None |
| `attachments.$.sizeBytes` | `Number` | Yes | None | Max 10,485,760 bytes (10MB) | — | None |
| `isDeleted` | `Boolean` | Yes | `false` | Soft delete flag (displays "Removed") | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | Compound Index |

---

### 2.5 Collection: `notifications`
- **Purpose:** In-app notification bell alerts (MOD-17).
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `userId` | `ObjectId` | Yes | None | Must reference recipient User | `users` | Compound Index (`{ userId: 1, isRead: 1, createdAt: -1 }`) |
| `title` | `String` | Yes | None | Alert header, max 100 chars | — | None |
| `message` | `String` | Yes | None | Alert body, max 500 chars | — | None |
| `category` | `String` | Yes | None | Enum: `['notice', 'request', 'assignment', 'emergency', 'system']`| — | Standard Index |
| `linkUrl` | `String` | Optional | `null` | Relative path to navigate upon click | — | None |
| `isRead` | `Boolean` | Yes | `false` | Unread flag for badge counter | — | Compound Index |
| `readAt` | `Date` | Optional | `null` | Timestamp when user viewed alert | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | Compound Index |

---

## 3. Academic Scheduling & Timetable Collections (MVP)

### 3.1 Collection: `calendar_events`
- **Purpose:** Institutional holidays, exam dates, college fests (MOD-10).
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `termId` | `ObjectId` | Yes | None | Must reference AcademicTerm | `academic_terms` | Standard Index |
| `title` | `String` | Yes | None | Event name, 3–150 chars | — | None |
| `description` | `String` | Optional | `""` | Event details | — | None |
| `category` | `String` | Yes | `'academic'` | Enum: `['holiday', 'exam', 'academic', 'cultural']` | — | Compound Index |
| `startDate` | `Date` | Yes | None | Event start timestamp | — | Compound (`{ startDate: 1, endDate: 1 }`) |
| `endDate` | `Date` | Yes | None | Must be `>= startDate` | — | Compound Index |
| `targetScope` | `Subdocument` | Optional | `{ scopeType: 'all' }` | Scoping criteria | — | Embedded Object |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 3.2 Collection: `timetable_slots`
- **Purpose:** Weekly recurring lecture, tutorial, and lab schedules (MOD-10).
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `courseId` | `ObjectId` | Yes | None | Must reference Course | `courses` | Compound Index |
| `facultyId` | `ObjectId` | Yes | None | Must reference Faculty User | `users` | **Compound Unique (Faculty Clash)** |
| `roomId` | `ObjectId` | Yes | None | Must reference Room | `rooms` | **Compound Unique (Room Clash)** |
| `termId` | `ObjectId` | Yes | None | Must reference AcademicTerm | `academic_terms` | Compound Index |
| `dayOfWeek` | `Number` | Yes | None | Range: `1` (Monday) to `6` (Saturday) | — | Compound Index |
| `startTime` | `String` | Yes | None | Regex: `^([01]\d\|2[0-3]):([0-5]\d)$` | — | Compound Index |
| `endTime` | `String` | Yes | None | Must be later than `startTime` | — | None |
| `section` | `String` | Yes | `"A"` | Section identifier (e.g., `"A"`, `"B"`) | — | Compound Index |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

## 4. Administrative & Governance Collections (MVP)

### 4.1 Collection: `request_categories`
- **Purpose:** Standardized service request templates (bonafide, leaves, etc.).
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `code` | `String` | Yes | None | Uppercase code (e.g., `"BONAFIDE"`, `"LEAVE"`) | — | **Unique Index** (`{ code: 1 }`) |
| `title` | `String` | Yes | None | Display title, 3–100 chars | — | None |
| `description` | `String` | Yes | None | Guidelines for students | — | None |
| `targetDepartmentId` | `ObjectId` | Yes | None | Fulfilling department (e.g. Registrar) | `departments` | Standard Index |
| `defaultSlaHours` | `Number` | Yes | `48` | Expected resolution turnaround in hours | — | None |
| `formSchema` | `Subdocument` | Yes | None | Dynamic JSON schema defining required fields | — | Embedded Object |
| `isActive` | `Boolean` | Yes | `true` | Active status flag | — | None |

---

### 4.2 Collection: `service_requests`
- **Purpose:** Student administrative requisition tickets (MOD-13).
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `trackingNumber` | `String` | Yes | None | Formatted ticket ID (e.g., `"REQ-2026-1042"`) | — | **Unique Index** (`{ trackingNumber: 1 }`) |
| `categoryId` | `ObjectId` | Yes | None | Must reference RequestCategory | `request_categories` | Standard Index |
| `studentId` | `ObjectId` | Yes | None | Must reference Student User | `users` | Compound (`{ studentId: 1, createdAt: -1 }`) |
| `departmentId` | `ObjectId` | Yes | None | Must reference Department | `departments` | Compound (`{ departmentId: 1, status: 1 }`) |
| `assignedAdminId` | `ObjectId` | Optional | `null` | Officer assigned to review ticket | `users` | Standard Index |
| `status` | `String` | Yes | `'submitted'` | Enum: `['submitted', 'under_review', 'approved', 'rejected', 'closed']` | — | Compound Index |
| `formData` | `Object` | Yes | None | Dynamic validated payload matching category schema | — | Embedded Object |
| `proofAttachments` | `Array<Subdocument>`| Optional | `[]` | Supporting documents uploaded by student | — | Embedded Array |
| `proofAttachments.$.url` | `String` | Yes | None | Cloudinary private delivery URL | — | None |
| `proofAttachments.$.name` | `String` | Yes | None | File display name | — | None |
| `issuedDocumentUrl` | `String` | Optional | `null` | Cloudinary URL for auto-generated certificate PDF | — | None |
| `resolutionNotes` | `String` | Optional | `""` | Administrative remarks or rejection reason | — | None |
| `comments` | `Array<Subdocument>`| Optional | `[]` | Internal & external discussion timeline | — | Embedded Array |
| `comments.$.authorId` | `ObjectId` | Yes | None | Comment author User ObjectId | `users` | None |
| `comments.$.body` | `String` | Yes | None | Note text, max 1,000 chars | — | None |
| `comments.$.isInternal` | `Boolean` | Yes | `false` | True if only visible to Admin staff | — | None |
| `comments.$.createdAt` | `Date` | Yes | Auto | Timestamp | — | None |
| `slaDueDate` | `Date` | Yes | None | Timestamp when SLA breach occurs | — | Sort Index (`{ slaDueDate: 1 }`) |
| `resolvedAt` | `Date` | Optional | `null` | Timestamp when ticket reached terminal state | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | Sort Index |

---

### 4.3 Collection: `audit_logs`
- **Purpose:** Immutable compliance and security ledger (MOD-19).
- **Release Target:** **MVP (Phase 1)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `actorId` | `ObjectId` | Yes | None | Must reference User performing action | `users` | Compound (`{ actorId: 1, createdAt: -1 }`) |
| `actorRole` | `String` | Yes | None | Role context during action execution | — | Standard Index |
| `action` | `String` | Yes | None | e.g., `"ROLE_CHANGE"`, `"APPROVE_REQUEST"` | — | Standard Index |
| `module` | `String` | Yes | None | e.g., `"MOD-01"`, `"MOD-13"`, `"MOD-16"` | — | Compound (`{ module: 1, createdAt: -1 }`) |
| `entityId` | `String` | Yes | None | Target document identifier | — | Standard Index |
| `oldState` | `Object` | Optional | `null` | Snapshot of modified fields prior to update | — | Embedded Object |
| `newState` | `Object` | Optional | `null` | Snapshot of modified fields after update | — | Embedded Object |
| `ipAddress` | `String` | Yes | None | Client IP address string | — | None |
| `userAgent` | `String` | Optional | `""` | Client browser user agent string | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp (Immutable) | — | Sort Index (`{ createdAt: -1 }`) |

---

## 5. Coursework, Spaces & Portfolios Collections (Later Releases)

### 5.1 Collection: `assignments`
- **Purpose:** Coursework briefs, rubrics, and deadlines (MOD-11).
- **Release Target:** **Phase 2 (Version 2.0)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `courseId` | `ObjectId` | Yes | None | Must reference Course | `courses` | Compound (`{ courseId: 1, dueDate: 1 }`) |
| `facultyId` | `ObjectId` | Yes | None | Must reference Faculty User | `users` | Standard Index |
| `title` | `String` | Yes | None | Assignment title, 3–150 chars | — | None |
| `description` | `String` | Yes | None | Rich text markdown brief | — | None |
| `maxMarks` | `Number` | Yes | `100` | Range: `1` to `500` | — | None |
| `dueDate` | `Date` | Yes | None | Hard submission deadline | — | Compound Index |
| `allowLate` | `Boolean` | Yes | `false` | If false, submissions reject after `dueDate` | — | None |
| `lateCutoffDate` | `Date` | Optional | `null` | Hard cutoff date if late allowed | — | None |
| `attachments` | `Array<Subdocument>`| Optional | `[]` | Reference files from faculty | — | Embedded Array |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 5.2 Collection: `submissions`
- **Purpose:** Student uploaded coursework and grading records (MOD-11).
- **Release Target:** **Phase 2 (Version 2.0)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `assignmentId` | `ObjectId` | Yes | None | Must reference Assignment | `assignments` | **Compound Unique (`{ assignmentId: 1, studentId: 1 }`)** |
| `studentId` | `ObjectId` | Yes | None | Must reference Student User | `users` | Compound Unique Index |
| `fileUrl` | `String` | Yes | None | Cloudinary private delivery URL | — | None |
| `fileName` | `String` | Yes | None | Original upload name | — | None |
| `fileSizeBytes` | `Number` | Yes | None | Max 26,214,400 bytes (25MB) | — | None |
| `submittedAt` | `Date` | Yes | Auto | Timestamp of file upload | — | Sort Index |
| `isLate` | `Boolean` | Yes | `false` | True if `submittedAt > assignment.dueDate`| — | None |
| `status` | `String` | Yes | `'submitted'` | Enum: `['submitted', 'graded', 'resubmission_requested']` | — | Standard Index |
| `score` | `Number` | Optional | `null` | Must be `<= assignment.maxMarks` | — | None |
| `feedback` | `String` | Optional | `""` | Private remarks from grading faculty | — | None |
| `gradedById` | `ObjectId` | Optional | `null` | User ObjectId of evaluating faculty | `users` | None |
| `gradedAt` | `Date` | Optional | `null` | Timestamp when score was recorded | — | None |

---

### 5.3 Collection: `study_materials`
- **Purpose:** Unit-wise lecture notes, slides, and syllabus files (MOD-12).
- **Release Target:** **Phase 2 (Version 2.0)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `courseId` | `ObjectId` | Yes | None | Must reference Course | `courses` | Compound (`{ courseId: 1, unitNumber: 1 }`) |
| `facultyId` | `ObjectId` | Yes | None | Must reference Faculty User | `users` | Standard Index |
| `unitNumber` | `Number` | Yes | `1` | Range: `1` to `10` (Syllabus unit) | — | Compound Index |
| `title` | `String` | Yes | None | Document title, 3–150 chars | — | Text Index |
| `description` | `String` | Optional | `""` | Overview of content | — | Text Index |
| `fileUrl` | `String` | Yes | None | Cloudinary authenticated delivery URL | — | None |
| `fileType` | `String` | Yes | None | e.g., `"pdf"`, `"pptx"`, `"docx"` | — | None |
| `fileSizeBytes` | `Number` | Yes | None | Max 52,428,800 bytes (50MB) | — | None |
| `downloadCount` | `Number` | Yes | `0` | Incremented atomically via `$inc` | — | None |
| `tags` | `Array<String>` | Optional | `[]` | Keyword search tags (e.g., `["3NF", "SQL"]`)| — | Text Index |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 5.4 Collection: `polls`
- **Purpose:** Single and multi-choice democratic voting topics (MOD-09).
- **Release Target:** **Phase 2 (Version 2.0)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `title` | `String` | Yes | None | Poll question, 5–250 chars | — | None |
| `description` | `String` | Optional | `""` | Background context | — | None |
| `creatorId` | `ObjectId` | Yes | None | Must reference User | `users` | Standard Index |
| `options` | `Array<Subdocument>`| Yes | None | Min 2, max 10 options | — | Embedded Array |
| `options.$._id` | `ObjectId` | Yes | Auto | Unique option identifier | — | None |
| `options.$.text` | `String` | Yes | None | Option label, 1–100 chars | — | None |
| `options.$.voteCount` | `Number` | Yes | `0` | Atomic vote accumulator | — | None |
| `isAnonymous` | `Boolean` | Yes | `true` | If true, voter IDs are cryptographically hashed | — | None |
| `targetScope` | `Subdocument` | Yes | None | Scoping criteria (same as notices) | — | Embedded Object |
| `expiresAt` | `Date` | Yes | None | Voting deadline | — | Standard Index |
| `isClosed` | `Boolean` | Yes | `false` | Manual or automated close flag | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 5.5 Collection: `poll_votes`
- **Purpose:** Individual vote records enforcing single-vote rules (MOD-09).
- **Release Target:** **Phase 2 (Version 2.0)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `pollId` | `ObjectId` | Yes | None | Must reference Poll | `polls` | **Compound Unique Index** |
| `optionId` | `ObjectId` | Yes | None | Must match `_id` in `poll.options` | — | None |
| `voterHash` | `String` | Yes | None | HMAC-SHA256 hash or User ObjectId | — | **Compound Unique (`{ pollId: 1, voterHash: 1 }`)** |
| `votedAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 5.6 Collection: `rooms`
- **Purpose:** Classrooms, lecture halls, and laboratories (MOD-14).
- **Release Target:** **Phase 2 (Version 2.0)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `block` | `String` | Yes | None | e.g., `"Block A"`, `"Block B"` | — | Compound Index |
| `roomNumber` | `String` | Yes | None | e.g., `"Lab 402"`, `"LH-101"` | — | **Compound Unique (`{ block: 1, roomNumber: 1 }`)** |
| `type` | `String` | Yes | None | Enum: `['classroom', 'computer_lab', 'mech_lab', 'seminar_hall']` | — | Standard Index |
| `seatingCapacity` | `Number` | Yes | None | Range: `10` to `500` | — | Sort Index |
| `hasProjector` | `Boolean` | Yes | `true` | AV projector flag | — | None |
| `pcCount` | `Number` | Yes | `0` | Number of desktop PCs installed | — | None |
| `isAirConditioned` | `Boolean` | Yes | `false` | AC installation flag | — | None |

---

### 5.7 Collection: `room_reservations`
- **Purpose:** Ad-hoc space bookings for events and makeup classes (MOD-14).
- **Release Target:** **Phase 2 (Version 2.0)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `roomId` | `ObjectId` | Yes | None | Must reference Room | `rooms` | Compound (`{ roomId: 1, startTime: 1, endTime: 1 }`) |
| `requestedById` | `ObjectId` | Yes | None | Must reference User | `users` | Standard Index |
| `startTime` | `Date` | Yes | None | Booking start timestamp | — | Compound Index |
| `endTime` | `Date` | Yes | None | Must be later than `startTime` | — | Compound Index |
| `purpose` | `String` | Yes | None | Brief reason, 5–200 chars | — | None |
| `status` | `String` | Yes | `'pending'` | Enum: `['pending', 'approved', 'rejected', 'cancelled']` | — | Standard Index |
| `approvedById` | `ObjectId` | Optional | `null` | Approving Facilities Admin User ObjectId | `users` | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 5.8 Collection: `student_achievements`
- **Purpose:** Verified co-curricular portfolio milestones (MOD-15 Passport).
- **Release Target:** **Phase 3 (Version 3.0)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `studentId` | `ObjectId` | Yes | None | Must reference Student User | `users` | Compound (`{ studentId: 1, verificationStatus: 1 }`) |
| `category` | `String` | Yes | None | Enum: `['certification', 'hackathon', 'publication', 'sports', 'club']` | — | Standard Index |
| `title` | `String` | Yes | None | Milestone title, 3–150 chars | — | None |
| `issuer` | `String` | Yes | None | e.g., `"Smart India Hackathon"`, `"AWS"` | — | None |
| `dateAchieved` | `Date` | Yes | None | Date of credential/award | — | None |
| `proofFileUrl` | `String` | Yes | None | Cloudinary certificate image/PDF URL | — | None |
| `verificationStatus` | `String` | Yes | `'pending'` | Enum: `['pending', 'verified', 'rejected']` | — | Compound Index |
| `verifiedById` | `ObjectId` | Optional | `null` | Faculty/T&P Coordinator User ObjectId | `users` | None |
| `rejectionReason` | `String` | Optional | `""` | Mandatory if status is `'rejected'` | — | None |
| `verifiedAt` | `Date` | Optional | `null` | Timestamp when verified | — | None |
| `createdAt` | `Date` | Yes | Auto | Timestamp | — | None |

---

### 5.9 Collection: `emergency_alerts`
- **Purpose:** System-wide high-priority emergency broadcast records (MOD-16).
- **Release Target:** **Phase 3 (Version 3.0)** (Basic hook in MVP)

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `title` | `String` | Yes | None | Urgent alert headline, 5–150 chars | — | None |
| `message` | `String` | Yes | None | Plaintext directives, max 2,000 chars | — | None |
| `severity` | `String` | Yes | `'amber'` | Enum: `['amber', 'red']` | — | Standard Index |
| `isActive` | `Boolean` | Yes | `true` | True while alert commands active screens | — | **Standard Index (`{ isActive: 1 }`)** |
| `triggeredById` | `ObjectId` | Yes | None | Must reference Super Admin User | `users` | None |
| `triggeredAt` | `Date` | Yes | Auto | Broadcast timestamp | — | Sort Index |
| `deactivatedAt` | `Date` | Optional | `null` | Timestamp when alert was cancelled | — | None |
| `deactivatedById` | `ObjectId` | Optional | `null` | Super Admin who cancelled alert | `users` | None |

---

### 5.10 Collection: `emergency_acknowledgments`
- **Purpose:** Student/faculty confirmation receipts during campus emergencies (MOD-16).
- **Release Target:** **Phase 3 (Version 3.0)**

| Field Name | BSON / Mongoose Type | Required? | Default Value | Validation Rules | Reference (`ref`) | Index Requirements |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | Auto | MongoDB ObjectId | — | Primary Key |
| `alertId` | `ObjectId` | Yes | None | Must reference EmergencyAlert | `emergency_alerts` | **Compound Unique (`{ alertId: 1, userId: 1 }`)** |
| `userId` | `ObjectId` | Yes | None | Must reference User | `users` | Compound Unique Index |
| `ipAddress` | `String` | Yes | None | IP address string | — | None |
| `acknowledgedAt` | `Date` | Yes | Auto | Timestamp when user confirmed | — | None |

