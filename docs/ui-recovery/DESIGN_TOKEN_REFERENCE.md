# AXIS LINKUP — DESIGN TOKEN REFERENCE
**Authoritative Semantic Token Specification**  
*Document Version:* 2.0.0  
*Phase:* 4.8.3 — Premium Design System & Visual Identity Refinement  
*Institution:* Axis Institute of Technology & Management (AITM), Kanpur  
*Last Updated:* November 13, 2026  

---

## 1. Overview & Architectural Philosophy

The **Axis LinkUp Design Token System** establishes a single source of truth for color, elevation, typography, geometry, and glassmorphism across all student, faculty, and administrative interfaces.

The token system combines:
1. **Reference 1 (Visual Identity):** Atmospheric sky-blue background, luminous frosted glass panels, translucent white borders, specular edge reflections, and refined vibrant royal blue accents.
2. **Reference 2 (Layout & Composition):** High-density SaaS grid hierarchy, 4-column KPI rows, capsule pills, and balanced whitespace.

---

## 2. Color Tokens

### 2.1 Core Palette Matrix

| Semantic Token | Light Mode Value | Dark Mode Value | Contrast Ratio (vs Surface) | Primary Usage |
| :--- | :--- | :--- | :---: | :--- |
| `--background` | `#edf5fd` (Sky-Blue Atmosphere) | `#08111f` (Deep Sapphire Navy) | — | Global page backdrop |
| `--foreground` | `#0f1c30` (Deep Ink Navy) | `#f8fafc` (Slate Crisp White) | 12.8:1 / 14.5:1 | Primary headings, body copy |
| `--card` | `rgba(255, 255, 255, 0.70)` | `rgba(14, 28, 50, 0.65)` | — | Dashboard cards, modules |
| `--card-foreground` | `#0f1c30` | `#f8fafc` | 12.4:1 / 13.9:1 | Card text and metric labels |
| `--popover` | `#ffffff` | `#0e1c32` | — | Dropdowns, dialogs, tooltips |
| `--popover-foreground`| `#0f1c30` | `#f8fafc` | 13.2:1 / 13.8:1 | Overlay text |
| `--primary` | `#2563eb` (Vibrant Royal Blue) | `#3b82f6` (Luminous Cerulean) | 4.8:1 / 5.2:1 | Primary CTA buttons, active pills |
| `--primary-foreground`| `#ffffff` | `#ffffff` | 5.1:1 / 4.9:1 | Text inside primary buttons/pills |
| `--secondary` | `#e0edf9` | `#162844` | — | Secondary buttons, subtle panels |
| `--secondary-foreground`| `#0f1c30` | `#f8fafc` | 10.2:1 / 11.5:1 | Secondary button text |
| `--muted` | `#e2effa` | `#13243f` | — | Disabled states, chip backgrounds |
| `--muted-foreground` | `#475d7e` | `#94a3b8` | 5.2:1 / 6.8:1 | Subtitles, helper text, timestamps |
| `--accent` | `#dcecf9` | `#192e4e` | — | Hover highlight on list items |
| `--accent-foreground` | `#0f1c30` | `#f8fafc` | 11.1:1 / 12.1:1 | Highlighted text |
| `--border` | `rgba(147, 197, 253, 0.35)` | `rgba(255, 255, 255, 0.12)` | — | Subtle card & divider borders |
| `--input` | `rgba(147, 197, 253, 0.40)` | `rgba(255, 255, 255, 0.15)` | — | Form field outline borders |
| `--ring` | `#2563eb` | `#3b82f6` | — | Two-tier keyboard focus rings |

### 2.2 Semantic Status & Feedback Tokens

| Semantic Token | Light Mode Value | Dark Mode Value | Usage & Meaning |
| :--- | :--- | :--- | :--- |
| `--success` | `#10b981` (Emerald) | `#34d399` | Approved, active status, attendance safe (>=75%) |
| `--warning` | `#f59e0b` (Amber) | `#fbbf24` | Pending action, low attendance warning (65%–74%) |
| `--destructive` | `#ef4444` (Ruby) | `#f87171` | Critical error, critical attendance (<65%), rejection |
| `--info` | `#2563eb` (Royal Blue) | `#60a5fa` | Informational announcements, academic circulars |

### 2.3 Chart & Data Visualization Tokens

| Semantic Token | Light Mode Value | Dark Mode Value | Recommended Visualization |
| :--- | :--- | :--- | :--- |
| `--chart-1` | `#2563eb` | `#60a5fa` | Primary series (Overall Attendance Track) |
| `--chart-2` | `#10b981` | `#34d399` | Secondary series (Completed Submissions) |
| `--chart-3` | `#f59e0b` | `#fbbf24` | Tertiary series (Pending Evaluations) |
| `--chart-4` | `#8b5cf6` | `#a78bfa` | Elective & Specialization distribution |
| `--chart-5` | `#06b6d4` | `#38bdf8` | Laboratory & Practical metrics |

---

## 3. Glassmorphism Design Tokens

```css
:root {
  /* Surface Fills */
  --glass-surface: rgba(255, 255, 255, 0.65);
  --glass-surface-hover: rgba(255, 255, 255, 0.82);
  --glass-surface-secondary: rgba(235, 244, 254, 0.60);
  --glass-master-canvas: rgba(255, 255, 255, 0.50);

  /* Borders & Highlights */
  --glass-border: rgba(255, 255, 255, 0.75);
  --glass-border-hover: rgba(37, 99, 235, 0.40);
  --glass-highlight: inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.90);

  /* Ambient Shadows */
  --glass-shadow: 0 12px 36px -6px rgba(37, 99, 235, 0.08);
}

.dark {
  /* Surface Fills */
  --glass-surface: rgba(14, 28, 50, 0.65);
  --glass-surface-hover: rgba(20, 38, 66, 0.78);
  --glass-surface-secondary: rgba(18, 35, 62, 0.50);
  --glass-master-canvas: rgba(10, 20, 36, 0.65);

  /* Borders & Highlights */
  --glass-border: rgba(255, 255, 255, 0.12);
  --glass-border-hover: rgba(96, 165, 250, 0.40);
  --glass-highlight: inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.15);

  /* Ambient Shadows */
  --glass-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.55);
}
```

---

## 4. Curvature & Radius Tokens

| Token Name | Computed Value | Pixels | Reference Usage |
| :--- | :--- | :---: | :--- |
| `--radius-xs` | `calc(var(--radius) * 0.4)` | 4.8px | Micro badges, status indicators |
| `--radius-sm` | `calc(var(--radius) * 0.6)` | 7.2px | Dropdown items, tooltips |
| `--radius-md` | `calc(var(--radius) * 0.8)` | 9.6px | Compact buttons, inputs |
| `--radius-lg` | `var(--radius)` | 12.0px | Standard dialogs, nested cards |
| `--radius-xl` | `calc(var(--radius) * 1.35)` | 16.0px | Standard dashboard glass cards |
| `--radius-2xl` | `calc(var(--radius) * 1.8)` | 21.6px | Large content panels, side rails |
| `--radius-3xl` | `calc(var(--radius) * 2.2)` | 26.4px | Elevated modals, mobile drawers |
| `--radius-4xl` | `calc(var(--radius) * 2.6)` | 31.2px | Hero banners |
| `--radius-canvas`| `2.0rem` | 32.0px | Floating master canvas container (Ref 2) |
| `--radius-full` | `9999px` | Capsule | Pills, search bar, active buttons, avatars |

---

## 5. Typography Scale & Font Tokens

- **Font Sans:** `var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif`
- **Font Mono:** `var(--font-geist-mono), ui-monospace, monospace`
- **Font Heading:** `var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif`

| Typography Role | Tailwind Classes | Size / Line Height | Tracking | Weight | Example |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Hero Title** | `text-3xl sm:text-4xl font-bold` | 30px–36px / 1.15 | `tracking-tight` | Bold (700) | Landing Page Hero |
| **Page Title** | `text-2xl sm:text-3xl font-bold` | 24px–30px / 1.20 | `tracking-tight` | Bold (700) | Dashboard Greeting |
| **Section Header** | `text-lg sm:text-xl font-semibold` | 18px–20px / 1.30 | `tracking-tight` | SemiBold (600) | "Upcoming Assessments" |
| **Card Header** | `text-sm sm:text-base font-semibold` | 14px–16px / 1.40 | Normal | SemiBold (600) | "Attendance Track" |
| **Metric Digit** | `text-2xl sm:text-3xl font-bold` | 24px–30px / 1.10 | `tracking-tight` | Bold (700) | "84.5%", "25" |
| **Metric Label** | `text-xs font-medium` | 12px / 1.40 | Normal | Medium (500) | "Semester Attendance" |
| **Body Primary** | `text-sm font-normal` | 14px / 1.50 | Normal | Regular (400) | General prose |
| **Body Small** | `text-xs font-normal` | 12px / 1.50 | Normal | Regular (400) | Helper text, hints |
| **Navigation Link** | `text-xs font-medium` | 12px / 1.35 | Normal | Medium (500) | Sidebar items |
| **Micro Caption** | `text-[10px] font-medium` | 10px / 1.30 | Normal | Medium (500) | Badges, timestamps |

---

## 6. Elevation & Depth Scale

| Elevation Level | Class | Light Mode Effect | Dark Mode Effect |
| :--- | :--- | :--- | :--- |
| **Base Surface** | `.glass-panel` | `shadow-[var(--glass-shadow)]` | Deep ambient shadow |
| **Elevated Card** | `.glass-card` | Lift on hover (`-translate-y-0.5`) + shadow expansion | Elevated glow on hover |
| **Floating Canvas**| `.glass-canvas` | `shadow-2xl shadow-blue-900/10` + `rounded-[32px]` | High optical depth |
| **Capsule Control**| `.glass-pill` | `shadow-sm shadow-blue-500/10` | Subtle specular outline |
| **Modal / Dialog** | `.glass-modal` | `shadow-2xl` with 20px blur backdrop | High-contrast elevation |

