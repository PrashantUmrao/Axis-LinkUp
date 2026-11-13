# AXIS LINKUP — FINAL COMBINED DESIGN DIRECTION
**Reference Synthesis: Visual Identity (Ref 1) + UI Structure & Grid Composition (Ref 2)**  
*Document Version:* 2.0.0  
*Phase:* 4.8.3 — Premium Design System & Visual Identity Refinement  
*Last Updated:* November 13, 2026  
*Status:* COMPLETE & REFINED SPECIFICATION  

---

## 1. Executive Summary & Design Mandate

The final visual design and layout architecture of **Axis LinkUp** is formed by synthesizing two approved visual references:

1. **REFERENCE 1 — VISUAL IDENTITY & ATMOSPHERE** ([media_1794586477929_bb419fb5.jpg](file:///C:/Users/prash/.gemini/antigravity/brain/92155752-4c25-454d-8c0f-1f2b79b1cb00/.user_uploaded/media_1794586477929_bb419fb5.jpg)):
   - **Color Palette:** Luminous sky-blue, icy cyan, soft periwinkle, royal blue accents, clean white highlights, and deep slate/navy text.
   - **Atmospheric Background:** Multi-stop sky blue to soft cerulean gradient with ambient optical depth.
   - **Glassmorphism Treatment:** High-translucency frosted glass (`rgba(255, 255, 255, 0.48)` to `0.60`), high blur (`backdrop-blur(20px)`), subtle translucent white borders (`rgba(255, 255, 255, 0.55)`), and specular edge highlights.
   - **Geometry:** Fluid capsule pill controls (`rounded-full`), generous card curves (`rounded-2xl`), and a floating master canvas container (`rounded-[32px]`).

2. **REFERENCE 2 — UI STRUCTURE & COMPONENT COMPOSITION** ([media_1794586488857_baeefce5.jpg](file:///C:/Users/prash/.gemini/antigravity/brain/92155752-4c25-454d-8c0f-1f2b79b1cb00/.user_uploaded/media_1794586488857_baeefce5.jpg)):
   - **Proportions & Density:** Professional SaaS-grade information density with balanced whitespace.
   - **Sidebar Architecture:** Structured navigation rail with grouped sections (`Workspace`, `Academic Modules`, `Settings`), active navigation pill, and bottom utility card.
   - **Dashboard Grid Hierarchy:**
     - **Top Metric Row:** 4-column KPI cards (`grid grid-cols-4 gap-4`) displaying key metric digits, descriptive labels, and upward/downward trend chips.
     - **Middle 2-Column Split:** 2/3 main analytical canvas + 1/3 right-hand activity rail.
     - **Data Visualization Panels:** Side-by-side comparative charts (e.g., Attendance Trends & Subject Evaluation distributions).
     - **Course / Project Cards:** Clean multi-column section cards with instructor/student avatar stacks and status badges.
     - **Concentric Circular Progress Gauges:** Multi-ring donut progress indicators tracking degree completion and syllabus coverage.
     - **Right-Hand Activity Rail:** Compact, high-utility lists for faculty advisors, recent campus notices, and academic milestones.

### Explicit Negative Constraints (What NOT to copy from Reference 2)
- **NO Dark Charcoal / Pure Black Color Scheme:** The application will NOT use Reference 2's harsh black/charcoal backgrounds. Dark mode will use deep sapphire/midnight-blue translucent glass.
- **NO Orange / Neon Green Accents:** Accents must strictly follow Reference 1's light-blue and royal-blue visual system.
- **NO Crypto / Investment / E-commerce Content:** All copy, tables, charts, and metrics must represent actual Axis LinkUp collegiate features (students, faculty, attendance, courses, grades, notices, clearances).

---

## 2. Visual Identity & Token Specifications (Reference 1)

### 2.1 Atmospheric Background Gradients

```css
/* Light Mode Canvas Background */
--bg-gradient-light: linear-gradient(
  135deg,
  #94d2f8 0%,
  #b8e1fc 30%,
  #cdebfd 65%,
  #e2f2fe 100%
);

/* Dark Mode Canvas Background (Deep Sapphire Glass) */
--bg-gradient-dark: linear-gradient(
  135deg,
  #081220 0%,
  #0e1c32 35%,
  #152945 70%,
  #1b3354 100%
);
```

### 2.2 Frosted Glass Token Matrix

| Surface Token | Light Mode Value | Dark Mode Value | Purpose |
| :--- | :--- | :--- | :--- |
| `--glass-master-canvas` | `rgba(255, 255, 255, 0.42)` | `rgba(14, 28, 50, 0.65)` | Floating master frame (`rounded-[32px]`) |
| `--glass-card-surface` | `rgba(255, 255, 255, 0.58)` | `rgba(18, 35, 62, 0.55)` | KPI cards, chart containers, data lists |
| `--glass-card-hover` | `rgba(255, 255, 255, 0.72)` | `rgba(24, 46, 80, 0.70)` | Interactive card hover states |
| `--glass-sidebar-surface`| `rgba(255, 255, 255, 0.35)` | `rgba(10, 20, 36, 0.60)` | Translucent navigation rail |
| `--glass-border-subtle` | `rgba(255, 255, 255, 0.55)` | `rgba(255, 255, 255, 0.12)` | Card and panel structural borders |
| `--glass-border-hover` | `rgba(59, 130, 246, 0.40)` | `rgba(96, 165, 250, 0.45)` | Interactive focus & hover borders |
| `--glass-specular-edge` | `inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.65)` | `inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.15)` | Top-edge optical glass reflection |
| `--glass-ambient-shadow` | `0 16px 40px -12px rgba(37, 99, 235, 0.10)` | `0 20px 48px -12px rgba(0, 0, 0, 0.50)` | Soft blue diffused ambient elevation |

### 2.3 Curvature & Radius Hierarchy

- **Master Canvas Container:** `rounded-[32px]` (2.0rem)
- **Modal Dialogs & Drawers:** `rounded-3xl` (1.5rem)
- **Dashboard Cards & Panels:** `rounded-2xl` (1.0rem)
- **Inner Content Blocks / Tables:** `rounded-xl` (0.75rem)
- **Capsule Controls (Search, Buttons, Badges, Pills):** `rounded-full` (9999px)

---

## 3. UI Structure & Grid Composition (Reference 2)

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  AXIS LINKUP FLOATING MASTER GLASS CANVAS (rounded-[32px] with soft blue ambient shadow)              │
│ ┌───────────────┬────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ TRANSLUCENT   │ TOPBAR: [≡] [Search Campus... / ⌘K (Pill)]     [Notices] [Theme] [User Capsule]    │ │
│ │ SIDEBAR RAIL  ├────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ (w-64)        │ DASHBOARD GREETING: "Good morning, Prashant" • Roll No • Semester 5                │ │
│ │               ├────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ [AITM Crest]  │ TOP ROW: 4 KPI METRIC CARDS (grid grid-cols-4 gap-4)                               │ │
│ │               │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │ │
│ │ WORKSPACE     │ │ Enrolled Subj│ │ Overall Att. │ │ Pending Drops│ │ Circulars    │                │ │
│ │ • Dashboard   │ │ 6 Active     │ │ 84.5%        │ │ 0 Pending    │ │ 3 New Dispat.│                │ │
│ │ • Profile     │ │ +1 Sem Trend │ │ +2.4% Safe   │ │ All Clear    │ │ +1 This Week │                │ │
│ │               │ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘                │ │
│ │ MODULES       ├───────────────────────────────────────────────────┬────────────────────────────────┤ │
│ │ • Notices     │ 2/3 MAIN ANALYTICAL CANVAS                        │ 1/3 RIGHT ACTIVITY RAIL        │ │
│ │ • Assignments │ ┌───────────────────────┬───────────────────────┐ │ ┌────────────────────────────┐ │ │
│ │ • Timetable   │ │ Attendance Trend      │ Academic Distribution │ │ │ Faculty Mentors & Advisors │ │ │
│ │ • Services    │ │ (Weekly Line Chart)   │ (Subject Bar Chart)   │ │ │ • Dr. Verma (HOD CS)       │ │ │
│ │               │ └───────────────────────┴───────────────────────┘ │ │ • Prof. Sharma (Data Comm) │ │ │
│ │ SETTINGS      │ ┌───────────────────────────────────────────────┐ │ │ • Dr. Gupta (Algorithms)   │ │ │
│ │ • Account     │ │ Enrolled Course Modules (4 Cards)             │ │ │ [View Department Dossier]  │ │ │
│ │               │ │ [Data Struct] [Comp Net] [OS] [Database]      │ │ ├────────────────────────────┤ │ │
│ │ ┌───────────┐ │ ├───────────────────────┬───────────────────────┤ │ │ Academic Circulars Stream  │ │ │
│ │ │ MOBILE SYNC│ │ Recent Submissions    │ Syllabus Progress     │ │ │ • Mid-Term Exam Dates      │ │ │
│ │ │ [QR Code] │ │ (Activity Timeline)   │ (Concentric Ring Chart│ │ │ • Campus Placement Drive   │ │ │
│ │ │ [Sync App]│ │ • Lab 4 Evaluated     │   78% Coverage)       │ │ │ • Sports Week Schedule     │ │ │
│ │ └───────────┘ │ └───────────────────────┴───────────────────────┘ │ └────────────────────────────┘ │ │
│ └───────────────┴───────────────────────────────────────────────────┴────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Persona-Specific Feature Mapping

Every component from Reference 2's structure is systematically adapted to genuine Axis LinkUp features across the three primary collegiate dashboards:

### 4.1 Student Dashboard Mapping

| Reference 2 Grid Position | Reference 2 Component | Axis LinkUp Student Dashboard Feature | Data Source / Truth-in-UI Boundary |
| :--- | :--- | :--- | :--- |
| **Top Metric 1** | Total Revenue | **Enrolled Course Load:** `6 Subjects` | Student Profile / Current Semester registration |
| **Top Metric 2** | Conversion Rate | **Semester Attendance:** `84.5%` (+2.4% Safe threshold) | Attendance telemetry (Phase 5 linked) |
| **Top Metric 3** | Membership Renewals| **Pending Coursework:** `0 Due` (All submissions clear) | Assignment dropboxes (ABAC verified) |
| **Top Metric 4** | Total Subscribers | **Campus Circulars:** `3 Active` departmental notices | Official university bulletin feed |
| **Middle Chart Left** | Orders Trend (Line)| **Weekly Lecture Attendance Track:** Mon–Fri session record | Interactive line chart with week filter |
| **Middle Chart Right**| Product Statics (Bars)| **Subject-wise Credit Distribution:** Core vs. Electives | Bar chart with semester credit weights |
| **Mid Row Cards** | Project Cards (4x) | **Enrolled Course Modules:** DS, OS, DBMS, Networks | Course cards with instructor avatar chips |
| **Lower Left** | Messages Timeline | **Recent Academic Milestones:** Lab evaluations, sign-ins | Audit log and submission receipt stream |
| **Lower Right** | Project Overview (Rings)| **Degree & Syllabus Completion:** Multi-ring concentric gauge | Concentric circular progress (78% Syllabus) |
| **Right Rail Top** | Team Member List | **Assigned Faculty Advisors:** Department HOD & Mentors | Faculty profile directory with cabin numbers |
| **Right Rail Bottom**| Top Conversations | **Department Bulletins & Deadlines:** Circular priority list | Signed university notifications |

---

### 4.2 Faculty Dashboard Mapping

| Reference 2 Grid Position | Reference 2 Component | Axis LinkUp Faculty Dashboard Feature | Data Source / Truth-in-UI Boundary |
| :--- | :--- | :--- | :--- |
| **Top Metric 1** | Total Revenue | **Instructional Course Sections:** `3 Assigned` | Faculty Profile (`assignedCourses`) |
| **Top Metric 2** | Conversion Rate | **Total Students Mentored:** Authentic cohort count | MongoDB user directory query |
| **Top Metric 3** | Membership Renewals| **Evaluation Queue:** `0 Pending` submissions | Coursework evaluation dropboxes |
| **Top Metric 4** | Total Subscribers | **Course Notices Dispatched:** `2 Active` | Faculty circular broadcasts |
| **Middle Chart Left** | Orders Trend (Line)| **Student Submission Pace:** Assignment upload velocity | Weekly submission curve |
| **Middle Chart Right**| Product Statics (Bars)| **Grade Distribution Curve:** Class average performance | Distribution histogram |
| **Mid Row Cards** | Project Cards (4x) | **Active Teaching Modules:** Batch A & Batch B lecture slots | Timetable course cards with room numbers |
| **Lower Left** | Messages Timeline | **Instructional Evaluation Log:** Grade submissions | Faculty grading audit log |
| **Lower Right** | Project Overview (Rings)| **Syllabus Coverage Gauge:** Concentric progress rings | Multi-ring gauge tracking lecture units |
| **Right Rail Top** | Team Member List | **Enrolled Student Roster:** Top attendees & scholars | Student cohort list with roll numbers |
| **Right Rail Bottom**| Top Conversations | **Department Council Circulars:** HOD notices | Institutional academic notices |

---

### 4.3 Administrator Dashboard Mapping

| Reference 2 Grid Position | Reference 2 Component | Axis LinkUp Administrator Dashboard Feature | Data Source / Truth-in-UI Boundary |
| :--- | :--- | :--- | :--- |
| **Top Metric 1** | Total Revenue | **Enrolled Students:** Authentic count from Atlas | `UserRepository.countByRole('student')` |
| **Top Metric 2** | Conversion Rate | **Instructional Faculty:** Authentic count from Atlas | `UserRepository.countByRole('faculty')` |
| **Top Metric 3** | Membership Renewals| **Administrative Officers:** Authentic count from Atlas | `UserRepository.countByRole('admin')` |
| **Top Metric 4** | Total Subscribers | **Service Requisitions:** Clearance & bonafide queue | Department clearance ticket count |
| **Middle Chart Left** | Orders Trend (Line)| **Campus Ingress Velocity:** Daily user sign-in activity | 7-day session activity timeline |
| **Middle Chart Right**| Product Statics (Bars)| **Department Population Breakdown:** CS, ME, EC, Civil | Departmental student bar chart |
| **Mid Row Cards** | Project Cards (4x) | **Department Management Desks:** Registry, Exam, Library | Administrative domain console cards |
| **Lower Left** | Messages Timeline | **IAM Security & Audit Log:** Webhook sync & role checks | System security audit stream |
| **Lower Right** | Project Overview (Rings)| **Campus Operational Health:** Concentric ring status | System health (DB, Auth, Storage) |
| **Right Rail Top** | Team Member List | **Departmental Staff Directory:** Active officers & HODs | Administrator staff list with domain tags |
| **Right Rail Bottom**| Top Conversations | **Campus Requisition Priority Queue:** Urgent clearances | Student service ticketing feed |

---

## 5. Implementation Roadmap Integration

With the approval of this combined design direction:
1. **Design System & Tokens (Phase 4.8.2):** Implement the sky-blue gradient background, frosted glass variables, and radius scales from Reference 1.
2. **Global Application Shell (Phase 4.8.3):** Construct the floating master canvas container (`rounded-[32px]`), translucent sidebar rail, and capsule topbar based on Reference 2's structure.
3. **Public Landing Page (Phase 4.8.4):** Create a full-width collegiate digital platform landing page featuring institutional hero, portal access, campus notices, and footer.
4. **Dashboards (Phases 4.8.5, 4.8.6, 4.8.7):** Implement the 4-column KPI row, 2-column analytics split, concentric circular gauges, and right-hand activity rails across Student, Faculty, and Admin cockpits.
5. **Auth & Polish (Phases 4.8.8, 4.8.9):** Harmonize Clerk authentication views to seamlessly match both Light and Dark glassmorphism themes, followed by full quality gate verification.

