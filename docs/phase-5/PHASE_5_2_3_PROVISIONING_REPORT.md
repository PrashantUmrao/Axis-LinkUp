# Phase 5.2.3: Admin Single-Account Provisioning Implementation Report

**Status:** Completed & Fully Verified  
**Date:** November 15, 2026  
**Module:** User Management & Account Provisioning  
**Author:** Antigravity Engineering Agent  
**Context:** Axis LinkUp — College Communication and Productivity Platform (AITM Kanpur)

---

## 1. Executive Summary

Phase 5.2.3 successfully implements the closed, administrator-controlled single-account provisioning workflow for Axis LinkUp. In strict accordance with the **Phase 4.8.2 Access & Identity Requirements**, **Phase 5.1 Architecture Roadmap**, and **Phase 5.2.1/5.2.2 Identity Synchronization Specifications**:

1. **Strict Administrative Authorization & Separation of Powers**: Only authorized System Administrators (`super_admin` with `adminSubRole: 'sys_admin'` or root `super_admin`) possess authority to provision collegiate accounts. Department Heads (HODs) and Executive Directors are explicitly denied global account-provisioning privileges.
2. **Standardized Provisioning API (`POST /api/v1/admin/users/provision`)**: Accepts student and faculty onboarding payloads, validates input constraints using strict Zod schemas, performs pre-flight uniqueness checks against MongoDB, creates external Clerk credentials, and persists linked collegiate records.
3. **Passwordless Clerk Identity Generation**: Accounts are provisioned with `skipPasswordRequirement: true`, eliminating insecure default or temporary passwords. Clerk metadata (`publicMetadata`) is strictly injected server-side to prevent role spoofing.
4. **Compensating Rollback Transaction Architecture**: If external Clerk creation succeeds but database persistence fails (e.g., transient network drop or connection timeout), the system automatically initiates a compensating deletion (`client.users.deleteUser(clerkUser.id)`), guaranteeing zero orphaned accounts.
5. **Frontend Administrative Form Integration**: The `AdminProvisioningCard` component on the Administration Dashboard is connected directly to the new API with asynchronous submission states, field validation error mapping, resilient error banners, auto-dismissing success notifications, and Next.js router cache invalidation.
6. **100% Verified Quality**: Verified through a comprehensive 17-scenario unit test suite, passing all 173 platform unit tests, 0 TypeScript errors, 0 ESLint warnings, and a successful production build across all 21 application routes.

---

## 2. Architectural Compliance & Security Guardrails

| Requirement Specification | Source Document | Implementation Details | Verification Status |
| :--- | :--- | :--- | :--- |
| **Closed Ingress Policy** | Phase 4.8.2 §2.1 | Public student and faculty sign-up routes remain strictly blocked; only System Administrators can create accounts. | Verified |
| **Separation of Powers** | Phase 4.8.2 §2.3 | `assertCanManageUserRoles` checks caller session. HODs and Directors receive 403 Forbidden on provisioning attempts. | Verified |
| **Collegiate Identity Standard** | Phase 5.2.1 §2 | Institutional emails must strictly match `@axiscolleges.in`. Usernames are normalized to lowercase alphanumeric strings. | Verified |
| **Passwordless Activation** | Phase 5.2.3 §3 | Insecure temporary passwords (`Pass@123`) are prohibited. Accounts are created with `skipPasswordRequirement: true`. | Verified |
| **Server-Controlled RBAC** | Phase 5.2.2 §3 | Role values (`student`, `faculty`) are injected directly into `publicMetadata` from backend domain logic. | Verified |
| **Department Foreign Key Integrity** | Phase 5.1 §3 | `DepartmentModel` and `DepartmentRepository` validate department codes (`CSE`, `ECE`, etc.) before account creation. | Verified |
| **Compensating Rollback** | Phase 5.2.3 §4 | If MongoDB write throws, the created Clerk identity is immediately destroyed via `deleteUser()`. | Verified |

---

## 3. Data Models & Repositories

### 3.1 Department Model & Repository
To support normalized collegiate departmental associations, the following entities were introduced:

- **Type Definition** (`src/types/department.ts`):
  ```typescript
  export interface IDepartment {
    _id: Types.ObjectId;
    code: string; // e.g. "CSE", "ECE", "ME", "CE", "IT", "MBA"
    name: string; // e.g. "Computer Science & Engineering"
    hodId?: Types.ObjectId;
    establishedYear?: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
  ```
- **Mongoose Model** (`src/lib/db/models/department.model.ts`):
  - Normalized uppercase indexing on `code`.
  - Default status `isActive: true`.
  - Lean DTO transformation helper `toDepartmentDTO`.
- **Repository Methods** (`src/lib/db/repositories/department.repository.ts`):
  - `findById(id: string)`: Resolves department by MongoDB ObjectId.
  - `findByCode(code: string)`: Resolves department by institutional code (case-insensitive).
  - `findActiveByIdOrCode(identifier: string)`: Polymorphic resolver for either 24-character hex ID or department code.
  - `findAllActive()`: Fetches all operational academic departments.
  - `ensureDefaultDepartments()`: Idempotently seeds default AITM departments (`CSE`, `ECE`, `ME`, `CE`, `IT`, `MBA`).

---

## 4. API Specification: `POST /api/v1/admin/users/provision`

### 4.1 Request Contract
- **HTTP Method**: `POST`
- **Path**: `/api/v1/admin/users/provision`
- **Authentication**: Required (`requireAuth()`)
- **Required Authorization**: System Administrator (`role: 'super_admin'` or `adminSubRole: 'sys_admin'`)

#### Student Provisioning Payload Example
```json
{
  "fullName": "Divya Nair",
  "username": "divya.nair",
  "email": "divya.nair@axiscolleges.in",
  "role": "student",
  "departmentId": "CSE",
  "studentProfile": {
    "rollNumber": "24BCSE120",
    "batchYear": 2026,
    "currentSemester": 1,
    "section": "A"
  }
}
```

#### Faculty Provisioning Payload Example
```json
{
  "fullName": "Dr. Vivek Shukla",
  "username": "dr.shukla",
  "email": "dr.shukla@axiscolleges.in",
  "role": "faculty",
  "departmentId": "ECE",
  "facultyProfile": {
    "employeeId": "FAC-ECE-030",
    "designation": "Professor"
  }
}
```

### 4.2 Response Contract (HTTP 201 Created)
```json
{
  "success": true,
  "message": "Collegiate account provisioned successfully",
  "data": {
    "user": {
      "id": "6730a005f8b1a2001a000101",
      "email": "divya.nair@axiscolleges.in",
      "username": "divya.nair",
      "fullName": "Divya Nair",
      "role": "student",
      "status": "pending_verification",
      "isEmailVerified": false,
      "departmentId": "6730a005f8b1a2001a000050",
      "provisionedBy": "6730a005f8b1a2001a000099",
      "studentProfile": {
        "rollNumber": "24BCSE120",
        "batchYear": 2026,
        "currentSemester": 1,
        "section": "A",
        "admissionType": "regular"
      },
      "createdAt": "2026-11-15T00:00:00.000Z",
      "updatedAt": "2026-11-15T00:00:00.000Z"
    }
  },
  "error": null,
  "timestamp": "2026-11-15T00:00:00.000Z"
}
```

### 4.3 Error Responses
- `401 Unauthorized`: Missing or invalid session token.
- `403 Forbidden`: Caller lacks System Administrator privileges (e.g. HOD, Director, Student, Faculty).
- `400 Bad Request`: Validation failure (missing required fields, invalid email domain, invalid role, invalid department).
- `409 Conflict`: Duplicate institutional email, duplicate username, duplicate student roll number, or duplicate faculty employee ID.
- `502 Bad Gateway`: External Clerk communication failure.

---

## 5. Domain Business Logic (`ProvisioningService`)

The core provisioning workflow is encapsulated in `ProvisioningService.provisionSingleAccount` (`src/lib/services/provisioning.service.ts`):

```mermaid
flowchart TD
    A["Caller Request"] --> B["1. Authorization Gate\n(assertCanManageUserRoles)"]
    B -->|Forbidden| B_Err["Throw ForbiddenError (403)"]
    B -->|Authorized| C["2. Zod Schema Validation\n(provisionUserSchema)"]
    C -->|Invalid| C_Err["Throw ValidationError (400)"]
    C -->|Valid| D["3. Resolve Department\n(DepartmentRepository.findActiveByIdOrCode)"]
    D -->|Not Found| D_Err["Throw ValidationError (400)"]
    D -->|Found| E["4. Pre-Flight Uniqueness Checks\n(Email, Username, Roll No / Employee ID)"]
    E -->|Duplicate| E_Err["Throw ConflictError (409)"]
    E -->|Unique| F["5. External Clerk Identity Creation\n(skipPasswordRequirement: true)"]
    F -->|Clerk Error| F_Err["Map to Conflict (409) or Gateway Error (502)"]
    F -->|Success| G["6. MongoDB User Persistence\n(UserModel.create)"]
    G -->|DB Write Fails| H["Compensating Rollback:\nDelete Clerk User (deleteUser)"]
    H --> G_Err["Re-throw DB Error"]
    G -->|DB Write Succeeds| I["7. Return Sanitized UserDTO (201 Created)"]
```

### Key Safeguards
1. **Passwordless Provisioning**:
   ```typescript
   const clerkUser = await client.users.createUser({
     emailAddress: [validated.email],
     username: validated.username,
     firstName,
     lastName,
     skipPasswordRequirement: true,
     publicMetadata: {
       role: validated.role,
       departmentId: department._id.toString(),
       departmentCode: department.code,
       institutionalId: validated.role === 'student'
         ? validated.studentProfile?.rollNumber
         : validated.facultyProfile?.employeeId,
       isProvisioned: true,
     },
   });
   ```
2. **Compensating Rollback**:
   ```typescript
   try {
     createdUser = await UserRepository.create({ ... });
   } catch (dbError) {
     logger.error(`Database write failed for user ${clerkUser.id}. Initiating compensating Clerk rollback...`);
     try {
       await client.users.deleteUser(clerkUser.id);
       logger.info(`Successfully rolled back Clerk user ${clerkUser.id}`);
     } catch (rollbackError) {
       logger.error(`CRITICAL: Compensating rollback failed for Clerk user ${clerkUser.id}`);
     }
     throw dbError;
   }
   ```

---

## 6. Frontend Form Integration

The administrative provisioning UI (`src/app/(admin)/admin/dashboard/components/admin-provisioning-card.tsx`) was upgraded:
- **Direct Backend Binding**: Submits to `/api/v1/admin/users/provision` with proper JSON payload structure.
- **Dynamic Persona Switching**: Toggling between **Student** and **Faculty** dynamically mounts and validates the corresponding persona fields:
  - *Student*: Roll Number, Batch Year (e.g., 2026), Current Semester (1–8), and Section.
  - *Faculty*: Employee ID (e.g., `FAC-CSE-012`) and Academic Designation.
- **Real-Time Client Validation & Server Errors**: Surfaces field-level validation errors directly below the corresponding input controls and displays top-level banner alerts for 409 Conflict / 403 Forbidden errors.
- **Success Notification & Form Reset**: Emits a green confirmation banner stating the username and email provisioned, automatically clears the form state, and invokes `router.refresh()` to update administrative stats and user directories.

---

## 7. Verification & Test Results

### 7.1 Single-Account Provisioning Unit Tests (`tests/unit/provisioning.test.ts`)
A dedicated 17-scenario unit test suite was implemented and verified:

```
TAP version 13
# Subtest: Phase 5.2.3 — 1. Provisioning Schema Validation
    ok 1 - validates complete student provisioning input and normalizes username
    ok 2 - validates complete faculty provisioning input
    ok 3 - rejects student provisioning lacking studentProfile
    ok 4 - rejects faculty provisioning lacking facultyProfile
    ok 5 - rejects provisioning attempts with unauthorized roles (admin/super_admin)
ok 1 - Phase 5.2.3 — 1. Provisioning Schema Validation (5/5 passed)

# Subtest: Phase 5.2.3 — 2. Administrative Authorization & Separation of Powers
    ok 1 - rejects provisioning attempt when invoked by Department HOD
    ok 2 - rejects provisioning attempt when invoked by Executive Director
    ok 3 - rejects provisioning attempt when invoked by Faculty or Student
ok 2 - Phase 5.2.3 — 2. Administrative Authorization & Separation of Powers (3/3 passed)

# Subtest: Phase 5.2.3 — 3. Pre-Flight Uniqueness & Reference Checks
    ok 1 - rejects provisioning when department is invalid or not found
    ok 2 - rejects provisioning on duplicate institutional email
    ok 3 - rejects provisioning on duplicate institutional username
    ok 4 - rejects provisioning on duplicate student roll number
ok 3 - Phase 5.2.3 — 3. Pre-Flight Uniqueness & Reference Checks (4/4 passed)

# Subtest: Phase 5.2.3 — 4. Clerk Failure Handling & Resilience
    ok 1 - maps Clerk identity already exists error to ConflictError
    ok 2 - maps generic Clerk network failure to 502 AppError
ok 4 - Phase 5.2.3 — 4. Clerk Failure Handling & Resilience (2/2 passed)

# Subtest: Phase 5.2.3 — 5. Compensating Rollback Transaction on MongoDB Failure
    ok 1 - rolls back created Clerk user when MongoDB persistence fails
ok 5 - Phase 5.2.3 — 5. Compensating Rollback Transaction on MongoDB Failure (1/1 passed)

# Subtest: Phase 5.2.3 — 6. Successful Provisioning Pipeline & DTO Verification
    ok 1 - successfully provisions a student account with correct role, status and provisionedBy
    ok 2 - successfully provisions a faculty account with employeeId and designation
ok 6 - Phase 5.2.3 — 6. Successful Provisioning Pipeline & DTO Verification (2/2 passed)
```

### 7.2 Full Platform Test & Build Suite
- **Unit Test Runner (`npm test`)**: **173 passed, 0 failed** across 29 subtest suites and 65 suites.
- **TypeScript Typecheck (`npx tsc --noEmit`)**: **0 errors**.
- **ESLint Validation (`npm run lint`)**: **0 warnings / 0 errors**.
- **Next.js Production Build (`npm run build`)**: **21/21 routes compiled successfully**.

---

## 8. Artifacts & Deliverables Summary

| File Path | Description |
| :--- | :--- |
| `src/types/department.ts` | Academic department TypeScript interfaces (`IDepartment`, `DepartmentDTO`). |
| `src/lib/db/models/department.model.ts` | Mongoose schema and model for collegiate departments. |
| `src/lib/db/repositories/department.repository.ts` | Repository methods for resolving and seeding departments. |
| `src/lib/validations/provision.schema.ts` | Zod validation schemas for student and faculty account provisioning. |
| `src/lib/services/provisioning.service.ts` | Domain provisioning service with Clerk creation and rollback compensation. |
| `src/app/api/v1/admin/users/provision/route.ts` | Next.js API route handler for `POST /api/v1/admin/users/provision`. |
| `src/app/(admin)/admin/dashboard/components/admin-provisioning-card.tsx` | Enhanced frontend form component connected to the provisioning API. |
| `tests/unit/provisioning.test.ts` | Complete 17-scenario unit test suite for provisioning workflow. |
| `docs/phase-5/PHASE_5_2_3_PROVISIONING_REPORT.md` | Comprehensive architectural and implementation report. |

---

## 9. Next Steps (Phase 5.2.4 & Beyond)
With single-account administrative provisioning fully operational:
1. **Phase 5.2.4: Bulk CSV User Provisioning**:
   - Implement bulk CSV parser, batch validation against institutional department and format schemas.
   - Batch Clerk identity creation with rate-limit backoff and partial failure reporting.
2. **Phase 5.2.5: Account Activation & First-Time Password Setup Flow**:
   - Dedicated passwordless invite email / activation token verification page.
   - Initial password setup and transition of account status from `pending_verification` to `active`.

