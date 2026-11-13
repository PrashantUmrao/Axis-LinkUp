# Phase 3 — Known Issues & Operational Requirements
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Phase:** Phase 3 — Authentication, Authorization & Session Management  
**Date:** November 2026  
**Auditor:** Senior Software Architect & Technical Auditor  
**Status:** 1 PENDING CREDENTIAL ITEM / 1 MONITORED SUPPLY CHAIN ITEM  

---

## 1. Executive Summary

This document catalogues all known operational issues, configuration requirements, and external dependencies identified at the conclusion of Phase 3. None of these items represent unhandled software bugs or internal security defects. All internal application logic, database schemas, cryptographic webhooks, and access matrices are 100% verified and pass automated quality gates.

---

## 2. Active Known Issues Log

### ISSUE-001: Clerk Cloud Ingress `host_invalid` Error (BUG-001)

| Attribute | Specification |
| :--- | :--- |
| **Tracking ID** | **ISSUE-001** (Corresponds to BUG-001 in Bug Report) |
| **Severity** | **HIGH** (Configuration / External Cloud Dependency) |
| **Component** | Clerk Authentication Provider Integration |
| **First Identified** | Part 3.7 / Part 3.8 Audit |
| **Resolution Status** | **PENDING DEVELOPER CREDENTIAL INPUT** |

#### Technical Description & Reproduction
Probing the configured Clerk Frontend API using the publishable key in `.env`:
```powershell
curl -i -H "Authorization: Bearer pk_test_YXhpcy1saW5rdXAuY2xlcmsuYWNjb3VudHMuZGV2JA" https://axis-linkup.clerk.accounts.dev/v1/client
```
Yields an HTTP 400 Bad Request error:
```json
{
  "errors": [
    {
      "message": "We were unable to attribute this request to an instance running on Clerk. Make sure that your Clerk Publishable Key is correct.",
      "long_message": "We were unable to attribute this request to an instance running on Clerk. Make sure that your Clerk Publishable Key is correct.",
      "code": "host_invalid"
    }
  ]
}
```

#### Root Cause Analysis
Clerk publishable keys encode the target Frontend API host in base64. Decoding the current key:
`pk_test_YXhpcy1saW5rdXAuY2xlcmsuYWNjb3VudHMuZGV2JA`  
Base64 string `YXhpcy1saW5rdXAuY2xlcmsuYWNjb3VudHMuZGV2JA` decodes to `axis-linkup.clerk.accounts.dev$`.  
This domain has not been registered or claimed on Clerk's cloud infrastructure at `https://dashboard.clerk.com`.

#### System Impact Assessment
- **Unit & Security Tests:** **0% Impact** (Decoupled; test runner uses mock fixtures and passes 113/113 tests).
- **Next.js Production Build:** **0% Impact** (Compiles 16 routes cleanly in ~5.9s).
- **TypeScript & ESLint:** **0% Impact** (0 errors, 0 warnings).
- **Live Browser Interactive Authentication:** **BLOCKED** until valid developer keys are configured in `.env.local`.

#### Remediation Steps for Project Owner / Developer
1. Log into [Clerk Dashboard](https://dashboard.clerk.com).
2. Create or select the `Axis LinkUp` project.
3. In **API Keys**, copy the active `Publishable key` (`pk_test_...`) and `Secret key` (`sk_test_...`).
4. In **Webhooks**, configure endpoint `https://<your-domain>/api/webhooks/clerk`, subscribe to `user.*` events, and copy the `Signing Secret` (`whsec_...`).
5. Populate `.env.local` with the real keys:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_<your-real-key>
   CLERK_SECRET_KEY=sk_test_<your-real-key>
   CLERK_WEBHOOK_SECRET=whsec_<your-real-signing-secret>
   ```

---

### ISSUE-002: Transitive Build Tooling Security Advisories (BUG-005)

| Attribute | Specification |
| :--- | :--- |
| **Tracking ID** | **ISSUE-002** (Corresponds to BUG-005 in Bug Report) |
| **Severity** | **LOW** (Dev Tooling / Transitive Supply Chain) |
| **Component** | `npm audit` Dependencies (`postcss`, `deepmerge`, `minimatch`) |
| **First Identified** | Part 3.8 Security Audit |
| **Resolution Status** | **MONITORED / NON-BLOCKING** |

#### Technical Description
Running `npm audit` reports 13 vulnerabilities in transitive packages:
- `deepmerge`: Prototype pollution in `@shadcn/registry` (High).
- `postcss`: Path traversal and unescaped CSS stringify in `next` build toolchain (Moderate/High).
- `minimatch`: Potential DoS via globparts amplification in `@typescript-eslint` (Moderate).

#### Risk Assessment
- None of the flagged packages are loaded or executed in production runtime network listeners.
- They are exclusively invoked during compile-time asset bundling (`next build`) or developer CLI component scaffolding (`npx shadcn add ...`).
- Running `npm audit fix --force` would trigger breaking framework upgrades to `next@16`, which is in incompatible preview states.
- **Action:** Retain current stable dependencies. Review patch releases during standard monthly maintenance.

---

## 3. Operational Deployment Requirements for Staging/Production

Before promoting Axis LinkUp to staging or live institutional pilot environments, the following manual configuration checklist must be satisfied:

### 3.1 MongoDB Atlas Network Hardening
- **Requirement:** Restrict MongoDB Atlas IP Access List.
- **Action:** Remove any `0.0.0.0/0` (allow all) rules in MongoDB Atlas. Whitelist only the static outbound IP addresses of the application hosting servers (or configure AWS VPC Peering / Vercel Secure Integration).

### 3.2 TLS 1.3 & HTTPS Enforcement
- **Requirement:** Secure transport for institutional traffic.
- **Action:** Ensure DNS records route through Cloudflare or reverse proxy with TLS 1.3 enforced and HSTS preloading enabled.

### 3.3 Root Super Administrator Provisioning
- **Requirement:** Initial super administrator account creation.
- **Action:** Execute the offline administrative script before opening ingress:
  ```powershell
  npx tsx scripts/create-super-admin.ts
  ```
  Provide an institutional super admin email (`admin@aitm.ac.in`) and a cryptographically generated high-entropy password.

---

## 4. Responsibility & Ownership Matrix

| Issue / Requirement | Designated Owner | Target Milestone | Pre-requisite For |
| :--- | :--- | :--- | :--- |
| Clerk Credentials Setup (ISSUE-001) | Project Owner / DevOps Lead | Before Phase 4 E2E Browser Testing | Live User Interactive Login |
| Transitive Dependencies (ISSUE-002) | Frontend Lead | Monthly Maintenance Sprint | Clean `npm audit` report |
| MongoDB Atlas IP Whitelisting | Database Administrator | Staging Deployment | Production Go-Live |
| Super Admin CLI Bootstrapping | System Administrator | Staging Deployment | Initial Platform Management |

