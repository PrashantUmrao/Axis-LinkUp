# Axis LinkUp — Phase 5.2.6: Email OTP Verification System Implementation Report

**Author:** Axis LinkUp Engineering Team  
**Date:** November 15, 2026  
**Status:** Completed & Fully Verified  
**Target Platform:** Axis Institute of Technology & Management (AITM), Kanpur  

---

## 1. Executive Summary

Phase 5.2.6 implements a production-grade, cryptographically secure **Email OTP Verification System** for Axis LinkUp. The system is designed to provide identity verification for institutional account activation, email verification, and password recovery (coordinated with Phase 5.2.7) without introducing a separate password authentication system or compromising Clerk IAM.

### Key Architectural Achievements:
1. **Cryptographic Integrity & Timing-Safe Hashing:** 6-digit numeric OTP codes are generated via `crypto.randomInt(100000, 1000000)`, hashed immediately via SHA-256 before persistence, and compared using `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
2. **Strict Expiration & Replay Defense:** OTP codes have an ephemeral 5-minute time-to-live (`OTP_EXPIRATION_MS = 300,000`), enforced at both application and database levels via MongoDB TTL indexes (`expiresAt: 1, expireAfterSeconds: 0`). Successfully verified codes are atomically marked consumed to prevent replay.
3. **Resend Cooldown & Attempt Limit Protection:** Implemented a strict 60-second resend cooldown (`RESEND_COOLDOWN_MS = 60,000`) and a maximum limit of 5 failed attempts. Attempt exhaustion immediately invalidates the OTP with an HTTP 429 (`RATE_LIMIT_EXCEEDED`).
4. **Zero OTP Telemetry Exposure & Email Masking:** The `EmailService` masks email local parts (`aa***@axiscolleges.in`) and strictly forbids logging raw 6-digit OTP codes in logs, audit records, or telemetry.
5. **Accessible Frontend OTP Input:** Built an accessible, discrete 6-digit input component (`<OtpInput />`) featuring auto-advance, backspace regression, paste parsing, dynamic 60-second cooldown timer, remaining attempts warning, and glassmorphic styling.
6. **Account Activation Flow Integration:** Integrated OTP verification into the `/activate` route, offering a seamless two-step activation experience: verifying the institutional email followed by establishing permanent credentials.
7. **Phase 5.2.7 Coordination:** Upon successful verification, an HMAC-SHA256 signed `verificationProofToken` is issued to authorize single-use password recovery requests.

---

## 2. Cryptographic & Security Architecture

### 2.1 Security Parameters

| Parameter | Configuration | Security Purpose |
| :--- | :--- | :--- |
| **Code Format** | 6-digit numeric (`100000`–`999999`) | Institutional standard, user-friendly, high entropy |
| **Generation Primitive** | `crypto.randomInt(100000, 1000000)` | Cryptographically secure pseudo-random number generator (CSPRNG) |
| **Storage Primitive** | SHA-256 (`crypto.createHash('sha256')`) | Raw codes are never stored in plain text in MongoDB |
| **Comparison Primitive** | `crypto.timingSafeEqual` | Eliminates timing-attack vectors during hash validation |
| **TTL Window** | 5 minutes (300,000 ms) | Limits exposure of active verification windows |
| **Resend Cooldown** | 60 seconds (60,000 ms) | Prevents email inbox flooding and denial-of-service |
| **Max Verification Attempts** | 5 attempts | Defends against brute-force guessing attacks |
| **Replay Defense** | Atomic single-use consumption (`isConsumed: true`) | Pre-empts token reuse across multiple requests |
| **Proof Token** | HMAC-SHA256(`email:purpose:timestamp`, `secret`) | Authorizes downstream actions in Phase 5.2.7 |

### 2.2 Purpose Isolation

OTP records strictly enforce scope boundaries across 3 collegiate purposes:
- `email_verification`: Verifying institutional email ownership during profile changes or administrative requests.
- `account_activation`: Validating institutional email ownership during first-time onboarding.
- `password_recovery`: Confirming identity before allowing password resets (Phase 5.2.7).

An OTP issued for one purpose cannot be verified for another purpose; queries strictly match `{ email, purpose, isConsumed: false }`.

---

## 3. Database Design & Persistence

### 3.1 Mongoose Schema: `OtpModel` (`src/lib/db/models/otp.model.ts`)

```typescript
const OtpSchema = new Schema<IOtpDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    hashedOtp: { type: String, required: true },
    purpose: {
      type: String,
      enum: ['email_verification', 'account_activation', 'password_recovery'],
      required: true,
      index: true,
    },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1 },
    resendAvailableAt: { type: Date, required: true },
    isConsumed: { type: Boolean, default: false, index: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Automatic MongoDB background deletion upon expiration
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for active verification queries
OtpSchema.index({ email: 1, purpose: 1, isConsumed: 1 });
```

### 3.2 Repository Invariants (`OtpRepository`)

1. **Single Active OTP Invariant:** When `createOtp` is called, any prior unconsumed OTPs for the same email and purpose are marked consumed (`isConsumed: true`) before inserting the new OTP document.
2. **Atomic Attempt Increment:** `incrementAttempts` increments the `attempts` counter atomically via `$inc: { attempts: 1 }`.
3. **Atomic Consumption:** `consumeOtp` atomically sets `{ isConsumed: true, consumedAt: new Date() }`.

---

## 4. API Endpoints Specification

All endpoints are hosted under `/api/v1/auth/otp/*` and authenticated as public ingress routes in `src/middleware.ts`.

### 4.1 POST `/api/v1/auth/otp/request`
Generates and dispatches a fresh 6-digit OTP code to the requested institutional email.

- **Request Body:**
  ```json
  {
    "email": "aarav.sharma@axiscolleges.in",
    "purpose": "account_activation"
  }
  ```
- **Validation Rules:**
  - `email`: Valid institutional email format, trimmed and normalized to lowercase.
  - `purpose`: One of `'email_verification'`, `'account_activation'`, `'password_recovery'`.
- **Response (`HTTP 200 OK`):**
  ```json
  {
    "success": true,
    "message": "Verification code sent successfully to your institutional email.",
    "data": {
      "email": "aarav.sharma@axiscolleges.in",
      "purpose": "account_activation",
      "resendAvailableAt": "2026-11-15T02:05:00.000Z",
      "expiresInSeconds": 300,
      "resendAvailableInSeconds": 60,
      "expiresInMinutes": 5
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Invalid email format or unsupported purpose.
  - `403 Forbidden`: Account is suspended.
  - `429 Too Many Requests`: Resend cooldown active (`"Please wait 45 second(s) before requesting another verification code."`).

### 4.2 POST `/api/v1/auth/otp/verify`
Validates a candidate 6-digit verification code using timing-safe comparison.

- **Request Body:**
  ```json
  {
    "email": "aarav.sharma@axiscolleges.in",
    "otp": "482910",
    "purpose": "account_activation"
  }
  ```
- **Validation Rules:**
  - `otp`: Exactly 6 numeric digits (`/^\d{6}$/`).
- **Response (`HTTP 200 OK`):**
  ```json
  {
    "success": true,
    "message": "Email verification code confirmed successfully.",
    "data": {
      "verified": true,
      "email": "aarav.sharma@axiscolleges.in",
      "purpose": "account_activation",
      "verificationProofToken": "a3f5b9...64-hex-token..."
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Code is incorrect (`"Invalid verification code. 4 attempt(s) remaining."`) or code already consumed.
  - `410 Gone`: Code has expired (`"Verification code has expired. Please request a new code."`).
  - `429 Too Many Requests`: 5 failed attempts exceeded (`"Maximum verification attempts exceeded. Code has been invalidated."`).

### 4.3 POST `/api/v1/auth/otp/resend`
Enforces cooldown and dispatches a fresh code.

- **Request Body:**
  ```json
  {
    "email": "aarav.sharma@axiscolleges.in",
    "purpose": "account_activation"
  }
  ```
- **Response (`HTTP 200 OK`):**
  ```json
  {
    "success": true,
    "message": "A fresh verification code has been dispatched to your institutional email.",
    "data": { ... }
  }
  ```

---

## 5. Email Dispatch Architecture & Privacy

### 5.1 Zero Credential Exposure
- Raw OTP codes are **never** logged to `stdout`, `stderr`, application loggers, or telemetry files.
- All email logging applies `EmailService.maskEmail()`:
  - `aarav.sharma@axiscolleges.in` → `aa***@axiscolleges.in`
  - `director@axiscolleges.in` → `di***@axiscolleges.in`
  - `""` or invalid email → `***`

### 5.2 Production Email Configuration Guidelines
`EmailService` supports three dispatch modes:
1. **Development/Testing Sandbox (Default):** Dispatches to internal logger safely with masked credentials, returning simulated message IDs (`sim_<random>`).
2. **Production SMTP:** Configure standard environment variables:
   ```env
   SMTP_HOST=smtp.gmail.com # or institutional SMTP gateway
   SMTP_PORT=587
   SMTP_USER=no-reply@axiscolleges.in
   SMTP_PASS=<app-password>
   SMTP_FROM="Axis LinkUp Identity <no-reply@axiscolleges.in>"
   ```
3. **Transactional API (Resend / AWS SES):**
   ```env
   RESEND_API_KEY=re_123456789
   ```

---

## 6. Frontend Components & UX Flow

### 6.1 Discrete 6-Digit OTP Input (`src/components/auth/otp-input.tsx`)
- **Key Interactions:**
  - 6 individual numeric inputs with `inputMode="numeric"` and `pattern="[0-9]*"`.
  - Auto-focus progression to input `i+1` upon digit entry.
  - Backspace regression: clears current or focuses `i-1`.
  - Arrow key navigation (`ArrowLeft` / `ArrowRight`).
  - Paste handling: strips non-numeric characters and fills inputs across indices 0–5.
- **Dynamic Feedback:**
  - 60-second visual countdown on the "Resend code" trigger.
  - Clear amber warning indicator displaying remaining attempts (e.g. `⚠️ 3 attempts remaining`).
  - Loading spinner states for sending, verifying, and resending.
  - Success badge with emerald checkmark upon validation.

### 6.2 Activation Page Integration (`src/app/(auth)/activate/page.tsx`)
- Evaluates `userInfo.isEmailVerified` on token validation.
- When unverified, steps the user through:
  - **Step 1:** Confirm Institutional Email (OTP verification).
  - **Step 2:** Establish Permanent Password (enforcing 8+ chars, uppercase, lowercase, number, special symbol).
- Supports an explicit "Skip to password setup" fallback option so students/faculty are never blocked by email delivery latency.

---

## 7. Quality Assurance & Verification Results

### 7.1 Automated Unit Test Suite (`tests/unit/email-otp.test.ts`)
18 tests spanning 7 suites covering:
1. **Cryptographic Generation & Hashing:** Uniform distribution within `[100000, 999999]`, SHA-256 deterministic 64-hex output.
2. **Email Privacy & Masking:** Correct masking, zero raw OTP leakage.
3. **Zod Validation:** Payload bounds, normalization, type rejections.
4. **Cooldown & Rate Limiting:** 60s cooldown enforcement, 429 response on rapid request, resend eligibility.
5. **Verification & Single-Use:** Timing-safe comparison, atomic consumption, replay rejection.
6. **Attempt Decrement & Exhaustion:** Attempt count decrement, HTTP 429 lock-out after 5 failures.
7. **Expiration Boundary & Isolation:** 410 Gone on expired OTPs, cross-purpose isolation, cross-account protection.

**Test Run Output:**
```
# tests 18
# suites 7
# pass 18
# fail 0
# duration_ms 1149.6916
```

### 7.2 Full Platform Test Suite
```
> axis-linkup@0.1.0 test
> npx tsx --test tests/unit/**/*.test.ts

# tests 231
# suites 83
# pass 231
# fail 0
# cancelled 0
# duration_ms 26210.9731
```

### 7.3 Type Checking (`npx tsc --noEmit`)
- **Status:** Passed cleanly with **0 errors**.

### 7.4 Linting (`npm run lint`)
- **Status:** Passed cleanly with **0 warnings / 0 errors**.

### 7.5 Production Build (`npm run build`)
- **Status:** Next.js 15.5.29 compiled all 22 static and dynamic routes cleanly:
  - `ƒ /api/v1/auth/otp/request`
  - `ƒ /api/v1/auth/otp/verify`
  - `ƒ /api/v1/auth/otp/resend`
  - `○ /activate`

---

## 8. Modified & Created Files Summary

| File Path | Type | Description |
| :--- | :--- | :--- |
| `src/types/otp.ts` | Created | Data contracts, purpose types, and API response interfaces |
| `src/types/index.ts` | Modified | Exported OTP types |
| `src/lib/db/models/otp.model.ts` | Created | Mongoose model with TTL index and atomic flags |
| `src/lib/db/models/index.ts` | Modified | Exported `OtpModel` |
| `src/lib/db/repositories/otp.repository.ts` | Created | Database access layer with single active OTP invariant |
| `src/lib/db/repositories/index.ts` | Modified | Exported `OtpRepository` |
| `src/lib/validations/otp.schema.ts` | Created | Zod schemas for request, verify, and resend operations |
| `src/lib/services/email.service.ts` | Created | Email dispatch service with masking and zero OTP leakage |
| `src/lib/services/otp.service.ts` | Created | Domain service with timing-safe comparison and attempt limits |
| `src/lib/services/index.ts` | Modified | Exported `OtpService` and `EmailService` |
| `src/app/api/v1/auth/otp/request/route.ts` | Created | Public API endpoint for requesting verification codes |
| `src/app/api/v1/auth/otp/verify/route.ts` | Created | Public API endpoint for validating verification codes |
| `src/app/api/v1/auth/otp/resend/route.ts` | Created | Public API endpoint for resending verification codes |
| `src/components/auth/otp-input.tsx` | Created | Accessible 6-digit input component with cooldown timer |
| `src/components/auth/index.ts` | Modified | Exported `OtpInput` |
| `src/app/(auth)/activate/page.tsx` | Modified | Integrated 2-step activation with email OTP verification |
| `src/middleware.ts` | Modified | Added `/api/v1/auth/otp(.*)` to public edge routes |
| `tests/unit/email-otp.test.ts` | Created | 18 unit tests validating security, hashing, and boundaries |
| `docs/phase-5/PHASE_5_2_6_EMAIL_OTP_REPORT.md` | Created | Architectural implementation report |

---

## 9. Preparedness for Phase 5.2.7: Password Recovery System

Phase 5.2.6 establishes the required foundation for **Phase 5.2.7: Password Recovery System**:
1. `password_recovery` purpose is fully supported in `OtpModel`, `OtpService`, and API validation schemas.
2. `OtpService.verifyOtp` generates a cryptographically signed HMAC token (`verificationProofToken`).
3. Phase 5.2.7 will accept this proof token on the password reset endpoint to verify that the user's institutional email was confirmed before updating credentials in Clerk IAM.

