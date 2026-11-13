# Student Dashboard Design & Information Architecture
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Information Architecture & Design Philosophy

The **Student Dashboard** (`/student/dashboard`) serves as the central academic operational hub for enrolled students at **Axis Institute of Technology & Management (AITM)**.

Built on the **Glassmorphism Design System** (Part 4.1) and encapsulated within the **Global Application Shell** (Part 4.2), the dashboard delivers high clarity, low cognitive load, and instant access to academic status, official circulars, coursework dropboxes, and institutional credentials.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Global AppShell (<AppShell user={session}>)                           │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ StudentWelcomeBanner                                               │ │
│ │ • Avatar + Real Name • Greeting • Roll No / Semester • Indian Date │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ StudentMetricsOverview (4-Column Responsive Grid)                  │ │
│ │ [Academic Standing] [Coursework Due] [Bulletins] [IAM Verified]    │ │
│ ├──────────────────────────────────┬─────────────────────────────────┤ │
│ │ Main Split (Col-Span 2)          │ Secondary Column (Col-Span 1)   │ │
│ │ • StudentNoticeFeed              │ • StudentAcademicCalendar       │ │
│ │ • StudentAssignmentOverview      │ • StudentRecentActivity         │ │
│ │ • StudentQuickActions            │ • Institutional Boundary Card   │ │
│ └──────────────────────────────────┴─────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Server-Authoritative Data Integration

### 2.1 Ingress Security & Role Authorization
The student dashboard route is a **Next.js Server Component** guarded by Tier-2 authorization:
```typescript
const session = await requireRole(['student', 'super_admin']);
```
- Unauthenticated requests are rejected and redirected to `/sign-in`.
- Suspended accounts are redirected to `/account-suspended`.
- Pending verification accounts are redirected to `/pending-approval`.
- Unauthorized roles (e.g. faculty, unprivileged admin) are redirected to `/unauthorized`.
- Client-side role claims are **never trusted**.

### 2.2 Profile Query & Sanitization
The authoritative student document is retrieved directly from MongoDB Atlas using `UserRepository.findById(session.userId)` and transformed via `toUserDTO()`:
- `fullName`: Displayed across greetings, banners, and profile cards.
- `studentProfile.rollNumber`: Institutional identifier (e.g. `STU-059984`).
- `studentProfile.currentSemester`: Active academic semester.
- `studentProfile.batchYear`: Graduation cohort (e.g. `Batch 2024`).
- `studentProfile.section`: Departmental section assignment.
- `avatarUrl`: Hosted profile picture or automated initials fallback (`AvatarFallback`).

### 2.3 Database Fallback Resiliency
If the database connection is delayed or a webhook synchronization is currently pending, the dashboard gracefully constructs a safe fallback `UserDTO` from authenticated session claims, guaranteeing zero runtime crashes.

---

## 3. Truth-in-UI & Anti-Hallucination Standards

To strictly adhere to engineering standards prohibiting fake data or phantom features:
1. **No Invented Metrics:** Cards do not fabricate metrics like "14 assignments overdue" or "92% attendance". Instead, they report authentic standing ("0 Pending", "All Clear", "Active / Verified").
2. **Phase 5 Modules Handled Gracefully:**
   - **Campus Notices:** Renders an elegant frosted glass `EmptyState` explaining that official bulletin feeds and emergency broadcast channels activate in Phase 5.
   - **Assignments:** Renders an `EmptyState` explaining that coursework dropboxes and rubrics synchronize when instructors upload modules in Phase 5.
   - **Calendar:** Renders an interactive calendar day grid with today highlighted, showing an empty schedule slot for upcoming exams.
   - **Quick Actions:** Live routes (`/shared/profile`, `/ui-preview`) are active links; upcoming features (`/student/notices`, `/student/assignments`, `/student/calendar`, `/student/requests`) are clearly rendered as disabled with `Phase 5` badges and hover tooltips.

---

## 4. Responsive Layout Breakpoints

| Breakpoint Tier | Container Grid | Left Column (`lg:col-span-2`) | Right Column (`lg:col-span-1`) |
| :--- | :--- | :--- | :--- |
| **Desktop (`≥ 1024px`)** | 3-Column asymmetric grid | Notices, Assignments, and Quick Actions stacked vertically. | Calendar, Recent Activity, and Campus IAM card stacked vertically. |
| **Tablet (`768px – 1023px`)** | 2-Column adaptable grid | Metric cards display in a 2x2 grid. Sections stack sequentially. | Calendar and Activity cards expand to full tablet width. |
| **Mobile (`< 768px`)** | 1-Column fluid stack | Single-column stacking with edge-to-edge padding (`px-4`). Touch-friendly tap targets (`min-h-[44px]`). | All secondary widgets stack beneath primary sections with zero horizontal overflow. |

---

## 5. Visual Quality & Accessibility (WCAG 2.1 AA)

- **Surface Tokens:** Frosted glass cards utilize `.glass-panel` and `variant="glass"` (`rgba(255,255,255,0.72)` light / `rgba(24,35,52,0.70)` dark, `backdrop-blur-md`).
- **Contrast Ratios:** All text elements (`#172033` on light glass, `#F8FAFC` on dark glass) exceed the 4.5:1 minimum contrast requirement.
- **Semantic Structure:** Follows an accessible document outline (`h1` for student welcome, `h2` / `h3` for section titles, semantic `<nav>` and `<time>` tags).

