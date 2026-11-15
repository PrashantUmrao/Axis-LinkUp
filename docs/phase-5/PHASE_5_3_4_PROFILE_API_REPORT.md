# Phase 5.3.4: Profile REST API Development & Integration — Implementation Report

**Project:** Axis LinkUp — College Communication and Productivity Platform  
**Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Phase:** 5.3.4 — Profile REST API Layer, Information Privacy & Roster Endpoints  
**Status:** Completed  
**Date:** November 15, 2026  

---

## 1. API Architecture

Phase 5.3.4 exposes the centralized `ProfileService` (`src/lib/services/profile.service.ts`) through secure, validated Next.js Route Handlers without duplicating business logic, permission gates, or data projections.

```
                              +---------------------------------------+
                              |         Client / Browser / RSC        |
                              +---------------------------------------+
                                                  |
                                                  v
                              +---------------------------------------+
                              |         Next.js Route Handlers        |
                              |             (/api/v1/...)             |
                              +---------------------------------------+
                                    |                     |
                   +----------------+                     +----------------+
                   | (Session & Gates)                                     | (Domain Logic)
                   v                                                       v
+---------------------------------------+               +---------------------------------------+
|       Server Auth & RBAC Engine       |               |            ProfileService             |
|   (requireAuth, UserSession claims)   |               |   - getOwnProfile                     |
+---------------------------------------+               |   - updateOwnProfile                  |
                                                        |   - getProfileById                    |
                                                        |   - getDepartmentRoster               |
                                                        |   - updateAcademicProfile             |
                                                        +---------------------------------------+
                                                                   |                 |
                                                  +----------------+                 +----------------+
                                                  v                                                   v
                               +-------------------------------------+             +-------------------------------------+
                               |           UserRepository            |             |        DepartmentRepository         |
                               +-------------------------------------+             +-------------------------------------+
```

### Key Architectural Tenets
1. **Delegation by Design:** Route Handlers parse HTTP transport structures (JSON bodies, URL query parameters, dynamic path params) and directly delegate authorization and domain processing to `ProfileService`.
2. **Deny-by-Default Authorization:** Every profile route requires active session authentication via `requireAuth()`. Unauthenticated requests immediately yield HTTP 401; suspended or deactivated accounts yield HTTP 403.
3. **Context-Aware Projections:** Raw MongoDB documents are never exposed over HTTP. Responses are serialized into strictly allowlisted DTOs (`OwnerProfileDTO`, `DirectoryProfileDTO`, `AdminProfileDTO`, `RosterStudentDTO`).
4. **Standardized Envelopes:** All responses adhere to `ApiSuccessResponse<T>` and RFC 7807-compatible `ApiErrorResponse` structures via centralized utilities.

---

## 2. Routes Implemented

| HTTP Method | Route Path | Description | Access Level |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/profile/me` | Retrieves caller's own full profile (`OwnerProfileDTO`) | Any authenticated active user |
| **PATCH** | `/api/v1/profile/me` | Updates self-service fields (`bio`, `phoneNumber`, `facultyPreferences`) | Any authenticated active user |
| **GET** | `/api/v1/users/[id]/profile` | Retrieves context-aware profile for target user ID (`DirectoryProfileDTO` / `AdminProfileDTO`) | Any authenticated active user |
| **GET** | `/api/v1/departments/[id]/roster` | Retrieves cohort student roster with cursor/page pagination | Department Faculty, HOD, Director, System Admin (Students denied) |
| **PATCH** | `/api/v1/admin/users/[id]/academic-profile` | Updates student cohort fields (`currentSemester`, `section`, `batchYear`, `program`) | Department HOD (own dept) and System Admin |

---

## 3. Authentication & Authorization Rules

### Separation of Powers & Role Scopes

| Role & Sub-Role | `GET /profile/me` | `PATCH /profile/me` | `GET /users/[id]/profile` | `GET /departments/[id]/roster` | `PATCH /admin/users/[id]/academic-profile` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Student** | Full Owner DTO | Self-service only | Directory DTO (phone masked unless opt-in) | **403 Forbidden** | **403 Forbidden** |
| **Faculty (Standard)** | Full Owner DTO | Self-service + Preferences | Directory DTO (phone masked) | **Own Department Only** | **403 Forbidden** |
| **HOD (`admin/hod`)** | Full Owner DTO | Self-service + Preferences | Full DTO in dept; Directory DTO cross-dept | **Own Department Only** | **Own Dept Students Only** |
| **Director (`admin/director`)** | Full Owner DTO | Self-service only | Directory DTO (oversight context) | **All Departments** | **403 Forbidden** (Policy Restriction) |
| **System Admin (`super_admin`)** | Full Owner DTO | Self-service only | Full Admin DTO (with audit metadata) | **All Departments** | **All Departments** |

> [!IMPORTANT]
> **Director Scope Invariant:** Directors possess read-only institutional oversight over academic rosters across departments. However, Directors **cannot mutate** student cohort fields via `PATCH /api/v1/admin/users/[id]/academic-profile`. Attempting to do so yields an explicit HTTP 403 Forbidden response.

---

## 4. DTO Response Contracts

### 1. `OwnerProfileDTO` (Self View)
Returned by `GET /api/v1/profile/me` and `PATCH /api/v1/profile/me`:
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "6730a005f8b1a2001a000001",
    "email": "aarav.sharma@axiscolleges.in",
    "username": "aarav.sharma",
    "fullName": "Aarav Sharma",
    "role": "student",
    "status": "active",
    "isEmailVerified": true,
    "isProfileComplete": true,
    "phoneNumber": "+919876543201",
    "avatarUrl": null,
    "departmentId": "6730a005f8b1a2001a000010",
    "departmentName": "Computer Science and Engineering",
    "departmentCode": "CSE",
    "studentProfile": {
      "rollNumber": "24BCSE101",
      "enrollmentNumber": "EN202401",
      "program": "BTECH_CSE",
      "batchYear": 2026,
      "currentSemester": 3,
      "section": "A",
      "admissionType": "regular"
    },
    "createdAt": "2024-08-01T00:00:00.000Z",
    "updatedAt": "2024-08-01T00:00:00.000Z"
  },
  "error": null,
  "timestamp": "2026-11-15T04:10:00.000Z"
}
```

### 2. `DirectoryProfileDTO` (Public / Peer View)
Returned by `GET /api/v1/users/[id]/profile`:
```json
{
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "id": "6730a005f8b1a2001a000002",
    "fullName": "Dr. Ananya Sen",
    "username": "ananya.sen",
    "role": "faculty",
    "avatarUrl": null,
    "departmentId": "6730a005f8b1a2001a000010",
    "departmentName": "Computer Science and Engineering",
    "departmentCode": "CSE",
    "designation": "Associate Professor",
    "cabinRoom": "Block B, Room 204",
    "officeHours": null,
    "specialization": ["Machine Learning", "Data Mining"],
    "phoneNumber": null
  },
  "error": null,
  "timestamp": "2026-11-15T04:10:00.000Z"
}
```

### 3. `RosterStudentDTO` (Cohort View)
Returned within `GET /api/v1/departments/[id]/roster`:
```json
{
  "success": true,
  "message": "Department academic roster retrieved successfully",
  "data": {
    "department": {
      "id": "6730a005f8b1a2001a000010",
      "name": "Computer Science and Engineering",
      "code": "CSE"
    },
    "totalStudents": 45,
    "page": 1,
    "limit": 50,
    "nextCursor": null,
    "hasMore": false,
    "students": [
      {
        "id": "6730a005f8b1a2001a000001",
        "fullName": "Aarav Sharma",
        "username": "aarav.sharma",
        "role": "student",
        "departmentId": "6730a005f8b1a2001a000010",
        "departmentName": "Computer Science and Engineering",
        "departmentCode": "CSE",
        "program": "BTECH_CSE",
        "rollNumber": "24BCSE101",
        "enrollmentNumber": "EN202401",
        "batchYear": 2026,
        "currentSemester": 3,
        "section": "A",
        "avatarUrl": null
      }
    ]
  },
  "error": null,
  "timestamp": "2026-11-15T04:10:00.000Z"
}
```

---

## 5. Privacy Enforcement & Mass-Assignment Defense

1. **Faculty Phone Privacy Matrix:**
   - When a student calls `GET /api/v1/users/[facultyId]/profile`, `phoneNumber` is populated **only if** `facultyProfile.sharePhoneWithStudents === true`. Otherwise, it is returned as `null`.
   - In cross-department directory searches, phone numbers remain masked.
   - System Administrators always have unmasked access for official and emergency coordination.
2. **Mass-Assignment Defense:**
   - `PATCH /api/v1/profile/me` uses `selfServiceProfileUpdateSchema`.
   - If a malicious student caller submits `role: "super_admin"`, `departmentId: "..."`, or `studentProfile: { section: "Z" }`, these fields are automatically discarded before persistence.
3. **Academic Identifier Immutability:**
   - `rollNumber` and `enrollmentNumber` are institutional registry identifiers and cannot be modified via `PATCH /api/v1/admin/users/[id]/academic-profile`.
4. **Academic Program Compatibility:**
   - Assigning unconfirmed/pending programs (`BCA`, `MCA`, `MTECH_CSE`) fails validation with HTTP 400 Bad Request.
   - Assigning academic degree programs to Applied Sciences & Humanities (`ASH`) fails validation with HTTP 400 Bad Request.

---

## 6. Files Created & Modified

### Created
1. `src/app/api/v1/profile/me/route.ts`: Handlers for `GET` (own profile) and `PATCH` (self-service profile update).
2. `src/app/api/v1/users/[id]/profile/route.ts`: Handler for `GET` (context-aware target user profile projection).
3. `src/app/api/v1/departments/[id]/roster/route.ts`: Handler for `GET` (paginated department academic roster).
4. `src/app/api/v1/admin/users/[id]/academic-profile/route.ts`: Handler for `PATCH` (administrative academic cohort mutations).
5. `tests/unit/profile-api.test.ts`: 22 automated integration tests covering all routes, permissions, and validation scenarios.
6. `docs/phase-5/PHASE_5_3_4_PROFILE_API_REPORT.md`: This comprehensive implementation report.

### Modified
1. `src/lib/auth/server.ts`: Added `__setTestSession` test helper for isolated route testing without live network Clerk dependencies.
2. `src/types/profile.ts`: Added `cursor` support to `RosterQueryOptions`, added `nextCursor` and `hasMore` to `PaginatedRosterResponse`.
3. `src/lib/validations/user.schema.ts`: Added `departmentRosterQuerySchema` and exported `DepartmentRosterQueryParams`.
4. `src/lib/db/repositories/user.repository.ts`: Enhanced `findDepartmentRoster` with cursor pagination support and metadata calculation.
5. `src/lib/services/profile.service.ts`: Updated `getDepartmentRoster` to forward cursor and pagination options.

---

## 7. Integration Test Results

- **Test Suite:** `tests/unit/profile-api.test.ts`
- **Total Tests:** 22/22 passed (0 failures)
- **Execution Time:** ~1.5s

### Verified API Scenarios
- [x] `GET /api/v1/profile/me`: Authenticated student retrieves full `OwnerProfileDTO`.
- [x] `GET /api/v1/profile/me`: Unauthenticated request returns HTTP 401 Unauthorized.
- [x] `GET /api/v1/profile/me`: Suspended account returns HTTP 403 Forbidden.
- [x] `PATCH /api/v1/profile/me`: Successfully updates whitelisted bio and phone number.
- [x] `PATCH /api/v1/profile/me`: Mass-assignment attempts (`role`, `departmentId`, `section`) are stripped.
- [x] `GET /api/v1/users/[id]/profile`: Malformed ObjectId returns HTTP 400 Bad Request.
- [x] `GET /api/v1/users/[id]/profile`: Non-existent user ID returns HTTP 404 Not Found.
- [x] `GET /api/v1/users/[id]/profile`: Faculty phone hidden from student when `sharePhoneWithStudents = false`.
- [x] `GET /api/v1/users/[id]/profile`: Faculty phone visible to student when `sharePhoneWithStudents = true`.
- [x] `GET /api/v1/users/[id]/profile`: System Administrator receives `AdminProfileDTO` with audit fields.
- [x] `GET /api/v1/departments/[id]/roster`: Student caller receives HTTP 403 Forbidden.
- [x] `GET /api/v1/departments/[id]/roster`: HOD querying different department receives HTTP 403 Forbidden.
- [x] `GET /api/v1/departments/[id]/roster`: HOD querying own department receives HTTP 200 with roster students.
- [x] `GET /api/v1/departments/[id]/roster`: Director querying any department receives HTTP 200 (institutional oversight).
- [x] `GET /api/v1/departments/[id]/roster`: Rejects out-of-bounds query parameters (`limit=250`) with HTTP 400.
- [x] `GET /api/v1/departments/[id]/roster`: Supports cursor-based pagination parameters (`cursor`, `limit`).
- [x] `PATCH /api/v1/admin/users/[id]/academic-profile`: Student/faculty caller receives HTTP 403 Forbidden.
- [x] `PATCH /api/v1/admin/users/[id]/academic-profile`: Director caller receives HTTP 403 Forbidden (policy restriction).
- [x] `PATCH /api/v1/admin/users/[id]/academic-profile`: HOD updating student in different department receives HTTP 403.
- [x] `PATCH /api/v1/admin/users/[id]/academic-profile`: HOD updates section/semester in own department with HTTP 200 and audit log.
- [x] `PATCH /api/v1/admin/users/[id]/academic-profile`: Rejects inactive/pending programs (`BCA`) with HTTP 400.
- [x] `PATCH /api/v1/admin/users/[id]/academic-profile`: Rejects program assignments to ASH with HTTP 400.

---

## 8. Quality Gate Results

| Check | Tool / Command | Result |
| :--- | :--- | :--- |
| **Unit & Integration Tests** | `npm test` | **353/353 passed** across 80 test suites |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **0 errors** |
| **ESLint Code Quality** | `npm run lint` | **0 errors, 0 warnings** |
| **Next.js Production Build** | `npm run build` | **All 27 routes compiled successfully** |

---

## 9. Manual Testing Checklist

When testing against live Clerk sessions and MongoDB Atlas:

1. **Self-Service Verification (`/api/v1/profile/me`):**
   - [ ] Log in as a student; send `GET /api/v1/profile/me`. Confirm full owner details return.
   - [ ] Send `PATCH /api/v1/profile/me` with `{"bio": "New bio", "role": "super_admin"}`. Confirm bio updates and role remains unchanged.
2. **Faculty Phone Privacy Verification (`/api/v1/users/[id]/profile`):**
   - [ ] As a faculty member, set `sharePhoneWithStudents = false` via `PATCH /api/v1/profile/me`.
   - [ ] As a student, view the faculty profile via `GET /api/v1/users/[facultyId]/profile`. Confirm `phoneNumber` is `null`.
   - [ ] As the faculty member, set `sharePhoneWithStudents = true`.
   - [ ] Re-fetch as the student. Confirm `phoneNumber` is now visible.
3. **Department Roster Verification (`/api/v1/departments/[id]/roster`):**
   - [ ] Log in as a student and attempt to fetch any department roster. Confirm HTTP 403 Forbidden.
   - [ ] Log in as CSE HOD and fetch CSE roster. Confirm HTTP 200 with student cohort list.
   - [ ] As CSE HOD, attempt to fetch ECE roster. Confirm HTTP 403 Forbidden.
   - [ ] Log in as Director. Confirm ability to fetch rosters across all departments.
4. **Academic Updates (`/api/v1/admin/users/[id]/academic-profile`):**
   - [ ] As CSE HOD, update section for a CSE student. Confirm HTTP 200.
   - [ ] As CSE HOD, attempt to change student program to `BCA`. Confirm HTTP 400 rejection (inactive program).
   - [ ] As Director, attempt to update a student's section. Confirm HTTP 403 rejection.

---

## 10. Known Limitations

1. **Frontend UI Not Yet Mounted:** Phase 5.3.4 focused strictly on the REST API layer and server-side authorization. Frontend user profile components, roster tables, and settings forms will be integrated in Phase 5.3.5.
2. **Avatar Binary Uploads:** `avatarUrl` currently accepts validated image URLs. Direct object storage uploads (e.g. presigned S3 / Cloudinary URLs) will be evaluated in subsequent media storage phases.

