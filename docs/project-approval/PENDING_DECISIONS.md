# Register of Pending Decisions Requiring Human Approval

> **Document ID:** DOC-APPR-005  
> **Status:** Pending Stakeholder Review (Phase 1, Part 1.7)  
> **Institution:** Axis Institute of Technology & Management  
> **Target Decision Makers:** Director, Dean of Academic Affairs, Campus IT Head, Lead Architect  
> **Last Updated:** November 2026  

---

## 1. Overview & Decision Framework

In accordance with architectural principles, **unverified institutional policies and third-party commercial commitments have not been fabricated or locked as final without stakeholder review**.

The following seven decisions require formal review and human sign-off before or during early Phase 2 implementation.

---

## 2. Decision Register

### DEC-01: Primary Database Technology Finalization
- **Context:** Phase 1.1 evaluated PostgreSQL; Parts 1.2–1.6 designed and specified MongoDB Atlas and Mongoose 8+ to support dynamic forms (`service_requests`) and embedded notice arrays.
- **Options Considered:**
  - *Option A: Formally Approve MongoDB Atlas (AWS Mumbai `ap-south-1`) with Mongoose 8+ (Recommended).*
  - *Option B: Revert to Relational PostgreSQL with Prisma ORM.*
- **Trade-off Analysis:**
  - *Option A Pros:* Natural JSON document modeling for polymorphic administrative request tickets; zero complex migrations for custom form fields; high-performance embedded arrays; sub-50ms index lookups; DPDP Act compliance.
  - *Option A Cons:* Requires application-level enforcement of referential integrity (handled via Mongoose repository middleware).
  - *Option B Pros:* Native relational foreign-key cascading.
  - *Option B Cons:* Requires storing dynamic ticket forms in untyped JSONB columns; rigid SQL schema migrations slow down early feature iterations.
- **Recommended Option:** **Option A (MongoDB Atlas).**
- **Impact of Delaying Decision:** **CRITICAL BLOCKER.** Physical database provisioning in Phase 2 depends entirely on this choice.

---

### DEC-02: Identity Provider & Authentication Strategy
- **Context:** User authentication requires session cookies, Edge Middleware validation, and mandatory Multi-Factor Authentication (TOTP) for Admin and Super Admin roles.
- **Options Considered:**
  - *Option A: Formally Approve Clerk (`@clerk/nextjs`) (Recommended).*
  - *Option B: Build Custom In-House Auth with Argon2id and Custom JWTs.*
- **Trade-off Analysis:**
  - *Option A Pros:* Turnkey TOTP MFA; sub-10ms Edge Middleware decoding; server-only `publicMetadata` prevents student role tampering; zero password vault liability; free tier covers up to 10,000 MAUs.
  - *Option A Cons:* External vendor dependency.
  - *Option B Pros:* Zero third-party cloud service.
  - *Option B Cons:* High development overhead (300+ hours); ongoing security patching liability; building custom TOTP MFA and refresh-token rotation from scratch.
- **Recommended Option:** **Option A (Clerk).**
- **Impact of Delaying Decision:** **CRITICAL BLOCKER.** Route protection, user seeding, and auth middleware scaffolding cannot begin without an approved identity provider.

---

### DEC-03: Real-Time Communication Engine
- **Context:** Course chat (MOD-08) and campus Emergency Mode (MOD-16) require low-latency bi-directional messaging under serverless hosting.
- **Options Considered:**
  - *Option A: Formally Approve Ably Realtime (Recommended).*
  - *Option B: Deploy Self-Hosted Socket.io and Redis on a Campus Virtual Machine.*
- **Trade-off Analysis:**
  - *Option A Pros:* Decouples persistent WebSockets from stateless Vercel Serverless compute; guaranteed 99.999% SLA; built-in reconnection buffer for campus Wi-Fi drops; automatic fallback to HTTP long-polling behind strict firewalls.
  - *Option A Cons:* Usage quotas apply once monthly message allowance is exceeded.
  - *Option B Pros:* Fixed server hosting cost.
  - *Option B Cons:* High DevOps maintenance (OS patching, cluster load-balancing, Redis sentinel failover); single point of failure during campus emergencies.
- **Recommended Option:** **Option A (Ably Realtime).**
- **Impact of Delaying Decision:** **HIGH.** Real-time chat and emergency broadcast integration in Phase 2 depends on this broker.

---

### DEC-04: College Notice Publishing Governance & Moderation Workflow
- **Context:** In collegiate environments, unmoderated broadcasts can lead to spam or unauthorized announcements.
- **Options Considered:**
  - *Option A: Direct Publishing for Enrolled Courses + Admin Moderation for College-Wide Bulletins (Recommended).*
  - *Option B: Mandatory Pre-Publication Moderation for ALL Notices by HOD / Admin.*
  - *Option C: Completely Open Publishing by Any Faculty Member Campus-Wide.*
- **Trade-off Analysis:**
  - *Option A (Balanced):* Faculty publish homework and reschedule alerts to their enrolled students immediately; college-wide announcements require Admin approval.
  - *Option B (Strict):* Prevents all accidental announcements, but creates severe administrative bottlenecks for routine daily classroom updates.
  - *Option C (Lax):* High risk of notice feed spam and student notification fatigue.
- **Recommended Option:** **Option A.**
- **Impact of Delaying Decision:** **MEDIUM.** Affects whether `NoticeService` requires a draft-and-approval state machine or a direct publication pipeline.

---

### DEC-05: Student Course Section Enrollment Strategy (MVP)
- **Context:** How student accounts are mapped to course sections (`course_enrollments`) in the initial release.
- **Options Considered:**
  - *Option A: Central Administrative CSV Batch Import (Recommended for MVP).*
  - *Option B: Student Self-Registration / Elective Enrollment Portal.*
- **Trade-off Analysis:**
  - *Option A Pros:* 100% data accuracy matching official college registrar records; zero student enrollment errors; rapid MVP delivery.
  - *Option A Cons:* Department admins must upload CSV rosters at the start of each semester.
  - *Option B Pros:* Students select electives directly.
  - *Option B Cons:* Requires building complex add/drop workflows, prerequisite validation, and capacity caps in Phase 1.
- **Recommended Option:** **Option A (Administrative CSV Import for MVP; Self-Registration in Phase 2).**
- **Impact of Delaying Decision:** **LOW to MEDIUM.** Determines whether student self-enrollment UI is scaffolded in Phase 2.

---

### DEC-06: Campus Emergency Mode Trigger Authorization
- **Context:** Triggering Emergency Mode (MOD-16) locks all connected client screens and sounds siren modals across campus.
- **Options Considered:**
  - *Option A: Single Super Admin Trigger with Mandatory Password/MFA Re-prompt (Recommended).*
  - *Option B: Dual-Authorization Rule (Requires Two Independent Admins to Confirm).*
- **Trade-off Analysis:**
  - *Option A Pros:* Immediate dispatch in life-safety emergencies (severe storms, active threats) where seconds matter; re-prompt prevents accidental triggers; audit log records IP and timestamp.
  - *Option B Pros:* Zero possibility of rogue single-operator panic.
  - *Option B Cons:* Unacceptable broadcast delay if second administrator is unreachable during a sudden disaster.
- **Recommended Option:** **Option A.**
- **Impact of Delaying Decision:** **LOW.** Emergency Mode is scheduled for Phase 3 (Advanced), with only schema hooks in MVP.

---

### DEC-07: Data Retention & PII Purging Window (DPDP Act Compliance)
- **Context:** Student academic records must be retained for institutional accreditation (NAAC/NBA), while personal PII must not be held indefinitely under the Indian DPDP Act, 2023.
- **Options Considered:**
  - *Option A: 5-Year Post-Graduation Window Before PII Purge (Recommended).*
  - *Option B: Indefinite Data Retention (No Purging).*
  - *Option C: Immediate PII Purge Upon Graduation.*
- **Trade-off Analysis:**
  - *Option A Pros:* Aligns with standard 5-year NAAC accreditation audit cycles while respecting DPDP Act privacy principles.
  - *Option B Pros:* Easy to maintain.
  - *Option B Cons:* Violates Indian DPDP Act data minimization regulations.
  - *Option C Pros:* Maximum privacy.
  - *Option C Cons:* Destroys records needed for alumni degree verifications and transcripts.
- **Recommended Option:** **Option A.**
- **Impact of Delaying Decision:** **LOW.** Relates to long-term database lifecycle scripts in Phase 3.

