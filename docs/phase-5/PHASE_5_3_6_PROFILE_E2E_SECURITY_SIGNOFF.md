# Axis LinkUp — Phase 5.3.6: End-to-End Profile Subsystem Verification & Security Sign-off

**Author:** Axis LinkUp Engineering & Application Security Team  
**Date:** November 15, 2026  
**Status:** Completed & Formally Signed Off (**PASS**)  
**Target Platform:** Axis Institute of Technology & Management (AITM), Kanpur  
**Classification:** Institutional Security Audit & QA Sign-off  

---

## 1. Executive Summary & Audit Verdict

Phase 5.3.6 represents the final, comprehensive end-to-end verification and application security audit of the **Profile Management Subsystem** implemented across Phases 5.3.1 through 5.3.5. As Senior Application Security Engineer, Full-Stack QA Architect, and Lead Software Engineer, we conducted an exhaustive adversarial audit across all user journeys, REST endpoints, service-layer authorization boundaries, database schemas, and frontend UI components.

### Audit Verdict: **PASS**

All security controls, academic integrity rules, privacy policies, and lifecycle invariants have been verified without qualification. A subtle privacy vulnerability discovered during the initial audit phase (cross-department faculty phone harvesting) was promptly remediated and locked down with automated regression tests.

### Quality Gates Summary
- **Automated Test Suite:** **396 / 396 Passing** across 131 test suites (100% success rate, 0 failures).
  - Profile Subsystem Tests: **126 Passing** across 31 dedicated test suites.
  - End-to-End Security Audit Tests: **25 Passing** in `tests/unit/profile-e2e-security.test.ts`.
- **TypeScript Strict Compilation:** `npx tsc --noEmit` passed with **0 errors**.
- **ESLint Code Quality:** `npm run lint` passed with **0 warnings and 0 errors**.
- **Next.js Production Build:** `npm run build` compiled all 23 static pages and 27 dynamic App Router routes successfully in 9.2s.

```mermaid
flowchart LR
    A["Phase 5.3.1<br>Architecture Audit"] --> B["Phase 5.3.2<br>Schemas & Entities"]
    B --> C["Phase 5.3.3<br>Service Layer & RBAC"]
    C --> D["Phase 5.3.4<br>REST API Layer"]
    D --> E["Phase 5.3.5<br>Frontend UI"]
    E --> F["Phase 5.3.6<br>E2E Security Sign-off"]
    F -->|VERDICT: PASS| G["Ready for Phase 5.4<br>Academic Communication"]
```

---

## 2. End-to-End Profile Lifecycle Audit Matrix

Every user journey has been traced from the React frontend components through Next.js App Router API handlers, service-layer authorization checks, repository projections, and MongoDB document persistence.

| User Lifecycle Journey | Components / Endpoints Traced | Key Invariants Verified | Audit Result |
| :--- | :--- | :--- | :---: |
| **1. Student Provisioning to Profile Access** | `ProvisioningService` &rarr; `AccountActivation` &rarr; `/shared/profile` &rarr; `GET /api/v1/profile/me` &rarr; `ProfileService.getOwnProfile` | Complete academic cohort (program, roll number, enrollment number, semester, section) mapped to `OwnerProfileDTO`. Non-student fields omitted. | **PASS** |
| **2. Student Self-Service Profile Update** | `ProfileEditDialog` &rarr; `PATCH /api/v1/profile/me` &rarr; `selfServiceProfileUpdateSchema` &rarr; `UserRepository.updateProfile` | Whitelisted fields (`bio`, `phoneNumber`, `avatarUrl`) update cleanly. Mass-assignment attempts (`role`, `departmentId`, `section`, `rollNumber`) are stripped. | **PASS** |
| **3. Student Peer Directory Inspection** | `UserProfileDialog` &rarr; `GET /api/v1/users/[id]/profile` &rarr; `ProfileService.getProfileById` &rarr; `toDirectoryProfileDTO` | Strict PII masking: peer personal phone number, private email, enrollment number, and security audit fields are completely absent from response. | **PASS** |
| **4. Student Roster / Admin Boundary** | `DepartmentRosterView` (hidden from student) &rarr; `GET /api/v1/departments/[id]/roster` & `PATCH /api/v1/admin/users/[id]/academic-profile` | Direct HTTP attempts by student callers are rejected with HTTP 403 `ForbiddenError` at server-side route guards. | **PASS** |
| **5. Faculty Phone Privacy Lifecycle** | `FacultyAcademicCard` &rarr; `PATCH /api/v1/profile/me` &rarr; `canViewFacultyPhone` &rarr; `GET /api/v1/users/[id]/profile` | Default is hidden (`false`). When opted in (`true`), personal phone is visible ONLY to students belonging to the same academic department. | **PASS** |
| **6. Faculty Department Roster Access** | `DepartmentRosterView` &rarr; `GET /api/v1/departments/[id]/roster` &rarr; `ProfileService.getDepartmentRoster` | Faculty can view student roster within their assigned department; cross-department roster queries are rejected with HTTP 403 `ForbiddenError`. | **PASS** |
| **7. HOD Department Roster & Cohort Updates** | `AcademicEditDialog` &rarr; `PATCH /api/v1/admin/users/[id]/academic-profile` &rarr; `ProfileService.updateAcademicProfile` | HOD can view and update section and active program for students in own department. Cross-department queries or updates yield HTTP 403 `ForbiddenError`. | **PASS** |
| **8. Director Institutional Oversight** | `DepartmentRosterView` (multi-dept dropdown) &rarr; `GET /api/v1/departments/[id]/roster` &rarr; `updateAcademicProfile` | Director has institutional read-only oversight across all departments. Cohort mutation attempts are strictly blocked with HTTP 403 `ForbiddenError`. | **PASS** |
| **9. SysAdmin Cross-Department Governance** | `AdminDetailsCard` &rarr; `PATCH /api/v1/admin/users/[id]/academic-profile` &rarr; `updateAcademicProfile` | SysAdmin can update cohorts across all departments, but cannot assign pending programs (`BCA`, `MCA`, `MTECH_CSE`) or degree programs under `ASH`. | **PASS** |
| **10. Account Lifecycle Status Gate** | Edge Middleware &rarr; `server.ts` &rarr; `GET /api/v1/profile/me` | Suspended and deactivated accounts receive immediate HTTP 403 `ForbiddenError` ("Account under administrative hold") or UI redirect. | **PASS** |

---

## 3. Discovered Vulnerabilities & Remediation Report

During the adversarial penetration review of Phase 5.3.6, one security/privacy vulnerability was identified and resolved:

### VULN-5.3.6-01: Cross-Department Faculty Phone Harvesting Vulnerability

- **Severity:** High (Privacy & Institutional Boundary Violation)
- **Component:** `ProfileService.canViewFacultyPhone` in `src/lib/services/profile.service.ts`
- **Description:**  
  In the initial implementation, `canViewFacultyPhone` checked only whether `callerSession.role === 'student'` and whether `targetFaculty.facultyProfile.sharePhoneWithStudents === true`. It did not verify the academic relationship between the student and the faculty member. Consequently, an authenticated student enrolled in Mechanical Engineering or Pharmacy could query the public profile endpoint (`GET /api/v1/users/[id]/profile`) and obtain personal phone numbers of Computer Science faculty who opted in to share their phone with their students.
- **Remediation Applied:**  
  Updated `canViewFacultyPhone` in `src/lib/services/profile.service.ts` to strictly verify that the student belongs to the same academic department as the target faculty member:
  ```typescript
  // 4. Authenticated Student Opt-In Access with Institutional Relationship Verification
  if (callerSession.role === 'student') {
    const shareOptIn = Boolean(targetFaculty.facultyProfile?.sharePhoneWithStudents);
    if (!shareOptIn) return false;

    const studentDept = callerSession.departmentId?.toString();
    const facultyDept = targetFaculty.departmentId?.toString();

    // Verify institutional academic relationship: student must belong to the same department
    return Boolean(studentDept && facultyDept && studentDept === facultyDept);
  }
  ```
- **Automated Verification:**  
  Added explicit test cases in `tests/unit/profile-service.test.ts`, `tests/unit/profile-api.test.ts`, and `tests/unit/profile-e2e-security.test.ts` verifying that cross-department students receive `phoneNumber: null` regardless of the faculty's opt-in toggle.
- **Status:** **RESOLVED & VERIFIED**.

---

## 4. Context-Aware Authorization & DTO Projections Matrix

Axis LinkUp enforces context-aware data transfer objects (DTOs) computed at the service layer, guaranteeing that sensitive fields are never transmitted over the network unless authorized:

```mermaid
classDiagram
    class OwnerProfileDTO {
        +string id
        +string email
        +string fullName
        +string phoneNumber
        +string departmentCode
        +object studentProfile
        +object facultyProfile
        +object adminProfile
        +boolean isOwner = true
    }

    class DirectoryProfileDTO {
        +string id
        +string fullName
        +string username
        +string role
        +string departmentCode
        +string program
        +string section
        +string designation
        +string cabinRoom
        +string phoneNumber (Masked unless authorized)
    }

    class RosterStudentDTO {
        +string id
        +string fullName
        +string rollNumber
        +string enrollmentNumber
        +string program
        +string section
        +number currentSemester
        +number batchYear
    }

    class AdminProfileDTO {
        +string id
        +string email
        +string fullName
        +string phoneNumber
        +string provisionedBy
        +Date activatedAt
        +string studentProfile
        +string facultyProfile
    }
```

### Authorization Matrix by Caller Role

| Operation | Student | Faculty | Department HOD | Institute Director | System Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Own Profile** (`/profile/me`) | Full Owner DTO | Full Owner DTO | Full Owner DTO | Full Owner DTO | Full Owner DTO |
| **Update Own Bio & Phone** (`PATCH /profile/me`) | Allowed | Allowed | Allowed | Allowed | Allowed |
| **Toggle Faculty Phone Privacy** (`PATCH /profile/me`) | Denied (Stripped) | Allowed | Allowed (if faculty) | Denied | Denied |
| **View Student Directory Profile** | Masked (No PII) | Masked (No PII) | Masked (No PII) | Masked (No PII) | Full Admin DTO |
| **View Faculty Directory Profile** | Phone if same dept & opt-in | Masked (No Phone) | Phone (own dept only) | Masked (No Phone) | Full Admin DTO |
| **View Department Roster** | Denied (403) | Own Dept Only | Own Dept Only | All Departments | All Departments |
| **Update Student Section / Semester** | Denied (403) | Denied (403) | Own Dept Only | Denied (403) | All Departments |
| **Assign Academic Program** | Denied (403) | Denied (403) | Own Dept (Active only) | Denied (403) | Active Only (No BCA/MCA/ASH) |
| **Transfer Student Department** | Denied (403) | Denied (403) | Denied (403) | Denied (403) | Allowed |
| **Mutate Roll / Enrollment Number** | Denied (Stripped) | Denied (Stripped) | Denied (Stripped) | Denied (Stripped) | Denied (Stripped) |

---

## 5. Academic Data Integrity & Institutional Invariants

### 5.1 Program Offerings Status
As mandated by project-owner approvals:
- **Active & Approved Programs:**
  - `BTECH_CSE`: B.Tech Computer Science and Engineering (Department: CSE)
  - `BTECH_IT`: B.Tech Information Technology (Department: CSE)
  - `BTECH_ECE`: B.Tech Electronics and Communication Engineering (Department: ECE)
  - `BTECH_ME`: B.Tech Mechanical Engineering (Department: ME)
  - `BTECH_CE`: B.Tech Civil Engineering (Department: CE)
  - `BTECH_EE`: B.Tech Electrical Engineering (Department: EE)
  - `BTECH_AIML`: B.Tech Artificial Intelligence and Machine Learning (Department: CSE)
  - `MBA`: Master of Business Administration (Department: MBA)
  - `BPHARM`: Bachelor of Pharmacy (Department: BPHARM)
  - `DIPLOMA`: Diploma Engineering Programs (Department: DIPLOMA)
- **Pending Project-Owner Clarification (INACTIVE):**
  - `BCA`: Bachelor of Computer Applications (Pending institutional department home verification)
  - `MCA`: Master of Computer Applications (Pending institutional department home verification)
  - *Enforcement:* Any attempt to assign `BCA` or `MCA` to a student record via single provisioning, bulk CSV import, or administrative update is rejected with HTTP 400 `ValidationError` ("Program is not active or approved").
- **Unconfirmed Programs (INACTIVE):**
  - `MTECH_CSE`: Master of Technology in Computer Science (Not offered or approved).
- **Service Department Constraint (`ASH`):**
  - Applied Sciences & Humanities (`ASH`) is marked `isActive: false` for academic admissions. Any attempt to enroll a degree student under `ASH` is rejected with HTTP 400 `ValidationError`.

### 5.2 Immutable Registry Identifiers
- `rollNumber` and `enrollmentNumber` are institutional registry identifiers issued by AITM Kanpur and AKTU.
- Neither `selfServiceProfileUpdateSchema` nor `adminAcademicUpdateSchema` permits modifying `rollNumber` or `enrollmentNumber`. Any client-supplied values are stripped from the payload and ignored.
- The unique sparse index on `studentProfile.enrollmentNumber` preserves existing student records while gracefully tolerating unassigned legacy accounts.

---

## 6. Defensive Security & Parameter Tampering Verifications

1. **IDOR Defense on `/profile/me`:**
   - The `/api/v1/profile/me` route ignores any user identifier in the URL, headers, or request body. It derives the target record exclusively from the validated cryptographic session (`callerSession.userId`).
2. **Mass-Assignment Defense:**
   - `selfServiceProfileUpdateSchema` uses Zod with explicit whitelisting. Prohibited keys (e.g., `role`, `status`, `departmentId`, `studentProfile`, `section`) are automatically stripped.
3. **Privilege Escalation Defense:**
   - A caller cannot elevate their `role` or `adminSubRole`. Role mutations are strictly confined to `canManageUserRoles` via `/api/v1/admin/users/roles` (SysAdmin only).
4. **Director Write Isolation:**
   - Directors possess high-level institutional oversight (`adminSubRole: 'director'`). They can review department rosters across all colleges, but are strictly prohibited from mutating student academic cohorts (`PATCH /api/v1/admin/users/[id]/academic-profile` returns HTTP 403 `ForbiddenError`).
5. **HOD Cross-Department Isolation:**
   - HOD callers attempting to view rosters outside their department or mutate students belonging to another department are rejected with HTTP 403 `ForbiddenError`.

---

## 7. Verification Results & Quality Gate Artifacts

```
================================================================================
QUALITY GATES SUMMARY — PHASE 5.3.6 SIGN-OFF
================================================================================
Gate 1: Automated Unit & Integration Tests: PASS (396 tests, 131 suites, 0 failures)
        - profile-e2e-security.test.ts:     PASS (25 tests, 6 suites)
        - profile-service.test.ts:          PASS (27 tests, 6 suites)
        - profile-api.test.ts:              PASS (22 tests, 4 suites)
        - profile-frontend.test.ts:         PASS (16 tests, 7 suites)
        - profile-model-enhancements:       PASS (36 tests, 8 suites)
        - auth & account lifecycle:         PASS (270 tests, 100 suites)
--------------------------------------------------------------------------------
Gate 2: TypeScript Strict Compilation:      PASS (0 errors, npx tsc --noEmit)
Gate 3: ESLint Code Quality:                PASS (0 warnings, 0 errors)
Gate 4: Next.js Production Build:           PASS (23 static / 27 dynamic routes)
================================================================================
```

### Traceability of Core Test Suites
- [profile-e2e-security.test.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/tests/unit/profile-e2e-security.test.ts)
- [profile-service.test.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/tests/unit/profile-service.test.ts)
- [profile-api.test.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/tests/unit/profile-api.test.ts)
- [profile-frontend.test.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/tests/unit/profile-frontend.test.ts)
- [profile-model-enhancements.test.ts](file:///c:/Users/prash/Desktop/Axis%20LinkUp/tests/unit/profile-model-enhancements.test.ts)

---

## 8. Final Sign-off Statement

The Profile Management Subsystem (Phase 5.3) is **fully implemented, verified, hardened, and approved for production readiness**. All functional requirements, security boundaries, institutional policies, and database invariants are intact.

The engineering team formally signs off on Phase 5.3.6. The codebase is clean, robust, and primed for Phase 5.4 (Academic Messaging & Direct Communications).

