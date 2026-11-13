# AXIS LINKUP — COMPONENT DESIGN SPECIFICATION
**Standardized Component Architecture & UI Specification**  
*Document Version:* 2.0.0  
*Phase:* 4.8.3 — Premium Design System & Visual Identity Refinement  
*Institution:* Axis Institute of Technology & Management (AITM), Kanpur  
*Last Updated:* November 13, 2026  

---

## 1. Component System Overview

The **Axis LinkUp Component System** is engineered on accessible Radix UI primitives and Tailwind CSS v4, styled in strict conformity with the synthesized **Reference 1 (Visual Identity)** and **Reference 2 (Layout & Density)** design specifications.

All components adhere to five core requirements:
1. **Single Source of Semantic Tokens:** Zero hardcoded colors; all components consume semantic CSS variables.
2. **Dual-Theme Fidelity:** Flawless rendering in both Light (sky-blue glass) and Dark (deep sapphire midnight) modes.
3. **Geometry Consistency:** Unified radius scale from micro-badges (`rounded-full`) to master canvas containers (`rounded-[32px]`).
4. **Touch & Keyboard Accessibility:** Minimum 44px hit targets on mobile, dual-tier focus rings (`focus-visible:ring-2 focus-visible:ring-ring/40`), and full ARIA compliance.
5. **Truth-in-UI:** Zero mock data; components cleanly render authentic collegiate data with robust empty and loading states.

---

## 2. Navigation Components

### 2.1 Desktop & Tablet Sidebar (`<Sidebar />`)
- **Proportions:** Fixed left rail, width `w-64` expanded, collapsible to `w-20` rail mode on desktop (`>=md`).
- **Surface:** `.glass-panel` with subtle translucent border (`border-r-border/40`).
- **Institutional Branding:** Top header with collegiate icon box (`size-9 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20`) and dual-line platform title.
- **Groupings:** Clear uppercase section labels: `WORKSPACE`, `MODULES`, `SETTINGS` (`text-[10px] font-semibold tracking-wider text-muted-foreground`).

### 2.2 Navigation Item & Active State (`renderNavItem`)
- **Geometry:** `rounded-xl` with smooth transition (`transition-all duration-150`).
- **Active State (Reference 1):** Solid royal blue capsule pill (`bg-primary text-primary-foreground font-semibold shadow-xs shadow-primary/30`).
- **Inactive State:** `text-muted-foreground hover:bg-glass-surface-hover hover:text-foreground`.
- **Disabled Modules:** Graceful opacity (`opacity-55`) with informative tooltip explaining future rollout phases.

### 2.3 Sticky Topbar (`<Topbar />`)
- **Surface:** `.glass-nav` with bottom blur highlight (`backdrop-blur(16px)`).
- **Search Bar (Reference 1 & 2):** High-utility capsule search pill (`rounded-full h-8.5 w-60 glass-panel border px-3.5 text-xs text-muted-foreground`).
- **Interactive Controls:** Icon buttons (`size-9 rounded-lg hover:bg-muted/50`), theme toggle, and user profile avatar menu.

### 2.4 Mobile Drawer (`<MobileDrawer />`)
- **Behavior:** Slide-over drawer on small viewports (`<md`), full height `w-72 max-w-[85vw]`.
- **Overlay:** Frosted blur overlay (`bg-black/40 backdrop-blur-sm`).
- **Touch Targets:** Minimum 44px vertical height (`min-h-[44px]`) for touch ergonomics.

---

## 3. Layout Components

### 3.1 Floating Master Canvas (`.glass-canvas`)
- **Role:** Floating master frame enveloping dashboard surfaces, inspired by Reference 2's structured dashboard container.
- **Styling:** `rounded-[32px]`, `backdrop-blur(20px)`, `border-1px solid var(--glass-border)`, ambient blue shadow.

### 3.2 Responsive Content Container (`<ContentContainer />`)
- **Padding:** `px-4 py-6 sm:px-6 lg:px-8` with centralized bounds (`max-w-7xl` default, `max-w-4xl` narrow, `max-w-full` full).
- **Page Header:** Standardized title (`text-2xl sm:text-3xl font-bold tracking-tight`), subtitle, role badge slot, and primary action group.

### 3.3 Dashboard Grid System (Reference 2 Grid)
- **Top Metric Row:** 4-column responsive grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`).
- **Analytical Canvas Split:** 2/3 main analytical canvas + 1/3 right-hand activity rail (`grid grid-cols-1 lg:grid-cols-3 gap-6`).

---

## 4. Data Display Components

### 4.1 KPI & Statistics Cards
- **Structure:**
  - Value: Large primary digit (`text-2xl sm:text-3xl font-bold tracking-tight font-heading`).
  - Label: Clean descriptive text (`text-xs font-medium text-muted-foreground`).
  - Trend Indicator: Capsule pill showing delta or threshold (`+2.4% Safe`, `All Clear`, `3 Active`).
- **Surface:** `.glass-card` with hover elevation lift (`hover:-translate-y-0.5`).

### 4.2 Status Badges (`<Badge />`)
- **Geometry:** Capsule pill (`rounded-full` / `rounded-4xl`), compact height `h-5`.
- **Variants:**
  - `default`: Primary royal blue fill (`bg-primary text-primary-foreground`).
  - `glass`: Frosted glass pill with subtle border (`glass-panel text-foreground`).
  - `success`: Emerald accent (`bg-success/15 text-success border border-success/30`).
  - `warning`: Amber accent (`bg-warning/15 text-warning border border-warning/30`).
  - `destructive`: Ruby accent (`bg-destructive/15 text-destructive border border-destructive/30`).
  - `info`: Royal blue accent (`bg-info/15 text-info border border-info/30`).

### 4.3 Data Tables
- **Header:** Sticky translucent header with subtle bottom border (`text-xs font-semibold text-muted-foreground`).
- **Rows:** Alternating subtle hover state (`hover:bg-glass-surface-hover/70 transition-colors`).
- **Numeric Data:** Tabular numbers (`tabular-nums`) right-aligned for readability.

---

## 5. Forms & Interaction Components

### 5.1 Buttons (`<Button />`)
- **Standard Variants:**
  - `default`: Solid primary royal blue with hover brightness.
  - `outline`: Subtle border with glass hover highlight.
  - `secondary`: Soft sky-blue (Light) / sapphire (Dark) background.
  - `ghost`: Transparent with subtle hover.
  - `glass`: Translucent glass button with specular edge.
  - `glass-primary`: Royal blue tinted translucent button (`bg-primary/15 border-primary/30`).
  - `pill-primary`: Reference 1 rounded pill action button (`rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25`).
  - `pill-glass`: Reference 1 rounded pill frosted button (`glass-pill text-foreground hover:text-primary`).

### 5.2 Input & Textarea (`<Input />`, `<Textarea />`)
- **Variant `glass`:**
  - Background: `bg-glass-surface/60` with `backdrop-blur-md`.
  - Border: `border-glass-border`.
  - Focus Ring: `focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30`.

### 5.3 Select & Dropdown Menus (`<Select />`, `<DropdownMenu />`)
- **Dropdown Surface:** `.glass-dropdown` with 16px blur, rounded-xl curvature, and specular rim.
- **Items:** `rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:bg-accent focus:text-accent-foreground`.

### 5.4 Dialogs & Modals (`<Dialog />`)
- **Overlay:** Soft dark blur overlay (`bg-black/30 backdrop-blur-xs`).
- **Content Panel:** `.glass-modal` with 20px blur, `rounded-2xl` curvature, specular edge highlight, and maximum width bounds (`sm:max-w-lg`).

