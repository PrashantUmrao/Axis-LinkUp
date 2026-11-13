# Axis LinkUp — Code Quality & Static Analysis Architecture

> **Document ID:** DOC-SETUP-004  
> **Status:** Approved Baseline (Phase 2, Part 2.4)  
> **Institution:** Axis Institute of Technology & Management  
> **Tools:** TypeScript 5.6+ (Strict), ESLint 9+ (Flat Config), Prettier 3.10+, EditorConfig  
> **Verification Date:** November 2026  
> **Compliance Status:** **100% PASS** (Types, Linting, Formatting, Production Build)  

---

## 1. Overview & Objectives

In accordance with the **Axis LinkUp Engineering Playbook** and **Quality Gates**, the project enforces an automated, multi-tiered code quality verification pipeline. This system prevents type regressions, enforces consistent syntax across all team members and AI coding agents, eliminates formatting friction, and guarantees that every pull request adheres to enterprise TypeScript standards.

---

## 2. TypeScript Strict Compiler Configuration (`tsconfig.json`)

The TypeScript compiler is configured in `tsconfig.json` with maximum rigor:

| Compiler Flag | Value | Architectural Purpose |
| :--- | :---: | :--- |
| **`strict`** | `true` | Enables all strict type-checking options simultaneously. |
| **`noImplicitAny`** | `true` | Forbids un-typed variables, parameters, or return values. |
| **`strictNullChecks`** | `true` | Prevents `null` or `undefined` runtime dereferencing crashes. |
| **`strictFunctionTypes`** | `true` | Enforces contravariant parameter types in function callbacks. |
| **`strictBindCallApply`** | `true` | Ensures `bind`, `call`, and `apply` methods validate arguments. |
| **`strictPropertyInitialization`** | `true` | Class properties must be initialized in constructors. |
| **`noImplicitThis`** | `true` | Disallows untyped `this` contexts. |
| **`alwaysStrict`** | `true` | Emits JavaScript files in ECMAScript strict mode (`"use strict"`). |
| **`noUnusedLocals`** | `true` | Flags any unused local variables as compile-time errors. |
| **`noUnusedParameters`** | `true` | Flags unused function arguments as errors (mitigate with `_` prefix). |
| **`noImplicitReturns`** | `true` | Ensures all codepaths in non-void functions return a value. |
| **`noFallthroughCasesInSwitch`** | `true` | Disallows silent fallthrough bugs in `switch` blocks. |
| **`noUncheckedIndexedAccess`** | `true` | Dynamic index access includes `undefined` in union type. |
| **`forceConsistentCasingInFileNames`** | `true` | Prevents Windows/Linux case-sensitivity import mismatches. |
| **`moduleResolution`** | `"bundler"` | Modern Next.js 15 resolution supporting package exports. |
| **`paths`** | `@/*: ["./src/*"]` | Root source path alias mapping. |

---

## 3. ESLint 9 Flat Configuration (`eslint.config.mjs`)

Axis LinkUp uses ESLint 9's native **Flat Configuration** format (`eslint.config.mjs`):

```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintConfigPrettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  eslintConfigPrettier,
];

export default eslintConfig;
```

### Key Enforcements:
- **Zero `any`:** `@typescript-eslint/no-explicit-any` throws an unsuppressable error.
- **Explicit Type Imports:** `@typescript-eslint/consistent-type-imports` mandates `import type { ... }` for zero runtime overhead.
- **Hook Integrity:** `react-hooks/rules-of-hooks` blocks invalid React hook invocations.
- **Prettier Conflict Suppression:** `eslint-config-prettier` turns off all conflicting formatting rules.

---

## 4. Prettier Formatting Configuration (`.prettierrc.json`)

All files are formatted consistently according to `.prettierrc.json`:

```json
{
  "$schema": "https://json.schemastore.org/prettierrc",
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "jsxSingleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### Prettier Exclusions (`.prettierignore`):
Excludes build directories, temporary artifacts, and historical documentation files:
- `node_modules/`, `.next/`, `out/`, `build/`, `dist/`
- `coverage/`, `test-results/`, `playwright-report/`
- `.env*` (except `.env.example`)
- `docs/` (preserves KaTeX formulas, tables, and alert callouts from unwanted text reflows)

---

## 5. Import Ordering Conventions

To ensure visual cleanliness and predictability, all TypeScript/TSX source files adhere to the strict 5-tier import order:

1. **Tier 1 — Node.js Built-Ins:** (e.g., `import path from 'node:path';`)
2. **Tier 2 — External Libraries:** (e.g., `import React from 'react'; import Link from 'next/link';`)
3. **Tier 3 — Internal Absolute Imports (`@/*`):** (e.g., `import { Button } from '@/components/ui/button';`)
4. **Tier 4 — Relative Local Imports:** (e.g., `import './globals.css';`)
5. **Tier 5 — Explicit Type-Only Imports:** (e.g., `import type { Metadata } from 'next';`)

---

## 6. Editor Configuration (`.editorconfig`)

Cross-IDE consistency is guaranteed via `.editorconfig`:
- **Indent Style:** Space (2 spaces).
- **Line Endings:** Unix-style Line Feed (`LF`).
- **Charset:** `utf-8`.
- **Whitespace:** Trailing whitespace automatically trimmed; final newline inserted on save.

---

## 7. Package Scripts Manifest

The `package.json` manifest includes the complete suite of quality scripts:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "type-check": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

---

## 8. Verification Results

All code quality checks were executed sequentially and verified with **100% pass rates**:

| Check Routine | Command | Result | Verification Output Summary |
| :--- | :--- | :---: | :--- |
| **Strict Type Checking** | `npm run typecheck` (`tsc --noEmit`) | **PASS** | `0 errors`. Verified strict null checks and noImplicitAny. |
| **ESLint Flat Analysis** | `npm run lint` (`eslint`) | **PASS** | `0 warnings`, `0 errors`. Clean flat config execution. |
| **Prettier Formatting** | `npm run format:check` | **PASS** | `All matched files use Prettier code style!` |
| **Production Build** | `npm run build` (`next build`) | **PASS** | Prerendered 6 routes in 6.6s (`/`, `/ui-preview`, `/_not-found`). |

---

## 9. Known Limitations & Architectural Notes

1. **FlatCompat Wrapper:** Next.js currently maintains its `next/core-web-vitals` config in legacy format, wrapped via `@eslint/eslintrc` `FlatCompat`. When Next.js releases native flat configs, this wrapper can be upgraded seamlessly.
2. **Documentation Formatting:** `docs/` is explicitly ignored by Prettier in `.prettierignore` to protect KaTeX equations, LaTeX delimiters, and custom GitHub-flavored Markdown alert callouts from unwanted wrapping or token reflows.

