# Faculty Dashboard Design & Information Architecture
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Information Architecture & Design Philosophy

The **Faculty Dashboard** (`/faculty/dashboard`), designated as the **Faculty Academic Cockpit**, serves as the central instructional management hub for teaching faculty, professors, and academic mentors at **Axis Institute of Technology & Management (AITM)**.

Built on the **Glassmorphism Design System** (Part 4.1), encapsulated within the **Global Application Shell** (Part 4.2), and styled with the approved **emerald accent palette** (`text-emerald-500`, `bg-emerald-500/10`), the cockpit delivers an elegant, high-clarity instructional environment tailored to curriculum delivery, grading rubrics, classroom announcements, and student cohort oversight.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Global AppShell (<AppShell user={session}>)                           │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ FacultyWelcomeBanner                                               │ │
│ │ • Avatar + Professor Name • Designation • Employee ID • Indian Date│ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ FacultyMetricsOverview (4-Column Responsive Grid)                  │ │
│ │ [Teaching Allocations] [Evaluations Queue] [Notices] [ABAC Verified]│ │
│ ├──────────────────────────────────┬─────────────────────────────────┤ │
│ │ Main Instructional Column (Col 2)│ Cohort & Schedule Column (Col 1)│ │
│ │ • FacultyClassRoster             │ • FacultyStudentOverview        │ │
│ │ • FacultyAssignmentManagement    │ • FacultyAcademicCalendar       │ │
│ │ • FacultyNoticeSection           │ • FacultyRecentActivity         │ │
│ │ • FacultyQuickActions            │ • Departmental Boundary Card    │ │
│ └──────────────────────────────────┴─────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Server-Authoritative Security & ABAC Ingress

### 2.1 Role-Gated Ingress Security
The faculty dashboard route is a **Next.js Server Component** protected by Tier-2 authorization:
```typescript
const session = await requireRole(['faculty', 'super_admin']);
```
- Unauthenticated requests are rejected and redirected to `/sign-in`.
- Suspended faculty accounts are redirected to `/account-suspended`.
- Pending verification accounts are redirected to `/pending-approval`.
- Unauthorized roles (e.g. students, unprivileged staff) are redirected to `/unauthorized`.
- Client-submitted role claims are **never trusted**.

### 2.2 Attribute-Based Access Control (ABAC) & Departmental Isolation
In accordance with `DOC-AUTH-005` (RBAC & Permission Matrix), faculty permissions operate under fine-grained scoping:
- **`OWN` Scope (Instructor Ownership):** Coursework grading (`assignments:create_grade`), class discussions (`chat:send_course_message`), and interactive polling (`polls:create_course`) require the faculty member's `userId` to match the course instructor assignment. Cross-faculty gradebook tampering is strictly prohibited.
- **`DEPT` Scope (Departmental Boundary):** Course notices (`notices:publish_course`) and timetable allocations are strictly bounded to the faculty member's assigned academic department (`departmentId`).

### 2.3 Authoritative Profile Ingestion
The faculty profile is retrieved from MongoDB Atlas using `UserRepository.findById(session.userId)` and sanitized via `toUserDTO()`:
- `fullName`: Displayed across greetings, banners, and profile cards.
- `facultyProfile.employeeId`: Institutional staff identifier (e.g. `FAC-084920`).
- `facultyProfile.designation`: Academic title (e.g. `Associate Professor`).
- `facultyProfile.cabinRoom`: Faculty cabin and consultation office.
- `facultyProfile.assignedCourses`: Array of linked course IDs.
- `facultyProfile.officeHours`: Consultation schedule.

---

## 3. Truth-in-UI & Anti-Hallucination Standards

To strictly adhere to engineering standards prohibiting fake data or phantom features:
1. **No Fabricated Academic Metrics:** Cards do not fabricate metrics like "18 assignments awaiting evaluation" or "240 students enrolled". Instead, they report authentic standing ("0 Pending", "Queue Clear", "ABAC Verified").
2. **Phase 5 Modules Handled Gracefully:**
   - **Teaching Allocations:** Inlines a frosted glass `EmptyState` explaining that course section allocations, batch timetables, and syllabus modules link upon semester academic scheduling in Phase 5.
   - **Gradebook & Evaluations:** Inlines an `EmptyState` explaining that coursework submission dropboxes and rubrics activate in Phase 5.
   - **Cohort Oversight:** Inlines an `EmptyState` explaining that student rosters and submission velocities populate upon course linking in Phase 5.
   - **Bulletins:** Inlines an `EmptyState` explaining that official faculty circulars activate in Phase 5.
   - **Quick Actions:** Live routes (`/shared/profile`, `/ui-preview`) are active links; upcoming features (`/faculty/notices`, `/faculty/assignments`, `/faculty/polls`, `/faculty/calendar`) are clearly rendered as disabled with `Phase 5` badges and hover tooltips.

---

## 4. Responsive Layout Breakpoints

| Breakpoint Tier | Container Grid | Left Column (`lg:col-span-2`) | Right Column (`lg:col-span-1`) |
| :--- | :--- | :--- | :--- |
| **Desktop (`≥ 1024px`)** | 3-Column asymmetric grid | Class Roster, Assignments, Notices, and Quick Actions stacked vertically. | Student Overview, Calendar, Recent Activity, and Departmental Boundary card stacked vertically. |
| **Tablet (`768px – 1023px`)** | 2-Column adaptable grid | Metric cards display in a 2x2 grid. Sections stack sequentially. | Calendar and Activity cards expand to full tablet width. |
| **Mobile (`< 768px`)** | 1-Column fluid stack | Single-column stacking with edge-to-edge padding (`px-4`). Touch-friendly tap targets (`min-h-[44px]`). | All secondary widgets stack beneath primary sections with zero horizontal overflow. |

---

## 5. Visual Quality & Accessibility (WCAG 2.1 AA)

- **Surface Tokens:** Frosted glass cards utilize `.glass-panel` and `variant="glass"` (`rgba(255,255,255,0.72)` light / `rgba(24,35,52,0.70)` dark, `backdrop-blur-md`).
- **Emerald Accent Hierarchy:** Conforms to `ROLE_PORTAL_METADATA.faculty.badgeVariant = 'success'` with `#10b981` accents, specular border highlights, and low-glare dark surfaces.
- **Contrast Ratios:** All text elements exceed the 4.5:1 minimum contrast requirement across both Light and Dark themes.
- **Semantic Structure:** Follows an accessible document outline (`h1` for faculty welcome, `h2` / `h3` for section titles, semantic `<nav>` and `<time>` tags).

