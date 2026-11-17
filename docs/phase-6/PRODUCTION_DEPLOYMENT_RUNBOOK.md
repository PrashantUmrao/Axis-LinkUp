# Axis LinkUp — Production Deployment Runbook (Axis Colleges IT)

**Target Platform:** Vercel (`bom1` — Mumbai) + MongoDB Atlas (`ap-south-1` — Mumbai)  
**Target Domain:** `https://linkup.axiscolleges.in` (or institutional custom domain)  
**Pre-Flight Command:** `npm run verify:prod -- --strict`

---

## Stage 1 — MongoDB Atlas (`ap-south-1` Mumbai)

1. **Cluster Provisioning:**
   - Provision a dedicated production cluster in **AWS Mumbai (`ap-south-1`)** to match Vercel's `bom1` region for sub-20ms database round-trips.
   - Enable automated daily continuous/snapshot backups with Point-in-Time Recovery (PITR).
2. **Least-Privilege Database User:**
   - Create a dedicated application user (e.g., `axis_linkup_prod_app`) scoped strictly to `readWrite` on the `axis_linkup` database only (never grant Atlas Admin / cluster-wide root credentials to the runtime app).
   - Generate a 32+ character high-entropy password and URL-encode special characters in `MONGODB_URI`.
3. **Network Access & TLS:**
   - Enforce TLS 1.2+ (`mongodb+srv://...&retryWrites=true&w=majority`).
   - Restrict IP Access List to Vercel static egress IPs (if Vercel Secure Compute is enabled) or required production ingress ranges.
4. **Index & TTL Verification:**
   - Verify Mongoose indexes after initial boot, specifically:
     - `notifications`: TTL index `{ expiresAt: 1 }` (`expireAfterSeconds: 0`) for automatic 90-day retention, plus `{ userId: 1, isArchived: 1, isRead: 1, createdAt: -1 }`.
     - `notificationpreferences`: unique `{ userId: 1 }`.
     - `auditlogs`: append-only chain ordering indexes.
     - `emergencyacknowledgments`: unique compound `{ alertId: 1, userId: 1 }` for idempotent receipts.
     - `passportshares`: unique `{ shareToken: 1 }` and `{ studentId: 1 }`.

---

## Stage 2 — Clerk Production Instance & IAM Cutover

1. **Switch to Live Production Keys:**
   - In Clerk Dashboard, promote the application to **Production** and bind the institutional domain.
   - Replace `pk_test_...` and `sk_test_...` with Live Production keys (`pk_live_...` and `sk_live_...`).
2. **Enforce Closed Institutional Sign-Up:**
   - In Clerk Dashboard → **User & Authentication → Restrictions**, disable public self-registration so only IT-provisioned accounts can access Axis LinkUp (reinforcing the application-level `/sign-up` → `/sign-in` middleware redirect).
3. **Rotate Initial System Administrator Password Immediately:**
   - Sign in as the seeded root `super_admin` (`sys_admin`) account and immediately rotate its password and enable MFA/2FA in Clerk before onboarding institutional staff or students.
   - Confirm the root Super Admin account is recorded in MongoDB with `role: "super_admin"` and `status: "active"`.
4. **Configure Svix User Synchronization Webhook:**
   - Endpoint URL: `https://<production-domain>/api/webhooks/clerk`
   - Subscribed Events: `user.created`, `user.updated`, `user.deleted`
   - Copy the generated signing secret (`whsec_...`) into `CLERK_WEBHOOK_SECRET`.

---

## Stage 3 — Ably, Cloudinary & Resend Provisioning

1. **Ably Realtime:**
   - Create a dedicated Production Ably App and generate a server-only API key (`ABLY_API_KEY`).
   - Never expose `ABLY_API_KEY` to client-side environment variables (`NEXT_PUBLIC_*`). Clients exclusively receive short-lived, per-channel capability tokens minted by `GET /api/v1/chat/token`.
2. **Cloudinary Signed Uploads:**
   - Provision a dedicated Production Cloudinary cloud and configure `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
   - Confirm signed upload preset enforcement (max 25 MB per file, strict MIME allowlist for PDFs, images, and Office documents across Assignments, Service Requests, Grievances, and Skill Passport proofs).
3. **Resend Transactional Email:**
   - Verify DNS records (SPF, DKIM, DMARC) for `axiscolleges.in` in Resend.
   - Set `RESEND_API_KEY` (production send-only key) and `EMAIL_FROM_ADDRESS="Axis LinkUp <notifications@axiscolleges.in>"`.

---

## Stage 4 — Vercel Production Deployment & Post-Deploy Smoke Test

1. **Project Import & Region Binding:**
   - Import the GitHub repository into Vercel. `vercel.json` automatically configures `"framework": "nextjs"`, `"regions": ["bom1"]`, and `maxDuration: 30` for `/api/**/*.ts`.
2. **Environment Variables:**
   - Add all variables listed in `.env.example` under Vercel **Settings → Environment Variables** (`Production` scope).
   - Confirm `NEXT_PUBLIC_APP_URL` is set to the exact HTTPS institutional origin (no trailing slash, never `localhost`).
   - Run pre-flight validation locally against exported staging/prod shells via `npm run verify:prod -- --strict` (confirm exit code `0`).
3. **Deploy & Execute Post-Deploy Smoke Tests:**
   ```bash
   # 1. Master readiness probe must return HTTP 200 with "status": "ok" and zero leaked secrets
   curl -sS https://<production-domain>/api/health

   # 2. Database connectivity probe must return HTTP 200
   curl -sS https://<production-domain>/api/health/db

   # 3. Verify all 6 enterprise HTTP security headers are present
   curl -I -sS https://<production-domain>/ | grep -iE "x-content-type-options|x-frame-options|referrer-policy|permissions-policy|strict-transport-security|x-dns-prefetch-control"

   # 4. Confirm development-only /ui-preview returns HTTP 404 in production
   curl -o /dev/null -s -w "%{http_code}\n" https://<production-domain>/ui-preview
   # Expected: 404

   # 5. Confirm closed public registration redirects /sign-up to /sign-in (HTTP 307/308)
   curl -I -sS https://<production-domain>/sign-up | grep -iE "^HTTP/|location:"
   ```
4. **Functional Verification Walkthrough:**
   - Authenticate as a `super_admin` → inspect `/super-admin/audit` and click **Verify Hash Chain** (must report intact).
   - Confirm Topbar Notification Bell loads `/api/v1/notifications/unread-summary` and `/shared/notifications` displays Preferences with **Emergency Alerts — Always On** locked.

---

## Stage 5 — Rollback & Incident Response Playbook

### Fast Production Rollback (Vercel)
1. Open Vercel Dashboard → **Deployments**.
2. Locate the last known-good production deployment and select **⋯ → Instant Rollback** (completes in <15 seconds with zero rebuild delay).
3. Re-run `curl -sS https://<production-domain>/api/health` to confirm `"status": "ok"`.

### Campus Safety & Security Incident Verification
1. **Campus Emergency Broadcasts:** If an operational incident requires immediate campus notification, a `super_admin` navigates to `/super-admin/emergency`, enters the directive + `CONFIRM EMERGENCY`, and monitors real-time acknowledgment coverage. Upon resolution, click **Stand Down / Deactivate** with official all-clear notes.
2. **Audit Chain Forensics:** After any security event or emergency stand-down, open `/super-admin/audit`, run **Verify Integrity** (`GET /api/v1/audit/verify`), and export the signed compliance report (`GET /api/v1/audit/export?format=json` or `csv`) for institutional records.
