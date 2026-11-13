# Shared Component Architecture (`src/components/`)

This directory houses all domain-agnostic, reusable presentation components for **Axis LinkUp**, organized into a strict 3-tier hierarchy.

## 1. Component Tiers

| Tier                          | Directory     | Responsibility                                                                                 | Guidelines                                                                                       |
| :---------------------------- | :------------ | :--------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| **Tier 1: UI Primitives**     | `ui/`         | Headless, accessible primitives based on shadcn/ui and Radix UI                                | Never import domain logic, Mongoose models, or feature code. Styled with design tokens via `cn`. |
| **Tier 2: Shared Composites** | `shared/`     | Reusable cross-feature widgets (data tables, file dropzones, emergency banners, status badges) | May compose multiple Tier 1 primitives. Must remain completely domain-agnostic.                  |
| **Tier 3: Layout Shells**     | `layouts/`    | Structural shells for roles (student bottom dock, faculty sidebar, admin console)              | Embeds navigation, user headers, and notification triggers.                                      |
| **Navigation**                | `navigation/` | Nav bars, breadcrumb trails, mobile drawers, and link rails                                    | Reusable across layout shells.                                                                   |

## 2. Directory Structure

```text
src/components/
├── ui/                 # Headless shadcn/ui primitives (button, card, dialog, input, etc.)
├── shared/             # Domain-agnostic composite components (data-table, dropzone, badges)
├── layouts/            # Role-specific dashboard layouts & shells
└── navigation/         # Header bars, sidebars, bottom nav rails
```

## 3. Boundary Rules

1. **No Database Imports:** Components in this directory must **never** import database models, repositories, or server-only utilities.
2. **Atomic Composition:** Tier 3 (`layouts/`) composes Tier 2 (`shared/`) and Tier 1 (`ui/`). Tier 2 composes Tier 1. Tier 1 has zero internal dependencies.
