# AXIS LINKUP — MANUAL CONFIGURATION CHECKLIST
**External Cloud Dashboard Settings, API Provisioning & Infrastructure Prerequisites**  
*Document Version:* 1.0.0  
*Phase:* Phase 5.1 (Backend Readiness & Architecture Audit)  
*Date:* November 14, 2026  
*Status:* PENDING USER ACTION (DOCUMENTED)  

---

## 1. Overview

While Antigravity can design, generate, test, and maintain all application source code, database models, and API route handlers within the repository, **external cloud dashboard settings and secret generation require manual user action**.

This document outlines the exact external configuration steps required across **Clerk**, **MongoDB Atlas**, **Cloudinary**, **Ably**, and **Resend**.

---

## 2. Master External Configuration Register

| Provider | Service / Purpose | Phase Dependency | Action Required by User | Status |
| :--- | :--- | :---: | :--- | :---: |
| **Clerk** | Username Login Support | **Phase 5.2** | Enable "Username" in User & Authentication settings | ⚠️ Pending |
| **Clerk** | Backend API Secret Key | **Phase 5.2** | Copy `CLERK_SECRET_KEY` into `.env.local` | ⚠️ Pending |
| **Clerk** | Webhook Synchronization | **Phase 5.2** | Register `/api/webhooks/clerk` and copy `CLERK_WEBHOOK_SECRET` | ⚠️ Pending |
| **MongoDB Atlas** | IP Access Whitelist | **Immediate** | Maintain developer IP (`152.59.186.38/32`) in Network Access | ✅ Active |
| **Cloudinary** | Coursework & Attachments | **Phase 5.6** | Create cloud account; copy Cloud Name, API Key, API Secret | ⏳ Deferred |
| **Ably Realtime** | WebSocket Push Gateway | **Phase 5.5** | Obtain Ably API Key for instant messaging & presence | ⏳ Deferred |
| **Resend** | Institutional Broadcasts | **Phase 5.7** | Verify `@axiscolleges.in` domain and obtain API Key | ⏳ Deferred |

---

## 3. Step-by-Step Instructions for the User

### Step 1: Clerk Authentication Configuration (Required for Phase 5.2)

1. Open the [Clerk Dashboard](https://dashboard.clerk.com).
2. Select your **Axis LinkUp** application.
3. **Enable Username Identification:**
   - Navigate to **Configure** > **User & Authentication** > **Email, Phone, Username**.
   - Under **Username**, toggle the switch to **Required** or **Optional** (so users can sign in using either their institutional email or their assigned username).
4. **Retrieve Server Secret Key:**
   - Navigate to **Configure** > **Developers** > **API Keys**.
   - Under **Secret keys**, reveal and copy your secret key (`sk_test_...` for development).
   - Paste it into `.env.local`:
     ```env
     CLERK_SECRET_KEY=sk_test_...
     ```
5. **Configure Webhook Endpoint (For Live User Synchronization):**
   - Navigate to **Configure** > **Developers** > **Webhooks**.
   - Click **Add Endpoint**.
   - Enter your public development tunnel URL (e.g., via ngrok/localtunnel) or production URL:
     ```text
     https://<your-domain>/api/webhooks/clerk
     ```
   - Under **Subscribe to events**, select:
     - `user.created`
     - `user.updated`
     - `user.deleted`
   - Click **Create**.
   - Under **Signing Secret**, reveal and copy the secret (`whsec_...`).
   - Paste it into `.env.local`:
     ```env
     CLERK_WEBHOOK_SECRET=whsec_...
     ```

---

### Step 2: MongoDB Atlas Maintenance (Active)

1. Open the [MongoDB Atlas Console](https://cloud.mongodb.com).
2. Navigate to **Security** > **Network Access**.
3. Ensure your current public IP address is active:
   - Current Developer IP: **`152.59.186.38/32`**.
   - *(Optional for development mobility)*: Add `0.0.0.0/0` (Allow access from anywhere) if your ISP rotates dynamic IP addresses frequently.

---

### Step 3: Cloudinary Media Storage (Deferred to Phase 5.6)

1. Open the [Cloudinary Console](https://cloudinary.com).
2. From the **Dashboard Summary**, copy:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
3. Add these credentials to `.env.local`:
   ```env
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=axis-linkup-media
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```

---

### Step 4: Ably Realtime WebSocket Gateway (Deferred to Phase 5.5)

1. Open the [Ably Dashboard](https://ably.com).
2. Create an app named **Axis LinkUp Realtime**.
3. Navigate to **API Keys** and copy the **Root Key**.
4. Add to `.env.local`:
   ```env
   ABLY_API_KEY=...
   ```

---

### Step 5: Resend Transactional Email (Deferred to Phase 5.7)

1. Open the [Resend Console](https://resend.com).
2. Navigate to **Domains** and add `axiscolleges.in` (configure DNS DKIM / SPF records).
3. Navigate to **API Keys** and create an API Key.
4. Add to `.env.local`:
   ```env
   RESEND_API_KEY=re_...
   EMAIL_FROM_ADDRESS="Axis LinkUp <notifications@axiscolleges.in>"
   ```

