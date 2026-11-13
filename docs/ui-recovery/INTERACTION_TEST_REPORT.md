# AXIS LINKUP — INTERACTION TEST REPORT
**Document ID:** `TEST-INT-001`  
**Phase:** 4.8.7 (Complete Platform-Wide UI Bug Fixing & Interaction Audit)  
**Date:** November 13, 2026  
**Status:** All Interactions Verified  

---

## 1. Executive Summary

This report documents the functional interaction audit conducted across every interactive element in Axis LinkUp, including navigation controls, modals, tabs, forms, buttons, and state switchers.

---

## 2. Interactive Component Test Results

### 2.1 Theme & Layout Controls
- **Theme Switcher (`ThemeToggle`):**
  - Toggles between `Light`, `Dark`, and `System` modes without page reloads or styling glitches.
  - Applies `.dark` class to `<html>` and updates CSS variables instantly.
  - Specular rim lights on `.glass-panel` adjust opacity automatically.
- **Mobile Navigation Drawer (`MobileDrawer`):**
  - Triggers via topbar hamburger button on screens `< 1024px`.
  - Animates from left with frosted backdrop overlay; tapping outside or clicking a link closes the drawer cleanly.
- **User Profile Menu (`UserMenu`):**
  - Dropdown opens with authenticated avatar, name, and role badge.
  - "Profile & Settings" routes to `/shared/profile`.
  - "Sign Out" invokes Clerk session signout and clears authentication cookies.

### 2.2 Role Ingress & Authentication (Three-Door Portal)
- **Role Selector (`RoleSelector`):**
  - Allows selecting Student, Faculty, or Administration.
  - Directs user to `/sign-in?role=<selectedRole>`.
  - "Switch Portal Door" button on login form allows changing roles without navigating back to home.
- **Closed Registration Gate (`/sign-up`):**
  - Confirms public self-registration is closed; directs users to contact administrator or log in.

### 2.3 Role-Based Dashboards
- **Student Dashboard (`/student/dashboard`):**
  - Enrolled Course Modules: Hover elevates cards; syllabus progress bars animate smoothly.
  - Concentric Progress Ring: Renders 84.5% Attendance (Royal Blue) and 78.0% Syllabus Coverage (Sky Cyan) with KaTeX centered readout.
  - Grievance Portal Desk: Direct "Lodge Grievance" action routes cleanly to `/student/complaints`.
  - Mentors Rail: Clicking message icon opens `/student/messages` with the assigned mentor.
- **Faculty Dashboard (`/faculty/dashboard`):**
  - Teaching Allocations: Section cards show student counts, hall allocations, and syllabus milestones.
  - Moderated Academic Groups Desk: Displays class channels; "Create Group" button routes to `/faculty/messages`.
  - Instructional Progress Gauge: Renders 82.0% Syllabus Taught and 94.0% Evaluations Met.
- **Administration Workspace (`/admin/dashboard`):**
  - Scope Switcher (`AdminWorkspaceView`): Seamlessly switches between `System Administrator`, `HOD Department Desk`, and `Executive Director Desk` without page reload.
  - Closed Provisioning Desk: Form triggers single-account invitation and provides CSV batch upload modal.
  - Governance Progress Gauge: Renders 100.0% IAM Verification and 99.9% Platform Uptime.
- **Super Admin Dashboard (`/super-admin/dashboard`):**
  - Verified harmonized light-blue glass cards for Emergency Broadcast, IAM Governance, and Telemetry.

### 2.4 Internal Chat & Group Messaging (`/student/messages`, `/faculty/messages`, `/admin/messages`)
- **Conversation Selection:** Tapping a conversation updates active conversation view and highlights active item in sidebar.
- **Search Bar:** Real-time filter matches contact names, handles, and message text.
- **Category Filter Tabs:** Filters conversations by `All`, `Direct`, and `Groups`.
- **Message Sending:** Typing text and clicking Send appends message to active conversation with timestamp and delivery ticks.
- **Broadcast-Only Policy Gate:** Student view in broadcast-only group locks composer with warning banner.
- **Faculty Group Creator Dialog:** Allows entering title, description, policy, searching students, selecting members, and creating a new academic group.
- **Info Panel Toggle:** Slides in right details drawer showing member list and channel policies.

### 2.5 Statutory Grievance Redressal (`/student/complaints`, `/faculty/complaints`, `/admin/complaints`)
- **Category & Status Filters:** Filters dockets by `All`, `Submitted`, `Under Review`, `Responded`, `Resolved`.
- **Grievance Composition Form:**
  - Recipient selection between HOD (48h SLA) and Executive Director (7-day SLA).
  - Classification chip selector.
  - Complainant name and roll number locked to session (anti-spoofing).
  - Document attachment control.
  - Submitting appends new petition to docket list and opens detailed view.
- **Docket Detail Modal:**
  - Displays full narrative, evidence docket, and chronological response history chain.
  - HOD / Director response composer allows recording official findings, resolving case, or escalating to Director.
