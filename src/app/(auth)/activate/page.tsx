'use client';

/**
 * First-Time Collegiate Account Activation Landing Page.
 * Conforms to Phase 5.2.5 & Phase 5.2.6 specifications:
 * - Validates cryptographic time-limited invitation token
 * - Step 1: Optional/guided Email OTP verification (6-digit code with cooldown & rate limit)
 * - Step 2: Allows user to establish permanent password through Clerk
 * - Transitions account lifecycle from 'pending_verification' to 'active'
 * - Handles expired, already-activated, and suspended account states
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  GraduationCap,
  BookOpenCheck,
  ArrowRight,
  ShieldCheck,
  User,
  MailCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input } from '@/components/ui';
import { OtpInput } from '@/components/auth/otp-input';
import type { ActivationValidationResponse } from '@/types/activation';

function ActivateAccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  // Verification & Form State
  const [isVerifying, setIsVerifying] = useState(true);
  const [userInfo, setUserInfo] = useState<ActivationValidationResponse | null>(null);
  const [errorType, setErrorType] = useState<
    'missing' | 'invalid' | 'expired' | 'already_activated' | 'suspended' | 'server' | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Multi-step activation flow: 'verify_email' -> 'set_password'
  const [activationStep, setActivationStep] = useState<'verify_email' | 'set_password'>('set_password');
  const [emailOtpVerified, setEmailOtpVerified] = useState(false);

  // Password Input State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // 1. Validate Invitation Token on Mount
  useEffect(() => {
    if (!token || !email) {
      setIsVerifying(false);
      setErrorType('missing');
      setErrorMessage('Activation link is incomplete or missing required parameters.');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(
          `/api/v1/auth/activation/validate?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
        );
        const json = await res.json();

        if (!res.ok) {
          const status = res.status;
          const msg = json.message || 'Activation verification failed.';
          setErrorMessage(msg);

          if (status === 409 || msg.toLowerCase().includes('already been activated')) {
            setErrorType('already_activated');
          } else if (status === 410 || msg.toLowerCase().includes('expired')) {
            setErrorType('expired');
          } else if (status === 403) {
            setErrorType('suspended');
          } else {
            setErrorType('invalid');
          }
          return;
        }

        const data: ActivationValidationResponse = json.data;
        setUserInfo(data);

        // If email is not yet verified, start at OTP verification step
        if (!data.isEmailVerified) {
          setActivationStep('verify_email');
        } else {
          setEmailOtpVerified(true);
          setActivationStep('set_password');
        }
      } catch {
        setErrorType('server');
        setErrorMessage('Unable to connect to authentication gateway. Please check your network.');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token, email]);

  // Password strength checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid =
    hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // 2. Handle Password Submission & Account Activation
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid || !passwordsMatch) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/v1/auth/activation/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          password,
          confirmPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Failed to complete account activation.');
      }

      setIsSuccess(true);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Activation failed due to an unexpected error.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // State: Verifying Token
  if (isVerifying) {
    return (
      <div className="glass-card border-glass-border mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-4 border p-8 text-center shadow-xl">
        <Loader2 className="text-primary size-10 animate-spin" />
        <div className="space-y-1">
          <h2 className="font-heading text-foreground text-lg font-bold">
            Verifying Collegiate Invitation
          </h2>
          <p className="text-muted-foreground text-xs">
            Authenticating your one-time activation token against Axis Institute IAM...
          </p>
        </div>
      </div>
    );
  }

  // State: Activation Success
  if (isSuccess) {
    const portal = userInfo?.role === 'faculty' ? 'faculty' : 'student';
    return (
      <div className="glass-card border-glass-border mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-5 border p-8 text-center shadow-2xl">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 shadow-lg">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-foreground text-2xl font-bold tracking-tight">
            Account Activated Successfully!
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your permanent institutional credentials have been established. Your status is now{' '}
            <strong className="text-emerald-500">Active</strong>.
          </p>
        </div>

        <div className="border-border/30 bg-muted/20 w-full rounded-xl border p-3.5 text-left text-xs">
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Institutional Email:</span>
            <span className="text-foreground font-mono font-medium">{email}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Username:</span>
            <span className="text-foreground font-mono font-medium">@{userInfo?.username}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Collegiate Role:</span>
            <span className="text-foreground font-medium capitalize">{userInfo?.role}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Email Status:</span>
            <span className="flex items-center gap-1 font-medium text-emerald-500">
              <CheckCircle2 className="size-3" /> Verified
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="pill-primary"
          onClick={() => router.push(`/sign-in?portal=${portal}`)}
          className="w-full text-xs font-semibold"
        >
          <span>Sign In to {portal === 'faculty' ? 'Faculty Workspace' : 'Student Portal'}</span>
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    );
  }

  // State: Error States (Already Activated, Expired, Suspended, or Invalid)
  if (errorType) {
    return (
      <div className="glass-card border-glass-border mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-5 border p-8 text-center shadow-xl">
        {errorType === 'already_activated' ? (
          <div className="flex size-16 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-500 shadow-md">
            <ShieldCheck className="size-8" />
          </div>
        ) : errorType === 'expired' ? (
          <div className="flex size-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-md">
            <Clock className="size-8" />
          </div>
        ) : errorType === 'suspended' ? (
          <div className="flex size-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive shadow-md">
            <ShieldAlert className="size-8" />
          </div>
        ) : (
          <div className="flex size-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive shadow-md">
            <AlertCircle className="size-8" />
          </div>
        )}

        <div className="space-y-2">
          <h2 className="font-heading text-foreground text-xl font-bold tracking-tight">
            {errorType === 'already_activated'
              ? 'Account Already Activated'
              : errorType === 'expired'
                ? 'Activation Invitation Expired'
                : errorType === 'suspended'
                  ? 'Account Suspended'
                  : 'Invalid Activation Link'}
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">{errorMessage}</p>
        </div>

        <div className="w-full pt-2">
          {errorType === 'already_activated' ? (
            <Button
              type="button"
              variant="pill-primary"
              onClick={() => router.push('/sign-in')}
              className="w-full text-xs font-semibold"
            >
              Go to Sign In
              <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : (
            <div className="space-y-2">
              <Link href="/">
                <Button variant="outline" className="w-full text-xs">
                  Return to Home
                </Button>
              </Link>
              <p className="text-muted-foreground text-[11px]">
                Need a new activation link? Contact{' '}
                <a
                  href="mailto:support@axiscolleges.in"
                  className="text-primary underline hover:opacity-80"
                >
                  support@axiscolleges.in
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // State: Valid Invitation — Render Step 1 (OTP Verification) or Step 2 (Password Setup)
  const RoleIcon = userInfo?.role === 'faculty' ? BookOpenCheck : GraduationCap;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      {/* Top Header */}
      <div className="space-y-2 text-center">
        <div className="bg-primary/10 border-primary/20 text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
          <RoleIcon className="size-3.5" />
          <span>{userInfo?.role === 'faculty' ? 'Faculty Workspace' : 'Enrolled Scholar'}</span>
        </div>

        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight">
          Activate Your Account
        </h1>

        <p className="text-muted-foreground text-xs">
          {activationStep === 'verify_email'
            ? 'Step 1 of 2: Verify your institutional email address'
            : 'Step 2 of 2: Establish your permanent institutional password'}
        </p>
      </div>

      {/* Main Glass Card */}
      <Card variant="glass" className="border-glass-border space-y-5 border p-6 shadow-xl sm:p-8">
        <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-3">
          <div className="flex items-center gap-2">
            <User className="text-primary size-4" />
            <CardTitle className="text-xs font-semibold">{userInfo?.fullName}</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono text-emerald-500">
            @{userInfo?.username}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4 p-0">
          {/* STEP 1: Email OTP Verification */}
          {activationStep === 'verify_email' ? (
            <div className="space-y-4">
              <OtpInput
                email={email}
                purpose="account_activation"
                title="Verify Institutional Email"
                description={`Enter the 6-digit code sent to ${email}`}
                autoSendOnMount={true}
                onVerified={() => {
                  setEmailOtpVerified(true);
                  setActivationStep('set_password');
                }}
              />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setActivationStep('set_password')}
                  className="text-muted-foreground hover:text-foreground text-xs underline"
                >
                  Skip to password setup (verify email later) →
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: Password Setup */
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="border-border/20 bg-muted/20 flex items-center justify-between rounded-xl border p-3 text-xs">
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">Registered Email</div>
                  <div className="text-foreground font-mono font-medium">{userInfo?.email}</div>
                </div>
                {emailOtpVerified ? (
                  <Badge variant="outline" className="flex items-center gap-1 border-emerald-500/30 text-emerald-500">
                    <MailCheck className="size-3" />
                    Verified
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActivationStep('verify_email')}
                    className="text-primary text-[11px] underline"
                  >
                    Verify Email
                  </button>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="size-3.5" />
                    New Password
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground text-[11px]"
                  >
                    {showPassword ? (
                      <span className="flex items-center gap-1">
                        <EyeOff className="size-3" /> Hide
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" /> Show
                      </span>
                    )}
                  </button>
                </label>

                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-card/40 border-glass-border h-9 text-xs"
                />
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <KeyRound className="size-3.5" />
                  Confirm Password
                </label>

                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-card/40 border-glass-border h-9 text-xs"
                />

                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-[10px] text-destructive">Passwords do not match</p>
                )}
              </div>

              {/* Password Strength Checklist */}
              <div className="border-border/30 bg-muted/10 space-y-1.5 rounded-xl border p-3 text-[11px]">
                <div className="text-muted-foreground font-medium">Password Requirements:</div>
                <ul className="space-y-1">
                  <li
                    className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="size-3" />
                    <span>At least 8 characters</span>
                  </li>
                  <li
                    className={`flex items-center gap-1.5 ${hasUppercase && hasLowercase ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="size-3" />
                    <span>Uppercase &amp; lowercase letters</span>
                  </li>
                  <li
                    className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="size-3" />
                    <span>At least one number</span>
                  </li>
                  <li
                    className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="size-3" />
                    <span>At least one special character</span>
                  </li>
                </ul>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">Activation Failed</p>
                    <p className="text-[11px] opacity-90">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="pill-primary"
                size="sm"
                disabled={!isPasswordValid || !passwordsMatch || isSubmitting}
                className="w-full text-xs font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Setting Password &amp; Activating...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-1.5 size-3.5" />
                    Activate Account &amp; Set Password
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="text-primary size-8 animate-spin" />
        </div>
      }
    >
      <ActivateAccountContent />
    </Suspense>
  );
}
