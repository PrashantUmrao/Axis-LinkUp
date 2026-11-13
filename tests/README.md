# Test Architecture & Organization (`tests/`)

This directory houses test suites, test fixtures, integration helpers, and end-to-end automation scripts for **Axis LinkUp**.

## 1. Directory Structure

```text
tests/
├── unit/               # Pure algorithmic and utility unit tests (Vitest)
├── integration/        # Service-repository and database pipeline integration tests (Vitest)
└── e2e/                # Cross-role end-to-end user journey tests (Playwright)
```

## 2. Testing Frameworks

- **Unit & Integration:** Powered by **Vitest** with happy-dom environment for high-speed, native TypeScript and ESM execution.
- **End-to-End (E2E):** Powered by **Playwright**, executing automated multi-browser tests (Chromium, Firefox, WebKit) simulating Student, Faculty, Admin, and Super Admin user flows.
- **Co-located Feature Tests:** Specific feature component tests and service unit tests may also be co-located within feature directories under `src/features/{domain}/__tests__/`.
