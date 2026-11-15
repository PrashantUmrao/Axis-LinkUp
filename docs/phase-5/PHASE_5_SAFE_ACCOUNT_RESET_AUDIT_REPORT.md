# Axis LinkUp — Safe Faculty & Admin Account Reset: Audit & Dry-Run Report

**Date:** November 15, 2026  
**Status:** Clerk Cleanup Completed & Verified — Ready for Super Admin Bootstrap  
**Security Clearance:** Application Security Architect & Lead Backend Reviewer  

---

## 1. Executive Summary & Objective

The objective is to execute a **controlled, safe reset of all existing Faculty and Admin accounts** in Axis LinkUp and enable fresh provisioning of new accounts with official usernames, institutional emails (`@axiscolleges.in`), and secure credentials through the System Administrator workflow.

### EXECUTION STATUS:
- **Clerk IAM Deletions Completed:** The two orphan test identities (`hodaxis` and `ankitpatel`) have been permanently removed from Clerk IAM.
- **Student Account Preserved:** Exactly 1 identity remains in Clerk IAM (`theprashantumrao@gmail.com`, `user_3M3S2RxNg0f7ihtFDcmHbW9z93Q`), verified untouched.
- **MongoDB Atlas Accounts:** 0 Faculty/Admin accounts exist in MongoDB. 1 Student account exists.
- **Integrity Assertion:** 0 collections dropped, 0 indexes removed, 0 student records modified.

---

## 2. Phase 1 — Comprehensive Inventory Audit

Live scans were performed across both **MongoDB Atlas** and **Clerk IAM** using read-only inspection utilities.

### 2.1 MongoDB Atlas Collections Audit

| Collection | Total Records | Breakdown | Deletion Targets |
| :--- | :---: | :--- | :---: |
| `users` | 1 | **1 Student** (`theprashantumrao@gmail.com`) | **0** |
| `departments` | 0 | None present | 0 |
| `notices` | 0 | None present | 0 |
| `polls` | 0 | None present | 0 |
| `otps` | 0 | None present | 0 |
| `poll_votes` | 0 | None present | 0 |
| `notice_receipts` | 0 | None present | 0 |

### 2.2 Clerk IAM Identities Audit

A total of **3 identities** exist in Clerk IAM:

| # | Clerk User ID | Email | Username | Clerk Role Metadata | Status & Action |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | `user_3M3S2RxNg0f7ihtFDcmHbW9z93Q` | `theprashantumrao@gmail.com` | `prashantumrao` | `{ role: 'student', status: 'active' }` | **PROTECTED — Student (Do Not Touch)** |
| **2** | `user_3M8BQF1hrzxPyF0VPOIWk0HfgMT` | `2023bit026@axiscolleges.in` | `hodaxis` | `{}` | **TARGET FOR DELETION (Orphan Test Account)** |
| **3** | `user_3M8HlBCJrJsGkytHSfsaVaXiHwd` | `hey.prashantumrao@gmail.com` | `ankitpatel` | `{}` | **TARGET FOR DELETION (Orphan Test Account)** |

---

## 3. Phase 2 — Safety Invariants & Boundary Guarantees

1. **Student Account Protection:**
   - Identity `theprashantumrao@gmail.com` (`6af71a73cbadeef26a5b6582` / `user_3M3S2RxNg0f7ihtFDcmHbW9z93Q`) is hard-coded into safety guards in deletion scripts.
   - Any script execution that encounters a student account in the deletion candidate list will immediately throw a fatal exception and abort.
2. **Collection Preservation:**
   - No collections (`users`, `departments`, `notices`, `polls`, etc.) or database schemas will be dropped or reset.
   - MongoDB indexes, validators, and collection configurations remain intact.
3. **Historical Data Integrity:**
   - Zero notices or polls exist in the current database; future reset scripts maintain snapshots rather than cascade deletes.
4. **Administrative Continuity:**
   - A dedicated System Administrator bootstrap script (`scripts/create-super-admin.ts`) is prepared to establish the fresh, verified Super Admin before creating other accounts.

---

## 4. Phase 3 & 4 — Backup & Execution Utilities Prepared

The following operational tools have been implemented and type-checked:

1. **User Backup Utility:** [`scripts/backup-users.ts`](file:///c:/Users/prash/Desktop/Axis%20LinkUp/scripts/backup-users.ts)
   - Exports the full `users` collection to `backups/backup-users-<timestamp>.json`.
   - Performs an automated post-export verification check.
2. **Targeted Account Deletion Utility:** [`scripts/delete-faculty-admin-accounts.ts`](file:///c:/Users/prash/Desktop/Axis%20LinkUp/scripts/delete-faculty-admin-accounts.ts)
   - Requires explicit `--confirm-deletion` flag.
   - Strictly verifies that student accounts are not targeted.
   - Deletes target Clerk identities (`hodaxis` and `ankitpatel`).
   - Verifies post-deletion counts.
3. **Super Administrator Bootstrap Utility:** [`scripts/create-super-admin.ts`](file:///c:/Users/prash/Desktop/Axis%20LinkUp/scripts/create-super-admin.ts)
   - Provisions initial System Administrator with `@axiscolleges.in` domain verification.
   - Synchronizes both Clerk IAM and MongoDB Atlas.

---

## 5. Phase 5 — Dry-Run Target Summary

| Role Category | MongoDB Records to Delete | Clerk Identities to Delete | Impacted Shared Content |
| :--- | :---: | :---: | :---: |
| **Student Accounts** | **0** (1 Protected) | **0** (1 Protected) | None (Untouched) |
| **Faculty Accounts** | 0 | 0 | None |
| **HOD Accounts** | 0 | 1 (`user_3M8BQF1hrzxPyF0VPOIWk0HfgMT`) | None |
| **Director Accounts** | 0 | 0 | None |
| **System Admin Accounts** | 0 | 0 | None |
| **Unlinked Test Accounts** | 0 | 1 (`user_3M8HlBCJrJsGkytHSfsaVaXiHwd`) | None |
| **TOTALS** | **0 MongoDB Records** | **2 Clerk Identities** | **0 Shared Items** |

---

## 6. Phase 6 — New Account Creation Architecture (Post-Approval)

Once deletion approval is granted and executed:

```
[System Administrator Bootstrap] (scripts/create-super-admin.ts)
        │
        ▼
[Super Admin Signs In] (at /sign-in -> /super-admin/dashboard)
        │
        ├─► Provisions Executive Director (@axiscolleges.in)
        ├─► Provisions Heads of Department (HOD) (@axiscolleges.in)
        └─► Provisions Faculty Members (@axiscolleges.in)
                 │
                 ▼
      [Standard OTP Activation] (Users activate at /activate)
```

1. **Institutional Domain Enforcement:** All new administrative and faculty accounts must use `@axiscolleges.in`.
2. **Zero-Trust Activation:** Accounts are provisioned in `pending_activation` status. Secure 64-hex OTP tokens are dispatched for first-time activation at `/activate`.
3. **Role Routing:** Post-login role routing gates (`src/lib/auth/routing.ts` & `src/app/auth/verify-role/page.tsx`) ensure users land only in their authorized portal.

---

## 7. Network / Infrastructure Note

Please ensure your current public IP address (`103.95.81.168`) is whitelisted in your **MongoDB Atlas Network Access (IP Access List)** (or `0.0.0.0/0` allowed during development) so that the backup and bootstrap scripts can connect seamlessly.

