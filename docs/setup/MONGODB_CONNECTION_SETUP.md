# Axis LinkUp — MongoDB Atlas & Mongoose Connection Setup Guide

> **Document ID:** DOC-SETUP-006  
> **Status:** Implementation Baseline (Phase 2, Part 2.6)  
> **Institution:** Axis Institute of Technology & Management  
> **Database Engine:** MongoDB Atlas (v7.0+ Replica Set in AWS Mumbai `ap-south-1`)  
> **ODM:** Mongoose 9+  
> **Health Check Route:** `GET /api/health/db`  
> **Last Updated:** November 2026  

---

## 1. Overview & Architectural Context

Axis LinkUp uses **MongoDB Atlas** as its primary document persistence layer, accessed through **Mongoose** via a singleton cached connection pool in `src/lib/db/mongodb.ts`. 

In serverless execution environments (e.g., Next.js App Router on Vercel) and during local hot-module reloading (HMR), instantiating a new database connection per incoming request quickly exhausts database connection limits. The implementation caches the active connection promise globally, guaranteeing connection reuse, clean error handling, and zero credential leakage.

---

## 2. Step-by-Step MongoDB Atlas Setup (Manual Guide)

Follow these manual steps to provision your dedicated collegiate cluster:

### Step 1: Access MongoDB Atlas
Navigate to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign in or create an account.

### Step 2: Create a Project
1. Open the project switcher in the top navigation.
2. Click **New Project**.
3. Name the project: `Axis LinkUp`.
4. Add any team members or administrators and click **Create Project**.

### Step 3: Deploy a Database Cluster
1. Click **Create** or **Build a Database**.
2. Select **M0 Free** (for local development/evaluation) or **M10+ Dedicated** (for production staging).
3. **Cloud Provider & Region:** Select **AWS** and **Mumbai (`ap-south-1`)** (Mandatory for Indian Digital Personal Data Protection Act compliance).
4. Set the cluster name: `axis-linkup-cluster`.
5. Click **Create Deployment**.

### Step 4: Configure Database User Authentication
1. Navigate to **Security** > **Database Access** in the left sidebar.
2. Click **Add New Database User**.
3. Authentication Method: **Password**.
4. Username: `axis_linkup_app`.
5. Password: Generate a secure 32+ character password and copy it securely (do not paste it in public forums).
6. Database User Privileges: Select **Read and write to any database** (or restrict permissions strictly to `axis_linkup`).
7. Click **Add User**.

### Step 5: Configure Network Access (IP Whitelist)
1. Navigate to **Security** > **Network Access** in the left sidebar.
2. Click **Add IP Address**.
3. Click **Add Current IP Address** to whitelist your development workstation.
4. Add an entry description (e.g., `Dev Workstation - Office`).
5. *Security Rule:* **Do not use `0.0.0.0/0` (Allow access from anywhere) for development environments**, as this exposes your cluster to brute-force credential stuffing.
6. Click **Confirm** and wait 1–2 minutes for the network rule to become active.

### Step 6: Obtain the Connection String
1. Navigate to **Deployment** > **Database**.
2. Click **Connect** next to `axis-linkup-cluster`.
3. Choose **Drivers** under "Connect to your application".
4. Select Driver: **Node.js**, Version: **5.5 or later**.
5. Copy the connection string format:
   ```text
   mongodb+srv://<db_username>:<db_password>@axis-linkup-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=axis-linkup-cluster
   ```

### Step 7: Format Your Connection String
1. Replace `<db_username>` with `axis_linkup_app`.
2. Replace `<db_password>` with your database user password (URL-encode special characters if necessary).
3. Append the database name `axis_linkup` directly after the host domain slash `/`:
   ```text
   mongodb+srv://axis_linkup_app:<db_password>@axis-linkup-cluster.xxxxx.mongodb.net/axis_linkup?retryWrites=true&w=majority
   ```

---

## 3. Local Environment Configuration

> [!CAUTION]
> Never place your real database URI or password inside source code, and never commit `.env.local` to Git.

1. Verify `.env.example` contains the template:
   ```env
   NODE_ENV=development
   MONGODB_URI=
   ```
2. Create or open `.env.local` in the project root:
   ```env
   NODE_ENV=development
   MONGODB_URI=mongodb+srv://axis_linkup_app:YOUR_ACTUAL_PASSWORD@axis-linkup-cluster.xxxxx.mongodb.net/axis_linkup?retryWrites=true&w=majority
   ```
3. Verify `.gitignore` contains:
   ```gitignore
   .env
   .env.*
   !.env.example
   ```

---

## 4. Connection Utility Architecture

The singleton connection utility is implemented in `src/lib/db/mongodb.ts`:

- **Global Promise Caching:** Uses `global.mongooseCache` to cache the resolved connection and promise across Next.js App Router hot reloads.
- **Fail-Safe URI Validation:** Validates that `MONGODB_URI` starts with `mongodb://` or `mongodb+srv://`.
- **Credential Protection:** Error catch blocks sanitize error output, preventing database credentials or cluster connection strings from appearing in server logs or client errors.
- **Connection Pooling:** Sets `maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`, and `socketTimeoutMS: 45000`.

---

## 5. Health Check Endpoint

A dedicated diagnostic route is available at `src/app/api/health/db/route.ts`:
- **Method:** `GET`
- **Route:** `/api/health/db`
- **Successful Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Database connected successfully",
    "database": "connected"
  }
  ```
- **Failure Response (`503 Service Unavailable`):**
  ```json
  {
    "success": false,
    "message": "Database connection unavailable",
    "database": "disconnected"
  }
  ```

---

## 6. Verification & Troubleshooting

### Verification Procedure:
1. Ensure `.env.local` is populated with a valid Atlas connection string.
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000/api/health/db` in your browser or curl:
   ```bash
   curl http://localhost:3000/api/health/db
   ```

### Troubleshooting Common Errors:
- **`MongooseServerSelectionError: connect ECONNREFUSED` / IP Not Whitelisted:**
  - Cause: Your local IP address has changed or is not present in Atlas Network Access.
  - Fix: Open Atlas > Network Access > Click "Add Current IP Address".
- **`MongoServerError: bad auth : Authentication failed`:**
  - Cause: Incorrect username or password. If your password contains special characters (e.g., `@`, `:`, `/`), ensure they are URL-encoded.
- **`Database configuration error: MONGODB_URI is not defined`:**
  - Cause: `.env.local` is missing or the server was not restarted after updating environment variables.

