# Axis LinkUp — Role-Based Access Control (RBAC) Implementation Report

> **Document ID:** DOC-AUTH-012  
> **Status:** Implemented & Verified (Phase 3, Part 3.5)  
> **Institution:** Axis Institute of Technology & Management  
> **Architecture Baseline:** DOC-AUTH-005 (RBAC & Permission Matrix)  
> **Last Updated:** November 2026  

---

## 1. Executive Summary

Phase 3, Part 3.5 delivers the centralized **Role-Based Access Control (RBAC)** and **Attribute-Based Access Control (ABAC)** authorization engine for Axis LinkUp.

The authorization system operates under a strict **Deny-by-Default** security posture, completely separating authentication identity (who the user is) from authorization capability (what the user is permitted to do). All access control assertions occur server-side, preventing client-side spoofing, parameter tampering, and unauthorized role escalation.

### Core Guarantees:
1. **Zero Client Trust:** Client-supplied role claims, headers, query parameters, or local storage are completely ignored. Identity and roles are resolved exclusively on the server from verified session claims and MongoDB Atlas user documents.
2. **Deny-by-Default Matrix:** Every unmapped role-permission tuple evaluates to `DENY` (`ForbiddenError` HTTP 403).
3. **Defense-in-Depth Resource Scoping (ABAC):** High-value operations (`OWN` and `DEPT`) enforce resource ownership (e.g., matching caller ID with resource creator or course instructor) and departmental isolation before mutations execute.
4. **Account Lifecycle Assertion:** Suspended (`status: 'suspended'`), deactivated, or unverified accounts are immediately denied with appropriate operational errors.
5. **No Public Role Escalation:** Ordinary user profile endpoints strip role mutations; only Super Administrators can elevate user privileges.

---

## 2. RBAC & ABAC Architecture

```mermaid
flowchart TD
    Req["Incoming Request / Server Action"] --> AuthGate["requireAuth() (Server Session)"]
    
    AuthGate -->|No Session| Err401["HTTP 401 UnauthorizedError"]
    AuthGate -->|Account Suspended / Deactivated| Err403Status["HTTP 403 ForbiddenError (Account Hold)"]
    AuthGate -->|Active Session| PermCheck["hasPermission(role, permission, context)"]
    
    PermCheck -->|DENY| Err403["HTTP 403 ForbiddenError (Insufficient Permissions)"]
    PermCheck -->|ALLOW| ExecAction["Execute Business Logic / Domain Service"]
    PermCheck -->|OWN (ABAC)| OwnerCheck{"context.ownerId === caller.userId OR instructorIds?"}
    PermCheck -->|DEPT (ABAC)| DeptCheck{"context.deptId === caller.deptId OR super_admin?"}
    
    OwnerCheck -->|Match| ExecAction
    OwnerCheck -->|Mismatch| Err403
    
    DeptCheck -->|Match| ExecAction
    DeptCheck -->|Mismatch| Err403
```

---

## 3. Role & Permission Specifications

### 3.1 The Four Approved Institutional Roles

| Role | Hierarchy Level | Primary Operational Scope | Security Invariants |
| :--- | :---: | :--- | :--- |
| **`student`** | 1 (Base) | Enrolled department, batch, assigned courses, self-profile. | Cannot publish global notices; cannot access other students' private grades/submissions. |
| **`faculty`** | 2 | Assigned courses, sections, departmental notices, student evaluations. | Cannot alter global college settings; cannot modify administrative queues or audit logs. |
| **`admin`** | 3 | Departmental administrative queues, service tickets, facility bookings, notices. | Scoped to assigned operational queues (Registrar, Exam Cell); cannot alter system audit logs. |
| **`super_admin`**| 4 (Executive) | Global system configuration, user role management, emergency broadcasts, audit. | Master Emergency trigger; full oversight; cannot delete or tamper with audit records. |

### 3.2 Canonical Permission Scopes

- **`ALLOW`**: Unrestricted operation within persona scope.
- **`OWN`**: Operation permitted strictly if caller owns the resource (or is assigned instructor/mentor).
- **`DEPT`**: Operation permitted strictly within caller's assigned academic/administrative department.
- **`DENY`**: Operation prohibited unconditionally (`HTTP 403 Forbidden`).

---

## 4. Reusable Authorization Utilities & Source Map

```
src/lib/auth/
├── permissions.ts    # Canonical permissions, scopes, and master ROLE_PERMISSIONS_MATRIX
├── rbac.ts           # Pure evaluation engine: hasPermission, canAccessResource, assertPermission, assertRole
├── server.ts         # Server-side guards: requireAuth, requireRole, requirePermission, requireResourceOwnership
├── client.ts         # Bundle-safe client helpers: hasClientPermission, canViewNavItem, getAuthorizedNavRoutes
└── index.ts          # Unified barrel export
```

### 4.1 Usage in Server Actions & Route Handlers

```typescript
import { requireAuth, requirePermission, requireResourceOwnership, PERMISSIONS } from '@/lib/auth';

// Example 1: Requiring specific permission with ABAC ownership
export async function gradeAssignmentAction(input: GradeInput) {
  const session = await requireAuth();
  
  // Enforces role permissions and instructor assignment
  await requirePermission(PERMISSIONS.ASSIGNMENTS_CREATE_GRADE, {
    instructorIds: [session.userId],
    departmentId: session.departmentId,
  });

  // Delegate to domain service...
}

// Example 2: Requiring direct resource ownership
export async function updateSubmissionAction(submissionId: string, content: string) {
  const submission = await SubmissionRepository.findById(submissionId);
  if (!submission) throw new NotFoundError('Submission', submissionId);

  // Throws ForbiddenError if caller is not the submission creator
  await requireResourceOwnership(submission.studentId);

  // Update submission...
}
```

### 4.2 Usage in Client Components (UI Usability Only)

```tsx
import { canViewNavItem, hasClientPermission, PERMISSIONS } from '@/lib/auth';

export function NavigationBar({ userRole }: { userRole: UserRole }) {
  return (
    <nav>
      {canViewNavItem(userRole, ['admin', 'super_admin']) && (
        <NavLink href="/admin/dashboard">Admin Console</NavLink>
      )}
      {hasClientPermission(userRole, PERMISSIONS.NOTICES_PUBLISH_COURSE) && (
        <Button>New Notice</Button>
      )}
    </nav>
  );
}
```

---

## 5. Verification & Testing Matrix

All 65 automated tests across 23 test suites passed with 0 errors:

| Test Group | Verification Target | Status |
| :--- | :--- | :---: |
| **1. Authorized Role Permissions** | Verifies permitted operations for student, faculty, admin, super_admin | ✅ PASS |
| **2. Unauthorized Denials** | Verifies deny-by-default on cross-role access (e.g. students blocked from admin console) | ✅ PASS |
| **3. Missing Authentication** | Verifies rejection when user session is null, undefined, or missing role | ✅ PASS |
| **4. Invalid Role Handling** | Verifies immediate denial for forged or unmapped role names | ✅ PASS |
| **5. Account Lifecycle Checks** | Verifies suspension, deactivation, and pending verification lockouts | ✅ PASS |
| **6. Resource Ownership (ABAC)** | Verifies `OWN` enforcement on profile editing, grading, and submissions | ✅ PASS |
| **7. Departmental Isolation (ABAC)** | Verifies `DEPT` scoping on administrative operations and super_admin bypass | ✅ PASS |
| **8. Privilege Escalation Prevention**| Verifies strict prohibition of non-super-admins modifying roles | ✅ PASS |
| **9. Hierarchy & Client Helpers** | Verifies role hierarchy ordering and persona navigation filtering | ✅ PASS |

---

## 6. Readiness Assessment

- **Prerequisites Verified:** Provider approval (Clerk), user model, and matrix baseline all confirmed.
- **Implementation Status:** Fully implemented, typechecked, linted, formatted, tested, and built.
- **Readiness:** **`READY`** for Phase 3, Part 3.6 (Edge Middleware & Route Protection Integration).

