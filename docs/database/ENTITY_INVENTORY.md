# Complete Entity Inventory

> **Document ID:** DOC-DATA-002  
> **Status:** Approved Baseline (Phase 1, Part 1.4)  
> **Institution:** Axis Institute of Technology & Management  
> **Total Entities Cataloged:** 25 Entities  
> **Last Updated:** November 2026  

---

## 1. Entity Classification Matrix

The 25 entities powering **Axis LinkUp** are grouped across five institutional domains:
1. **Identity, Organization & Academics** (Entities 01–06)
2. **Communication & Bulletins** (Entities 07–10)
3. **Academic Scheduling & Timetable** (Entities 11–12)
4. **Operations, Logistics & Services** (Entities 13–18)
5. **Coursework, Portfolios & Governance** (Entities 19–25)

---

## 2. Detailed Entity Catalog

### 2.1 Domain: Identity, Organization & Academics

#### ENT-01: User
- **Purpose:** Core profile representing any authenticated actor (Student, Faculty, Admin, Super Admin).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `clerkId`, `email`, `fullName`, `role`, `departmentId`, `phone`, `avatarUrl`, `status`, `studentMetadata`, `facultyMetadata`.
- **Relationships:** Belongs to `Department`; authors `Notices`; files `ServiceRequests`; submits `Submissions`.
- **Data Owner:** The individual user (profile fields) & Super Admin / Admin (roles, enrollment).
- **Access Restrictions:** Self-editable profile; role/status strictly restricted to Super Admin / Admin.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-02: Department
- **Purpose:** Academic branches within the institution (e.g., Computer Science, Mechanical Engineering).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `code`, `name`, `hodId`, `isActive`.
- **Relationships:** Has many `Users`, `Courses`, `ServiceRequests`.
- **Data Owner:** Central College Administration / Super Admin.
- **Access Restrictions:** Read-only for Students/Faculty; editable by Super Admin.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-03: Course
- **Purpose:** Academic subjects/modules offered within a department curriculum.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `code`, `title`, `departmentId`, `semester`, `credits`.
- **Relationships:** Belongs to `Department`; has many `Assignments`, `StudyMaterials`, `TimetableSlots`.
- **Data Owner:** Department HOD / Academic Coordinator.
- **Access Restrictions:** Read-only for Students; manageable by Department Admin.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-04: AcademicTerm
- **Purpose:** Defines active academic semester timeframes (e.g., "Odd Semester 2026-27").
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `name`, `startDate`, `endDate`, `isCurrent`.
- **Relationships:** Contains `CalendarEvents`, `TimetableSlots`, `CourseEnrollments`.
- **Data Owner:** Registrar / Dean of Academic Affairs.
- **Access Restrictions:** Public read across campus; write restricted to Super Admin.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-05: CourseEnrollment
- **Purpose:** Maps specific cohorts of students and instructors to an active course section in a given academic term.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `courseId`, `termId`, `section`, `primaryFacultyId`, `coFacultyIds`, `studentIds`.
- **Relationships:** References `Course`, `AcademicTerm`, `User` (faculty & students).
- **Data Owner:** Department Academic Coordinator.
- **Access Restrictions:** Read-only for enrolled students; manageable by Admin.
- **Release Target:** **MVP (Phase 1)**.

---

### 2.2 Domain: Communication, Bulletins & Messaging

#### ENT-06: Notice
- **Purpose:** Official bulletins and targeted announcements (MOD-07).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `title`, `contentMarkdown`, `authorId`, `priority`, `targetScope`, `attachments`, `isPinned`, `expiresAt`.
- **Relationships:** Authored by `User`; tracked by `NoticeReceipt`.
- **Data Owner:** Authoring Faculty / Admin / Super Admin.
- **Access Restrictions:** Read restricted to users matching `targetScope`; publish restricted to Faculty/Admin.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-07: NoticeReceipt
- **Purpose:** Tracks individual student acknowledgment and read status for targeted notices.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `noticeId`, `userId`, `readAt`, `acknowledgedAt`.
- **Relationships:** References `Notice` and `User`.
- **Data Owner:** System (automatically recorded upon client read).
- **Access Restrictions:** Read accessible to Notice Author & Admin; writable by reader.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-08: ChatChannel
- **Purpose:** Group communication spaces (course channels, departmental channels, direct 1:1 chat).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `name`, `type` (`direct` | `course` | `department` | `custom`), `courseId`, `departmentId`, `memberIds`, `isArchived`.
- **Relationships:** References `Course`, `Department`, `User` (members); contains `ChatMessages`.
- **Data Owner:** Channel Creator / Course Faculty.
- **Access Restrictions:** Read/write strictly bounded to users in `memberIds`.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-09: ChatMessage
- **Purpose:** Individual text messages, attachments, and threads within a channel.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `channelId`, `senderId`, `messageBody`, `attachments`, `isDeleted`, `createdAt`.
- **Relationships:** Belongs to `ChatChannel`; sent by `User`.
- **Data Owner:** Sending User.
- **Access Restrictions:** Visible only to members of the parent `ChatChannel`.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-10: Notification
- **Purpose:** In-app notification bell alerts and unread counters (MOD-17).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `userId`, `title`, `message`, `category`, `linkUrl`, `isRead`, `readAt`.
- **Relationships:** Belongs to recipient `User`.
- **Data Owner:** Recipient User.
- **Access Restrictions:** Read/write strictly restricted to the owning `userId`.
- **Release Target:** **MVP (Phase 1)**.

---

### 2.3 Domain: Academic Scheduling & Timetable

#### ENT-11: CalendarEvent
- **Purpose:** Institutional holidays, exam dates, college fests, and term milestones.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `termId`, `title`, `description`, `category` (`holiday` | `exam` | `academic` | `cultural`), `startDate`, `endDate`, `targetScope`.
- **Relationships:** Belongs to `AcademicTerm`.
- **Data Owner:** Academic Registrar.
- **Access Restrictions:** Public read for all campus users; write restricted to Admin / Super Admin.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-12: TimetableSlot
- **Purpose:** Recurring weekly lecture, tutorial, and lab scheduling blocks.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `courseId`, `facultyId`, `roomId`, `termId`, `dayOfWeek`, `startTime`, `endTime`, `section`.
- **Relationships:** References `Course`, `User` (faculty), `Room`, `AcademicTerm`.
- **Data Owner:** Department Timetable Coordinator.
- **Access Restrictions:** Read accessible to enrolled students and faculty; write restricted to Admin.
- **Release Target:** **MVP (Phase 1)**.

---

### 2.4 Domain: Operations, Logistics & Services

#### ENT-13: RequestCategory
- **Purpose:** Standardized catalog templates for student service requests (bonafide, leaves, etc.).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `code`, `title`, `description`, `targetDepartmentId`, `defaultSlaHours`, `formSchema`.
- **Relationships:** Belongs to `Department`.
- **Data Owner:** Campus Registrar.
- **Access Restrictions:** Read-only for Students; manageable by Super Admin.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-14: ServiceRequest
- **Purpose:** Student administrative requisition tickets (MOD-13).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `trackingNumber`, `categoryId`, `studentId`, `departmentId`, `assignedAdminId`, `status`, `formData`, `proofAttachments`, `comments`, `slaDueDate`.
- **Relationships:** References `RequestCategory`, `User` (student & admin), `Department`.
- **Data Owner:** Submitting Student (input) & Reviewing Admin (status).
- **Access Restrictions:** Student sees own tickets; Admin sees department tickets; Super Admin sees all.
- **Release Target:** **MVP (Phase 1)**.

#### ENT-15: AuditLog
- **Purpose:** Immutable compliance ledger recording security and operational mutations (MOD-19).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `actorId`, `actorRole`, `action`, `module`, `entityId`, `oldState`, `newState`, `ipAddress`, `userAgent`.
- **Relationships:** References `User` (actor).
- **Data Owner:** System (Immutable / Write-Once).
- **Access Restrictions:** Read restricted to Super Admin; Admin sees scoped operational events; completely invisible to Students/Faculty.
- **Release Target:** **MVP (Phase 1)**.

---

### 2.5 Domain: Coursework, Portfolios & Governance (Later Releases)

#### ENT-16: Assignment
- **Purpose:** Coursework briefs, deadlines, and grading rubrics (MOD-11).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `courseId`, `facultyId`, `title`, `description`, `maxMarks`, `dueDate`, `allowLate`, `lateCutoffDate`, `attachments`.
- **Relationships:** References `Course`, `User` (faculty); has many `Submissions`.
- **Data Owner:** Assigned Faculty.
- **Access Restrictions:** Viewable by enrolled students; manageable by Course Faculty.
- **Release Target:** **Phase 2 (Version 2.0)**.

#### ENT-17: Submission
- **Purpose:** Student uploaded assignment coursework and evaluation records.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `assignmentId`, `studentId`, `fileUrl`, `fileName`, `fileSizeBytes`, `submittedAt`, `isLate`, `status`, `score`, `feedback`, `gradedById`.
- **Relationships:** References `Assignment`, `User` (student & grading faculty).
- **Data Owner:** Submitting Student (file) & Grading Faculty (score/feedback).
- **Access Restrictions:** Strictly private to the student and grading faculty.
- **Release Target:** **Phase 2 (Version 2.0)**.

#### ENT-18: StudyMaterial
- **Purpose:** Unit-wise lecture notes, slide decks, and lab manuals (MOD-12).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `courseId`, `facultyId`, `unitNumber`, `title`, `description`, `fileUrl`, `fileType`, `downloadCount`, `tags`.
- **Relationships:** References `Course`, `User` (faculty).
- **Data Owner:** Course Faculty.
- **Access Restrictions:** Viewable and downloadable by enrolled students.
- **Release Target:** **Phase 2 (Version 2.0)**.

#### ENT-19: Poll
- **Purpose:** Single and multi-choice democratic voting topics (MOD-09).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `title`, `description`, `creatorId`, `options`, `isAnonymous`, `targetScope`, `expiresAt`, `isClosed`.
- **Relationships:** Created by `User`; has many `PollVotes`.
- **Data Owner:** Poll Creator (Faculty / Admin).
- **Access Restrictions:** Voteable by targeted users; results public upon poll closure.
- **Release Target:** **Phase 2 (Version 2.0)**.

#### ENT-20: PollVote
- **Purpose:** Individual vote records enforcing one-person-one-vote rule.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `pollId`, `optionId`, `voterHash` (or `userId` if non-anonymous), `votedAt`.
- **Relationships:** References `Poll`.
- **Data Owner:** System (Immutable).
- **Access Restrictions:** Read-only aggregate counts; individual vote links obscured for anonymous polls.
- **Release Target:** **Phase 2 (Version 2.0)**.

#### ENT-21: Room
- **Purpose:** Physical campus spaces (classrooms, lecture halls, computer labs) (MOD-14).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `block`, `roomNumber`, `type`, `seatingCapacity`, `hasProjector`, `pcCount`, `isAirConditioned`.
- **Relationships:** Has many `TimetableSlots`, `RoomReservations`.
- **Data Owner:** Campus Facilities Department.
- **Access Restrictions:** Public read across campus; write restricted to Admin.
- **Release Target:** **Phase 2 (Version 2.0)**.

#### ENT-22: RoomReservation
- **Purpose:** Ad-hoc room booking requisitions for faculty and student club events.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `roomId`, `requestedById`, `startTime`, `endTime`, `purpose`, `status`, `approvedById`.
- **Relationships:** References `Room`, `User` (requester & approver).
- **Data Owner:** Requesting User & Facilities Admin.
- **Access Restrictions:** Requester and Admin can manage; public calendar shows occupied blocks.
- **Release Target:** **Phase 2 (Version 2.0)**.

#### ENT-23: StudentAchievement
- **Purpose:** Student co-curricular portfolio milestones and hackathon records (MOD-15 Passport).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `studentId`, `category`, `title`, `issuer`, `dateAchieved`, `proofFileUrl`, `verificationStatus`, `verifiedById`.
- **Relationships:** References `User` (student & verifying faculty).
- **Data Owner:** Student (claims) & Verifying Faculty / T&P Cell (endorsement).
- **Access Restrictions:** Public shareable profile link; private verification workflow.
- **Release Target:** **Phase 3 (Version 3.0)**.

#### ENT-24: EmergencyAlert
- **Purpose:** High-priority campus emergency override broadcasts (MOD-16).
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `title`, `message`, `severity` (`amber` | `red`), `isActive`, `triggeredById`, `triggeredAt`, `deactivatedAt`.
- **Relationships:** Triggered by `User` (Super Admin); tracked by `EmergencyAcknowledgments`.
- **Data Owner:** Super Admin (Executive Leadership).
- **Access Restrictions:** Campus-wide forced read; trigger restricted strictly to Super Admin.
- **Release Target:** **Phase 3 (Version 3.0)** (Basic hook in MVP).

#### ENT-25: EmergencyAcknowledgment
- **Purpose:** Audit confirmation tracking who has read and confirmed emergency directives.
- **Primary Identifier:** `_id` (`ObjectId`)
- **Key Attributes:** `alertId`, `userId`, `ipAddress`, `acknowledgedAt`.
- **Relationships:** References `EmergencyAlert` and `User`.
- **Data Owner:** System (Recorded automatically).
- **Access Restrictions:** Read-only for Super Admin / Disaster Response Team.
- **Release Target:** **Phase 3 (Version 3.0)**.

