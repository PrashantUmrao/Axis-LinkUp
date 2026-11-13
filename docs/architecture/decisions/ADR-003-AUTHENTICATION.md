# Architecture Decision Record (ADR)
## ADR-003: Authentication & Identity Management — Clerk

> **Status:** Proposed / Under Review (Recommendation)  
> **Date:** November 2026  
> **Deciders:** Senior Software Architect, Security Lead  
> **Target System:** Axis LinkUp Identity & Access Management  

---

## 1. Context & Problem Statement

Axis LinkUp requires a secure, production-grade identity architecture that supports:
- Four user roles: Student, Faculty, Admin, Super Admin.
- Mandatory Multi-Factor Authentication (MFA) for Admin and Super Admin roles.
- Secure session cookie management (`HttpOnly`, `SameSite=Strict`, `Secure`).
- Fast edge routing in Next.js Edge Middleware.
- Elimination of privilege escalation risks (preventing students from elevating their own roles).
- Bulk provisioning from institutional CSV rosters.

---

## 2. Decision Drivers

- **Security & Threat Mitigation (NFR-SEC-01, NFR-SEC-02):** Eliminate common authentication vulnerabilities (session fixation, CSRF, insecure token storage, unhashed credentials).
- **Edge Performance:** Validate session tokens at the edge network layer prior to executing serverless functions.
- **Maintenance Overhead:** Building and maintaining a custom auth stack (email verification, TOTP MFA, password reset flows, session rotation) consumes significant development hours and creates long-term security maintenance liability.

---

## 3. Options Considered

### Option 1: Custom In-House Auth (Argon2id + JWT / Express Sessions)
- **Pros:** Total control over code, zero third-party licensing fees, 100% data residency on campus database.
- **Cons:** High development effort, ongoing security liability, complex edge session validation, custom MFA implementation overhead, risk of implementation flaws.

### Option 2: NextAuth.js / Auth.js
- **Pros:** Open source, runs within Next.js, no monthly subscription fees.
- **Cons:** Complex database adapter setup with Mongoose in serverless environments; TOTP MFA is not natively turnkey; session synchronization requires substantial custom code; recent breaking changes across version transitions.

### Option 3: Managed Identity Provider — Clerk (Recommended)
- **Pros:**
  - Turnkey Next.js App Router integration with native Edge Middleware support (`clerkMiddleware`).
  - Pre-built, accessible, institutional-branded UI components for sign-in, MFA, and profile management.
  - Multi-tiered metadata architecture (`publicMetadata`, `privateMetadata`, `unsafeMetadata`) that mechanically prevents client-side role tampering.
  - Webhook synchronization (via Svix) to keep MongoDB `users` collection in sync.
  - Free tier covers up to 10,000 monthly active users (fully covers Axis Institute's 3,000–5,000 users).
- **Cons:** Third-party cloud dependency; requires webhook endpoint maintenance to keep MongoDB user profiles synchronized.

---

## 4. Proposed Decision

**Adopt Option 3: Clerk as the Identity and Session Provider.**

Clerk will manage credentials, password hashing, session cookies, and MFA. User roles will be stored in Clerk's server-only `publicMetadata` for edge routing and mirrored in MongoDB `users.role` as the application source of truth.

---

## 5. Advantages & Positive Consequences

1. **Ironclad Role Security:** By placing roles strictly in `publicMetadata`, frontend clients cannot alter their own roles. Only Super Admin Server Actions utilizing the server-side `CLERK_SECRET_KEY` can mutate roles.
2. **Turnkey MFA:** Admin and Super Admin accounts can enforce TOTP authenticator app verification with zero custom cryptography code.
3. **Sub-10ms Edge Routing:** Next.js Edge Middleware decodes Clerk JWT claims directly at the edge, redirecting unauthorized students before spinning up serverless lambdas.
4. **Reduced Attack Surface:** Password storage and hashing operations are offloaded to an audited, SOC 2 Type II certified platform.

---

## 6. Disadvantages & Negative Consequences

1. **Vendor Lock-In Risk:** Migrating away from Clerk in the future would require exporting user password hashes or triggering a mandatory password reset.
2. **Dual-Store Synchronization:** Network failures or delayed webhooks could theoretically cause transient inconsistencies between Clerk and MongoDB (mitigated by idempotent webhook handlers and signature verification).

---

## 7. Mitigation Strategies & Future Considerations

- **Idempotent Webhooks:** The `/api/webhooks/clerk` endpoint uses Svix signature verification and executes upsert queries in MongoDB, ensuring webhook retries never produce duplicate accounts.
- **Data Minimization:** Only store basic identity credentials (email, name, role) in Clerk. All academic records, grades, and private mobile numbers remain strictly inside MongoDB Atlas (AWS Mumbai).
- **Institutional SSO Expansion:** In Phase 2, if Axis Institute adopts Google Workspace for Education or Microsoft 365, Clerk can activate institutional SAML/OAuth SSO with a single dashboard toggle.

