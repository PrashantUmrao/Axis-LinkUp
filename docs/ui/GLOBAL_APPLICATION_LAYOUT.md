# Global Application Layout Architecture (`AppShell`)
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Overview & Structural Philosophy

The **Axis LinkUp** global application shell provides an authenticated, responsive layout container built on the **Next.js App Router** and the **Glassmorphism Design System** established in Part 4.1.

The layout architecture adheres to a strict 3-tier presentation hierarchy:
1. **Tier 1 (UI Primitives):** Atomic Radix UI and Tailwind CSS components (`Button`, `Card`, `Badge`, `DropdownMenu`, `Tooltip`, `Avatar`, `Skeleton`) in `src/components/ui/`.
2. **Tier 2 (Navigation Composites):** Role-aware headers, collapsible rails, breadcrumb generators, and slide-over drawers in `src/components/navigation/`.
3. **Tier 3 (Layout Shells):** High-level structural shells (`AppShell`, `ContentContainer`) in `src/components/layouts/` that wrap route group children and eliminate layout duplication.

```
┌────────────────────────────────────────────────────────────────────────┐
│ AppShell Viewport                                                      │
│ ┌──────────────────────┬─────────────────────────────────────────────┐ │
│ │                      │ Topbar (Sticky Frosted Glass)               │ │
│ │                      │ [Toggle] [Breadcrumbs]    [Search] [🔔] [Theme] [Avatar] │
│ │                      ├─────────────────────────────────────────────┤ │
│ │ Sidebar (Glass Rail) │ Main Content Area (`<main>`)                │ │
│ │                      │ ┌─────────────────────────────────────────┐ │ │
│ │ • Branding / Crest   │ │ ContentContainer (max-w-7xl)            │ │ │
│ │ • Workspace Links    │ │ • Page Header (Title + Badge + Actions) │ │ │
│ │ • Module Navigation  │ │ • Dynamic Children Route Components     │ │ │
│ │ • Settings & Account │ └─────────────────────────────────────────┘ │ │
│ │                      ├─────────────────────────────────────────────┤ │
│ │ • Collapse Toggle    │ Collegiate Institutional Footer             │ │
│ └──────────────────────┴─────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 `AppShell` (`src/components/layouts/app-shell.tsx`)
The `AppShell` component orchestrates all high-level layout elements:
- **Server Identity Ingestion:** Receives the server-verified session payload (`email`, `role`, `fullName`, `avatarUrl`) from the wrapping layout.
- **Collapsible Rail State:** Tracks `isSidebarCollapsed` in client state, synchronized with `localStorage` (`axis-linkup-sidebar-collapsed`).
- **Mobile Drawer State:** Manages `isMobileDrawerOpen` and prevents body scrolling when the drawer is active.
- **Ambient Glass Aesthetics:** Renders subtle ambient radial gradient overlays (`bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(52,86,209,0.06),rgba(255,255,255,0))]`) for both light and dark themes.
- **Smooth Layout Transitions:** Desktop content margin shifts (`md:ml-64` to `md:ml-20`) with 300ms ease-in-out animations.

### 2.2 `ContentContainer` (`src/components/layouts/content-container.tsx`)
A standardized container for dashboard views and modular pages:
- **Responsive Padding:** `px-4 py-6 sm:px-6 lg:px-8`.
- **Max-Width Configurations:** `'narrow'` (`max-w-4xl`), `'default'` (`max-w-7xl`), `'wide'` (`max-w-(--breakpoint-2xl)`), and `'full'` (`max-w-full`).
- **Standardized Header Slots:** `title`, `subtitle`, `badge`, and `actions` (for primary CTAs, filters, or export triggers).

---

## 3. Responsive Breakpoint Matrix

| Viewport Tier | Width Threshold | Sidebar Behavior | Topbar Controls | Content Container |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile** | `< 768px` (`sm`) | Hidden from DOM flow. Opens as a slide-over modal drawer with a blurred glass backdrop. | Shows hamburger menu button (`Menu`); search and breadcrumb labels adapt or hide. | Full-width edge-to-edge padding (`px-4 py-6`). |
| **Tablet** | `768px – 1023px` (`md`) | Collapsible rail sidebar (defaults to `w-20` rail or `w-64` full width). | Desktop toggle button (`PanelLeft`); search trigger shown in compact mode. | Responsive margin (`ml-20` or `ml-64`), padding `px-6`. |
| **Desktop** | `≥ 1024px` (`lg`/`xl`) | Persistent, fully expanded sidebar (`w-64`) with category headers and badges. | Full topbar with breadcrumb trail, search placeholder (Cmd+K), notification bell, theme toggle, and user menu. | Max-width bounded (`max-w-7xl`) with generous `px-8` margins. |

---

## 4. Glassmorphic Surface Integration

The global shell strictly adheres to the glassmorphism parameters defined in Part 4.1:
1. **Backdrop Blur:** Constrained to **10px–16px** (`backdrop-blur-md` on `.glass-panel` and `.glass-nav`) to ensure maximum GPU performance on mobile devices.
2. **Opacity Bounds:**
   - Light Theme: Translucent surfaces at **72%–85%** opacity over `#F3F5F9`.
   - Dark Theme: Low-glare surfaces at **70%–75%** opacity over `#111827`.
3. **Specular Highlighting:** Top-edge border highlights (`--glass-highlight`) provide subtle elevation without loud drop shadows.
4. **Fallback Handling:** Implements `@supports not (backdrop-filter)` fallback background colors to ensure readable contrast on legacy browsers.

---

## 5. Elimination of Layout Duplication

Prior to Part 4.2, every persona layout (`(student)/layout.tsx`, `(faculty)/layout.tsx`, `(admin)/layout.tsx`, `(super-admin)/layout.tsx`, `(shared)/layout.tsx`) contained hardcoded HTML headers and disparate styling.

In Part 4.2:
- Each layout preserves its **Tier-2 Server Component Ingress Gate** (`getCurrentSession()`, authentication checks, suspension checks, role authorization).
- Once authorization succeeds, all layouts wrap their children in the unified `<AppShell user={session}>{children}</AppShell>`.
- The shell automatically adapts navigation links, titles, portal badges, and breadcrumbs to the authenticated role with zero redundant markup.

