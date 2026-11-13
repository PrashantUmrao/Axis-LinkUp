# Environment Variables & Configuration Specification

> **Document ID:** DOC-TECH-005  
> **Status:** Finalized Specification (Phase 1, Part 1.3)  
> **Institution:** Axis Institute of Technology & Management  
> **Target Environments:** Local Development, Staging / Preview, Production  
> **Last Updated:** November 2026  

---

## 1. Security Guidelines & Classification

Environment variables are partitioned into two strict security tiers:

1. **Public Client Variables (`NEXT_PUBLIC_*`):** Embedded into the browser JavaScript bundle during build time. They contain public API keys, endpoint URLs, and public identifiers. They must **never** contain passwords, database URIs, or signing secrets.
2. **Server-Only Secrets (Unprefixed):** Accessible exclusively within the Node.js serverless execution context on Vercel. Completely invisible to browser clients.

> [!CAUTION]
> Under no circumstances may `.env`, `.env.local`, or any file containing live credentials be committed to the Git repository. The `.gitignore` file must explicitly exclude all `.env*` files except `.env.example`.

---

## 2. Complete Environment Variables Manifest

### 2.1 Public Client-Side Variables (`NEXT_PUBLIC_*`)

| Variable Name | Description | Environment Scope | Example / Default Value | Required in MVP? |
| :--- | :--- | :--- | :--- | :---: |
| `NEXT_PUBLIC_APP_URL` | Canonical public URL of the application. | All | `http://localhost:3000` (Dev) / `https://linkup.axiscolleges.in` (Prod) | **Yes** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public key used by Clerk React components for client-side authentication. | All | `pk_test_...` (Dev) / `pk_live_...` (Prod) | **Yes** |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Route for the customized Clerk sign-in view. | All | `/sign-in` | **Yes** |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Route for user onboarding / invitation acceptance. | All | `/sign-up` | **Yes** |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Fallback redirect route immediately after login. | All | `/` (Handled by role middleware) | **Yes** |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Fallback redirect route immediately after onboarding. | All | `/` | **Yes** |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public Cloudinary cloud name for direct asset upload targets. | All | `axis-linkup-media` | **Yes** |
| `NEXT_PUBLIC_ABLY_CLIENT_KEY` | Optional public identifier for Ably client connection telemetry. | All | `client-telemetry-id` | Optional |
| `NEXT_PUBLIC_FCM_VAPID_KEY` | Public VAPID key for Web Push service worker subscription. | Staging / Prod | `BEl6...` | No (Phase 2) |

---

### 2.2 Server-Only Sensitive Secrets

| Variable Name | Description | Environment Scope | Example / Format | Required in MVP? |
| :--- | :--- | :--- | :--- | :---: |
| `NODE_ENV` | Application execution environment flag. | All | `development` / `production` / `test` | **Yes** |
| `MONGODB_URI` | Full connection string to MongoDB Atlas replica set with credentials and database name. | All | `mongodb+srv://user:pass@cluster.mongodb.net/axis_linkup?retryWrites=true&w=majority` | **Yes** |
| `CLERK_SECRET_KEY` | Master server secret key used to mutate user roles in `publicMetadata` and provision users. | All | `sk_test_...` (Dev) / `sk_live_...` (Prod) | **Yes** |
| `CLERK_WEBHOOK_SECRET` | Cryptographic secret provided by Clerk to verify Svix signatures on incoming webhooks. | All | `whsec_...` | **Yes** |
| `ABLY_API_KEY` | Master Ably API key used for generating client token requests and REST publishing. | All | `AppId.KeyId:Secret` | **Yes** |
| `CLOUDINARY_API_KEY` | Cloudinary backend API key. | All | `123456789012345` | **Yes** |
| `CLOUDINARY_API_SECRET` | Master secret key used to sign client upload presets and generate private URLs. | All | `aBcDeF...` | **Yes** |
| `RESEND_API_KEY` | API secret key used to dispatch transactional emails via the Resend API. | All | `re_123456789...` | **Yes** |
| `EMAIL_FROM_ADDRESS` | Verified sending address for transactional emails. | All | `Axis LinkUp <notifications@axiscolleges.in>` | **Yes** |
| `FIREBASE_PROJECT_ID` | Firebase project identifier for background push alerts. | Staging / Prod | `axis-linkup-fcm` | No (Phase 2) |
| `FIREBASE_CLIENT_EMAIL` | Service account email for Firebase Admin SDK. | Staging / Prod | `firebase-adminsdk@...iam.gserviceaccount.com` | No (Phase 2) |
| `FIREBASE_PRIVATE_KEY` | Private key for Firebase Admin SDK authentication. | Staging / Prod | `-----BEGIN PRIVATE KEY-----\n...` | No (Phase 2) |
| `UPSTASH_REDIS_REST_URL` | Redis URL for future asynchronous worker queues (BullMQ). | Staging / Prod | `https://...upstash.io` | No (Phase 3) |
| `UPSTASH_REDIS_REST_TOKEN`| Redis REST token for queue operations. | Staging / Prod | `AX...` | No (Phase 3) |

---

## 3. Environment Manifest Template (`.env.example`)

Developers and DevOps engineers must initialize their local environment using this template:

```env
# ==============================================================================
# Axis LinkUp — Local Environment Configuration Template (.env.example)
# Copy this file to .env.local and populate the secrets.
# DO NOT COMMIT THE COMPLETED FILE TO GIT.
# ==============================================================================

# Application Environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Primary Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/axis_linkup_dev?retryWrites=true&w=majority

# Authentication & Identity (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Real-Time Messaging & Broadcast (Ably)
ABLY_API_KEY=your_ably_app_id.key_id:secret_key

# Media & File Storage (Cloudinary)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Transactional Email (Resend)
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM_ADDRESS=Axis LinkUp <onboarding@resend.dev>

# Optional / Phase 2 Push Alerts (FCM)
# NEXT_PUBLIC_FCM_VAPID_KEY=
# FIREBASE_PROJECT_ID=
# FIREBASE_CLIENT_EMAIL=
# FIREBASE_PRIVATE_KEY=
```

---

## 4. Secret Rotation & Management Procedures

1. **Rotation Frequency:** Production API secrets (Clerk, Ably, Cloudinary, Resend) must be rotated semi-annually or immediately upon suspicion of credential leakage.
2. **Zero-Downtime Secret Rotation Workflow:**
   - **Step 1:** Generate a secondary API key in the provider dashboard (Ably and Clerk support active dual-key transitions).
   - **Step 2:** Update the environment variable in the Vercel Project Settings for Production.
   - **Step 3:** Trigger an atomic redeployment of the application on Vercel.
   - **Step 4:** Verify that new invocations authenticate successfully with the secondary key.
   - **Step 5:** Revoke the primary key in the provider dashboard.
3. **Emergency Secret Revocation:** If a key is accidentally committed or compromised, the IT Lead must immediately revoke the key in the external provider console, invalidating all unauthorized access in real time.

