'use client';

/**
 * Role-Specific Collegiate Login Experience.
 * Wraps Clerk authentication in the approved Glassmorphism design system.
 * Configured with portal-specific intent and zero public registration links.
 */

import React from 'react';
import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import { GraduationCap, BookOpenCheck, ShieldCheck, ArrowLeft, Lock } from 'lucide-react';
import type { PortalType } from './role-selector';

interface RoleLoginFormProps {
  portal: PortalType;
  onChangePortal: () => void;
  redirectUrl?: string;
}

const PORTAL_META = {
  student: {
    title: 'Student Portal Sign In',
    subtitle: 'Enter your registered username or official email to access your student dashboard.',
    badge: 'Enrolled Scholar',
    icon: GraduationCap,
    targetDashboard: '/student/dashboard',
  },
  faculty: {
    title: 'Faculty Workspace Sign In',
    subtitle: 'Enter your institutional credentials to access your instructional workspace.',
    badge: 'Faculty Member',
    icon: BookOpenCheck,
    targetDashboard: '/faculty/dashboard',
  },
  admin: {
    title: 'Administration Gateway',
    subtitle: 'Authorized access for Department HODs, Directorate leadership, and System Admins.',
    badge: 'Administrative Officer',
    icon: ShieldCheck,
    targetDashboard: '/admin/dashboard',
  },
};

export function RoleLoginForm({ portal, onChangePortal, redirectUrl }: RoleLoginFormProps) {
  const meta = PORTAL_META[portal] ?? PORTAL_META.student;
  const Icon = meta.icon;

  const targetDashboard = redirectUrl || meta.targetDashboard;

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      {/* Top Header Card */}
      <div className="space-y-3 text-center">
        <div className="bg-primary/10 border-primary/20 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
          <Icon className="size-4" />
          <span>{meta.badge}</span>
        </div>

        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          {meta.title}
        </h1>

        <p className="text-muted-foreground mx-auto max-w-sm text-xs leading-relaxed sm:text-sm">
          {meta.subtitle}
        </p>
      </div>

      {/* Main Glass Form Frame */}
      <div className="glass-card border-glass-border relative space-y-5 border p-6 shadow-xl backdrop-blur-xl sm:p-8">
        {/* Switch Portal Anchor */}
        <div className="border-border/40 flex items-center justify-between border-b pb-4 text-xs">
          <button
            type="button"
            onClick={onChangePortal}
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Switch Portal Door</span>
          </button>
          <span className="text-muted-foreground/70 font-mono text-[10px] font-semibold tracking-wider uppercase">
            {portal.toUpperCase()} INGRESS
          </span>
        </div>

        {/* Clerk Sign-In Component with Glassmorphism Theme Styling */}
        <div className="w-full">
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl={undefined}
            fallbackRedirectUrl={targetDashboard}
            forceRedirectUrl={targetDashboard}
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'bg-transparent shadow-none p-0 border-0',
                header: 'hidden',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                main: 'w-full gap-4',
                form: 'gap-3.5',
                formFieldRow: 'gap-1.5',
                formFieldLabel: 'text-foreground text-xs font-medium',
                formFieldInput:
                  'h-10 text-xs rounded-xl bg-glass-surface/60 border border-glass-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all backdrop-blur-md',
                formButtonPrimary:
                  'h-10 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25 transition-all',
                formFieldAction: 'text-primary text-xs hover:underline font-medium',
                identityPreview: 'bg-muted/30 border border-border/40 rounded-xl p-2.5',
                identityPreviewText: 'text-foreground text-xs font-medium',
                identityPreviewEditButton: 'text-primary hover:underline text-xs',
                otpCodeFieldInput:
                  'rounded-xl border border-glass-border bg-glass-surface/60 font-mono text-lg font-bold text-foreground',
                footerAction: 'hidden',
                footer: 'hidden',
                alert:
                  'rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs',
                alertText: 'text-destructive text-xs leading-relaxed',
              },
            }}
          />
        </div>

        {/* Zero-Trust Administrative Security Notice */}
        <div className="border-border/40 space-y-1 border-t pt-4 text-center">
          <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-[11px]">
            <Lock className="text-primary size-3" />
            <span>Closed Institutional Access Policy</span>
          </div>
          <p className="text-muted-foreground/75 text-[10px]">
            Public self-registration is permanently closed. Credentials are
            administrator-provisioned.
          </p>
        </div>
      </div>

      <div className="pt-2 text-center">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          ← Return to Campus Home
        </Link>
      </div>
    </div>
  );
}
