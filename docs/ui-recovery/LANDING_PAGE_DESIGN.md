# AXIS LINKUP — LANDING PAGE REDESIGN SPECIFICATION
**Collegiate Platform Public Ingress & Visual Identity**  
*Document Version:* 2.0.0  
*Phase:* 4.8.4 — Landing Page & Login Experience Redesign  
*Institution:* Axis Institute of Technology & Management (AITM), Kanpur  
*Last Updated:* November 13, 2026  

---

## 1. Design Overview & Objectives

The redesigned public landing page (`src/app/page.tsx`) transforms Axis LinkUp from an experimental centered card into a flagship, professional collegiate digital platform.

The visual execution is built directly upon the synthesis of our two visual benchmarks:
1. **Reference 1 (Visual Identity):** Soft sky-blue atmospheric background (`#edf5fd` with ambient radial blue optical depth), luminous frosted glass surfaces (`rgba(255, 255, 255, 0.65)`), crisp translucent white borders, specular edge highlights, fluid capsule pill controls (`rounded-full`), and refined royal blue accents (`#2563eb`).
2. **Reference 2 (Layout & Composition):** High-density SaaS grid hierarchy, structured sections, clean tabular alignment, and balanced whitespace.

---

## 2. Page Architecture & Section Composition

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP NAVIGATION: [AITM Crest] Axis LinkUp  │  [Portals] [Capabilities] [About]  │  [Theme] [Sign In] │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ HERO SECTION:                                                                                │
│   [AITM Kanpur • Collegiate Digital Portal]                                                  │
│   "The Unified Digital Campus Ecosystem"                                                     │
│   Connecting Students, Faculty, Department Administrators, and Directorate...                │
│                                                                                              │
│   [Access Campus Portals →]  [Explore Capabilities]                                          │
│                                                                                              │
│   [Lock: Closed Admin Provisioning] • [Shield: Zero-Trust RBAC] • [Scale: UGC Grievance]    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ THREE-DOOR ROLE INGRESS (#portals):                                                          │
│   ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐         │
│   │ STUDENT PORTAL         │  │ FACULTY WORKSPACE      │  │ ADMINISTRATION CONSOLE │         │
│   │ [GraduationCap]        │  │ [BookOpenCheck]        │  │ [ShieldCheck]          │         │
│   │ Enrolled Scholars      │  │ Instruction & Mentorship│ │ Governance & Directorate│        │
│   │ Coursework, attendance,│  │ Batch lectures, grades,│  │ HODs, Director, IT IAM │         │
│   │ timetables & grievances│  │ notices, class groups  │  │ console & audit logs   │         │
│   │ [Sign In as Student →] │  │ [Sign In as Faculty →] │  │ [Sign In as Admin →]   │         │
│   └────────────────────────┘  └────────────────────────┘  └────────────────────────┘         │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ PLATFORM CAPABILITIES GRID (#capabilities):                                                  │
│   ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐                       │
│   │ Campus Circulars   │ │ Direct Chat/Groups │ │ Academic Timetable │                       │
│   │ Official bulletins │ │ 1:1 @handle & groups│ │ Lectures & exams   │                       │
│   └────────────────────┘ └────────────────────┘ └────────────────────┘                       │
│   ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐                       │
│   │ Course Dropboxes   │ │ Campus Polls/Voting│ │ Grievance Portal   │                       │
│   │ Submissions & syllabus│ Student sentiment │ Statutory AICTE/UGC  │                       │
│   └────────────────────┘ └────────────────────┘ └────────────────────┘                       │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ INSTITUTIONAL GOVERNANCE & POLICY (#about):                                                  │
│   Axis Institute of Technology & Management (AITM), Kanpur                                   │
│   Notice: Closed Administrative Provisioning Policy (Zero Self-Registration)                 │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ FOOTER: © 2026 Axis Institute of Technology & Management (AITM). All rights reserved.        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Section Breakdown & Specifications

### 3.1 Top Navigation Bar
- **Surface:** `.glass-nav` with bottom highlight (`backdrop-blur(16px)`).
- **Branding:** Official collegiate icon container (`size-10 rounded-xl bg-primary/10 border border-primary/25`) with dual-line title:
  - Line 1: `Axis LinkUp` (`font-bold font-heading text-foreground text-base sm:text-lg`).
  - Line 2: `Axis Institute of Technology & Management` (`text-[11px] text-muted-foreground`).
- **Navigation Anchors:** Direct scroll targets to `#portals`, `#capabilities`, and `#about`.
- **Primary CTA:** Capsule button (`variant="pill-primary"`) linking directly to `/sign-in`.
- **Zero Registration Entry:** Public "Sign Up" or "Create Account" buttons are strictly eliminated.

### 3.2 Hero Section
- **Institutional Pill:** `<Sparkles />` icon with `AITM Kanpur • Collegiate Digital Portal`.
- **Typography:**
  - Headline: `text-3xl sm:text-5xl font-bold tracking-tight text-foreground leading-[1.15]`.
  - Subtitle: `text-sm sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto`.
- **Dual Capsule Actions:**
  - Primary: `Access Campus Portals` (`variant="pill-primary"` with `ArrowRight`).
  - Secondary: `Explore Capabilities` (`variant="pill-glass"`).
- **Access Posture Strip:** Frosted glass capsule pill summarizing three critical governance pillars:
  1. Closed Admin Provisioning
  2. Tier-2 Zero-Trust RBAC
  3. AICTE / UGC Statutory Grievance Redressal

### 3.3 Three-Door Role Ingress (`#portals`)
Provides dedicated visual doors for each primary collegiate persona:
- **Student Door:** Blue accent, `GraduationCap` icon, targeting enrolled undergraduate and postgraduate students.
- **Faculty Door:** Indigo accent, `BookOpenCheck` icon, targeting professors, lecturers, and lab mentors.
- **Administration Door:** Sky accent, `ShieldCheck` icon, targeting Department HODs, Executive Director, and IT Admins.
- **Security Rule:** Door selection registers a **portal intent**, never authorization. Server-side zero-trust guards validate the authenticated user's actual database role upon login.

### 3.4 Platform Capabilities Grid (`#capabilities`)
Presents six genuine, approved platform features:
1. **Campus Circulars & Bulletins:** Official university broadcasts and department circulars with priority tags.
2. **Direct Chat & Academic Groups:** WhatsApp-inspired 1:1 messaging using unique `@username` and faculty-created class groups.
3. **Academic Calendar & Schedule:** Daily lecture timetables, lab sessions, and examination milestones.
4. **Coursework & Digital Dropboxes:** Semester syllabus coverage, assignment submission tracking, and laboratory records.
5. **Campus Polls & Sentiment:** Anonymous class feedback and institutional student council voting.
6. **Student Grievance Redressal:** Formal AICTE/UGC compliant grievance system with direct routing to HOD and Executive Director.

---

## 4. Responsive Verification & Breakpoints

| Viewport | Device Class | Layout Adaptation |
| :--- | :--- | :--- |
| **320px–430px** | Mobile | Stacked hero, vertical 3-door cards, hamburger-free navigation, touch-friendly 44px+ buttons |
| **768px–1024px** | Tablet | 2-column capabilities, horizontal navigation, full hero typography |
| **1280px–1440px+**| Desktop | 3-door horizontal grid, 3-column capabilities grid, full atmospheric optical glows |
