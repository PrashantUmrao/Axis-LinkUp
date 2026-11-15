# Axis LinkUp — Phase 5.3.2: Profile Schemas, Model Enhancements & Academic Entity Integration
## Implementation & Verification Report

**Status:** Complete & Fully Verified  
**Date:** November 15, 2026  
**Phase:** Phase 5.3.2 — Profile Schemas, Model Enhancements & Academic Entity Integration  
**Preceding Audit:** [docs/phase-5/PHASE_5_3_1_PROFILE_ARCHITECTURE_AUDIT.md](file:///c:/Users/prash/Desktop/Axis%20LinkUp/docs/phase-5/PHASE_5_3_1_PROFILE_ARCHITECTURE_AUDIT.md)  
**Next Sub-Phase:** Phase 5.3.3 — Profile Service Layer & Access Control (Awaiting Project-Owner Approval)

---

## 1. Executive Summary

Phase 5.3.2 translates the architectural decisions approved during the Phase 5.3.1 audit into code across data models, TypeScript interfaces, Mongoose schemas, Zod validation engines, and repository layers.

All changes preserve backward compatibility for legacy records, maintain zero breaking changes to existing authentication flows (Clerk IAM, OTP, Account Activation, Password Recovery), and adhere to the strict RBAC boundaries established in earlier phases.

### Key Metrics
- **Automated Unit Tests:** 302 passed out of 302 (107 test suites), 0 failures.
- **Dedicated Phase 5.3.2 Test Suite:** 32 tests passed across 7 suites (`tests/unit/profile-model-enhancements.test.ts`).
- **TypeScript Static Verification:** `npx tsc --noEmit` passed with 0 errors.
- **ESLint Code Quality:** `npm run lint` passed with 0 errors and 0 warnings.
- **Production Build:** `npm run build` compiled all 23 application routes cleanly.

---

## 2. Approved Architectural Decisions Implemented

| Decision | Specification | Technical Implementation |
| :--- | :--- | :--- |
| **1. Academic Programs** | **Option A:** Embed approved programs in `Department`; store program code in `studentProfile`. No separate `programs` collection. | Added `programs: IDepartmentProgram[]` embedded subdocument array to `DepartmentModel`. Added `program?: string` and `admissionYear?: number` to `IStudentProfile`. Initialized approved programs for all 7 departments (`CSE`, `ECE`, `ME`, `CE`, `EE`, `IT`, `ASH`). |
| **2. Section Mutability** | Student sections cannot be modified via self-service. Only authorized Administrators and relevant HODs can update section. | Removed `studentProfile` from `updateUserProfileSchema` (self-service profile update). Added administrative section update in `adminUpdateUserSchema` and created `UserRepository.updateStudentSection(userId, section)`. |
| **3. Faculty Phone Privacy** | Phone numbers hidden from students by default. Explicit opt-in via preference toggle. | Added `sharePhoneWithStudents: boolean` (default: `false`) and `specialization: string[]` to `facultyProfile`. Indexed for rapid privacy-filtered projections. Added to self-service schema so faculty can manage preference. |
| **4. Faculty Designations** | Standardized, extensible institutional designation enum with legacy string fallback. | Exported `FACULTY_DESIGNATIONS` ('Professor', 'Associate Professor', 'Assistant Professor', 'Lab Instructor', 'Visiting Faculty') in `src/config/constants.ts`. Validated via `facultyDesignationSchema.or(z.string().trim().min(2).max(100))` to prevent legacy document parse errors. |

---

## 3. TypeScript Interfaces & Type Enhancements

### 3.1 Constants (`src/config/constants.ts`)
```typescript
export const FACULTY_DESIGNATIONS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Lab Instructor',
  'Visiting Faculty',
] as const;

export type FacultyDesignation = (typeof FACULTY_DESIGNATIONS)[number];
```

### 3.2 Department Types (`src/types/department.ts`)
```typescript
export interface IDepartmentProgram {
  code: string;
  name: string;
  isActive: boolean;
}

export interface DepartmentProgramDTO {
  code: string;
  name: string;
  isActive: boolean;
}

export interface IDepartment {
  _id: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  establishedYear?: number;
  hodId?: Types.ObjectId;
  isActive: boolean;
  programs: IDepartmentProgram[]; // Embedded academic programs
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.3 User & Profile Types (`src/types/user.ts`)
```typescript
export interface IStudentProfile {
  rollNumber: string;
  enrollmentNumber?: string;
  batchYear: number;
  currentSemester: number;
  section: string;
  program?: string;        // e.g. 'BTECH_CSE', 'MCA'
  admissionYear?: number;  // e.g. 2024
  academicMentorId?: Types.ObjectId;
  admissionType: StudentAdmissionType;
}

export interface IFacultyProfile {
  employeeId: string;
  designation: FacultyDesignation | string;
  qualifications: string[];
  cabinRoom?: string;
  assignedCourses: Types.ObjectId[];
  officeHours?: IFacultyOfficeHours;
  specialization?: string[];          // Up to 10 subject domains
  sharePhoneWithStudents?: boolean;   // Default false (privacy toggle)
}

export interface IAdminProfile {
  adminStaffId: string;
  administrativeDomain: string;
  designation?: string;               // e.g. 'Registrar', 'System Administrator'
  assignedQueueScopes: string[];
  emergencyOverridePermitted: boolean;
}

export interface UpdateUserProfileInput {
  fullName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  facultyProfile?: {
    cabinRoom?: string;
    officeHours?: IFacultyOfficeHours;
    specialization?: string[];
    sharePhoneWithStudents?: boolean;
  };
  // studentProfile removed entirely to prevent self-service section mutation
}
```

---

## 4. Mongoose Models & Schemas

### 4.1 Department Model (`src/lib/db/models/department.model.ts`)
- **Subdocument Schema:** `DepartmentProgramSchema` enforces uppercase codes, trimmed names, and boolean active status.
- **Index:** Added index on `{ 'programs.code': 1 }`.
- **RSC DTO Serialization:** `toDepartmentDTO()` maps `programs` into POJOs, eliminating Mongoose internal circular symbols.

### 4.2 User Model (`src/lib/db/models/user.model.ts`)
- **Student Profile Enhancements:**
  - `program`: `{ type: String, trim: true, uppercase: true }`
  - `admissionYear`: `{ type: Number, min: 2018, max: 2035 }`
- **Faculty Profile Enhancements:**
  - `specialization`: `[{ type: String, trim: true }]`
  - `sharePhoneWithStudents`: `{ type: Boolean, default: false }`
- **Admin Profile Enhancements:**
  - `designation`: `{ type: String, trim: true, maxlength: 100 }`
- **RSC Flight Serialization (`toUserDTO`):**
  - Maps `program`, `admissionYear`, `enrollmentNumber`, and `section` for students.
  - Maps `specialization` and defaults missing `sharePhoneWithStudents` to `false` for faculty.
  - Maps `designation` for admin profiles.

---

## 5. Indexing & Query Optimization Strategy

| Collection | Key Pattern | Index Type / Options | Purpose |
| :--- | :--- | :--- | :--- |
| `users` | `{ 'studentProfile.enrollmentNumber': 1 }` | `unique: true, sparse: true` | Prevents university enrollment collisions while allowing legacy records with null/missing values. |
| `users` | `{ 'studentProfile.program': 1, 'studentProfile.batchYear': 1 }` | Compound index | High-frequency cohort directory filtering (e.g. all 2024 CSE B.Tech students). |
| `users` | `{ 'facultyProfile.sharePhoneWithStudents': 1 }` | Single field index | Efficient filtering for student-facing faculty directory projections. |
| `departments` | `{ 'programs.code': 1 }` | Single field index | Fast lookup when validating program offerings across departments. |

---

## 6. Zod Validation & Mass-Assignment Defenses

### 6.1 User Profile Validation (`src/lib/validations/user.schema.ts`)
1. **`facultyDesignationSchema`**: Restricts to approved `FACULTY_DESIGNATIONS` with fallback string union for legacy data.
2. **`studentProfileSchema`**: Validates `program` (min 2, max 30, uppercase) and `admissionYear` (2018-2035).
3. **`updateUserProfileSchema`**:
   - **Student Section Defense:** Completely strips `studentProfile` from the input payload. Any attempt by a student to pass `studentProfile: { section: 'B' }` is discarded.
   - **Faculty Self-Management:** Permits faculty to update their `cabinRoom`, `officeHours`, `specialization` (max 10 items), and `sharePhoneWithStudents` toggle.
4. **`adminUpdateUserSchema`**:
   - Authorized administrative channel supporting mutations to `studentProfile` (`section`, `program`, `admissionYear`, `batchYear`, `currentSemester`, `rollNumber`, `enrollmentNumber`) and `facultyProfile` (`designation`, `specialization`, `sharePhoneWithStudents`).

### 6.2 Bulk Provisioning Schemas (`src/lib/validations/bulk-provision.schema.ts`)
- **`normalizeHeader`**: Recognizes `program`, `prog`, `course`, `academicprogram`, `admissionyear`, `admyear`, `enrollmentnumber`, `enrollmentid`, `specialization`, `specializations`, and `spec`.
- **`mapCsvRowToProvisionInput`**:
  - Automatically parses student `program`, `admissionYear`, and `enrollmentNumber`.
  - Automatically splits faculty semicolon-separated `specialization` (e.g. `AI; ML; Cloud`) into clean trimmed string arrays.

---

## 7. Repository Layer Integration

### 7.1 Department Repository (`src/lib/db/repositories/department.repository.ts`)
- **Default Offerings:** Populated `DEFAULT_DEPARTMENTS` with verified institutional programs:
  - `CSE`: `BTECH_CSE`, `BTECH_AIML`, `BTECH_DS`, `MCA`
  - `ECE`: `BTECH_ECE`, `BTECH_VLSI`
  - `ME`: `BTECH_ME`, `DIPLOMA_ME`
  - `CE`: `BTECH_CE`, `DIPLOMA_CE`
  - `EE`: `BTECH_EE`, `BTECH_EEE`
  - `IT`: `BTECH_IT`, `BCA`
  - `ASH`: `FY_FOUNDATION`
- **`isProgramApprovedForDepartment(deptIdOrCode, programCode)`**: Returns `{ valid: true }` if active and approved; otherwise returns explicit failure reasons (e.g. inactive, unapproved, department not found).
- **`addProgramToDepartment(deptIdOrCode, program)`**: Appends new programs with case-insensitive duplicate code rejection.
- **`setProgramStatus(deptIdOrCode, programCode, isActive)`**: Toggles activation status for program lifecycle management.

### 7.2 User Repository (`src/lib/db/repositories/user.repository.ts`)
- **`updateProfile(id, updateData)`**: Persists self-service changes to `specialization` and `sharePhoneWithStudents`. Stripped of `studentProfile.section`.
- **`updateStudentSection(userId, section)`**: Administrative atomic mutation method for student section transfers.
- **`updateStudentProgram(userId, program, admissionYear)`**: Administrative atomic mutation method for student program changes.

---

## 8. Backward Compatibility & Legacy Record Preservation

To prevent regressions across pre-existing user records and tests:
1. **No Destructive DB Migrations:** All newly introduced schema fields (`program`, `admissionYear`, `enrollmentNumber`, `specialization`) are optional.
2. **Safe Fallback Evaluation:** `toUserDTO` explicitly checks for missing or null values. For example, `sharePhoneWithStudents` evaluates safely to `false` when absent.
3. **Sparse Unique Indexing:** The `enrollmentNumber` index uses `{ sparse: true }`, ensuring legacy documents lacking university enrollment numbers do not trigger unique constraint violations.
4. **Flexible Designation Parsing:** The Zod faculty schema supports `facultyDesignationSchema.or(z.string().trim().min(2).max(100))`, allowing legacy records with arbitrary designations (e.g., `'Adjunct Lecturer'`) to be read and updated without runtime schema failures.

---

## 9. Verification & Quality Gates

### 9.1 Unit Test Suite (`tests/unit/profile-model-enhancements.test.ts`)
Comprehensive test suite with 32 assertions covering:
1. Student Profile Validation & Cohort Constraints (6 tests)
2. Faculty Profile, Designation Enum & Privacy Preferences (7 tests)
3. Department Programs Integration & Repository Helpers (7 tests)
4. Administrative Profile Designation & Sub-Role Support (2 tests)
5. Student Section Mutability & Role Permissions (5 tests)
6. Bulk Provisioning CSV Schema Mapping (3 tests)
7. Mongoose Schema Index Definitions (2 tests)

**Result:** 32 / 32 Passed (Execution time: < 1.0s).

### 9.2 Regression Test Suite (`npm test`)
Ran all 107 test suites across authentication, provisioning, OTP, password recovery, RBAC, and data models:
- **Total Tests:** 302
- **Passed:** 302
- **Failed:** 0

### 9.3 Type Check (`npx tsc --noEmit`)
- **Exit Code:** 0 (Zero TypeScript errors)

### 9.4 Linter (`npm run lint`)
- **Exit Code:** 0 (Zero ESLint warnings / errors)

### 9.5 Production Build (`npm run build`)
- **Exit Code:** 0 (All 23 Next.js routes built successfully)

---

## 10. Readiness for Phase 5.3.3

With data models, types, indexes, and validation schemas firmly in place, the system is fully prepared for **Phase 5.3.3: Profile Service Layer & Access Control**.

### Upcoming Phase 5.3.3 Scope:
1. `ProfileService.getProfile(targetUserId, callerSession)`:
   - Dynamic masking of faculty phone numbers based on role and `sharePhoneWithStudents` preference.
   - Cohort directory queries filtered by approved department programs.
2. `ProfileService.updateProfile(targetUserId, updateData, callerSession)`:
   - Self-service boundary enforcement (preventing student section mutation).
   - Administrative section/program transfer authorization (SysAdmin & department-scoped HOD).
3. End-to-end integration with `UserRepository` and `DepartmentRepository`.

*Phase 5.3.2 is complete and awaiting user review.*

