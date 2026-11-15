# Phase 5.3.3: Profile Service Layer & Context-Aware Access Control — Implementation Report

**Project:** Axis LinkUp — College Communication and Productivity Platform  
**Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Phase:** 5.3.3 — Centralized Profile Service Layer & Privacy-Preserving Access Control  
**Status:** Completed  
**Date:** November 15, 2026  

---

## 1. Service Architecture

The `ProfileService` (`src/lib/services/profile.service.ts`) serves as the single source of truth for user profile queries, cohort roster lookups, self-service profile updates, and administrative academic profile updates across Axis LinkUp.

```
                      +---------------------------------------+
                      |       Next.js API / RSC / Actions     |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |            ProfileService             |
                      +---------------------------------------+
                             |                     |
              +--------------+                     +--------------+
              |                                                   |
              v                                                   v
+---------------------------+                       +---------------------------+
|      UserRepository       |                       |   DepartmentRepository    |
+---------------------------+                       +---------------------------+
| - findById                |                       | - findById                |
| - updateProfile           |                       | - isProgramApproved...    |
| - updateAcademicProfile   |                       |                           |
| - findDepartmentRoster    |                       +---------------------------+
+---------------------------+
              |
              v
+---------------------------+
|      MongoDB Database     |
|   (users & departments)   |
+---------------------------+
```

### Core Responsibilities
1. **Context-Aware Projections:** Transforms raw Mongoose `IUser` documents into strictly allowlisted DTOs based on the authenticated caller's identity, role, and department context.
2. **Privacy Enforcement:** Shields sensitive contact details (faculty phone numbers, student roll/enrollment numbers) unless explicitly authorized or opted in.
3. **Academic Cohort Scoping:** Enforces institutional organizational boundaries on student rosters; prevents unauthorized cross-department snooping.
4. **Mass-Assignment Defense:** Strictly validates and sanitizes input data through dedicated Zod schemas before persisting updates to the database.
5. **Decoupled Department Population:** Gracefully resolves embedded department references via `DepartmentRepository` without hard Mongoose `$lookup` population dependencies.

---

## 2. DTO Definitions & Field Allowlists

To prevent sensitive data leakage (such as hashed passwords, OTP secrets, verification tokens, internal security audit metadata, and student identifiers), `ProfileService` provides 4 strictly typed DTO models (`src/types/profile.ts`):

| DTO Name | Target Audience | Key Included Fields | Strictly Excluded Fields |
| :--- | :--- | :--- | :--- |
| **`DirectoryProfileDTO`** | Peer students, general discovery, cross-department directory | `id`, `fullName`, `username`, `role`, `department` (`id`, `name`, `code`), `avatarUrl`, `bio`, `program` (students), `section` (students), `designation` (faculty), `facultyPreferences` (public fields), `phoneNumber` (if permitted) | `email`, `studentProfile.rollNumber`, `studentProfile.enrollmentNumber`, `batchYear`, `currentSemester`, `employeeId`, security metadata |
| **`RosterStudentDTO`** | Department Faculty, HOD, Director, System Admin | `id`, `fullName`, `username`, `institutionalEmail`, `departmentId`, `avatarUrl`, `program`, `rollNumber`, `enrollmentNumber`, `batchYear`, `currentSemester`, `section`, `status` | Personal phone, internal tokens, credentials, auth provider secrets |
| **`OwnerProfileDTO`** | The authenticated user viewing their own profile | All directory fields + `email`, `phoneNumber`, `studentProfile` (full), `facultyProfile` (full), `facultyPreferences`, `status` | Internal auth secrets, password hashes, OTP tokens, `provisionedBy`, `clerkId` |
| **`AdminProfileDTO`** | System Administrators & Institutional Directors | All owner fields + `provisionedBy`, `activatedAt`, `lastLoginAt`, `createdAt`, `updatedAt`, `status` | Clerk private keys, unhashed security tokens |

---

## 3. Authorization Matrix

| Action / Operation | Student Caller | Faculty Caller | Department HOD Caller | Director Caller | System Administrator Caller |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`getOwnProfile()`** | Self (`OwnerProfileDTO`) | Self (`OwnerProfileDTO`) | Self (`OwnerProfileDTO`) | Self (`OwnerProfileDTO`) | Self (`OwnerProfileDTO`) |
| **`getProfileById()` (Self)** | `OwnerProfileDTO` | `OwnerProfileDTO` | `OwnerProfileDTO` | `OwnerProfileDTO` | `AdminProfileDTO` |
| **`getProfileById()` (Peer Student)** | `DirectoryProfileDTO` (phone masked, roll/enrollment omitted) | `DirectoryProfileDTO` (or roster view if in dept) | `DirectoryProfileDTO` (or roster view if in dept) | `DirectoryProfileDTO` / Oversight | `AdminProfileDTO` (full audit fields) |
| **`getProfileById()` (Faculty Member)** | `DirectoryProfileDTO` (phone conditionally exposed per preference) | `DirectoryProfileDTO` (phone conditionally exposed) | `DirectoryProfileDTO` (phone visible to HOD) | `DirectoryProfileDTO` (phone visible) | `AdminProfileDTO` (full audit fields) |
| **`getDepartmentRoster()`** | **403 Forbidden** | **Allowed** (own assigned department only) | **Allowed** (own assigned department only) | **Allowed** (any institutional department) | **Allowed** (any institutional department) |
| **`updateOwnProfile()`** | Allowed (`fullName`, `bio`, `avatarUrl`, `phoneNumber`) | Allowed (`fullName`, `bio`, `avatarUrl`, `phoneNumber`, `facultyPreferences`) | Allowed (`fullName`, `bio`, `avatarUrl`, `phoneNumber`, `facultyPreferences`) | Allowed (`fullName`, `bio`, `avatarUrl`, `phoneNumber`) | Allowed (`fullName`, `bio`, `avatarUrl`, `phoneNumber`) |
| **`updateAcademicProfile()`** | **403 Forbidden** | **403 Forbidden** | **Allowed** (students in own assigned department only) | **Allowed** (students in any department) | **Allowed** (students in any department) |

---

## 4. Faculty Phone Privacy Implementation

In accordance with institutional guidelines:
- **Default Privacy:** Faculty phone numbers are private by default (`sharePhoneWithStudents = false`).
- **Student Visibility:** When a student views a faculty member's profile, the phone number is returned as `null` unless the faculty member has explicitly set `facultyPreferences.sharePhoneWithStudents = true`.
- **Legacy Compatibility:** If `facultyPreferences` is missing or undefined (legacy faculty record), `sharePhoneWithStudents` safely defaults to `false`.
- **Administrative Transparency:** Institutional Directors and System Administrators always have access to faculty phone numbers for official communication and emergency coordination.

```typescript
// Excerpt from src/lib/services/profile.service.ts
private static canViewFacultyPhone(
  targetFaculty: IUser,
  callerSession: UserSession
): boolean {
  if (callerSession.role === 'super_admin') return true;
  if (callerSession.role === 'admin' && callerSession.adminSubRole === 'director') return true;
  if (callerSession.userId === targetFaculty._id.toString()) return true;

  return targetFaculty.facultyPreferences?.sharePhoneWithStudents === true;
}
```

---

## 5. Profile Update Permissions & Mass-Assignment Defense

### Self-Service Updates (`updateOwnProfile`)
Validated via `selfServiceProfileUpdateSchema`:
- **Allowed for Students & Staff:** `fullName`, `bio`, `avatarUrl`, `phoneNumber`.
- **Allowed for Faculty:** Above fields + `facultyPreferences` (`sharePhoneWithStudents`, `receiveNotificationEmails`).
- **Strictly Stripped / Blocked:** `role`, `adminSubRole`, `email`, `departmentId`, `clerkId`, `status`, `studentProfile`, `facultyProfile.designation`, `facultyProfile.employeeId`.
- Any attempt by a student to modify their own `rollNumber`, `program`, `batchYear`, `currentSemester`, or `section` is completely ignored and stripped before persistence.

### Academic Cohort Updates (`updateAcademicProfile`)
Validated via `adminAcademicUpdateSchema`:
- **Allowed Fields:** `currentSemester`, `section`, `batchYear`, `program`.
- **Permissions:**
  - HOD callers can only update students belonging to their own department (`callerSession.departmentId === targetStudent.departmentId`). Cross-department attempts return HTTP 403 `ForbiddenError`.
  - Directors and System Administrators can update students in any department.
- **Roll Number & Enrollment Number Immutability:** `rollNumber` and `enrollmentNumber` are institutional identifiers assigned during provisioning and cannot be mutated via routine cohort progression.

---

## 6. Department Population Strategy

Rather than relying on Mongoose `.populate('departmentId')`—which is brittle across different indexing strategies and mock environments—`ProfileService` utilizes a graceful, decoupled lookup strategy via `DepartmentRepository.findById`:

1. If `user.departmentId` is present, `ProfileService.resolveDepartmentMeta(departmentId)` queries `DepartmentRepository`.
2. Returns a clean `{ id, name, code }` object.
3. If the department document is missing or orphaned, falls back gracefully to `{ id: departmentId.toString(), name: 'Unassigned Department', code: 'UNASSIGNED' }` without throwing a fatal 500 error or crashing the UI.

---

## 7. Academic Program Validation & Department Compatibility

When updating academic programs (`updateAcademicProfile`), `ProfileService` enforces institutional offering rules:
1. Validates that the program is explicitly approved and active for the student's department using `DepartmentRepository.isProgramApprovedForDepartment(departmentId, program)`.
2. **Inactive / Pending Programs:** Rejects unapproved, unconfirmed, or pending programs (`BCA`, `MCA`, `MTECH_CSE`) with HTTP 400 `ValidationError`.
3. **Foundational Departments:** Rejects academic program assignments to Applied Sciences & Humanities (`ASH`), preserving its role as a foundational service department.

---

## 8. Files Created & Modified

### Created
1. `src/types/profile.ts`: TypeScript definitions for `DirectoryProfileDTO`, `RosterStudentDTO`, `OwnerProfileDTO`, `AdminProfileDTO`, query options, and update inputs.
2. `src/lib/services/profile.service.ts`: Core `ProfileService` implementation.
3. `tests/unit/profile-service.test.ts`: 25 unit tests verifying all access control and projection rules.
4. `docs/phase-5/PHASE_5_3_3_PROFILE_SERVICE_REPORT.md`: This comprehensive implementation report.

### Modified
1. `src/types/index.ts`: Exported `src/types/profile.ts`.
2. `src/types/user.ts`: Added optional `bio?: string` to `IUser`, `UserDTO`, and `UpdateUserProfileInput`.
3. `src/lib/db/models/user.model.ts`: Added `bio` field (`type: String, trim: true, maxlength: 500`) to `UserSchema`.
4. `src/lib/validations/user.schema.ts`: Added `selfServiceProfileUpdateSchema` and `adminAcademicUpdateSchema`.
5. `src/lib/db/repositories/user.repository.ts`: Added `updateProfile` support for `bio`, implemented `updateAcademicProfile` and `findDepartmentRoster`.
6. `src/lib/services/index.ts`: Exported `ProfileService`.

---

## 9. Automated Test Results

- **Unit Test File:** `tests/unit/profile-service.test.ts`
- **Total Test Cases:** 25/25 passed
- **Full Test Suite:** 331/331 passed across 78 test suites
- **TypeScript Typecheck:** `npx tsc --noEmit` exited with 0 errors
- **ESLint Code Quality:** `npm run lint` exited with 0 errors, 0 warnings

### Verified Test Scenarios
- [x] Self-service profile retrieval (`getOwnProfile`) for student, faculty, and administrator.
- [x] Graceful fallback when department reference is null or unassigned.
- [x] Public directory profile projection (`getProfileById`) stripping roll numbers, enrollment numbers, and emails.
- [x] Admin profile retrieval (`AdminProfileDTO`) preserving audit fields (`provisionedBy`, `activatedAt`).
- [x] Faculty phone hidden from students when `sharePhoneWithStudents = false`.
- [x] Faculty phone visible to students when `sharePhoneWithStudents = true`.
- [x] Legacy faculty records defaulting phone sharing to `false`.
- [x] Faculty phone always visible to Directors and System Administrators.
- [x] Rejection of student callers attempting to access department rosters (HTTP 403).
- [x] Rejection of faculty callers attempting cross-department roster access (HTTP 403).
- [x] Department HOD access to assigned department student roster.
- [x] Director and System Administrator access to academic rosters across all departments.
- [x] Mass-assignment protection preventing students from elevating role or tampering with section.
- [x] Faculty self-service update of `bio` and `facultyPreferences`.
- [x] Non-HOD faculty rejection on academic update attempts (HTTP 403).
- [x] Department HOD rejection when attempting cross-department student academic updates (HTTP 403).
- [x] Department HOD allowed to update semester and section for students in their department.
- [x] Rejection of inactive or pending programs (`BCA`, `MCA`, `MTECH_CSE`) during cohort updates.
- [x] Rejection of academic program assignments to the Applied Sciences & Humanities department.

---

## 10. Outstanding Institutional Decisions

The following institutional matters remain pending project-owner clarification:
1. **BCA & MCA Programs:** Listed concurrently as confirmed and uncertain in preliminary documents. Kept marked as `isActive: false` pending formal institutional syllabus approval.
2. **M.Tech CSE Program:** Unconfirmed offering; remains inactive.
3. **Student Profile Photo Uploads:** Currently supports URL-based avatar assignments; object storage (e.g. S3 / Cloudinary) integration to be evaluated in Phase 5.3.4 / 5.3.5.

---

## 11. Manual Verification Requirements

When testing in a live or staging environment with real Clerk authentication:
1. **Verify Role Matrix:** Authenticate as a student and confirm that calling `ProfileService.getDepartmentRoster` throws `ForbiddenError`.
2. **Verify Privacy Toggle:** As a faculty member, toggle `sharePhoneWithStudents` between true and false; log in as a student to confirm phone number visibility toggles synchronously.
3. **Verify Cohort Filters:** As an HOD, query the department roster filtering by `batchYear=2024` and `section=A`; verify pagination and total count.

---

## 12. Known Limitations

1. **REST Endpoints Not Yet Mounted:** Phase 5.3.3 strictly implemented the Service and Repository layers. HTTP route handlers (`/api/v1/profile/*`) and Next.js frontend pages are scheduled for Phase 5.3.4.
2. **Enrollment Number Mutation:** As designed, enrollment numbers cannot be changed via `updateAcademicProfile`. Rare correction scenarios must be handled via direct administrative provisioning workflows.

