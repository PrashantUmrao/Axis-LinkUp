# Phase 3 — Security Remediation & Operational Guide
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Component:** Phase 3: Authentication, Authorization & Session Management  
**Audit Date:** November 2026  
**Auditor:** Senior Full-Stack Engineer & Application Security Reviewer  
**Classification:** ACTIONABLE ENGINEERING MANUAL  

---

## 1. Executive Summary

This Remediation Report delivers concrete, step-by-step operational procedures to resolve outstanding configuration items identified during the Phase 3 Security Audit. While internal application code, tests, and builds have achieved 100% compliance, production activation requires provisioning live credentials from the approved external identity provider (**Clerk**) and establishing production deployment hardening.

---

## 2. Remediation Procedure: BUG-001 (Clerk `host_invalid` Configuration)

### 2.1 Problem Recap
The application is currently configured with placeholder Clerk credentials (`pk_test_YXhpcy1saW5rdXAuY2xlcmsuYWNjb3VudHMuZGV2JA`), which target an unallocated Clerk cloud domain `axis-linkup.clerk.accounts.dev`. The Clerk cloud edge rejects incoming client handshakes with `code: "host_invalid"`.

### 2.2 Resolution Action Plan

The project owner or designated system administrator must complete the following six steps:

#### Step 1: Create / Select Application in Clerk Dashboard
1. Log in to the [Clerk Management Dashboard](https://dashboard.clerk.com).
2. Click **Create Application**.
3. Name the application: **`Axis LinkUp`** (or **`Axis LinkUp - Dev`** for local testing).
4. Select approved authentication strategies:
   - **Email address** (Required — institutional domain verification enabled).
   - **Password** or **Email Verification Code** (OTP).
   - *Optional:* Google Workspace SSO (if college Google accounts are utilized).
5. Click **Create Application**.

#### Step 2: Configure Ingress & Redirect URLs
In the Clerk Dashboard, navigate to **Configure > Paths** and configure standard platform routing:
- **Sign-in path:** `/sign-in`
- **Sign-up path:** `/sign-up`
- **After sign-in fallback URL:** `/` (Middleware will automatically redirect to `/student/dashboard`, `/faculty/dashboard`, `/admin/dashboard`, or `/super-admin/dashboard` based on user role).
- **After sign-up fallback URL:** `/shared/profile` (Directs to academic onboarding profile completion).

#### Step 3: Retrieve API Keys
Navigate to **Configure > Developers > API Keys**:
1. Copy the **Publishable key** (`pk_test_...` for development, `pk_live_...` for production).
2. Copy the **Secret key** (`sk_test_...` for development, `sk_live_...` for production).

#### Step 4: Configure Webhook Synchronization
To enable bidirectional user synchronization between Clerk and the Axis LinkUp MongoDB database:
1. In Clerk Dashboard, navigate to **Configure > Webhooks**.
2. Click **Add Endpoint**.
3. Set the Endpoint URL:
   - *Production:* `https://<your-production-domain>/api/webhooks/clerk`
   - *Local Development:* Use a local tunneling proxy (e.g. `ngrok http 3000`) such as `https://<subdomain>.ngrok-free.app/api/webhooks/clerk`.
4. Subscribe to the following standard lifecycle events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Click **Create Endpoint**.
6. Under **Signing Secret**, reveal and copy the secret (`whsec_...`).

#### Step 5: Update Environment Configuration
Create or update `.env.local` in the project root directory. **Never commit this file to version control.**

```bash
# ==============================================================================
# CLERK AUTHENTICATION (AUTHENTIC CREDENTIALS)
# ==============================================================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_<your-actual-publishable-key>
CLERK_SECRET_KEY=sk_test_<your-actual-secret-key>
CLERK_WEBHOOK_SECRET=whsec_<your-actual-webhook-signing-secret>

# Route Mappings
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/shared/profile
```

#### Step 6: Verify Resolution
Run the following verification probe in terminal:
```powershell
# Probe the live endpoint (substitute with your real publishable key)
curl -i https://<your-real-clerk-frontend-api>/v1/client
```
The response should return HTTP 200 OK with a valid JSON payload instead of `host_invalid`.
Then start the local development server:
```powershell
npm run dev
```
Navigate to `http://localhost:3000/sign-in` and confirm that the Clerk authentication card renders without modal configuration errors.

---

## 3. Remediation Procedure: BUG-005 (Transitive Build Tooling Dependencies)

### 3.1 Risk Context
`npm audit` identified 13 non-critical transitive vulnerabilities in dev toolchain packages (`postcss` via Next.js and `deepmerge` via shadcn CLI). These packages are isolated to compile-time asset generation and do not process client requests.

### 3.2 Action Plan
1. **Do not run `npm audit fix --force`**: This can introduce breaking API mismatches in Next.js 15 or Tailwind CSS.
2. During the next planned infrastructure sprint:
   ```powershell
   npm audit fix
   ```
   Inspect `git diff package-lock.json` to verify that only patch/minor versions were bumped without breaking framework peer dependencies.
3. Verify all quality gates continue to pass:
   ```powershell
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

---

## 4. Production Deployment Hardening Checklist

Prior to promoting Axis LinkUp to staging or production environments, verify the following security controls:

### 4.1 Secrets & Configuration Management
- [ ] Ensure `.env.local`, `.env`, and all credentials files are strictly excluded via `.gitignore`.
- [ ] Inject production credentials through encrypted CI/CD secrets (e.g. GitHub Actions Secrets, Vercel Environment Variables, AWS Secrets Manager).
- [ ] Generate a production-grade super admin initial password for `scripts/create-super-admin.ts` using a cryptographically secure generator (min 16 characters).

### 4.2 Database Security (MongoDB Atlas)
- [ ] Configure IP Access List in MongoDB Atlas to allow only the dedicated production server IPs or Vercel secure egress IPs (never use `0.0.0.0/0` in production).
- [ ] Enforce TLS 1.3 encryption on connection strings (`ssl=true`).
- [ ] Create a dedicated database user with least-privilege `readWrite` access restricted solely to the `axis_linkup` database.

### 4.3 Network & Transport Hardening
- [ ] Force HTTPS with HTTP Strict Transport Security (HSTS) headers enabled (`max-age=31536000; includeSubDomains; preload`).
- [ ] Ensure reverse proxies (Cloudflare, AWS CloudFront, or Vercel Edge) pass `x-forwarded-for` and `x-forwarded-proto` accurately to prevent infinite redirect loops.
- [ ] Verify that `X-Powered-By` header suppression remains active in Next.js configuration.

### 4.4 Monitoring & Incident Response
- [ ] Connect the application structured logger (`src/lib/utils/logger.ts`) to a centralized log aggregator (e.g. Datadog, Axiom, AWS CloudWatch).
- [ ] Configure alert triggers for sudden spikes in `401 Unauthorized` or `403 Forbidden` responses.
- [ ] Document emergency operational runbook for executing global session invalidation (`SessionService.revokeAllUserSessions()`) in the event of compromised credentials.

