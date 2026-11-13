# AXIS LINKUP — UI BUG REGISTER
**Phase 4.8.1: Complete UI Audit & Bug Identification**  
*Document Version:* 1.0.0  
*Audit Date:* November 13, 2026  
*Status:* COMPLETE & PRIORITIZED  

---

## 1. Severity Classification Matrix

| Severity | Definition | Impact on Platform | Target Resolution Window |
| :--- | :--- | :--- | :--- |
| **P0** | Critical functionality or security-related UI issue | Data loss, complete broken ingress, security bypass | Immediate Blocker (0 identified) |
| **P1** | Major broken layout, broken theme, or broken navigation | Unusable feature, severe layout collapse, broken authentication styling | Phase 4.8.2 / Phase 4.8.3 |
| **P2** | Significant visual inconsistency or poor usability | Missing interactive states, hardcoded dimensions, styling mismatches | Phase 4.8.4 - Phase 4.8.7 |
| **P3** | Minor visual refinement or cosmetic polish | Border radius alignment, micro-spacing, typography tracking | Phase 4.8.8 |

---

## 2. Identified Bug Register

### BUG-001: Clerk Sign-In & Sign-Up Hardcoded Dark Styles Break Light Theme
- **Bug ID:** `BUG-001`
- **Severity:** `P1` (Major Broken Layout / Theme Collision)
- **Component / Route:** `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` & `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- **Description:** 
  The Clerk authentication views have hardcoded dark classes (`bg-slate-900`, `border-slate-800`, `text-white`, `bg-[#0A2540]`, `text-[#F5A623]`) directly embedded in the `appearance` element configuration. In addition, the page headings have hardcoded `text-white` classes. When the user switches to Light Mode, the headings become invisible white text against a light gray-blue background (`#f3f5f9`), and the Clerk sign-in box appears as an uncoordinated pitch-black rectangle with dark navy buttons and gold text.
- **Reproduction Steps:**
  1. Navigate to `/sign-in` or `/sign-up`.
  2. Click the `ThemeToggle` button in the top right header to switch from Dark Mode to Light Mode.
  3. Observe that the heading "Welcome Back" is rendered in white text on a light background.
  4. Observe that the Clerk card is an isolated dark box completely disconnected from the light theme.
- **Evidence:** `sign-in/page.tsx#L13-L37` & `sign-up/page.tsx#L15-L46`.
- **Recommended Correction:**
  Remove hardcoded dark Tailwind classes and hex codes (`#0A2540`, `#F5A623`). Integrate Clerk's dynamic `appearance.baseTheme` or bind the element classes to the platform's CSS variables (`bg-card`, `text-card-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`) so the card automatically adjusts to both Light and Dark modes.

---

### BUG-002: Landing Page Centered Card Causes Extreme Whitespace Abandonment on Desktop
- **Bug ID:** `BUG-002`
- **Severity:** `P1` (Major Broken Layout / Viewport Abandonment)
- **Component / Route:** `src/app/page.tsx` (`HomePage`)
- **Description:** 
  The landing page wraps all content inside a single `max-w-2xl` card centered inside `min-h-screen flex items-center justify-center`. On standard desktop and high-resolution displays (1080p, 1440p, 4K), over 80% of the screen area is an empty black void. The page looks like a detached modal or debug dialog rather than an institutional college website.
- **Reproduction Steps:**
  1. Open `http://localhost:3000/` in a desktop browser at 1440px or 1920px width.
  2. Observe the vast black margins surrounding a tiny box in the center of the display.
- **Evidence:** User-uploaded screenshot: [media_1794585997041_50601133.png](file:///C:/Users/prash/.gemini/antigravity/brain/92155752-4c25-454d-8c0f-1f2b79b1cb00/.user_uploaded/media_1794585997041_50601133.png).
- **Recommended Correction:**
  Redesign the landing page into a full-width collegiate digital platform featuring a proper institutional header, hero section with campus imagery, key value propositions for students, faculty, and administrators, recent public bulletins, and a structured college footer.

---

### BUG-003: Landing Page Displays Developer-Centric Technical Specifications Instead of College Services
- **Bug ID:** `BUG-003`
- **Severity:** `P1` (Inappropriate Public Ingress Content)
- **Component / Route:** `src/app/page.tsx` (`HomePage#L49-L74`)
- **Description:** 
  The public homepage prominently displays a 4-column grid detailing the internal developer tech stack: "Framework: Next.js 15.5", "Language: TypeScript 5", "Design System: Glassmorphism", and "Security: Clerk + RBAC". It also features a primary CTA button linking to `/ui-preview`. This is inappropriate for an institutional portal aimed at students, faculty, and parents.
- **Reproduction Steps:**
  1. Navigate to `/`.
  2. Inspect the content below the main title. Notice the four developer spec cards and the `UI Preview` button.
- **Evidence:** `page.tsx#L50-L74`, `page.tsx#L91-L96`.
- **Recommended Correction:**
  Replace the developer tech cards with collegiate platform pillars (e.g., "Student Academic Hub", "Faculty Evaluation Cockpit", "Administrative Governance", "Campus Broadcasts"). Remove the `/ui-preview` link from the public landing page actions.

---

### BUG-004: Topbar Global Search Is a Static Disabled Stub Lacking Keyboard Shortcuts
- **Bug ID:** `BUG-004`
- **Severity:** `P2` (Non-Functional Primary Navigation Control)
- **Component / Route:** `src/components/navigation/topbar.tsx` (`Topbar#L115-L137`)
- **Description:** 
  The search input in the top navigation bar is a static `div` with `cursor-not-allowed` and a hardcoded `⌘K` badge. Clicking on it opens a tooltip explaining that search is planned for Phase 5, but pressing `Cmd+K` or `Ctrl+K` on the keyboard does nothing. Users expect either a functioning search modal or an accessible search palette trigger.
- **Reproduction Steps:**
  1. Navigate to any dashboard (`/student/dashboard`, `/faculty/dashboard`, `/admin/dashboard`).
  2. Press `Ctrl+K` (Windows) or `Cmd+K` (macOS). Nothing happens.
  3. Attempt to click on the search bar. The cursor turns to `not-allowed`.
- **Evidence:** `topbar.tsx#L118-L128`.
- **Recommended Correction:**
  Transform the search input into a rounded pill control consistent with the target reference. Add a keyboard listener for `Cmd+K`/`Ctrl+K` and open a clean glassmorphic command dialog that allows navigation between implemented dashboard sections.

---

### BUG-005: Topbar Notification Bell Is a Non-Functional Dead Button
- **Bug ID:** `BUG-005`
- **Severity:** `P2` (Non-Functional Action Element)
- **Component / Route:** `src/components/navigation/topbar.tsx` (`Topbar#L139-L158`)
- **Description:** 
  The notification bell icon has a notification indicator badge (red dot), but clicking it does nothing because it is disabled (`cursor-not-allowed` with tooltip). This creates visual frustration by signaling pending notifications that cannot be viewed.
- **Reproduction Steps:**
  1. Locate the bell icon in the top right of the dashboard header.
  2. Click on the bell icon. No dropdown or drawer opens.
- **Evidence:** `topbar.tsx#L141-L157`.
- **Recommended Correction:**
  Implement a lightweight glassmorphic popover dropdown for the notification bell displaying recent system telemetry or official notices with a "Mark all as read" control.

---

### BUG-006: Global Shell Lacks Target Reference Floating Canvas & Pill Controls
- **Bug ID:** `BUG-006`
- **Severity:** `P2` (Major Visual Divergence from Target Benchmark)
- **Component / Route:** `src/components/layouts/app-shell.tsx` & `src/components/navigation/sidebar.tsx`
- **Description:** 
  The application shell currently fills the entire viewport with a fixed left sidebar (`fixed inset-y-0 left-0 w-64 border-r`) and full-width topbar. In contrast, the approved target reference ([VerdantFlow](file:///C:/Users/prash/.gemini/antigravity/brain/92155752-4c25-454d-8c0f-1f2b79b1cb00/.user_uploaded/media_1794585990477_242653da.jpg)) features an expansive, floating frosted-glass canvas (`rounded-[32px]`) set within a luminous soft blue atmospheric background, with translucent sidebar integration, pill-shaped active navigation states, and a bottom QR sync widget.
- **Reproduction Steps:**
  1. Compare the running dashboard layout with target reference `media_1794585990477_242653da.jpg`.
  2. Observe the absence of the floating rounded frame, translucent glass sidebar, and pill buttons.
- **Evidence:** `app-shell.tsx#L64-L105` vs target image `media_1794585990477_242653da.jpg`.
- **Recommended Correction:**
  Update the `AppShell` container structure to support a floating rounded glass master canvas with soft blue ambient shadow, a translucent sidebar rail with pill active indicators, and a bottom mobile app sync card.

---

### BUG-007: Flat Backgrounds Prevent Proper Glassmorphism Refraction
- **Bug ID:** `BUG-007`
- **Severity:** `P2` (Design System Aesthetic Flaw)
- **Component / Route:** `src/app/globals.css` (`--background` tokens & `.glass-panel` utilities)
- **Description:** 
  In `globals.css`, `--background` is defined as a flat color (`#f3f5f9` in Light Mode and `#111827` in Dark Mode). Because the background has no luminous multi-stop gradient, the `backdrop-filter: blur(14px)` on cards has no visual complexity to blur. As a result, the cards look like flat semi-opaque boxes rather than frosted glass panels.
- **Reproduction Steps:**
  1. Inspect any dashboard in Light Mode. The background is uniform light gray.
  2. Observe that glass cards look identical to standard white cards with faint gray borders.
- **Evidence:** `globals.css#L77`, `globals.css#L139`, `globals.css#L225-L231`.
- **Recommended Correction:**
  Establish a multi-stop periwinkle/sky blue atmospheric gradient background (Light: `linear-gradient(135deg, #a0c4f8 0%, #b8d6fc 50%, #cfe2fe 100%)`; Dark: `linear-gradient(135deg, #0d1726 0%, #152438 50%, #1c314c 100%)`) that provides the optical depth required for glassmorphism.

---

### BUG-008: Inconsistent Corner Radii Across UI Components
- **Bug ID:** `BUG-008`
- **Severity:** `P2` (Visual Inconsistency)
- **Component / Route:** Global components (`Button`, `Card`, `Badge`, `Input`, `Avatar`)
- **Description:** 
  The codebase exhibits mixed corner radii. Buttons use `rounded-md` (6px) or `rounded-lg` (8px), cards use `rounded-xl` (12px) or `rounded-2xl` (16px), badges use `rounded-full`, and search inputs use `rounded-lg`. In the target reference, the visual language is defined by large, harmonious curves: `rounded-2xl` for cards, `rounded-[32px]` for the master canvas, and `rounded-full` for all pill controls (search, active nav, filter chips, action buttons).
- **Reproduction Steps:**
  1. Inspect buttons in `src/components/ui/button.tsx` (uses `rounded-lg`).
  2. Inspect cards in `src/components/ui/card.tsx` (uses `rounded-xl`).
  3. Compare with the smooth pill curves of the target reference.
- **Evidence:** `button.tsx#L18`, `card.tsx#L17`.
- **Recommended Correction:**
  Align component border radii to the target design scale: `rounded-2xl` for cards, `rounded-3xl` for major sections, and `rounded-full` for pills, tags, search bars, and action buttons.

---

### BUG-009: Dashboard Metric Overview Cards Lack Sparkline Wave Silhouettes & Trend Indicators
- **Bug ID:** `BUG-009`
- **Severity:** `P2` (Feature Presentation Gap)
- **Component / Route:** `metrics-overview.tsx` across Student, Faculty, and Admin dashboards
- **Description:** 
  The metric overview cards display a simple icon in a colored square box alongside a number and a label. In the target reference, metric cards are spacious frosted panels featuring large bold digits, an upward trend indicator (`^`), and a soft blue sparkline/area wave silhouette in the background.
- **Reproduction Steps:**
  1. Inspect `StudentMetricsOverview`, `FacultyMetricsOverview`, and `AdminMetricsOverview`.
  2. Notice that cards are standard icon-title-number boxes without data visualization silhouettes.
- **Evidence:** `metrics-overview.tsx` across dashboards vs target image top row cards.
- **Recommended Correction:**
  Redesign the metric overview cards to include subtle SVG area wave silhouettes, trend chips, and cleaner typography hierarchy.

---

### BUG-010: Breadcrumbs Lack Pill Styling & Active Route Highlights
- **Bug ID:** `BUG-010`
- **Severity:** `P3` (Minor Visual Polish)
- **Component / Route:** `src/components/navigation/topbar.tsx` (`Topbar#L80-L109`)
- **Description:** 
  Breadcrumbs in the topbar are rendered as plain inline text with small chevron separators (`Dashboard > Student`). They lack background pill containers, icon indicators, and smooth hover transitions.
- **Reproduction Steps:**
  1. Navigate to `/student/dashboard` or `/shared/profile`.
  2. Inspect the breadcrumb trail in the topbar.
- **Evidence:** `topbar.tsx#L81-L109`.
- **Recommended Correction:**
  Style breadcrumbs as subtle translucent pill badges with icon integration and active route emphasis.

---

### BUG-011: Awkward Wrapping of Credential Chips on Narrow Mobile Viewports (320px–375px)
- **Bug ID:** `BUG-011`
- **Severity:** `P3` (Mobile Usability / Responsive Wrap)
- **Component / Route:** `welcome-banner.tsx` across Student, Faculty, and Admin dashboards
- **Description:** 
  On narrow viewports (320px to 375px), the academic credential strip (`Roll Number • Semester • Batch` or `Employee ID • Designation • Cabin`) wraps onto three separate lines with awkward bullet alignment, crowding the header card.
- **Reproduction Steps:**
  1. Set the browser viewport width to 320px (iPhone SE).
  2. Inspect the welcome banner at the top of `/student/dashboard`.
  3. Observe the bullet points wrapping unpredictably across multiple lines.
- **Evidence:** `welcome-banner.tsx#L94-L101` in student, faculty, and admin.
- **Recommended Correction:**
  Use a responsive flex-wrap layout with standalone chip badges instead of inline bullets, ensuring clean alignment on all viewport sizes.

---

### BUG-012: Inconsistent Color Accents Across Dashboards Diverge from Brand Theme
- **Bug ID:** `BUG-012`
- **Severity:** `P3` (Visual Brand Fragmentation)
- **Component / Route:** Dashboard components across roles
- **Description:** 
  Currently, each persona uses a completely different accent color: Student uses primary blue, Faculty uses emerald green (`text-emerald-500`), Admin uses amber (`text-amber-500`), and Super Admin uses rose (`text-rose-500`). While role differentiation is helpful, having entirely separate dominant color schemes fragments the platform's visual identity.
- **Reproduction Steps:**
  1. Switch between Student, Faculty, and Admin dashboards.
  2. Observe the sudden jump from blue to green to bright orange/amber.
- **Evidence:** `welcome-banner.tsx` in faculty (`emerald-500`) and admin (`amber-500`).
- **Recommended Correction:**
  Anchor all dashboards to the unified light-blue glassmorphism palette, using secondary role badges rather than overriding the entire interface color.

---

### BUG-013: Missing Interactive Modals for Quick Action Buttons
- **Bug ID:** `BUG-013`
- **Severity:** `P3` (Usability Gap)
- **Component / Route:** `quick-actions.tsx` across Student, Faculty, and Admin dashboards
- **Description:** 
  Non-live quick action buttons display simple disabled tooltips (`Module planned for Phase 5`). Providing a modal preview or waitlist notification would provide a significantly more engaging user experience.
- **Reproduction Steps:**
  1. Click on "Campus Bulletins" or "Assignments Portal" in `StudentQuickActions`.
  2. Notice the button cannot be clicked.
- **Evidence:** `quick-actions.tsx#L68-L98`.
- **Recommended Correction:**
  Allow clicking on upcoming action cards to open an informational glassmorphic modal explaining the upcoming feature with a preview of its capabilities.

---

### BUG-014: Dark Mode Surfaces Lack Soft Blue Translucency
- **Bug ID:** `BUG-014`
- **Severity:** `P3` (Dark Theme Visual Polish)
- **Component / Route:** `src/app/globals.css` (`.dark` theme tokens)
- **Description:** 
  Dark mode currently uses dark slate/charcoal tones (`#111827`, `#182334`). To match the premium feel of the target reference, dark mode should feature deep sapphire/midnight blue translucent glass surfaces with luminous cyan-blue borders.
- **Reproduction Steps:**
  1. Toggle to Dark Mode on any dashboard.
  2. Observe the heavy gray/charcoal tones.
- **Evidence:** `globals.css#L138-L197`.
- **Recommended Correction:**
  Update dark mode tokens to use deep blue tones (`#0a1120`, `#101e36`) with soft blue glass highlights.

---

## 3. Bug Summary Matrix

| Severity | Total Identified | Primary Affected Components | Priority Phase |
| :---: | :---: | :--- | :--- |
| **P0** | **0** | None (Zero data loss / zero security breaches) | — |
| **P1** | **3** | Auth Clerk styling, Landing page layout, Landing page content | Phase 4.8.2 / 4.8.4 |
| **P2** | **4** | Global shell frame, Background atmosphere, Search stub, Corner radii | Phase 4.8.2 / 4.8.3 |
| **P3** | **7** | Metric sparklines, Breadcrumbs, Credential wrap, Dark palette polish | Phase 4.8.5 - 4.8.8 |
| **TOTAL** | **14** | **14 Documented UI Issues Across 12 Pages** | **Full Roadmap** |

