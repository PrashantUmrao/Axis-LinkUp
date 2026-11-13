# Open Questions, Architectural Decisions & Risk Register

> **Document ID:** DOC-REQ-006  
> **Status:** Draft for Review (Phase 1, Part 1.1)  
> **Institution:** Axis Institute of Technology & Management  
> **Target Audience:** College Administration, IT Directors, Project Sponsors, Engineering Lead  

---

## 1. Executive Summary

This document captures unresolved institutional policies, technical decisions requiring stakeholder sign-off, architectural challenges, third-party dependency risks, and recommended mitigations for **Axis LinkUp**. 

In accordance with system design principles, **no assumptions or fabricated college business rules have been hardcoded into the specifications**. Items are categorized by their nature, accompanied by architectural impact analysis, proposed recommendations, and sign-off status.

---

## 2. Institutional & Business Policy Questions

### Question 1: Identity Source of Truth & Authentication Mode
- **Context:** Students and faculty currently utilize email addresses, but it is unconfirmed whether Axis Institute operates an existing central directory (e.g., Google Workspace for Education, Microsoft 365, or LDAP/Active Directory).
- **Impact on Architecture:** Determines whether MOD-01 should implement standalone credentials (Argon2id password hashes + email verification) or integrate an OpenID Connect (OIDC) / SAML Single Sign-On (SSO) gateway.
- **Proposed Recommendation:**
  - *Phase 1 (MVP):* Implement robust standalone email/password authentication with CSV bulk onboarding.
  - *Phase 2:* Add Google/Microsoft OAuth2 SSO provider configuration if institutional domains (e.g., `@axiscolleges.in`) are active.
- **Decision Status:** 🟡 Pending Institutional IT Sign-off.

### Question 2: College Notice Governance & Moderation Workflow
- **Context:** Does a faculty member have the authority to publish a departmental notice directly to students, or must all notices undergo pre-publication moderation by an Admin or Head of Department (HOD)?
- **Impact on Architecture:** Dictates whether MOD-07 requires a multi-stage approval state machine (`Draft` &rarr; `Submitted for Review` &rarr; `Approved` &rarr; `Published`) or a direct publishing pipeline.
- **Proposed Recommendation:** Course-level announcements can be published directly by assigned course faculty. Department-wide and college-wide notices must be authored by or approved by an Admin / HOD.
- **Decision Status:** 🟡 Pending Academic Dean Confirmation.

### Question 3: Student Service Request Taxonomy & Approval Hierarchy
- **Context:** The college processes multiple desk requisitions (Bonafide Certificates, Medical Leaves, Lab Access, No-Dues Clearance). The exact approval chains (e.g., Student &rarr; Mentor &rarr; HOD &rarr; Registrar) and official SLAs are not yet formally cataloged.
- **Impact on Architecture:** Influences the database structure of MOD-13. A rigid schema vs. a configurable multi-step workflow engine.
- **Proposed Recommendation:** Launch MVP with the 5 most frequent standardized single-approver requests (Bonafide, Leave, Lab Access, ID Card, General Grievance). Introduce dynamic multi-stage approval pipelines in Version 2.0.
- **Decision Status:** 🟡 Pending Registrar Office Feedback.

### Question 4: Faculty Privacy & Real-Time Messaging Boundaries
- **Context:** Faculty members express concern regarding after-hours direct messages from students disrupting their personal time.
- **Impact on Architecture:** Determines whether MOD-08 must implement "Office Hours" message silencing, rate limiting, and an opt-out toggle for direct student-to-faculty chats.
- **Proposed Recommendation:** Enforce course-level group channels as the primary communication medium. Restrict 1-on-1 direct messages to faculty-configured office hours, with students seeing an "Instructor is currently offline" notice outside designated windows.
- **Decision Status:** 🟡 Recommended Policy for Approval.

### Question 5: Skill & Achievement Passport Verification Authority
- **Context:** Who carries the institutional authority to certify a student's hackathon win, external MOOC certification, or paper presentation?
- **Impact on Architecture:** Defines the approval routing in MOD-15 (Class Mentor vs. HOD vs. Training & Placement Cell).
- **Proposed Recommendation:** Direct submissions to the designated Departmental Co-curricular / T&P Coordinator. Once approved, the record is cryptographically stamped as "Institution Verified".
- **Decision Status:** 🟡 Pending Academic Council Input.

### Question 6: Emergency Mode Triggering Authorization
- **Context:** Initiating campus-wide Emergency Mode is a high-gravity action that locks active screens and dispatches high-priority broadcasts.
- **Impact on Architecture:** Dictates authorization gates in MOD-16 (single Super Admin key vs. two-person dual authorization rule).
- **Proposed Recommendation:** Allow Super Admin (Director/Dean) immediate single-action trigger with mandatory password/MFA re-prompt. Provide an audit alarm dispatched to all administrators upon activation.
- **Decision Status:** 🟡 Pending Director Sign-off.

---

## 3. Technical & Architectural Decisions

### Question 7: Object Storage Provider & Storage Budget
- **Context:** Assignments, study materials, student proofs, and notice attachments require reliable, scalable cloud object storage.
- **Options Under Review:**
  1. *AWS S3 / Cloudflare R2:* High durability, global CDN, pay-as-you-go pricing, zero egress fees (Cloudflare R2).
  2. *Self-Hosted MinIO:* Complete data residency on campus servers, zero recurring cloud costs, but requires dedicated campus hardware, RAID backups, and IT maintenance.
- **Recommendation:** Cloudflare R2 or AWS S3 with signed private URLs for sensitive student submissions and public cached URLs for lecture notes.
- **Decision Status:** 🟡 Pending Infrastructure Budget Review.

### Question 8: Real-Time Communication Architecture
- **Context:** MOD-08 (Chat) and MOD-16 (Emergency Mode) require low-latency bi-directional messaging.
- **Options Under Review:**
  1. *Custom WebSocket Server (Node.js / ws + Redis Pub/Sub):* Full architectural control, cost-effective, self-contained within the stack.
  2. *Managed Real-Time Service (e.g., Pusher, Ably, Supabase Realtime):* Minimal operational maintenance, rapid development, but incurs external API costs as user count scales.
- **Recommendation:** Implement custom Redis Pub/Sub with WebSocket server for development and production to keep the platform fully self-hosted and cost-predictable.
- **Decision Status:** 🟡 Proposed Architecture for Engineering Sign-off.

### Question 9: Database Deployment & High Availability Strategy
- **Context:** The system expects 3,000–5,000 users with burst loads during exam release and emergency events.
- **Options Under Review:**
  1. *Managed PostgreSQL (AWS RDS / Neon / Supabase):* Automated backups, point-in-time recovery, horizontal read replicas.
  2. *Self-Hosted PostgreSQL on Campus Linux Server:* Data stays strictly inside Axis Institute premises, zero cloud fee, requires campus UPS and backup automation.
- **Recommendation:** Managed PostgreSQL instance with automated daily snapshots and connection pooling (PgBouncer) for high reliability.
- **Decision Status:** 🟡 Pending IT Infrastructure Decision.

### Question 10: Background Worker & Asynchronous Processing Engine
- **Context:** Heavy tasks (generating bulk Bonafide PDFs, dispatching thousands of notification emails, parsing CSV rosters) will degrade API response times if processed synchronously.
- **Recommendation:** Utilize a Redis-backed queue (e.g., BullMQ) running on dedicated worker processes decoupled from the Next.js web application server.
- **Decision Status:** 🟢 Confirmed Engineering Best Practice.

---

## 4. Architectural Risk Register & Mitigation Strategies

| Risk ID | Risk Description | Severity | Probability | Proposed Mitigation Strategy |
| :--- | :--- | :---: | :---: | :--- |
| **RSK-01** | **Database Connection Exhaustion:** Sudden spike in student logins during exam timetable releases exhausts database pool. | High | High | Implement connection pooling (PgBouncer), edge caching for static notices/schedules, and aggressive Redis query caching. |
| **RSK-02** | **Malicious File Uploads:** Students or bad actors upload executable malware disguised as assignment submissions or notes. | Critical | Medium | Validate file magic bytes (not just extensions), reject executable MIME types, store in isolated buckets with no public execution permissions, and enforce max size limits (25MB). |
| **RSK-03** | **Privilege Escalation via Parameter Tampering:** Malicious user modifies client-side payload to elevate role to Admin or view another student's submission. | Critical | Low | Zero-trust backend architecture: re-verify session, user role, and entity ownership on every single Server Action and database query. |
| **RSK-04** | **Data Loss During Campus Power / Hardware Failure (if self-hosted):** On-premise server suffers storage failure without redundant backups. | High | Medium | Enforce automated off-site encrypted daily backups to S3-compatible cloud storage with tested disaster recovery playbooks. |
| **RSK-05** | **Notice Information Noise & Notification Fatigue:** Users disable notifications due to irrelevant or spammy broadcast announcements. | Medium | High | Strict multi-tier targeting (branch/year/section) so students only receive notices directly relevant to their enrolled cohort. |

---

## 5. Confirmed Baseline vs. Proposed Recommendations

To maintain transparency between verified stakeholder inputs and engineering recommendations, the current project status is delineated below:

### Confirmed Baseline (Approved Scope)
- Target institution is Axis Institute of Technology & Management.
- 4 distinct user roles: Student, Faculty, Admin, Super Admin.
- 19 core functional modules identified for the ecosystem.
- Clean separation between MVP (Phase 1), Version 2.0 (Phase 2), and Advanced (Phase 3).
- Strict non-functional requirements (WCAG 2.1 AA accessibility, sub-second latency, DPDP Act compliance, immutable audit logs).

### Proposed Recommendations Awaiting Sign-Off
- Selection of Cloudflare R2 vs. Self-hosted MinIO for binary storage.
- Standalone credentials + CSV provisioning for MVP vs. immediate Google/Microsoft SSO integration.
- Limitation of student-to-faculty direct messages to faculty office hours.
- Five standardized request templates for the initial Student Request Tracker release.
- Emergency Mode single-action Super Admin trigger with mandatory MFA re-prompt.

---

## 6. Next Steps for Phase 1, Part 1.2

Upon stakeholder review of this Requirement Analysis package, the recommended immediate next steps for **Phase 1, Part 1.2 (System Architecture & Data Modeling)** are:

1. **Formalize Domain Data Models & Schemas:**
   - Author complete PostgreSQL schema definitions (tables, foreign keys, indexes, cascades).
   - Define entity relationship diagrams (ERDs) connecting Users, Departments, Courses, Notices, Requests, and Submissions.
2. **Design API & Server Action Contract Specifications:**
   - Detail request/response payload schemas using TypeScript interfaces and Zod validation schemas.
   - Map route handlers and access policies for MVP endpoints.
3. **Draft Wireframe & UI/UX Component Architecture:**
   - Specify component hierarchy, atomic design tokens (colors, typography, spacing), and layout shells for each role dashboard.
4. **Finalize Infrastructure & Deployment Blueprint:**
   - Define Docker containerization specs, CI/CD pipeline, and environment configuration (.env variables).

