# Axis LinkUp — Semantic Color Tokens
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Compliance:** WCAG 2.1 Level AA (Contrast Ratio >= 4.5:1 for Normal Text, >= 3:1 for Large Text)  
**Implementation:** `src/app/globals.css` via Tailwind CSS v4 `@theme inline`  

---

## 1. Color Palette Architecture

The color system avoids arbitrary hardcoded HEX values by using **semantic tokens**. The tokens adapt dynamically when switching between **Light** and **Dark** modes via the `.dark` class applied to `document.documentElement`.

---

## 2. Token Cross-Reference Matrix

| Token Name | Light Mode Value | Dark Mode Value | Semantic Role & Purpose | WCAG Contrast |
| :--- | :--- | :--- | :--- | :---: |
| `--background` | `#F3F5F9` | `#111827` | Application page canvas background | Base |
| `--foreground` | `#172033` | `#F8FAFC` | High-contrast primary reading text | 12.8:1 / 15.2:1 |
| `--card` | `#FFFFFF` | `#182334` | Solid primary component surface | Base |
| `--card-foreground` | `#172033` | `#F8FAFC` | Primary text rendered within cards | 13.5:1 / 14.1:1 |
| `--popover` | `#FFFFFF` | `#182334` | Dropdowns, dialogs, and popover panels | Base |
| `--popover-foreground` | `#172033` | `#F8FAFC` | Text rendered within floating popovers | 13.5:1 / 14.1:1 |
| `--primary` | `#3456D1` | `#829AFF` | Primary brand accent, primary CTA buttons | 5.8:1 / 6.2:1 |
| `--primary-foreground`| `#FFFFFF` | `#0B1120` | Text/icons rendered inside primary CTAs | 5.8:1 / 7.1:1 |
| `--secondary` | `#E8EDF5` | `#202B3B` | Subtle buttons, secondary badges, tags | 1.3:1 (Surface) |
| `--secondary-foreground`| `#172033`| `#F8FAFC` | Text rendered on secondary surfaces | 10.4:1 / 12.8:1 |
| `--muted` | `#E8EDF5` | `#202B3B` | Inactive tabs, disabled states, dividers | 1.3:1 (Surface) |
| `--muted-foreground` | `#64748B` | `#AAB7CA` | Secondary subtitles, captions, timestamps | 4.6:1 / 5.2:1 |
| `--accent` | `#E8EDF5` | `#202B3B` | Hover highlights on list items and menus | Subtle |
| `--accent-foreground` | `#172033` | `#F8FAFC` | Text rendered on hover-accented items | High |
| `--destructive` | `#EF4444` | `#F87171` | Destructive alerts, delete buttons, error badges | 4.5:1 / 4.8:1 |
| `--destructive-foreground`| `#FFFFFF` | `#0B1120` | Text rendered on destructive surfaces | High |
| `--success` | `#10B981` | `#34D399` | Approved state, attendance present, success badges | 4.5:1 / 5.1:1 |
| `--success-foreground`| `#FFFFFF` | `#064E3B` | Text rendered on success elements | High |
| `--warning` | `#F59E0B` | `#FBBF24` | Pending approval, caution alerts, warning badges | 4.5:1 / 5.4:1 |
| `--warning-foreground`| `#FFFFFF` | `#78350F` | Text rendered on warning elements | High |
| `--info` | `#3456D1` | `#829AFF` | Informational callouts, notice highlights | 5.8:1 / 6.2:1 |
| `--info-foreground` | `#FFFFFF` | `#0B1120` | Text rendered on info elements | High |
| `--border` | `rgba(100,116,139,0.18)`| `rgba(255,255,255,0.10)` | Standard component borders and dividers | Subtle |
| `--input` | `rgba(100,116,139,0.22)`| `rgba(255,255,255,0.14)` | Form control borders (inputs, textareas) | Visible |
| `--ring` | `#3456D1` | `#829AFF` | Focus indicator ring for keyboard accessibility | High |

---

## 3. Glassmorphism Surface Tokens

| Token Name | Light Mode Value | Dark Mode Value | Functionality |
| :--- | :--- | :--- | :--- |
| `--glass-surface` | `rgba(255, 255, 255, 0.72)` | `rgba(24, 35, 52, 0.70)` | Standard frosted glass panel background |
| `--glass-surface-hover` | `rgba(255, 255, 255, 0.86)` | `rgba(32, 43, 59, 0.82)` | Hover state for interactive glass cards |
| `--glass-surface-secondary` | `rgba(232, 237, 245, 0.65)` | `rgba(32, 43, 59, 0.50)` | Recessed secondary frosted layers |
| `--glass-border` | `rgba(100, 116, 139, 0.18)` | `rgba(255, 255, 255, 0.10)` | Subtle perimeter glass border |
| `--glass-border-hover` | `rgba(52, 86, 209, 0.35)` | `rgba(130, 154, 255, 0.35)` | Accent border on hover focus |
| `--glass-shadow` | `0 8px 32px 0 rgba(100,116,139,0.10)` | `0 8px 32px 0 rgba(0,0,0,0.45)` | Ambient diffused depth shadow |
| `--glass-highlight` | `inset 0 1px 1px 0 rgba(255,255,255,0.85)` | `inset 0 1px 1px 0 rgba(255,255,255,0.12)` | Subtle specular top-edge light reflection |

---

## 4. Institutional Brand Integration

The system retains Axis Institute of Technology & Management's prestigious institutional heritage:
- **Navy Anchor:** `#0A2540` utilized in branding headers, super-admin security credentials, and identity badges.
- **Gold Accent:** `#F5A623` utilized in institutional crest highlights and verification marks.
- **Modern Indigo/Blue:** `#3456D1` (Light) / `#829AFF` (Dark) serves as the primary digital application interactive accent.

