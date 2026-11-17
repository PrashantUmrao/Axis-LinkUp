# Axis LinkUp — Phase 5.7.1: Assignment Management — Backend Architecture Report

**Document Version:** 1.0.0  
**Phase:** 5.7 — Prompt 1 of 2 (Backend Foundation)  
**Date:** November 17, 2026  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary & Architecture Audit

Phase 5.7 establishes coursework lifecycle management for Axis LinkUp, enabling faculty members to author, publish, grade, and track academic assignments while allowing students to view assigned coursework, submit deliverables, track versions, and receive graded evaluations.

### Architectural Invariants & Constraints Enforced:
1. **Academic Calendar Explicit Exclusion:** In accordance with explicit system directions, the Smart Academic Calendar feature was removed entirely. No calendar models, schemas, routes, reminders, or database fields were introduced.
2. **Strict Course-Teaching Authorization (ABAC):** Faculty can **only** author assignments for courses registered in their active teaching roster (`facultyProfile.assignedCourses`). Cross-course and cross-department creation is strictly forbidden. Department HODs hold supervisory authority across all courses in their academic department. Super administrators and directors possess institutional oversight. Students are strictly forbidden from authoring coursework.
3. **Cohort-Targeted Visibility:** Assignments are targeted by semester, program, and section. Students only discover published assignments matching their academic cohort. Draft assignments are completely hidden from students.
4. **Resubmission Versioning & Immutability:** Submissions maintain complete audit histories (`history` subdocument array) with version increments. Once an evaluation is graded (`evaluation.isGraded = true`), further resubmissions are permanently locked.
5. **Evaluation Boundaries:** Faculty evaluations cannot award marks exceeding the assignment's `maxMarks`. Maximum marks cannot be modified on an assignment once any submission has been graded.
6. **Graceful Cloudinary Signed Envelope:** Signed upload parameters are generated using Cloudinary SHA-1 HMAC signatures. In development/offline environments where Cloudinary is unconfigured, an active mock fallback envelope is issued without throwing 500 errors.

---

## 2. Domain Models & Schemas

### 2.1 Assignment Model (`AssignmentModel` / `IAssignment`)
- **Collection:** `assignments`
- **File:** `src/lib/db/models/assignment.model.ts`
- **Fields:**
  - `title`: String (3–200 chars, indexed with text search)
  - `description`: String (3–5000 chars, text search)
  - `instructions`: Optional string (up to 5000 chars)
  - `courseCode`: String (e.g. `CS301`, uppercase, indexed)
  - `courseName`: String (e.g. `Advanced Data Structures`)
  - `departmentId`: ObjectId (ref: `Department`, indexed)
  - `academicTarget`:
    - `program`: Optional string (e.g. `B.TECH`)
    - `year`: Optional number (1–6)
    - `semester`: Number (1–12, indexed)
    - `section`: Optional string (e.g. `A`, indexed)
    - `batchYear`: Optional number (e.g. 2026)
  - `createdBy`: ObjectId (ref: `User`, indexed)
  - `creatorSnapshot`:
    - `fullName`: String
    - `role`: String
    - `employeeId`: Optional string
    - `avatarUrl`: Optional string
  - `attachments`: Array of attachment subdocs (`name`, `url`, `sizeBytes`, `mimeType`, `publicId`, `uploadedAt`)
  - `dueDate`: Date (indexed)
  - `maxMarks`: Number (default 100, bounded 1–1000)
  - `lateSubmissionPolicy`:
    - `allowLate`: Boolean (default `false`)
    - `lateDueDate`: Optional Date
    - `penaltyPercentagePerDay`: Number (0–100)
  - `allowResubmission`: Boolean (default `false`)
  - `maxResubmissions`: Number (default 3, max 10)
  - `status`: Enum (`draft`, `published`, `closed`, `archived`, indexed)
  - `publishedAt`, `closedAt`, `archivedAt`: Optional Dates
- **Compound Indexes:**
  - `{ departmentId: 1, 'academicTarget.semester': 1, status: 1 }`
  - `{ createdBy: 1, status: 1 }`
  - `{ status: 1, dueDate: 1 }`
  - `{ title: 'text', description: 'text', courseCode: 'text' }`

### 2.2 Submission Model (`SubmissionModel` / `ISubmission`)
- **Collection:** `submissions`
- **File:** `src/lib/db/models/submission.model.ts`
- **Fields:**
  - `assignmentId`: ObjectId (ref: `Assignment`, indexed)
  - `studentId`: ObjectId (ref: `User`, indexed)
  - `studentSnapshot`:
    - `fullName`: String
    - `rollNumber`: Optional string
    - `enrollmentNumber`: Optional string
    - `avatarUrl`: Optional string
    - `email`: String
  - `version`: Number (starts at 1)
  - `submissionText`: Optional string (up to 10,000 chars)
  - `attachments`: Array of attachment subdocs
  - `history`: Array of previous submission revisions (`version`, `submissionText`, `attachments`, `submittedAt`, `isLate`)
  - `status`: Enum (`submitted`, `resubmitted`, `graded`, `returned`)
  - `submittedAt`: Date
  - `isLate`: Boolean (computed on submission)
  - `evaluation`:
    - `marksObtained`: Number (null until evaluated)
    - `feedback`: Optional string (up to 2000 chars)
    - `evaluatedBy`: Optional ObjectId (ref: `User`)
    - `evaluatedByName`: Optional string
    - `evaluatedAt`: Optional Date
    - `isGraded`: Boolean (default `false`)
    - `releasedAt`: Optional Date
- **Unique Compound Index:**
  - `{ assignmentId: 1, studentId: 1 }` (guarantees one active submission per student per assignment)
- **Additional Indexes:**
  - `{ studentId: 1, status: 1 }`
  - `{ assignmentId: 1, 'evaluation.isGraded': 1 }`
  - `{ submittedAt: -1 }`

---

## 3. Validation & Invariants Layer

- **File:** `src/lib/validations/assignment.schema.ts`
- **Schemas Implemented:**
  - `createAssignmentSchema`: Validates full creation payload; enforces `lateDueDate >= dueDate` when late submissions are allowed.
  - `updateAssignmentSchema`: Validates partial assignment edits.
  - `submitAssignmentSchema`: Requires either textual solution or at least one valid attachment; validates 25MB attachment ceiling and permitted MIME types (PDF, Word, Excel, PowerPoint, Plaintext, Archives, Images).
  - `evaluateSubmissionSchema`: Enforces non-negative marks, optional feedback, and release grade flag.
  - `assignmentFilterSchema` & `submissionFilterSchema`: Validates cursor-based pagination and status/cohort filtering parameters.

---

## 4. Domain Service & Authorization (`AssignmentService`)

- **File:** `src/lib/services/assignment.service.ts`

### Key Methods:
| Method | Description | Access Control |
|---|---|---|
| `assertFacultyCourseAuthorization` | Checks caller teaching scope against `facultyProfile.assignedCourses` | Faculty (matching course), HOD (department), Admin |
| `createAssignment` | Authors assignment document in draft or published status | Authorized Faculty, HOD, Admin |
| `getAssignmentById` | Retrieves assignment details with submission stats or student submission status | Faculty/HOD/Admin, Cohort-matched Student |
| `updateAssignment` | Updates assignment metadata; freezes `maxMarks` if any submission is graded | Authoring Faculty, HOD, Admin |
| `publishAssignment` | Transitions draft assignment to published state | Authoring Faculty, HOD, Admin |
| `closeAssignment` | Transitions published assignment to closed state | Authoring Faculty, HOD, Admin |
| `archiveAssignment` | Archives closed assignment | Authoring Faculty, HOD, Admin |
| `deleteAssignment` | Deletes draft assignment without submissions | Authoring Faculty, HOD, Admin |
| `submitAssignment` | Creates initial submission or increments resubmission version | Enrolled Student in Target Cohort |
| `getStudentSubmission` | Retrieves student's active submission with history and evaluation | Student (own only), Authoring Faculty, HOD, Admin |
| `evaluateSubmission` | Grades submission, verifies `marksObtained <= maxMarks`, releases grade | Authoring Faculty, HOD, Admin |
| `getAssignments` | Paginated assignment query with cohort filter | Role-aware (students restricted to published cohort) |
| `getSubmissions` | Paginated submissions query for faculty review | Authoring Faculty, HOD, Admin |
| `getUploadSignature` | Generates Cloudinary signed upload envelope or mock envelope | Authenticated Student / Faculty |

---

## 5. REST API Route Handlers

All endpoints reside under `/api/v1/assignments` and integrate `requireAuth()`, Zod validation, and standard API responses:

| Endpoint | HTTP Method | Handler Location | Primary Access |
|---|---|---|---|
| `/api/v1/assignments` | `GET` | `src/app/api/v1/assignments/route.ts` | Authenticated Users |
| `/api/v1/assignments` | `POST` | `src/app/api/v1/assignments/route.ts` | Faculty / HOD |
| `/api/v1/assignments/[id]` | `GET` | `src/app/api/v1/assignments/[id]/route.ts` | Authenticated Users |
| `/api/v1/assignments/[id]` | `PATCH` | `src/app/api/v1/assignments/[id]/route.ts` | Author / HOD |
| `/api/v1/assignments/[id]` | `DELETE` | `src/app/api/v1/assignments/[id]/route.ts` | Author / HOD |
| `/api/v1/assignments/[id]/publish` | `POST` | `src/app/api/v1/assignments/[id]/publish/route.ts` | Author / HOD |
| `/api/v1/assignments/[id]/close` | `POST` | `src/app/api/v1/assignments/[id]/close/route.ts` | Author / HOD |
| `/api/v1/assignments/[id]/archive` | `POST` | `src/app/api/v1/assignments/[id]/archive/route.ts` | Author / HOD |
| `/api/v1/assignments/[id]/submissions` | `GET` | `src/app/api/v1/assignments/[id]/submissions/route.ts` | Faculty / HOD |
| `/api/v1/assignments/[id]/submissions` | `POST` | `src/app/api/v1/assignments/[id]/submissions/route.ts` | Target Students |
| `/api/v1/assignments/[id]/submissions/me` | `GET` | `src/app/api/v1/assignments/[id]/submissions/me/route.ts` | Student (Own Submission) |
| `/api/v1/assignments/[id]/submissions/[submissionId]/evaluate` | `POST` | `src/app/api/v1/assignments/[id]/submissions/[submissionId]/evaluate/route.ts` | Author / HOD |
| `/api/v1/assignments/upload-signature` | `GET` | `src/app/api/v1/assignments/upload-signature/route.ts` | Authenticated Users |

---

## 6. Real-time Notifications & Cloudinary Integration

1. **Ably Notifications:**
   - On submission: Emits `assignment.submission.received` to faculty channel (`user:<facultyId>:notifications`).
   - On evaluation: Emits `assignment.evaluated` to student channel (`user:<studentId>:notifications`).
   - Safe Fallback: If `ABLY_API_KEY` is not present, events are logged gracefully without interrupting transactions.
2. **Cloudinary Signed Envelopes:**
   - Endpoint `/api/v1/assignments/upload-signature` provides `apiKey`, `timestamp`, `signature`, `folder`, and `cloudName`.
   - If Cloudinary environment variables are absent, returns a mock envelope marked `mock: true` for development upload workflows.

---

## 7. Verification & Test Execution Results

### 7.1 Unit Test Suite (`tests/unit/assignment-backend.test.ts`)
- **Total Tests:** 46
- **Passed:** 46
- **Failed:** 0
- **Suites Covered:**
  1. Zod Validation Schemas (7 tests)
  2. Faculty Course Authorization & RBAC Boundaries (6 tests)
  3. Assignment Lifecycle & Mutation Invariants (5 tests)
  4. Student Assignment Visibility & Cohort Scoping (4 tests)
  5. Student Coursework Submissions, Deadlines & Resubmissions (5 tests)
  6. Faculty Evaluation, Marks Boundary & Grade Release (4 tests)
  7. Cloudinary Signed Upload Envelope & Fallback (2 tests)
  8. REST API Route Handlers Integration (13 tests)

### 7.2 Full Project Regression Test Suite (`npm test`)
- **Total Test Files:** 117
- **Total Test Suites:** 187
- **Total Tests:** 671
- **Passed:** 671
- **Failed:** 0
- **Regressions:** 0

### 7.3 TypeScript Typecheck (`npm run typecheck`)
- **Command:** `tsc --noEmit`
- **Result:** PASSED with 0 errors.

### 7.4 ESLint Code Quality (`npm run lint`)
- **Command:** `eslint`
- **Result:** PASSED with 0 errors and 0 warnings.

### 7.5 Production Build (`npm run build`)
- **Command:** `next build`
- **Result:** Compiled successfully in 12.8s. All 27 static/dynamic pages and 9 new assignment API routes cleanly generated.

---

## 8. Summary of Files Created & Modified

### Created Files:
1. `src/types/assignment.ts`
2. `src/lib/db/models/assignment.model.ts`
3. `src/lib/db/models/submission.model.ts`
4. `src/lib/validations/assignment.schema.ts`
5. `src/lib/db/repositories/assignment.repository.ts`
6. `src/lib/db/repositories/submission.repository.ts`
7. `src/lib/services/assignment.service.ts`
8. `src/app/api/v1/assignments/route.ts`
9. `src/app/api/v1/assignments/[id]/route.ts`
10. `src/app/api/v1/assignments/[id]/publish/route.ts`
11. `src/app/api/v1/assignments/[id]/close/route.ts`
12. `src/app/api/v1/assignments/[id]/archive/route.ts`
13. `src/app/api/v1/assignments/[id]/submissions/route.ts`
14. `src/app/api/v1/assignments/[id]/submissions/me/route.ts`
15. `src/app/api/v1/assignments/[id]/submissions/[submissionId]/evaluate/route.ts`
16. `src/app/api/v1/assignments/upload-signature/route.ts`
17. `tests/unit/assignment-backend.test.ts`
18. `docs/phase-5/PHASE_5_7_ASSIGNMENT_BACKEND_REPORT.md`

### Modified Files:
1. `src/lib/db/models/index.ts` (Exported `AssignmentModel`, `SubmissionModel`, and DTO helpers)
2. `src/lib/validations/index.ts` (Exported assignment schemas and input types)
3. `src/lib/db/repositories/index.ts` (Exported `AssignmentRepository` and `SubmissionRepository`)
4. `src/lib/services/index.ts` (Exported `AssignmentService`)

---

## 9. Remaining Risks & Prompt 2 Transition

1. **Frontend UI Scope (Prompt 2):**
   - Student Assignment Portal (tabbed feed: Active, Past Due, Submitted, Graded).
   - Student Submission Dialog with file drag-and-drop, Cloudinary direct upload, and version viewer.
   - Faculty Assignment Creator / Editor with course selector dynamically populated from `assignedCourses`.
   - Faculty Grading & Feedback modal with submission inspection, file preview links, and marks validation.
2. **Manual Configuration Needed for Production:**
   - Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` for production asset storage.
   - Configure `ABLY_API_KEY` for live notification distribution.
   - Development mock fallback ensures the system works 100% out of the box in local environments.
