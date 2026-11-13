# AXIS LINKUP — FINAL PRIORITIZED BUG REGISTER
**Document ID:** `REG-BUG-002`  
**Phase:** 4.8.7 (Complete Platform-Wide UI Bug Fixing & Interaction Audit)  
**Date:** November 13, 2026  
**Status:** All Identified Bugs Resolved  

---

## 1. Prioritization Framework

- **P0 — Critical:** Security vulnerability, bypass of access controls, or broken authentication gate.
- **P1 — High:** Broken functionality, major navigation failure, or 404 dead link.
- **P2 — Medium:** Significant visual inconsistency, layout breakage, or usability defect.
- **P3 — Low:** Minor visual refinement, label discrepancy, or micro-spacing adjustment.

---

## 2. Bug Register & Resolution Ledger

### Bug ID: BUG-001
- **Severity:** `P0 — Critical`
- **Component:** `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- **Description:** Public registration was enabled by default via Clerk's public `<SignUp />` component, violating the institutional policy requiring all accounts to be administrative-provisioned only.
- **Root Cause:** Default Clerk sign-up route left open to public self-registration.
- **Resolution:** Replaced public sign-up with a Closed Administrative Provisioning Gate. Informs prospective students and faculty to contact the Registrar or use pre-provisioned credentials.
- **Verification:** Navigating to `/sign-up` shows the closed administrative gate. Tested and verified.

---

### Bug ID: BUG-002
- **Severity:** `P1 — High`
- **Component:** `src/components/auth/role-selector.tsx` & `src/app/page.tsx`
- **Description:** Landing page lacked clear persona ingress; users had no way to select their role (Student, Faculty, Administration) prior to signing in.
- **Root Cause:** Legacy landing page dropped users directly into a single generic login form.
- **Resolution:** Built a Three-Door role selector component on the landing page and `/sign-in` route with dedicated persona guidance, credentials guidelines, and role switching.
- **Verification:** Verified across all three roles; active role tabs update dynamically.

---

### Bug ID: BUG-003
- **Severity:** `P1 — High`
- **Component:** `src/config/navigation.ts` & Dashboard Quick Actions
- **Description:** Dashboard buttons referenced `/student/messages`, `/student/complaints`, `/faculty/messages`, and `/admin/messages`, but these routes did not exist prior to Phase 4.8.6.
- **Root Cause:** Navigation routes had not yet been authored.
- **Resolution:** Implemented all 6 dedicated messaging and complaints pages across student, faculty, and administration directories. Added active routes to master navigation and breadcrumb generators.
- **Verification:** All links route directly to live, interactive communication pages without 404s.

---

### Bug ID: BUG-004
- **Severity:** `P1 — High`
- **Component:** `src/app/(super-admin)/super-admin/dashboard/page.tsx`
- **Description:** Super Admin console had hardcoded legacy rose/purple accent colors and harsh dark backgrounds that clashed with the approved light-blue glassmorphism design system.
- **Root Cause:** Legacy hardcoded Tailwind classes (`bg-rose-500/10`, `ring-rose-500/30`, `text-purple-500`).
- **Resolution:** Harmonized styling to use approved light-blue design tokens (`primary`, `primary/10`, `ring-primary/20`, `glass-panel`).
- **Verification:** Visual consistency verified in both light and dark themes.

---

### Bug ID: BUG-005
- **Severity:** `P2 — Medium`
- **Component:** `src/components/chat/chat-conversation-view.tsx`
- **Description:** In broadcast-only academic groups created by faculty, enrolled students could still access the text input and attempt to submit messages.
- **Root Cause:** Missing client-side role and channel policy check on message composer.
- **Resolution:** Disabled input field and send button for students in broadcast-only groups. Rendered an explicit warning alert: *"This academic group is in Broadcast-Only mode. Only verified faculty moderators may post."*
- **Verification:** Verified student view in broadcast-only group locks input cleanly.

---

### Bug ID: BUG-006
- **Severity:** `P2 — Medium`
- **Component:** `src/components/complaints/complaint-compose-form.tsx`
- **Description:** Risk of anonymous or impersonated student grievance filings if roll number or name was editable.
- **Root Cause:** Standalone form fields without user profile binding.
- **Resolution:** Locked student name, roll number, department, and institutional email directly to the authenticated session (`UserDTO`). Displayed a "Signed Identity • Zero-Impersonation Enforced" verification banner.
- **Verification:** Student cannot edit or spoof complainant credentials.

---

### Bug ID: BUG-007
- **Severity:** `P3 — Low`
- **Component:** Dashboard Quick Actions across Student, Faculty, and Admin
- **Description:** Quick action cards displayed placeholder or disabled actions instead of highlighting live communication and grievance features.
- **Root Cause:** Legacy quick action arrays were defined before communication modules were implemented.
- **Resolution:** Updated Quick Actions to feature live links to `Collegiate Messages` and `Grievance Redressal` / `Directorate Appeals`.
- **Verification:** Verified live badges and direct ingress on all role dashboards.

---

## 3. Summary Statistics

| Total Bugs Logged | Resolved | Unresolved / Blocked |
| :---: | :---: | :---: |
| **7** | **7 (100%)** | **0** |
