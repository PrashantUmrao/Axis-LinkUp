# Axis LinkUp — Typography System
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Font Families:** Geist Sans (`--font-geist-sans`), Geist Mono (`--font-geist-mono`)  
**Implementation:** `src/app/globals.css`, `src/app/layout.tsx` via `next/font/google`  

---

## 1. Typographic Hierarchy

The typography system is engineered for maximum readability across academic coursework, administrative tables, and communication channels:

| Level | Desktop Size / Line-Height | Mobile Size | Weight | Tracking | Tailored Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display 1** | `48px` (3rem) / `1.15` | `36px` (2.25rem) | `700` Bold | `-0.025em` | Main landing headlines, hero titles |
| **Page Heading** | `30px` (1.875rem) / `1.25` | `24px` (1.5rem) | `700` Bold | `-0.02em` | Portal views, dashboard titles |
| **Section Heading** | `20px` (1.25rem) / `1.35` | `18px` (1.125rem) | `600` Semibold | `-0.015em` | Module cards, major subsections |
| **Card Heading** | `16px` (1rem) / `1.4` | `15px` (0.9375rem) | `600` Semibold | `-0.01em` | Course titles, notice headings |
| **Subheading / Meta** | `14px` (0.875rem) / `1.4` | `13px` (0.8125rem) | `500` Medium | `normal` | Profile subtitles, table column headers |
| **Body Regular** | `14px` (0.875rem) / `1.5` | `14px` (0.875rem) | `400` Normal | `normal` | Academic notices, post bodies, descriptions |
| **Body Small** | `13px` (0.8125rem) / `1.5` | `12px` (0.75rem) | `400` Normal | `normal` | Secondary descriptions, helper text |
| **Labels & Form** | `12px` (0.75rem) / `1.2` | `12px` (0.75rem) | `500` Medium | `0.01em` | Input labels, button text, badges |
| **Captions & Meta** | `11px` (0.6875rem) / `1.2` | `10px` (0.625rem) | `400` Normal | `0.02em` | Timestamps, status indicators, footers |
| **Code / Monospace** | `12px` (0.75rem) / `1.4` | `11px` (0.6875rem) | `400` Normal | `normal` | Roll numbers, employee IDs, hashes |

---

## 2. Utility Class Standards

### Heading Utility
```tsx
// Page Title
<h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
  Student Academic Portal
</h1>

// Section Header
<h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
  Enrolled Courses (Semester 7)
</h2>

// Card Title
<h3 className="font-heading text-base font-semibold text-foreground">
  CS-401: Distributed Systems
</h3>
```

### Body & Secondary Text Utility
```tsx
// Primary Body Text
<p className="text-foreground text-sm leading-relaxed">
  Attendance records have been synchronized with university servers.
</p>

// Secondary Muted Subtitle
<p className="text-muted-foreground text-xs leading-normal">
  Updated 12 minutes ago • Verified by Department Dean
</p>
```

---

## 3. Font Loading & Performance

1. **Zero Layout Shift (CLS):** Loaded via `next/font/google` with CSS variables `--font-geist-sans` and `--font-geist-mono` preloaded at build time.
2. **System Fallbacks:** Fallback to `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` guarantees instant render on slow or offline networks.

