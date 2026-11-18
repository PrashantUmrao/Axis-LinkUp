# P0 Remediation Batch 2 — Grievance RBAC Hardening, Query Overwrite Defense, SysAdmin/Director Separation & Internal Note Privacy

**Status:** Completed & Verified  
**Targeted Audit Findings:** `AUD-C01` (+ `AUD-M02` complaint regex escaping & `sortBy` allowlist), `AUD-C02` (+ HOD-to-Director boundary & student SLA-breach escalation gate), `AUD-C03`, `AUD-H01`  
**Scope Discipline:** Strictly confined to the Grievance Redressal validation schema, repository, service, and dedicated regression test suite — zero edits to MongoDB Conversation/User indexes, `EmailService`, `FileUploader`, Facilities, Chat, Passport, or Dashboard modules. Academic Calendar (MOD-10) remains permanently excluded.

---

## 1. Exact Files Modified & Created

| File | Action | Finding Addressed |
| :--- | :--- | :--- |
| `src/lib/validations/complaint.schema.ts` | Modified | `AUD-C01` — Added `COMPLAINT_SORT_FIELDS` (`createdAt`, `updatedAt`, `priority`, `status`, `sla.deadline`) and constrained `complaintQuerySchema.sortBy` to `z.enum(COMPLAINT_SORT_FIELDS)` |
| `src/lib/db/repositories/complaint.repository.ts` | Modified | `AUD-C01`, `AUD-M02`, `AUD-C02` — Added `escapeComplaintRegex()` and `buildComplaintQueryFilter()` combining immutable `baseFilter` + caller filters via `$and`; restricted `departmentId`/`recipientRole` query params to `{ allowScopeFilters: true }` (Director & SysAdmin only); added `findAssignedComplaints(assigneeId, params)`; enforced `ALLOWED_COMPLAINT_SORT_SET` allowlist |
| `src/lib/services/complaint.service.ts` | Modified | `AUD-C02`, `AUD-C03`, `AUD-H01` — Unified role predicates (`isDirectorUser`, `isSystemAdminUser`, `isDepartmentHodUser`, `isRegularFacultyUser`), fail-closed `resolveHodDepartmentId()`, centralized `projectComplaintForSession()` DTO redaction & internal note stripping, assigned-only regular faculty isolation, HOD-vs-Director boundary, SysAdmin read-only metadata enforcement (403 on all mutations), student `isInternal: false` coercion & internal timeline isolation, and statutory SLA-breach prerequisite on student self-escalation |
| `tests/unit/p0-batch2-complaints-remediation.test.ts` | Created | 20 dedicated security regression tests covering `AUD-C01`, `AUD-M02`, `AUD-C02`, `AUD-C03`, `AUD-H01`, and student SLA-breach escalation across repository, service, schema, and Next.js REST route handlers |

> **Legacy Test Compatibility:** Zero modifications were required in `tests/unit/complaints-backend.test.ts` or `tests/unit/complaints-frontend-integration.test.ts` — all **45 / 45** existing grievance tests continue passing with zero weakened security checks.

---

## 2. Before vs. After Security Posture

| Finding | Before (Vulnerable) | After (Remediated) |
| :--- | :--- | :--- |
| **`AUD-C01` Query Overwrite, ReDoS & Unbounded Sort (`AUD-M02`)** | `queryWithFilters` mutated a shallow copy of `baseFilter`, allowing callers (`GET /api/v1/complaints?departmentId=<OTHER>&recipientRole=director`) to overwrite HOD/student isolation boundaries or clobber Director `$or` filters with `search`. Raw `new RegExp(params.search, 'i')` crashed on malformed regexes and risked ReDoS. `sortBy` accepted arbitrary strings. | `buildComplaintQueryFilter()` wraps immutable `baseFilter` and caller predicates inside `{ $and: [baseFilter, ...userConditions] }`. Scope filters (`departmentId`, `recipientRole`) are completely ignored unless `{ allowScopeFilters: true }` (Director / SysAdmin only). `escapeComplaintRegex()` escapes all regex metacharacters. `sortBy` is strictly validated against `COMPLAINT_SORT_FIELDS` at both Zod and repository layers. |
| **`AUD-C02` Regular Faculty HOD Escalation, HOD -> Director Leakage & Premature Escalation** | Non-HOD `faculty` were grouped into HOD departmental branches across `getComplaints`, `getComplaintById`, `addResponse`, `escalateComplaint`, `getStats`, and `assertCanAccessComplaint`. HODs could read/mutate same-department `recipientRole: 'director'` complaints by ID. Unassigned HODs lacked fail-closed enforcement. Students could self-escalate before SLA breach. | Regular non-HOD `faculty` (`role === 'faculty' && adminSubRole !== 'hod'`) route exclusively to `findAssignedComplaints(session.userId, params)`, may ONLY read/respond to explicitly assigned tickets (`assignedTo.id === session.userId`), and receive HTTP `403` on `updateStatus`, `escalateComplaint`, `assignComplaint`, and `getStats`. HODs fail closed (`403`) if `departmentId` is missing and are strictly blocked (`403`) from `recipientRole: 'director'` complaints even in their own department. Student self-escalation requires `sla.isBreached === true` or `deadline < Date.now()`. |
| **`AUD-C03` System Admin / Director Conflation & Incomplete Redaction** | Root `super_admin` (`adminSubRole: undefined`) and `sys_admin` retained mutation paths (`addResponse`, `updateStatus`, `assignComplaint`, `escalateComplaint`), and read redaction only masked `narrative`/`description`, leaving `subject`, `responses`, `attachments`, `detailedAttachments`, `escalation.reason`, and `timeline[].remarks` exposed. | `isSystemAdminUser` classifies BOTH `adminSubRole === 'sys_admin'` AND root `super_admin` (`adminSubRole !== 'director'`). All 4 mutation methods (`addResponse`, `updateStatus`, `assignComplaint`, `escalateComplaint`) immediately throw `ForbiddenError` (`403`). On read (`getComplaints`, `getComplaintById`), `projectComplaintForSession()` redacts `subject`, `narrative`, `description`, `responses: []`, `attachments: []`, `detailedAttachments: []`, `escalation.reason`, and `timeline[].remarks = '[REDACTED]'` while retaining governance telemetry metadata. Executive Director (`adminSubRole === 'director'`) retains full ombudsman read & adjudication authority. |
| **`AUD-H01` Confidential Internal Tribunal Notes Exposure** | `toComplaintDTO()` returned all `responses` (including `isInternal: true` internal tribunal notes) to students, and `addResponse()` trusted caller-supplied `input.isInternal` for students and copied `actionTaken` into public timeline remarks even on internal notes. | `projectComplaintForSession()` strips all `r.isInternal === true` responses and `INTERNAL_TRIBUNAL_NOTE` timeline events from every DTO returned to students (`getComplaints`, `getComplaintById`, `addResponse`, `updateStatus`, `escalateComplaint`). In `addResponse()`, student submissions strictly coerce `isInternal: false`, and authority internal notes record a neutral `INTERNAL_TRIBUNAL_NOTE` timeline entry without leaking `actionTaken` or prematurely flipping status. |

---

## 3. Verification Results

| Gate | Command | Result |
| :--- | :--- | :--- |
| TypeScript Strict Check | `npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 errors |
| ESLint | `npm run lint` (`eslint`) | **PASS** — 0 errors, 0 warnings |
| Targeted Grievance Suites | `npx tsx --test tests/unit/p0-batch2-complaints-remediation.test.ts tests/unit/complaints-backend.test.ts tests/unit/complaints-frontend-integration.test.ts` | **65 / 65 PASS** (45 existing + 20 new P0 Batch 2 tests) |
| Full Unit Regression Suite | `npm test` | **862 / 862 PASS** across 262 suites (+20 new P0 Batch 2 tests, 0 failures) |
| Cross-Module Integration Suite | `npm run test:integration` | **5 / 5 PASS** (0 failures) |
| Combined Test Suite | `npm run test:all` | **867 / 867 PASS** (0 failures) |
| Production Build | `npm run build` (`next build`) | **PASS** — Compiled cleanly in 15.4s; 39/39 static pages + all dynamic routes & middleware (`93.5 kB`) |
