# Axis LinkUp — Design Tokens & Theming Specification

> **Document ID:** DOC-UI-002  
> **Status:** Approved Baseline (Phase 2, Part 2.3)  
> **Institution:** Axis Institute of Technology & Management  
> **Color Model:** CSS Custom Properties with OKLCH Color Space  
> **Theming Engine:** Class-based theme switching (`.dark` on `<html>`)  
> **Last Updated:** November 2026  

---

## 1. Design Token Architecture

Axis LinkUp uses a semantic design token architecture where visual styling is decoupled from specific hard-coded hexadecimal codes. Components consume tokens via functional utility classes (`bg-background`, `text-foreground`, `border-border`, `bg-primary`), which map directly to CSS custom properties defined in `src/app/globals.css`.

---

## 2. Master CSS Variables Dictionary

### 2.1 Core Semantic Tokens

| Token Name | Light Mode Value (OKLCH) | Dark Mode Value (OKLCH) | Semantic Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(1 0 0)` (#ffffff) | `oklch(0.145 0 0)` (#171717) | Global viewport canvas background. |
| `--foreground` | `oklch(0.145 0 0)` (#171717) | `oklch(0.985 0 0)` (#fafafa) | Primary body text and high-contrast labels. |
| `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Background surface for cards, dialogs, drawers. |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Text content rendered directly inside cards. |
| `--popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Floating overlay container (tooltips, dropdowns). |
| `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Text inside popovers and menus. |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | Primary call-to-action button, active tab indicator. |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | Contrast text rendered inside primary containers. |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Secondary buttons, subtle filter pills, badges. |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Text rendered on secondary surfaces. |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Disabled backgrounds, skeleton placeholders. |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | De-emphasized timestamps, helper descriptions. |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Interactive hover background for menu items. |
| `--accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Text on hovered interactive items. |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Emergency alerts, delete actions, error states. |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Subtle borders for containers, cards, and dividers. |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | Form field outline and input borders. |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Accessible focus outline rings on tab/focus. |

---

## 3. Border Radius System

Border radii are mathematically scaled off a single base token `--radius: 0.625rem` (10px):

```css
--radius-sm:  calc(var(--radius) * 0.6);   /* ~6px  - Small badges & code chips */
--radius-md:  calc(var(--radius) * 0.8);   /* ~8px  - Buttons & form inputs */
--radius-lg:  var(--radius);               /* ~10px - Standard cards & popovers */
--radius-xl:  calc(var(--radius) * 1.4);   /* ~14px - Modal dialog containers */
--radius-2xl: calc(var(--radius) * 1.8);   /* ~18px - Heavy dashboard cards */
```

---

## 4. Spacing & Container Conventions

- **Page Ingress Margin:** Mobile `px-4`, Tablet `px-6`, Desktop `px-8`.
- **Max Content Widths:**
  - Standard Forms & Modals: `max-w-xl` (576px)
  - Data Tables & Feeds: `max-w-5xl` (1024px)
  - Institutional Dashboards: `max-w-7xl` (1280px)
- **Component Padding Scale:**
  - Card Body: `p-4 sm:p-6`
  - Modal Dialog Content: `p-6`
  - Input Fields: `px-2.5 py-1` (height `h-8` or `h-10`)

---

## 5. Theme Switching Implementation

- **Strategy:** Class-based theme toggling using the `.dark` class applied to `<html>` or `<body>`.
- **Media Query Synchronization:** Respects OS preferences (`prefers-color-scheme: dark`) by default while permitting explicit user overrides stored in `localStorage`.

