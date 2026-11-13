# Register of Authentication Decisions Requiring Human Approval

> **Document ID:** DOC-AUTH-009  
> **Status:** Pending Stakeholder Review (Phase 3, Part 3.1)  
> **Institution:** Axis Institute of Technology & Management  
> **Target Decision Makers:** Director, Dean of Academic Affairs, Campus IT Head, Lead Architect  
> **Last Updated:** November 2026  

---

## 1. Overview & Governance Framework

Before proceeding to physical authentication implementation in **Phase 3, Part 3.2** (installing packages, configuring API keys, creating Mongoose models, and writing middleware), the following six authentication decisions require formal stakeholder review and developer confirmation.

Until these decisions are formally approved, they are classified as **PENDING HUMAN APPROVAL**.

---

## 2. Decision Register

### DEC-AUTH-01: Primary Identity Provider Selection
- **Context:** The system requires secure credential storage, session management, Edge Middleware decoding, and mandatory TOTP MFA for administrative accounts.
- **Options Considered:**
  - *Option A: Formally Approve Clerk (`@clerk/nextjs`) (Recommended).*
  - *Option B: Select Better Auth (`better-auth`) for self-hosted open-source auth.*
  - *Option C: Build Custom In-House Authentication with Argon2id and custom JWTs.*
- **Trade-off Analysis:**
  - *Option A Pros:* Built-in TOTP MFA; sub-10ms Edge JWT decoding; tamper-proof server-only `publicMetadata` preventing role escalation; 10,000 free MAU ceiling covers Axis Institute's 3,500 active students and 200 faculty.
  - *Option A Cons:* External SaaS dependency.
  - *Option B Pros:* Self-hosted; direct MongoDB adapter; zero third-party cloud user limits.
  - *Option B Cons:* Younger ecosystem; requires building custom admin consoles, email templates, and MFA enrollment UI from scratch.
  - *Option C Pros:* Full internal control.
  - *Option C Cons:* Severe security and liability risk; 250+ hours of custom development; ongoing maintenance.
- **Architectural Recommendation:** **Option A (Clerk).**
- **Impact of Delaying Decision:** RESOLVED.
- **Current Status:** **APPROVED by Stakeholder / Project Owner** (Option A: Clerk `@clerk/nextjs` with built-in TOTP MFA and Next.js App Router integration).

---

### DEC-AUTH-02: Student Registration Ingress Policy
- **Context:** Deciding how new students gain initial access to Axis LinkUp.
- **Options Considered:**
  - *Option A: Self-Service Registration with Pre-Authorized Roster Verification (Recommended).* Students sign up using their `@axiscolleges.in` email; the system verifies their roll number against pre-seeded registrar records.
  - *Option B: Closed Administrative CSV Pre-Provisioning Only.* Students cannot register publicly; IT admins upload a student CSV, and students receive one-time invitation links.
- **Trade-off Analysis:**
  - *Option A Pros:* Low administrative friction; self-service onboarding during admission orientation; immediate student activation.
  - *Option A Cons:* Requires registrar admission rosters to be pre-seeded into MongoDB.
  - *Option B Pros:* Maximum administrative control; zero unverified accounts created.
  - *Option B Cons:* High IT administrative burden during annual fresh batch onboarding (1,000+ students).
- **Architectural Recommendation:** **Option A (Self-Service with Roster Verification).**
- **Impact of Delaying Decision:** Affects the registration route design in Phase 3.3.
- **Current Status:** **PENDING HUMAN APPROVAL.**

---

### DEC-AUTH-03: Multi-Factor Authentication (MFA) Scope
- **Context:** Evaluating the enforcement boundary of Multi-Factor Authentication across collegiate roles.
- **Options Considered:**
  - *Option A: Enforce Mandatory TOTP MFA on Admin & Super Admin; Optional for Faculty & Students (Recommended).*
  - *Option B: Enforce Mandatory MFA on All Faculty and Administrators.*
  - *Option C: Enforce Mandatory MFA Campus-Wide (including all 3,500 students).*
- **Trade-off Analysis:**
  - *Option A Pros:* Protects high-value administrative capabilities while preventing student login friction during rapid timetable checks on mobile devices.
  - *Option A Cons:* Faculty accounts remain single-factor unless opted in.
  - *Option B Pros:* Protects grading and notice broadcast endpoints.
  - *Option B Cons:* Increases IT support tickets for faculty losing authenticator devices.
  - *Option C Pros:* Maximum campus-wide security.
  - *Option C Cons:* Extreme friction for mobile-heavy student body; hundreds of account recovery requests during exam days.
- **Architectural Recommendation:** **Option A (Mandatory on Admins; Optional on Faculty/Students).**
- **Impact of Delaying Decision:** Defines MFA onboarding redirection gates in Phase 3.4.
- **Current Status:** **PENDING HUMAN APPROVAL.**

---

### DEC-AUTH-04: Session Lifetime & Workstation Idle Timeout
- **Context:** Establishing token lifetimes for mobile students vs. high-density administrative workstations.
- **Options Considered:**
  - *Option A: Differentiated Timeouts (Recommended).* Students: 7-day rolling mobile session. Administrators: 30-minute idle workstation timeout with mandatory re-authentication.
  - *Option B: Uniform 24-Hour Timeout Across All Roles.*
  - *Option C: Indefinite Persistent Mobile Sessions for All Users.*
- **Trade-off Analysis:**
  - *Option A Pros:* Balances student mobile usability with strict physical workstation security in campus administrative offices.
  - *Option A Cons:* Requires dual-policy session configuration.
- **Architectural Recommendation:** **Option A (Differentiated Timeouts).**
- **Impact of Delaying Decision:** Configures session cookie maxAge and refresh rules in Phase 3.3.
- **Current Status:** **PENDING HUMAN APPROVAL.**

---

### DEC-AUTH-05: Administrative Password Expiration Policy
- **Context:** Determining whether administrators should be forced to change passwords periodically.
- **Options Considered:**
  - *Option A: Modern NIST Standard — No Arbitrary Expiration; Rely on Strong Passwords, Breach Screening & TOTP MFA (Recommended).*
  - *Option B: Legacy 90-Day Forced Password Expiration for Admins.*
- **Trade-off Analysis:**
  - *Option A Pros:* Follows NIST SP 800-63B guidelines; avoids predictable password modifications (e.g. `Admin2026!` -> `Admin2026@`).
  - *Option B Pros:* Traditional compliance checkbox.
- **Architectural Recommendation:** **Option A (NIST Modern Standards).**
- **Impact of Delaying Decision:** Non-blocking for early Phase 3.
- **Current Status:** **PENDING HUMAN APPROVAL.**

---

### DEC-AUTH-06: Disciplinary Suspension Ingress Behavior
- **Context:** Defining the exact system behavior when an account status is transitioned to `'suspended'`.
- **Options Considered:**
  - *Option A: Complete Session Termination & Immediate Ingress Block (Recommended).* Revoke all active sessions via provider API; redirect all navigation to `/account-suspended`.
  - *Option B: Soft Suspension (Read-Only Mode).* Block notices, chat, and submissions, but allow students to view their historical attendance and fees.
- **Trade-off Analysis:**
  - *Option A Pros:* Immediate, total risk mitigation for serious disciplinary, academic integrity, or security violations.
  - *Option A Cons:* Requires manual administrative intervention to communicate with the student.
- **Architectural Recommendation:** **Option A (Complete Termination & Hard Ingress Block).**
- **Impact of Delaying Decision:** Defines Server Component layout redirection rules.
- **Current Status:** **PENDING HUMAN APPROVAL.**

---

## 3. Summary of Approvals Required Before Phase 3.2

| Decision ID | Description | Architect Recommendation | Blocker Level | Stakeholder Sign-Off |
| :---: | :--- | :---: | :---: | :---: |
| **DEC-AUTH-01** | **Primary Identity Provider** | **Clerk (`@clerk/nextjs`)** | **CRITICAL** | Pending Human Review |
| **DEC-AUTH-02** | **Student Registration Policy** | **Self-Service + Roster Verification** | **High** | Pending Human Review |
| **DEC-AUTH-03** | **MFA Enforcement Scope** | **Mandatory Admins; Optional Others** | **Medium** | Pending Human Review |
| **DEC-AUTH-04** | **Session Lifetime & Timeouts** | **Differentiated (7-Day Mobile / 30-Min Admin)** | **Medium** | Pending Human Review |
| **DEC-AUTH-05** | **Password Expiration** | **NIST Standard (No Arbitrary Rotation)** | **Low** | Pending Human Review |
| **DEC-AUTH-06** | **Disciplinary Suspension** | **Complete Termination & Hard Redirect** | **High** | Pending Human Review |

