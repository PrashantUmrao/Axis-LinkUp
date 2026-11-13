# Antigravity AI Development & Pairing Rules

> **Document ID:** DOC-ENG-008  
> **Status:** Mandatory Operating Standard (Phase 1, Part 1.6)  
> **Institution:** Axis Institute of Technology & Management  
> **Target Audience:** All AI Coding Agents (Antigravity) and Pair-Programming Engineers  
> **Last Updated:** November 2026  

---

## 1. Prime Directives for AI-Assisted Engineering

When contributing to **Axis LinkUp**, AI coding agents (including Antigravity) must operate as disciplined, senior software engineers. The following 15 binding rules must be adhered to at all times:

```
 1. Read Documentation First      8. Follow Approved Architecture
 2. Inspect Before Creating       9. Make Small, Reviewable Changes
 3. Never Overwrite Blindly      10. Explain All Changes & Why
 4. Never Invent Specs / Schemas 11. Report Assumptions & Questions
 5. Never Bypass Auth / Security 12. Run Verification Checks
 6. Never Hardcode Secrets       13. Never Claim Without Proof
 7. Never Duplicate Logic        14. Do Not Install Bloatware
 15. Ask When Requirements Conflict
```

---

## 2. The 15 Binding Rules

### Rule 1: Read Relevant Project Documentation Before Making Changes
Always inspect the approved specifications in `docs/requirements/`, `docs/architecture/`, `docs/database/`, and `docs/project-structure/` before planning or writing any code. The documentation is the single source of truth.

### Rule 2: Inspect Existing Code Before Creating New Files
Search the codebase (`components/`, `lib/`, `features/`) before creating a new utility, hook, or component. If a `Button`, `DataTable`, `StatusBadge`, or `formatDate` utility already exists, reuse it.

### Rule 3: Never Overwrite Working Code Without Understanding Its Purpose
Do not blindly replace working files or delete existing methods, comments, or error handlers. If refactoring is required, explain the rationale clearly and ensure backward compatibility.

### Rule 4: Never Invent API Endpoints, Database Fields, or Environment Variables
All collection names, field types, and API routes must strictly match the approved specifications in `COLLECTION_DESIGN.md` and `APP_ROUTER_STRUCTURE.md`. Never invent college business rules or unapproved database fields.

### Rule 5: Never Bypass Authentication or Authorization
Never disable route guards, strip out RBAC checks, or omit departmental scoping filters to "make a test pass" or "simplify the code". Security and role boundaries are inviolable.

### Rule 6: Never Hardcode Secrets or Credentials
Never embed API keys, database connection strings, JWT secrets, or private certificates in source files. All secrets must be referenced via validated environment variables (`src/lib/env.ts`).

### Rule 7: Never Duplicate Existing Components or Business Logic
Follow the DRY (Don't Repeat Yourself) principle. Reusable UI elements belong in `src/components/shared/` or `src/components/ui/`. Domain business rules belong strictly in Domain Services (`src/lib/services/`), never inside React components.

### Rule 8: Follow the Approved Folder Architecture
Respect the vertical feature slicing architecture. Put feature code inside `src/features/<domain>/` and export only public contracts via `index.ts`. Never introduce arbitrary new top-level directories.

### Rule 9: Make Small, Reviewable Changes
Focus on one specific task, module, or defect at a time. Avoid large, sprawling code modifications that modify dozens of unrelated files simultaneously.

### Rule 10: Explain Files Changed and Why
In every turn, provide a concise, transparent explanation of which files were modified, created, or deleted, and describe the exact technical purpose of the change.

### Rule 11: Report Assumptions and Unresolved Questions
If an edge case, institutional policy, or data dependency is ambiguous, state the assumption explicitly and log an open question rather than guessing or fabricating college policies.

### Rule 12: Run Relevant Checks After Implementation
After modifying code, execute the appropriate quality verification steps: run TypeScript compilation checks (`tsc --noEmit`), linting (`eslint`), and relevant unit tests (`vitest`).

### Rule 13: Never Claim a Feature Works Without Verification
Do not report that an endpoint, migration, or UI component is "complete and verified" unless you have executed automated tests, verified type compilation, or confirmed runtime execution.

### Rule 14: Do Not Install Unnecessary Dependencies
Only install approved packages listed in `DEPENDENCY_MATRIX.md`. Never install redundant libraries (e.g. installing `axios` when Next.js native `fetch` / Server Actions are standard; installing `moment` when `date-fns` is approved).

### Rule 15: Ask for Clarification When Requirements Conflict
If a newly requested task contradicts earlier requirements, architecture specifications, or security standards, pause and explicitly present the conflict to the human architect for guidance.

---

## 3. Practical Scenarios & Decision Guides

### Scenario A: Adding a New Field to an Existing Entity
1. **Check Documentation:** Look up the entity in `COLLECTION_DESIGN.md`. If the field is not documented, record it as a proposed recommendation.
2. **Update Zod Schema:** Add the field with strict validation rules in `src/lib/validations/<domain>.schema.ts`.
3. **Update Mongoose Schema:** Add the field in `src/lib/db/models/<domain>.model.ts` with appropriate index and type constraints.
4. **Update DTO Types:** Ensure the inferred TypeScript DTO reflects the new field automatically.

### Scenario B: Implementing a New Server Action
1. **Create/Open:** `src/app/actions/<domain>.actions.ts`.
2. **Enforce Auth:** Call `const user = await requireRole(['student'])` as the very first line.
3. **Validate:** Call `<schema>.parse(rawInput)` to validate input types.
4. **Delegate:** Invoke the corresponding method in `src/lib/services/<domain>.service.ts`.
5. **Return Envelope:** Return the result wrapped in the standard `ApiResponse<T>` envelope.

### Scenario C: Encountering an Unresolved College Policy
- **Example:** You need to know if a student can cancel a service request after it has reached "Under Review".
- **Action:** Check `FEATURE_MODULES.md` and `OPEN_QUESTIONS.md`. If unspecified, implement the safe default (e.g. Cancellation only allowed while in "Submitted" state) and explicitly state the assumption in your response so the user can confirm.

