# Authentication Provider Evaluation & Architectural Comparison

> **Document ID:** DOC-AUTH-001  
> **Status:** Pending Human Approval (Phase 3, Part 3.1)  
> **Institution:** Axis Institute of Technology & Management  
> **System:** Axis LinkUp Platform  
> **Evaluators:** Principal Authentication Architect & Application Security Engineer  
> **Last Updated:** November 2026  

---

## 1. Executive Summary & Objective

The objective of this evaluation is to conduct a rigorous, objective architectural comparison between the three candidate authentication solutions identified for **Axis LinkUp**:
1. **Clerk (`@clerk/nextjs`)** — Managed Developer Identity Platform
2. **Better Auth (`better-auth`)** — Open-Source Self-Hosted Modern Auth Framework
3. **Custom In-House Authentication** — Custom-Engineered Auth Engine (Argon2id + JWT + Web Crypto)

This analysis evaluates each provider across ten core dimensions to determine the optimal solution for Axis Institute's 3,000 to 5,000 students and faculty members.

> [!IMPORTANT]
> **Decision Status: PENDING HUMAN APPROVAL.**  
> While this document presents an authoritative architectural recommendation, the final provider selection remains pending formal confirmation by the lead developer and institutional stakeholders.

---

## 2. Comprehensive 10-Dimension Evaluation Matrix

| Evaluation Dimension | Clerk (`@clerk/nextjs`) | Better Auth (`better-auth`) | Custom In-House Auth |
| :--- | :--- | :--- | :--- |
| **1. Security Model** | Enterprise-grade; built-in TOTP MFA; automated brute-force protection; device fingerprinting; breach password alerts. | Strong open-source foundation; plugin-based 2FA; relies on host security and database safeguards. | Full architectural liability; custom Argon2id hashing; custom TOTP and rate-limiting implementation required. |
| **2. Session Management** | Cryptographically signed, short-lived JWTs; automated refresh-token rotation in `HttpOnly`, `SameSite=Strict` cookies. | Database-backed sessions or stateless JWTs; requires custom cookie policy and rotation configuration. | Custom cookie management; must build token rotation, blacklisting, and session revocation logic from scratch. |
| **3. Next.js 15 Compatibility** | Native App Router support; sub-10ms Edge Middleware decoding; official React Server Components (RSC) hooks. | Next.js App Router support; middleware integration; server actions compatibility via plugins. | Requires custom edge middleware JWT verifier; custom context providers for RSC. |
| **4. MongoDB Integration** | Dual-store pattern: decoupled cloud identity with Svix-verified webhooks syncing to MongoDB `users` collection. | MongoDB adapter available; stores auth tables (`user`, `session`, `account`) directly in database. | Native Mongoose integration; user credentials and profiles co-located in MongoDB collections. |
| **5. User Management** | Rich administrative dashboard; invitation flows; user ban/suspend; user impersonation for IT troubleshooting. | Admin plugin available; basic user management; custom UI required for complex administrative workflows. | Must construct 100% of the administrative user management, ban, and password reset UI from scratch. |
| **6. Role & Permission Support**| Segregated metadata: `publicMetadata` (server-only write, edge-readable), `privateMetadata`, `unsafeMetadata`. | Role/Permission plugin available; schema-driven roles stored in database. | Fully customizable; stored directly in MongoDB document. |
| **7. Development Complexity** | **Very Low:** Turnkey components (`<SignIn />`, `<UserProfile />`); reduces auth setup to 10–15 hours. | **Moderate:** Requires schema setup, adapter configuration, email provider integration (40–60 hours). | **Very High:** 200–300+ engineering hours; password hashing, salt rotation, email verification, MFA, CSRF. |
| **8. Maintenance Liability** | **Zero server maintenance:** Security patches, CVE mitigations, and compliance handled upstream. | **Moderate:** Dependency updates, database migration maintenance, session table vacuuming. | **Extreme Liability:** Ongoing security patching, cryptographic maintenance, penetration testing costs. |
| **9. Cost & Usage Limits** | Generous free tier: up to **10,000 monthly active users (MAUs)** with unlimited logins; fully covers 3,000–5,000 MAUs. | **100% Free & Open Source:** Hosting costs tied only to existing Vercel/MongoDB infrastructure. | **100% Free (Software):** High ongoing developer labor cost for maintenance and security audits. |
| **10. Future Scalability** | Global edge network; handles concurrent login surges (e.g., morning timetable or result release) effortlessly. | Scales with host database; high concurrent database lookups during traffic spikes unless Redis is added. | Scalability constrained by MongoDB session lookups; requires Redis caching layer for high concurrency. |

---

## 3. Deep Dive into Candidate Providers

### 3.1 Clerk (`@clerk/nextjs`)
- **Strengths:**
  1. *Turnkey Multi-Factor Authentication (MFA):* Satisfies the mandatory institutional requirement (NFR-SEC-01) for Admin and Super Admin TOTP MFA with zero custom cryptographic code.
  2. *Tamper-Proof Metadata:* Server-only write permissions on `publicMetadata` physically prevent malicious students from elevating their privileges via client-side script manipulation.
  3. *Generous Institutional Free Tier:* 10,000 MAUs free tier easily accommodates Axis Institute's current 3,500 active students and 200 faculty without recurring SaaS expenses during initial rollout.
  4. *Decoupled DPDP Compliance:* Only minimal authentication attributes (email, name, hashed credentials) reside in Clerk. All academic records, grades, PII phone numbers, and departmental associations remain strictly in MongoDB Atlas in AWS Mumbai (`ap-south-1`).
- **Weaknesses:**
  1. Proprietary third-party SaaS dependency.
  2. Pricing cliff if active user count ever exceeds 10,000 MAUs.

### 3.2 Better Auth (`better-auth`)
- **Strengths:**
  1. Open-source, self-hosted, zero vendor lock-in.
  2. Direct database integration with MongoDB via official adapter.
  3. No external monthly user limits or SaaS pricing tiers.
- **Weaknesses:**
  1. Relatively young ecosystem compared to NextAuth/Auth.js and Clerk; smaller community and fewer battle-tested production benchmarks.
  2. Requires building custom institutional administrative consoles for user impersonation, password reset overrides, and audit monitoring.
  3. Requires provisioning and managing transactional email templates and delivery pipelines for basic verification from Day 1.

### 3.3 Custom In-House Authentication
- **Strengths:**
  1. Total architectural ownership; zero external dependencies.
  2. Unified single-store database architecture directly within MongoDB.
- **Weaknesses:**
  1. *Severe Security Risk:* Engineering custom authentication introduces critical vulnerabilities (timing attacks on hash comparisons, JWT replay flaws, broken session invalidation, CSRF oversights).
  2. *Resource Sink:* Allocating 250+ hours to building commodity login/MFA infrastructure diverts engineering focus from core academic modules (Notices, Timetable, Service Requests).
  3. *Zero Out-of-the-Box Admin Tooling:* Everything from password resets to session revocation consoles must be built manually.

---

## 4. Architectural Recommendation

### **Recommended Provider: Clerk (`@clerk/nextjs`)**

### Rationale:
1. **Security & Zero Liability:** For an educational institution managing sensitive student and faculty records, offloading credential vaults, password hashing, and TOTP MFA to a dedicated SOC 2 Type II compliant identity provider drastically lowers the institution's liability profile.
2. **Speed to Value:** Enables the engineering team to deploy a robust, multi-role authentication system in days rather than weeks, keeping Phase 3 on schedule.
3. **Role Escalation Protection:** The segregated `publicMetadata` pattern guarantees that role claims cannot be forged by client callers.
4. **Zero Cost Impact:** With 3,000–5,000 MAUs, Axis LinkUp operates safely within Clerk’s 10,000 free MAU ceiling.

---

## 5. Decision Status & Approvals

| Decision Item | Proposed Selection | Impact | Current Status | Required Sign-Off |
| :--- | :---: | :--- | :---: | :--- |
| **Authentication Provider** | **Clerk** | Unlocks Phase 3.2 implementation; defines session handling | **PENDING HUMAN APPROVAL** | Lead Developer / Technical Stakeholder |
| *Fallback Provider* | *Better Auth* | Requires self-hosted database adapter & custom admin UI | *Standby Alternative* | — |

