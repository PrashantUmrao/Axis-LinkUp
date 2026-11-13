# Feature Modules Specification (All 19 Core Modules)

> **Document ID:** DOC-REQ-004  
> **Status:** Draft for Review (Phase 1, Part 1.1)  
> **Institution:** Axis Institute of Technology & Management  
> **Total Modules Documented:** 19 Modules  

---

## Table of Contents
1. [MOD-01: Authentication and User Management](#mod-01-authentication-and-user-management)
2. [MOD-02: Role-Based Access Control (RBAC)](#mod-02-role-based-access-control-rbac)
3. [MOD-03: Student Dashboard](#mod-03-student-dashboard)
4. [MOD-04: Faculty Dashboard](#mod-04-faculty-dashboard)
5. [MOD-05: Admin Dashboard](#mod-05-admin-dashboard)
6. [MOD-06: Super Admin Dashboard](#mod-06-super-admin-dashboard)
7. [MOD-07: College Notices](#mod-07-college-notices)
8. [MOD-08: Real-Time Chat and Groups](#mod-08-real-time-chat-and-groups)
9. [MOD-09: Polls and Voting](#mod-09-polls-and-voting)
10. [MOD-10: Academic Calendar](#mod-10-academic-calendar)
11. [MOD-11: Assignments and Submissions](#mod-11-assignments-and-submissions)
12. [MOD-12: Notes and Study Materials](#mod-12-notes-and-study-materials)
13. [MOD-13: Student Request Tracker](#mod-13-student-request-tracker)
14. [MOD-14: Room and Lab Finder](#mod-14-room-and-lab-finder)
15. [MOD-15: Skill and Achievement Passport](#mod-15-skill-and-achievement-passport)
16. [MOD-16: Emergency Mode](#mod-16-emergency-mode)
17. [MOD-17: Notifications](#mod-17-notifications)
18. [MOD-18: Analytics and Reports](#mod-18-analytics-and-reports)
19. [MOD-19: Audit Logs](#mod-19-audit-logs)

---

## MOD-01: Authentication and User Management

### 1. Purpose
Provides secure identity management, access control, and user provisioning for all campus stakeholders (Students, Faculty, Admins, Super Admins) of Axis Institute of Technology & Management.

### 2. Features
- Institutional email/password login with secure password hashing (Argon2id/bcrypt).
- CSV-based bulk user onboarding for administrative batches (students, faculty).
- Email verification and password reset workflows via time-limited, cryptographically secure tokens.
- Mandatory Multi-Factor Authentication (MFA/TOTP) for Admin and Super Admin roles; optional for Students and Faculty.
- Profile management (updating avatars, biography, emergency contacts, notification preferences).
- Account locking after consecutive failed login attempts (brute force protection).

### 3. User Roles Involved
- **Student & Faculty:** Sign in, update personal profile, reset password.
- **Admin:** Provision users within departmental scope, reset user credentials upon request.
- **Super Admin:** Global user creation, role assignment, account suspension, and bulk import execution.

### 4. Permissions
- `auth.login`: All roles
- `user.profile.update_self`: All roles
- `user.manage.department`: Admin
- `user.manage.global`: Super Admin

### 5. Main Workflows
1. **Bulk Provisioning Flow:** Super Admin uploads CSV containing Roll Numbers, Names, Departments, and Emails &rarr; System validates syntax &rarr; Creates accounts in `Invited` state &rarr; Dispatches welcome email with activation link &rarr; User clicks link, sets password &rarr; Account changes to `Active`.
2. **Login & Session Issuance:** User enters credentials &rarr; Server validates against Argon2id hash &rarr; Verifies account is not `Suspended` &rarr; If Admin/Super Admin, prompts for MFA code &rarr; Issues `HttpOnly` session cookie &rarr; Redirects to role-specific dashboard.

### 6. Dependencies
- **Upstream:** None (Foundation Module).
- **Downstream:** All modules (MOD-02 through MOD-19 require authenticated context).

### 7. Data Entities
- `User` (id, email, password_hash, full_name, avatar_url, phone, role_id, department_id, status, mfa_secret, created_at, updated_at)
- `Session` (id, user_id, token_hash, ip_address, user_agent, expires_at)
- `PasswordResetToken` (id, user_id, token_hash, expires_at, used_at)

### 8. Edge Cases & Validation Rules
- Duplicate institutional email or roll number rejected with specific validation error.
- Expired activation tokens require automated resend request.
- Deactivated/Suspended users must have all existing active sessions invalidated immediately.

---

## MOD-02: Role-Based Access Control (RBAC)

### 1. Purpose
Enforces granular access rights, departmental scoping, and administrative boundaries across all endpoints, UI views, and data operations.

### 2. Features
- Hardened server-side authorization guards on all Server Actions and API routes.
- Dynamic navigation rendering based on verified user claims.
- Departmental and section-level scoping (e.g., Faculty can only grade their own classes).
- Role context switching for users with dual roles (e.g., Professor + HOD).

### 3. User Roles Involved
- **Student, Faculty, Admin:** Subject to RBAC restrictions.
- **Super Admin:** Configures role definitions and grants permissions.

### 4. Permissions
- `rbac.view_roles`: Admin, Super Admin
- `rbac.assign_roles`: Super Admin
- `rbac.manage_permissions`: Super Admin

### 5. Main Workflows
1. **Authorization Middleware Flow:** Request arrives with session cookie &rarr; Middleware extracts user ID & role &rarr; Queries route access policy &rarr; If unauthorized, logs security event in MOD-19 and returns `403 Forbidden` / redirects to login.

### 6. Dependencies
- **Upstream:** MOD-01 (Authentication).
- **Downstream:** MOD-03 to MOD-19 (All protected routes and operations).

### 7. Data Entities
- `Role` (id, key, name, description, priority_level)
- `Permission` (id, key, module_name, description)
- `RolePermission` (role_id, permission_id)

### 8. Edge Cases & Validation Rules
- Privilege escalation attempts must immediately trigger a high-severity entry in `Audit Logs`.
- Super Admin cannot strip the last remaining Super Admin of their privileges.

---

## MOD-03: Student Dashboard

### 1. Purpose
Delivers a consolidated, personalized mobile-first workspace for students to track their daily academic schedule, upcoming deadlines, unread notices, and pending service requests.

### 2. Features
- "Today at a Glance" widget (upcoming lectures, lab sessions, room numbers).
- Priority notice carousel (urgent departmental and college-wide announcements).
- Upcoming Assignment Tracker (countdowns, pending submissions, graded items).
- Active Service Requests quick widget (ticket status badge).
- Quick links to Notes, Room Finder, and Skill Passport.

### 3. User Roles Involved
- **Student:** Sole consumer and interactive user.

### 4. Permissions
- `dashboard.student.view`: Restricted to authenticated `Student` role.

### 5. Main Workflows
1. **Student Dashboard Render Flow:** Student authenticates &rarr; Server aggregates: (a) Today's timetable entries (MOD-10), (b) Unread targeted notices (MOD-07), (c) Incomplete assignments due within 7 days (MOD-11), (d) Active requests in progress (MOD-13) &rarr; Renders unified dashboard view.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream Consumes:** MOD-07, MOD-10, MOD-11, MOD-13.

### 7. Data Entities
- Composite view; aggregates read models from `Notices`, `Assignments`, `Timetable`, `Requests`.

### 8. Edge Cases & Validation Rules
- If no academic events exist for today, display empty-state illustration with motivational message.
- If Emergency Mode is active, dashboard must be overlayed with the Emergency Banner (MOD-16).

---

## MOD-04: Faculty Dashboard

### 1. Purpose
Provides educators with a unified cockpit to oversee course schedules, manage assignments, broadcast course announcements, and evaluate student submissions.

### 2. Features
- Daily Teaching Timetable & Classroom Locator.
- Submission Grading Queue (shows assignments awaiting review and grading).
- Quick Course Announcement Composer.
- Pending Student Approvals (Skill Passport endorsements, project requests).
- Course Health Metrics (submission completion rate, poll engagement).

### 3. User Roles Involved
- **Faculty:** Primary user.

### 4. Permissions
- `dashboard.faculty.view`: Restricted to authenticated `Faculty` role.

### 5. Main Workflows
1. **Daily Teaching Flow:** Faculty logs in &rarr; Views today's assigned lecture blocks &rarr; Clicks class card to jump directly to attendance/notes repository &rarr; Views count of unreviewed student submissions needing evaluation.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream Consumes:** MOD-07, MOD-10, MOD-11, MOD-12, MOD-15.

### 7. Data Entities
- Aggregated read models from `Courses`, `Assignments`, `Submissions`, `PassportClaims`.

### 8. Edge Cases & Validation Rules
- Visiting faculty with no active courses assigned must see onboarding prompts to contact department admin.

---

## MOD-05: Admin Dashboard

### 1. Purpose
Equips departmental and campus administrative staff with real-time operational queues to process student requests, manage notices, inspect facility schedules, and oversee campus workflows.

### 2. Features
- Student Service Request Kanban / Queue (New, Assigned, Under Review, Resolved).
- SLA Breach Warnings (tickets approaching or exceeding resolution deadlines).
- Notice Publishing & Approval Desk.
- Classroom & Laboratory Occupancy Overview.
- Quick Export of Departmental Activity Reports.

### 3. User Roles Involved
- **Admin:** Primary user.
- **Super Admin:** Can inspect all Admin views.

### 4. Permissions
- `dashboard.admin.view`: Admin, Super Admin.

### 5. Main Workflows
1. **Administrative Operations Flow:** Admin opens dashboard &rarr; Filters queue by request category (e.g., Bonafide Certificate) &rarr; Picks pending ticket &rarr; Reviews student metadata &rarr; Changes status to "Under Review" &rarr; Resolves ticket with attached PDF.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream Consumes:** MOD-07, MOD-10, MOD-13, MOD-14, MOD-18.

### 7. Data Entities
- Aggregated operational models from `ServiceRequests`, `Notices`, `Facilities`.

### 8. Edge Cases & Validation Rules
- Overdue tickets must highlight with high-visibility alert markers based on institutional SLA parameters.

---

## MOD-06: Super Admin Dashboard

### 1. Purpose
Provides institutional executives and IT leaders with holistic oversight of campus digital operations, platform security, user audits, system health, and emergency controls.

### 2. Features
- High-level KPI widgets (Active users, daily transactions, request resolution rate, storage consumption).
- Global Emergency Broadcast Control Center (trigger/deactivate campus alert).
- User Provisioning & Role Management Shortcut.
- Real-Time Audit Log Feed (suspicious activities, privilege alterations).
- System Infrastructure Health (database latency, queue status, storage quota).

### 3. User Roles Involved
- **Super Admin:** Sole authorized user.

### 4. Permissions
- `dashboard.super_admin.view`: Restricted to `Super Admin`.

### 5. Main Workflows
1. **Executive Audit Flow:** Super Admin signs in with MFA &rarr; Inspects platform health &rarr; Checks audit log stream for privilege modifications &rarr; Reviews departmental ticket resolution turnaround metrics.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream Consumes:** MOD-16, MOD-18, MOD-19.

### 7. Data Entities
- Aggregated administrative metrics, health check endpoints, security telemetry.

### 8. Edge Cases & Validation Rules
- Strict MFA re-verification before accessing destructive global system actions.

---

## MOD-07: College Notices

### 1. Purpose
Provides an authoritative, structured, and auditable communication channel for publishing and consuming official institutional, departmental, and course announcements.

### 2. Features
- Multi-tier targeting: All Campus, Specific Department(s), Specific Degree/Year, Specific Section.
- Priority tagging: `Normal`, `Important`, `Urgent`.
- Expiry date configuration (notices automatically archive after validity period).
- Rich text formatting with PDF/image attachments.
- Read receipts and acknowledgment tracking (percentage of targeted cohort who viewed the notice).
- Pinning crucial notices to top of feeds.

### 3. User Roles Involved
- **Student:** View, search, filter, and acknowledge targeted notices.
- **Faculty:** Publish course-level and departmental notices.
- **Admin:** Publish departmental and campus-level notices; pin notices.
- **Super Admin:** Publish global notices; override or archive any notice.

### 4. Permissions
- `notices.view`: All authenticated roles (scoped by targeting criteria).
- `notices.create.course`: Faculty
- `notices.create.department`: Faculty (with coordinator role), Admin
- `notices.create.global`: Admin, Super Admin
- `notices.pin`: Admin, Super Admin

### 5. Main Workflows
1. **Publishing a Targeted Notice:** Admin selects "New Notice" &rarr; Inputs Title, Body, Priority &rarr; Selects Scope: "Computer Science" + "3rd Year" &rarr; Attaches PDF schedule &rarr; Clicks Publish &rarr; System records notice &rarr; Dispatches push notification (MOD-17) &rarr; Appears in targeted students' feed.
2. **Student Acknowledgment Flow:** Student opens notice &rarr; Reads content &rarr; Clicks "Acknowledge" &rarr; System records timestamped receipt &rarr; Faculty/Admin analytics view updates acknowledgment percentage.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** MOD-03, MOD-04, MOD-05, MOD-17, MOD-18, MOD-19.

### 7. Data Entities
- `Notice` (id, title, content_markdown, author_id, priority, target_scope_json, expires_at, is_pinned, created_at, updated_at)
- `NoticeAttachment` (id, notice_id, file_url, file_name, file_size, mime_type)
- `NoticeReadReceipt` (id, notice_id, user_id, read_at, acknowledged_at)

### 8. Edge Cases & Validation Rules
- Notices cannot be published without specifying target scope.
- `Urgent` notices trigger instant high-priority in-app alerts.
- Archived notices remain searchable in the historical archive repository.

---

## MOD-08: Real-Time Chat and Groups

### 1. Purpose
Enables secure, audited, real-time messaging for academic collaboration between students and faculty while protecting personal contact numbers.

### 2. Features
- Automated course and batch group channels (created based on academic enrollment rosters).
- Direct peer-to-peer and student-to-faculty messaging with configurable office hours.
- Text, code snippets, and document attachments (PDF, images).
- Content moderation flags (users can report inappropriate messages).
- Read indicators, online presence status, and typing indicators.

### 3. User Roles Involved
- **Student:** Participate in enrolled course channels, initiate permitted direct chats.
- **Faculty:** Moderate course channels, communicate with students during office hours.
- **Admin / Super Admin:** Review reported messages, remove inappropriate content, disable chat for abusive accounts.

### 4. Permissions
- `chat.send_message`: Student, Faculty
- `chat.create_custom_group`: Faculty, Admin
- `chat.moderate`: Faculty (own courses), Admin (departmental), Super Admin (global)

### 5. Main Workflows
1. **Class Discussion Flow:** Faculty opens Course Channel &rarr; Posts clarification on problem set &rarr; Students receive real-time message via WebSocket &rarr; Student replies in thread &rarr; All enrolled members see update without page reload.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** MOD-17 (Notifications), MOD-19 (Audit Logs for moderation).

### 7. Data Entities
- `ChatChannel` (id, name, type [direct, course_channel, group], course_id, created_by, is_archived)
- `ChannelMember` (channel_id, user_id, role [admin, member], joined_at)
- `ChatMessage` (id, channel_id, sender_id, message_body, attachments_json, is_deleted, created_at)
- `MessageReport` (id, message_id, reporter_id, reason, status, resolved_by)

### 8. Edge Cases & Validation Rules
- Rate limiting on messages (prevent automated flooding/spamming).
- Direct message requests to faculty can be toggled off by faculty outside office hours.
- Deleted messages show "This message was removed by moderator" rather than disappearing without trace.

---

## MOD-09: Polls and Voting

### 1. Purpose
Provides a rapid feedback and democratic decision-making mechanism for faculty, student representatives, and campus administrators.

### 2. Features
- Single-choice and multiple-choice polls.
- Anonymous or identified voting options (configured at poll creation).
- Role and cohort targeting (e.g., only Final Year Mechanical students).
- Time-bounded polls with automated closure and live chart visualizations.
- Export of voting results for administrative record-keeping.

### 3. User Roles Involved
- **Student:** Vote on targeted polls; view published aggregate results.
- **Faculty:** Create polls for classroom feedback, lecture speed, topic preferences.
- **Admin & Super Admin:** Create campus-wide student council or satisfaction surveys.

### 4. Permissions
- `polls.create.course`: Faculty
- `polls.create.campus`: Admin, Super Admin
- `polls.vote`: All roles (matching targeting criteria)
- `polls.export`: Creator, Admin, Super Admin

### 5. Main Workflows
1. **Conducting a Course Poll:** Faculty creates poll: "Select topic for next week's seminar" with 3 choices &rarr; Sets expiration to 48 hours &rarr; Students in section receive alert &rarr; Students cast vote (one vote per user enforced) &rarr; Poll reaches deadline &rarr; Final distribution displayed.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** MOD-03, MOD-04, MOD-17, MOD-18.

### 7. Data Entities
- `Poll` (id, title, description, creator_id, is_anonymous, expires_at, target_scope_json, is_closed)
- `PollOption` (id, poll_id, option_text, vote_count)
- `PollVote` (id, poll_id, option_id, user_id_hash [for anonymity] or user_id, voted_at)

### 8. Edge Cases & Validation Rules
- Strict uniqueness constraint: a user can vote only once per poll.
- Once cast, votes cannot be tampered with or revoked after poll closes.

---

## MOD-10: Academic Calendar

### 1. Purpose
Serves as the single source of truth for the institutional academic schedule, semester dates, examination timetables, holidays, and daily lecture timetables.

### 2. Features
- Multi-layer calendar views (Institutional Holidays, Departmental Events, Exam Schedules, Daily Class Timetables).
- Day, Week, Month, and Agenda display modes.
- Color-coded categories for rapid visual scanning.
- Export/sync capability (.ics feed for Google Calendar / Apple Calendar).
- Clash detection for exam and lecture scheduling.

### 3. User Roles Involved
- **Student:** View personal timetable, exam dates, college holidays.
- **Faculty:** View teaching schedule, enter reschedule requests.
- **Admin:** Maintain academic milestones, exam timetables, room schedules.
- **Super Admin:** Final approval and publication of master term calendars.

### 4. Permissions
- `calendar.view`: All authenticated roles.
- `calendar.edit.department`: Admin
- `calendar.edit.master`: Super Admin

### 5. Main Workflows
1. **Schedule Inspection Flow:** Student opens Academic Calendar &rarr; Automatically views personalized timetable for enrolled section &rarr; Clicks an exam slot to view reporting time, subject code, and assigned examination hall.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** MOD-03, MOD-04, MOD-05, MOD-14 (Room Finder).

### 7. Data Entities
- `AcademicTerm` (id, name, start_date, end_date, is_current)
- `CalendarEvent` (id, term_id, title, description, category [holiday, exam, event], start_time, end_time, target_scope_json)
- `TimetableSlot` (id, course_id, faculty_id, room_id, day_of_week, start_time, end_time, section_id)

### 8. Edge Cases & Validation Rules
- Overlapping lecture slots for the same room or faculty member must trigger validation conflicts.
- Date ranges cannot cross outside active academic term boundaries.

---

## MOD-11: Assignments and Submissions

### 1. Purpose
Digitizes the complete assignment lifecycle from creation, file attachment, and deadline enforcement to student submission, late tracking, and faculty grading.

### 2. Features
- Rich assignment briefs with support for PDF attachments, rubrics, and maximum marks.
- Hard deadline enforcement with optional "Allow Late Submissions with Penalty" configuration.
- Multi-format student file submissions (PDF, ZIP, DOCX) with client-side file size and type validation.
- Versioned submissions (students can re-upload before deadline if permitted by instructor).
- Faculty grading interface with score entry, rubric scoring, and private feedback comments.
- Bulk download of section submissions for offline grading.

### 3. User Roles Involved
- **Student:** View assignment requirements, upload submission files, view scores and feedback.
- **Faculty:** Create assignments, configure deadlines, inspect submissions, award marks, write feedback.
- **Admin:** Review departmental submission compliance and completion statistics.
- **Super Admin:** Oversight of academic delivery integrity.

### 4. Permissions
- `assignments.view`: Enrolled Students, Assigned Faculty, Admin
- `assignments.create`: Faculty
- `assignments.submit`: Enrolled Students
- `assignments.grade`: Assigned Faculty

### 5. Main Workflows
1. **Assignment Creation & Submission Flow:** Faculty creates assignment "Data Structures Lab 4" due Friday 11:59 PM &rarr; Students in section get alert &rarr; Student completes code, packages PDF, and uploads file &rarr; System records submission with timestamp and SHA-256 hash &rarr; Friday deadline passes &rarr; Faculty reviews submissions, inputs mark "18/20" with comment &rarr; Student views grade.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** MOD-03, MOD-04, MOD-17, MOD-18, MOD-19.

### 7. Data Entities
- `Assignment` (id, course_id, faculty_id, title, description_markdown, max_marks, due_date, allow_late, late_cutoff_date, created_at)
- `AssignmentAttachment` (id, assignment_id, file_url, file_name, file_size)
- `Submission` (id, assignment_id, student_id, file_url, file_name, file_size, submitted_at, is_late, score, feedback, graded_by, graded_at)

### 8. Edge Cases & Validation Rules
- Submissions attempted 1 second after `due_date` flagged as late; if `allow_late` is false, upload request is rejected with explicit deadline error.
- Maximum file size strictly capped (default 25MB). Executable files (.exe, .bat, .sh) strictly rejected.

---

## MOD-12: Notes and Study Materials

### 1. Purpose
Provides a structured, searchable, and permanent digital repository for course syllabi, lecture presentations, lab manuals, and reference materials.

### 2. Features
- Hierarchical classification: Department &rarr; Degree &rarr; Semester &rarr; Course/Subject &rarr; Unit/Module.
- File support for PDFs, PPT/PPTX presentations, reference URLs, and recorded video links.
- Fast keyword search and tag filtering (e.g., "Unit 2", "Previous Year Question Paper").
- Download counter and student bookmarking/saving for offline reference.
- Moderation capability for departmental coordinators.

### 3. User Roles Involved
- **Student:** Search, view, bookmark, and download materials for enrolled subjects.
- **Faculty:** Upload lecture notes, update revisions, organize subject units.
- **Admin:** Moderate content, purge outdated materials, verify syllabus alignment.

### 4. Permissions
- `notes.view`: All authenticated roles.
- `notes.upload`: Faculty, Admin.
- `notes.moderate`: Admin, Super Admin.

### 5. Main Workflows
1. **Uploading & Accessing Notes Flow:** Faculty selects Course "Database Management Systems", Unit 3 &rarr; Uploads "Normalization_Lecture.pdf" &rarr; Adds tags "3NF", "BCNF" &rarr; Saves &rarr; Students in course view the new resource immediately in their Notes tab &rarr; Student downloads PDF.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** MOD-03, MOD-04, MOD-17.

### 7. Data Entities
- `StudyMaterial` (id, course_id, faculty_id, unit_number, title, description, file_url, file_type, file_size, download_count, created_at)
- `MaterialBookmark` (id, user_id, material_id, created_at)

### 8. Edge Cases & Validation Rules
- Files stored on S3 must use signed URLs to prevent hotlinking and unauthenticated scraping.
- Duplicate file name uploads automatically append unique timestamp hashes.

---

## MOD-13: Student Request Tracker

### 1. Purpose
Transforms paper-based campus desk requisitions (Bonafide Certificates, Leave of Absence, Lab Access Keys, Library Dues Clearance, Fee Concession Applications) into an auditable digital ticketing system.

### 2. Features
- Standardized request templates with mandatory fields and supporting proof attachments.
- Automated routing to the appropriate department desk (Registrar, Exam Cell, HOD, Accounts).
- Status progression pipeline: `Submitted` &rarr; `Under Review` &rarr; `Approved / Ready` &rarr; `Rejected` &rarr; `Closed`.
- Internal administrative notes and public communication thread between student and reviewer.
- SLA timer tracking with automated escalation warnings for delayed tickets.
- Digital PDF generation of requested documents (e.g., auto-generated Bonafide with QR code).

### 3. User Roles Involved
- **Student:** Submit request, attach documents, track status, view comments, download issued certificates.
- **Faculty:** Approve academic endorsements (e.g., medical leave verification, project lab access).
- **Admin:** Primary operators of request queues, updating statuses, fulfilling requests.
- **Super Admin:** Review SLA compliance and operational efficiency metrics.

### 4. Permissions
- `requests.create`: Student
- `requests.view_own`: Student
- `requests.process.department`: Admin, Faculty (scoped)
- `requests.process.all`: Super Admin

### 5. Main Workflows
1. **Bonafide Request Lifecycle:** Student submits "Bonafide Request" for passport application &rarr; System assigns ticket ID `#REQ-1082` &rarr; Routes to Registrar Admin Queue &rarr; Admin verifies enrollment &rarr; Admin clicks "Approve & Generate Certificate" &rarr; System attaches digital certificate PDF &rarr; Student receives notification &rarr; Student downloads signed certificate.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** MOD-03, MOD-05, MOD-17, MOD-18, MOD-19.

### 7. Data Entities
- `RequestCategory` (id, name, description, sla_hours, required_fields_json, target_role)
- `ServiceRequest` (id, tracking_number, category_id, student_id, assigned_admin_id, status, form_data_json, resolution_notes, created_at, updated_at, resolved_at)
- `RequestComment` (id, request_id, author_id, comment_body, is_internal_note, created_at)
- `RequestAttachment` (id, request_id, file_url, file_name, file_size)

### 8. Edge Cases & Validation Rules
- Students cannot open duplicate requests for the same category while an active ticket is pending.
- Rejection must mandate a clear, descriptive reason in the remarks field.

---

## MOD-14: Room and Lab Finder

### 1. Purpose
Provides a digital map and live occupancy lookup for campus classrooms, lecture halls, computer labs, and seminar halls across all campus blocks.

### 2. Features
- Campus building and floor directory (Block A, Block B, Mechanical Workshop, Central Library).
- Live occupancy indicators: `Occupied (Class in progress)`, `Reserved`, `Available`.
- Room capability specifications (Capacity, Projector/AV, Smart Board, Number of PCs, AC).
- Ad-hoc booking request workflow for faculty and recognized student club leaders.
- Daily timetable schedule viewer per room.

### 3. User Roles Involved
- **Student:** Look up vacant spaces for group study or project work; find assigned lecture halls.
- **Faculty:** Find vacant labs for remedial classes; submit room reservation requests.
- **Admin:** Approve room reservations, adjust facility specifications, update schedules.
- **Super Admin:** Master campus facility management.

### 4. Permissions
- `facilities.view`: All authenticated roles.
- `facilities.reserve`: Faculty, Admin.
- `facilities.manage`: Admin, Super Admin.

### 5. Main Workflows
1. **Finding a Vacant Lab:** Faculty needs a 40-seat computer lab at 3:00 PM &rarr; Filters by "Block B", "Computer Lab", "Capacity >= 30", "Projector" &rarr; System checks active timetable (MOD-10) and approved reservations &rarr; Shows "Lab 402 - Available" &rarr; Faculty clicks "Reserve Slot" &rarr; Admin approves reservation.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02, MOD-10 (Academic Calendar/Timetable).
- **Downstream:** MOD-05, MOD-17, MOD-19.

### 7. Data Entities
- `CampusBlock` (id, name, code, total_floors)
- `Room` (id, block_id, room_number, floor_number, room_type [classroom, lab, seminar_hall], seating_capacity, has_projector, pc_count, status)
- `RoomReservation` (id, room_id, requested_by, start_time, end_time, purpose, status [pending, approved, rejected], approved_by)

### 8. Edge Cases & Validation Rules
- Cannot reserve a room that has a scheduled class in MOD-10 timetable.
- Reservation requests must prevent time-slot double bookings via database row-level locking.

---

## MOD-15: Skill and Achievement Passport

### 1. Purpose
Builds a verified digital portfolio of each student’s co-curricular achievements, hackathon wins, technical certifications, published papers, and club leadership roles, endorsed by faculty.

### 2. Features
- Milestone categories: Technical Certifications, Competitions & Hackathons, Paper Publications, Club Leadership, Community Service.
- Proof upload (certificate image/PDF, credential URL).
- Faculty endorsement pipeline (claims remain "Pending Verification" until verified by assigned faculty or HOD).
- Public shareable profile link / QR code (for placement recruiters and resume inclusion).
- Exportable comprehensive student co-curricular transcript (PDF).

### 3. User Roles Involved
- **Student:** Add achievements, upload credentials/proofs, generate shareable passport link.
- **Faculty:** Review, verify, or reject student achievement claims with feedback.
- **Admin:** Compile verified achievement reports for NAAC/NIRF accreditation.
- **Super Admin:** Placement and institutional analytics oversight.

### 4. Permissions
- `passport.view_own`: Student
- `passport.add_claim`: Student
- `passport.verify_claim`: Faculty, Admin
- `passport.export_accreditation`: Admin, Super Admin

### 5. Main Workflows
1. **Achievement Verification Flow:** Student uploads certificate for "1st Place - Smart India Hackathon" with certificate PDF &rarr; Submits to Faculty Coordinator &rarr; Coordinator reviews uploaded proof &rarr; Clicks "Verify & Endorse" &rarr; Claim badge turns "Verified by Axis Institute" with cryptographic verification stamp &rarr; Badge is featured on student's public passport.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** MOD-03, MOD-04, MOD-17, MOD-18.

### 7. Data Entities
- `AchievementCategory` (id, name, points_weight)
- `StudentAchievement` (id, student_id, category_id, title, issuing_organization, issue_date, credential_url, certificate_file_url, verification_status [pending, verified, rejected], verified_by, verified_at, rejection_reason)

### 8. Edge Cases & Validation Rules
- Unverified claims cannot display official college verification badge.
- Rejected claims allow the student one opportunity to resubmit with corrected documentation.

---

## MOD-16: Emergency Mode

### 1. Purpose
Provides a fail-safe, high-urgency communication mechanism for campus leadership to instantly disseminate emergency directives (e.g., sudden severe weather closure, campus security alert, immediate evacuation).

### 2. Features
- Master emergency trigger restricted to Super Admin (and specifically designated emergency admins).
- Immediate client UI takeover: persistent high-contrast emergency banner and modal dialog across all active screens.
- Multi-channel instant broadcast: WebSockets, Web Push Notifications, and priority email.
- Mandatory student and faculty acknowledgment button (tracks who has confirmed receipt).
- Deactivation workflow restoring the platform to standard operational mode.

### 3. User Roles Involved
- **Student & Faculty:** Receive alert, read urgent directives, acknowledge receipt.
- **Admin:** Monitor acknowledgment statistics across departments.
- **Super Admin:** Trigger Emergency Mode, formulate directives, deactivate emergency state.

### 4. Permissions
- `emergency.trigger`: Super Admin
- `emergency.deactivate`: Super Admin
- `emergency.acknowledge`: Student, Faculty, Admin

### 5. Main Workflows
1. **Emergency Broadcast Flow:** Super Admin enters Emergency Center &rarr; Selects severity "Red Alert - Campus Closure due to severe storm" &rarr; Inputs instructions &rarr; Confirms with password/MFA &rarr; WebSocket pushes payload to all active clients &rarr; Active screens lock to emergency banner &rarr; Users click "I Understand & Acknowledge" &rarr; Receipts recorded in real time.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** MOD-03, MOD-04, MOD-05, MOD-06, MOD-17, MOD-19.

### 7. Data Entities
- `EmergencyAlert` (id, title, message_markdown, severity [yellow, amber, red], triggered_by, triggered_at, is_active, deactivated_at, deactivated_by)
- `EmergencyAcknowledgment` (id, alert_id, user_id, acknowledged_at, ip_address)

### 8. Edge Cases & Validation Rules
- Dual confirmation dialog required before activation to eliminate accidental triggers.
- Triggering immediately writes an immutable high-severity entry to Audit Logs (MOD-19).

---

## MOD-17: Notifications

### 1. Purpose
Orchestrates multi-channel notifications (in-app toast, notification center bell, Web Push, and transactional email) based on user events and role triggers.

### 2. Features
- In-app notification center bell with unread badge counter.
- User-level notification preferences (toggle email/push per notification category).
- Grouping of related notifications (e.g., "3 new messages in CS301").
- Instant push notifications for critical notices, assignment deadlines, and request updates.
- Sound and vibration alerts for high-priority items.

### 3. User Roles Involved
- **All Roles:** Receive, view, mark read, and manage notification preferences.
- **Admin & Super Admin:** Send ad-hoc system notifications.

### 4. Permissions
- `notifications.view_own`: All roles.
- `notifications.broadcast`: Admin, Super Admin.

### 5. Main Workflows
1. **Notification Dispatch Flow:** An event occurs (e.g., Assignment graded in MOD-11) &rarr; Event bus calls Notification Service &rarr; Checks user preferences &rarr; Saves in-app notification to database &rarr; Emits real-time WebSocket event &rarr; Recipient sees badge increment and toast alert.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream:** Triggered by MOD-07, MOD-08, MOD-11, MOD-13, MOD-15, MOD-16.

### 7. Data Entities
- `Notification` (id, user_id, title, message, category, link_url, is_read, read_at, created_at)
- `NotificationPreference` (id, user_id, category, email_enabled, push_enabled, in_app_enabled)

### 8. Edge Cases & Validation Rules
- Duplicate notifications within 60 seconds are debounced.
- Notifications older than 90 days are automatically archived.

---

## MOD-18: Analytics and Reports

### 1. Purpose
Aggregates operational, instructional, and administrative metrics into actionable dashboards and downloadable reports for institutional decision-makers.

### 2. Features
- Student engagement metrics (notice read rates, assignment submission timeliness).
- Service request SLA performance (average resolution time per department, backlog counts).
- Facility utilization reports (room occupancy rates across blocks and peak hours).
- Export formats: CSV, XLSX, and formatted PDF summaries.
- Departmental comparative analytics for Deans and HODs.

### 3. User Roles Involved
- **Faculty:** Course-level submission and engagement metrics.
- **Admin:** Departmental SLA, room booking, and notice reach analytics.
- **Super Admin:** College-wide institutional health and activity reporting.

### 4. Permissions
- `analytics.view.course`: Faculty
- `analytics.view.department`: Admin
- `analytics.view.global`: Super Admin
- `analytics.export`: Admin, Super Admin

### 5. Main Workflows
1. **Generating Departmental SLA Report:** Admin opens Reports tab &rarr; Selects "Student Service Requests" &rarr; Date range "Last 30 Days" &rarr; Department "Registrar Office" &rarr; System compiles average turnaround (e.g., 22.4 hours) &rarr; Admin exports PDF for academic council review.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream Consumes:** MOD-07, MOD-11, MOD-13, MOD-14, MOD-15.

### 7. Data Entities
- Materialized aggregate views or indexed read-replicas derived from transactional tables.

### 8. Edge Cases & Validation Rules
- Heavy analytical aggregation queries must be cached or executed with read-only database connections to avoid locking transactional tables.

---

## MOD-19: Audit Logs

### 1. Purpose
Provides an unalterable, comprehensive security and compliance record of all sensitive operations, configuration changes, permission updates, and administrative interventions across the platform.

### 2. Features
- Append-only immutable log architecture (no UPDATE or DELETE operations permitted).
- Detailed telemetry: Timestamp, User ID, Role Context, Action Type, Target Entity, Old Values, New Values, IP Address, User Agent.
- Filtering and search by date range, actor, severity level, and affected module.
- Tamper-detection mechanisms (cryptographic chaining / hash verification).
- Automated retention policy enforcement (logs retained for institutional audit periods, e.g., 3 years).

### 3. User Roles Involved
- **Admin:** View operational logs within departmental jurisdiction.
- **Super Admin:** Full view, query, and compliance export of all system audit logs.

### 4. Permissions
- `audit.view.department`: Admin
- `audit.view.global`: Super Admin
- `audit.export`: Super Admin

### 5. Main Workflows
1. **Administrative Action Logging:** Admin approves a sensitive certificate request &rarr; System writes record to `audit_logs` table within the same database transaction &rarr; Record contains previous status `Under Review` and new status `Approved` along with admin IP &rarr; Super Admin can audit this entry at any time.

### 6. Dependencies
- **Upstream:** MOD-01, MOD-02.
- **Downstream Consumes Events From:** All Modules (MOD-01 through MOD-18).

### 7. Data Entities
- `AuditLog` (id, actor_id, actor_role, action_type [create, update, delete, login_failed, role_grant, emergency_trigger], module_name, entity_id, old_state_json, new_state_json, ip_address, user_agent, created_at)

### 8. Edge Cases & Validation Rules
- The database user account used by the application must have explicit permissions configured to reject `UPDATE` and `DELETE` queries on the `audit_logs` table.

