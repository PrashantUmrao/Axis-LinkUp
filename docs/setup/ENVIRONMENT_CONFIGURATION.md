# Axis LinkUp — Environment Configuration & Secrets Management Architecture

> **Document ID:** DOC-SETUP-007  
> **Status:** Approved Baseline (Phase 2, Part 2.7)  
> **Institution:** Axis Institute of Technology & Management  
> **Framework:** Next.js 15+ App Router • Zod Runtime Validation  
> **Configuration Module:** `src/config/env.ts`  
> **Last Updated:** November 2026  

---

## 1. Environment Loading & Phased File Strategy

Axis LinkUp adheres strictly to the official Next.js environment variable hierarchy to guarantee predictable configuration across development, automated testing, staging previews, and production hosting:

```mermaid
graph TD
    SystemEnv["Host Environment Variables (Vercel / Cloud Dashboard)"]
    LocalFile[".env.local (Developer Machine - Untracked)"]
    EnvFile[".env (Global Defaults - Untracked)"]
    ExampleFile[".env.example (Public Blueprint - Version Controlled)"]

    SystemEnv -->|Overrides All| NextRuntime["Next.js Runtime Environment"]
    LocalFile -->|Overrides .env| NextRuntime
    EnvFile -->|Base Defaults| NextRuntime
    ExampleFile -.->|Developer Clones to| LocalFile
```

### Loading Hierarchy (Highest Priority to Lowest):
1. **System Environment Variables:** Set directly in Vercel or deployment containers.
2. **`.env.local`:** Machine-specific local developer secrets (strictly excluded by Git).
3. **`.env.development` / `.env.production`:** Environment-scoped non-secret defaults.
4. **`.env`:** Universal base environment file (excluded by Git).

---

## 2. Multi-Tier Environment Separation

| Deployment Tier | File / Storage Location | Purpose & Restrictions |
| :--- | :--- | :--- |
| **Local Development** | `.env.local` / `.env` | Local development with sandbox Atlas credentials. Never committed to version control. |
| **Automated Testing (CI)** | GitHub Actions Secrets / `.env.test` | Ephemeral test databases for Vitest and Playwright test runners. |
| **Staging / Preview** | Vercel Environment Variables (Preview) | Isolated staging database with sample institutional data for QA review. |
| **Production** | Vercel Environment Variables (Production) | Dedicated, replica-set MongoDB Atlas M10+ in AWS Mumbai (`ap-south-1`). Live Clerk, Ably, Cloudinary keys. |

---

## 3. Master Environment Variable Inventory

Every environment variable in Axis LinkUp is categorized by domain, visibility, and integration status:

| Variable Name | Classification | Domain | Status | Required Scope | Source / Generation |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `NODE_ENV` | Server-Only | Runtime | **Active** | All | Node.js runtime (`development` / `production` / `test`). |
| `NEXT_PUBLIC_APP_URL` | Client-Exposed | Runtime | **Active** | All | Local `http://localhost:3000` / Prod `https://linkup.axiscolleges.in`. |
| `NEXT_PUBLIC_APP_NAME`| Client-Exposed | Runtime | **Active** | All | Institutional application title (`Axis LinkUp`). |
| `MONGODB_URI` | Server-Only | Database | **Active** | All | MongoDB Atlas connection string (AWS Mumbai `ap-south-1`). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client-Exposed | Auth | Deferred | Auth Phase | Clerk Dashboard > API Keys > Publishable Key (`pk_test_...`). |
| `CLERK_SECRET_KEY` | Server-Only | Auth | Deferred | Auth Phase | Clerk Dashboard > API Keys > Secret Key (`sk_test_...`). |
| `CLERK_WEBHOOK_SECRET` | Server-Only | Auth | Deferred | Auth Phase | Clerk Dashboard > Webhooks > Endpoint Signing Secret (`whsec_...`). |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Client-Exposed | Auth | Deferred | Auth Phase | Route path (`/sign-in`). |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Client-Exposed | Auth | Deferred | Auth Phase | Route path (`/sign-up`). |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Client-Exposed | Storage | Deferred | Storage Phase| Cloudinary Management Console (`axis-linkup-media`). |
| `CLOUDINARY_API_KEY` | Server-Only | Storage | Deferred | Storage Phase| Cloudinary Dashboard API Key. |
| `CLOUDINARY_API_SECRET` | Server-Only | Storage | Deferred | Storage Phase| Cloudinary API Secret (used for signing upload presets). |
| `ABLY_API_KEY` | Server-Only | Real-Time | Deferred | Real-Time Phase| Ably Dashboard > API Keys (token minting & REST publishing). |
| `RESEND_API_KEY` | Server-Only | Email | Deferred | Email Phase | Resend Console API Key (`re_...`). |
| `EMAIL_FROM_ADDRESS` | Server-Only | Email | Deferred | Email Phase | Institutional verified sender (`notifications@axiscolleges.in`). |

---

## 4. Centralized Validation Module (`src/config/env.ts`)

To eliminate fragile, scattered `process.env` lookups throughout the codebase, all configuration is parsed and validated through a single module:

- **Fail-Fast Validation:** Validates required variables on boot using **Zod**. If an active required secret (such as `MONGODB_URI`) is missing or malformed, the server raises an explicit configuration error.
- **Client vs. Server Isolation:**
  - `clientEnv`: Contains only `NEXT_PUBLIC_*` variables, bundled safely into browser JavaScript.
  - `serverEnv`: Wrapped in a JavaScript `Proxy` that physically throws a runtime security exception if accessed from a browser context (`typeof window !== 'undefined'`).
  - `env`: Unified server-side export for Server Components, Server Actions, and Route Handlers.

---

## 5. Security & Access Rules

1. **Strict Prohibition of Secrets in Client:** Server-only secrets (`MONGODB_URI`, `CLERK_SECRET_KEY`, `CLOUDINARY_API_SECRET`) must **never** be prefixed with `NEXT_PUBLIC_`.
2. **Zero Logging of Secrets:** Loggers and error-handling utilities must never serialize connection strings, authorization tokens, or passwords.
3. **No Hardcoded Fallbacks for Secrets:** Never fall back to a hardcoded connection string or default secret password in source code.
4. **Git Ignore Integrity:** `.gitignore` must strictly exclude all private environment files (`.env`, `.env.*`) while whitelisting the public template (`!.env.example`).
5. **Credential Rotation Protocol:** If a secret is accidentally committed to Git, immediately revoke and rotate it in the respective cloud console. Deleting the file locally does not erase repository history.

---

## 6. Developer Configuration Walkthrough

### How to Configure Your Local Workstation:
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` in your editor and enter your private MongoDB Atlas connection string:
   ```env
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://axis_linkup_app:YOUR_REAL_PASSWORD@axis-linkup-cluster.xxxxx.mongodb.net/axis_linkup?retryWrites=true&w=majority
   ```
3. Restart your development server:
   ```bash
   npm run dev
   ```

### How to Configure Production on Vercel:
1. Navigate to your project on the [Vercel Dashboard](https://vercel.com).
2. Go to **Settings** > **Environment Variables**.
3. Add `MONGODB_URI` with the production replica set connection string.
4. Set the environment scope to **Production** and **Preview**.

---

## 7. Verification Results

All static checks and runtime verification routines passed:

| Verification Check | Target | Result | Output Notes |
| :--- | :--- | :---: | :--- |
| **Strict Type Checking** | `src/config/env.ts` | **PASS** | 0 errors. Strict Zod typing inferred cleanly. |
| **ESLint Analysis** | `npm run lint` | **PASS** | 0 warnings, 0 errors. |
| **Prettier Formatting** | `npm run format:check` | **PASS** | Configuration and docs adhere to Prettier standards. |
| **Production Build** | `npm run build` | **PASS** | Dynamic routes and environment parsing compiled in 4.7s. |
| **Database Connectivity** | `GET /api/health/db` | **200 OK** | Live connection to MongoDB Atlas verified (`database: connected`). |

