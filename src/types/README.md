# Global TypeScript Type Architecture (`src/types/`)

This directory houses cross-cutting TypeScript definitions, API response envelopes, authentication claims, and institutional constants for **Axis LinkUp**.

## 1. Directory Structure

```text
src/types/
├── api.ts              # Standard API response envelopes (ApiResponse<T>, PaginatedResponse<T>)
├── auth.ts             # Session claims, Clerk publicMetadata shape, token payloads
├── common.ts           # Generic utility types: ID, Timestamps, Nullable, DeepPartial
├── enums.ts            # Canonical const-assertion enums (UserRole, NoticePriority, RequestStatus)
└── database.ts         # Base Mongoose document definitions and lean transformation helpers
```

## 2. Single Source of Truth Principle

To prevent drift between database documents, runtime validation, and UI presentations:

1. **Zod First for Inputs:** Request payloads are defined in Zod schemas (`src/lib/validations/` or `src/features/*/schemas/`); types are inferred via `z.infer<typeof schema>`.
2. **Plain DTOs for Presentation:** Client components consume clean, plain-object DTOs (Data Transfer Objects) where `_id` is transformed to string `id` and internal Mongoose metadata (`__v`) is stripped.
3. **Const Assertions Over Numeric Enums:** Role taxonomy and status codes use `const` objects with union types (`as const`) for literal string compatibility and clean JS emit.
