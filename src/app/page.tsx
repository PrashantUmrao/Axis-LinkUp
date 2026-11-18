import React from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Bell,
  MessageSquare,
  Inbox,
  FileText,
  BarChart3,
  Scale,
  Building2,
  Lock,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme';
import { RoleSelector } from '@/components/auth/role-selector';

export default function HomePage() {
  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col overflow-x-hidden transition-colors duration-200">
      {/* Ambient Optical Sky-Blue Atmosphere (Reference 1) */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,rgba(37,99,235,0.14),rgba(237,245,253,0))] dark:bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,rgba(59,130,246,0.12),rgba(8,17,31,0))]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -bottom-40 -left-40 -z-10 size-96 rounded-full bg-blue-300/25 blur-3xl dark:bg-blue-600/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -top-40 -right-40 -z-10 size-96 rounded-full bg-sky-200/35 blur-3xl dark:bg-sky-500/10"
        aria-hidden="true"
      />

      {/* A. Top Navigation Header */}
      <header className="glass-nav border-glass-border sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div className="bg-primary/10 border-primary/25 text-primary ring-primary/20 flex size-10 items-center justify-center rounded-xl border shadow-xs ring-1">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <span className="font-heading text-foreground block text-base leading-tight font-bold tracking-tight sm:text-lg">
                Axis LinkUp
              </span>
              <span className="text-muted-foreground block text-[11px] leading-tight font-medium">
                Axis Institute of Technology &amp; Management
              </span>
            </div>
          </Link>

          {/* Quick Anchor Links */}
          <nav className="text-muted-foreground hidden items-center gap-6 text-xs font-medium md:flex">
            <a href="#portals" className="hover:text-foreground transition-colors">
              Campus Portals
            </a>
            <a href="#capabilities" className="hover:text-foreground transition-colors">
              Platform Modules
            </a>
            <a href="#about" className="hover:text-foreground transition-colors">
              Governance &amp; Policy
            </a>
            {process.env.NODE_ENV !== 'production' && (
              <Link
                href="/ui-preview"
                className="hover:text-primary flex items-center gap-1 transition-colors"
              >
                <Layers className="size-3.5" />
                <span>UI Showcase</span>
              </Link>
            )}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle variant="icon-button" />
            <Button
              asChild
              variant="pill-primary"
              size="default"
              className="h-8.5 px-4 text-xs font-semibold"
            >
              <Link href="/sign-in">
                <span>Portal Sign In</span>
                <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* B. Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 pt-12 pb-16 text-center sm:px-6 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Institutional Badge */}
          <div className="bg-primary/10 border-primary/25 text-primary inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-medium shadow-xs">
            <Sparkles className="size-3.5" />
            <span>AITM Kanpur • Collegiate Digital Portal</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-heading text-foreground text-3xl leading-[1.15] font-bold tracking-tight sm:text-5xl">
            The Unified Digital Campus Ecosystem
          </h1>

          {/* Subtitle */}
          <p className="text-muted-foreground mx-auto max-w-2xl text-sm leading-relaxed sm:text-lg">
            Connecting Students, Faculty, Department Administrators, and Directorate through
            real-time communication, academic collaboration, and transparent governance.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              asChild
              variant="pill-primary"
              className="shadow-primary/25 h-10 px-6 text-xs font-semibold shadow-md"
            >
              <a href="#portals">
                <span>Access Campus Portals</span>
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>

            <Button asChild variant="pill-glass" className="h-10 px-6 text-xs font-medium">
              <a href="#capabilities">
                <span>Explore Capabilities</span>
              </a>
            </Button>
          </div>

          {/* Security & Access Posture Strip */}
          <div className="pt-8">
            <div className="glass-panel text-muted-foreground border-glass-border inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border px-5 py-2.5 text-[11px] font-medium sm:gap-6">
              <div className="text-foreground flex items-center gap-1.5">
                <Lock className="text-primary size-3.5" />
                <span>Closed Admin Provisioning</span>
              </div>
              <span className="text-border hidden sm:inline">•</span>
              <div className="text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                <span>Tier-2 Zero-Trust RBAC</span>
              </div>
              <span className="text-border hidden sm:inline">•</span>
              <div className="text-foreground flex items-center gap-1.5">
                <Scale className="size-3.5 text-blue-500" />
                <span>AICTE / UGC Grievance Redressal</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* C. Three-Door Portal Selection Screen */}
      <section id="portals" className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <RoleSelector />
      </section>

      {/* D. Platform Capabilities Grid */}
      <section
        id="capabilities"
        className="mx-auto w-full max-w-7xl space-y-10 px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="space-y-2 text-center">
          <Badge variant="glass" className="px-3 py-1 text-xs">
            Core Modules
          </Badge>
          <h2 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Engineered for College Productivity
          </h2>
          <p className="text-muted-foreground mx-auto max-w-lg text-xs sm:text-sm">
            Actual approved platforms and workflows powering daily academic operations at AITM.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Capability 1 */}
          <div className="glass-card border-glass-border space-y-3 border p-6 text-left">
            <div className="bg-primary/10 border-primary/20 text-primary flex size-10 items-center justify-center rounded-xl border">
              <Bell className="size-5" />
            </div>
            <h3 className="font-heading text-foreground text-base font-bold">
              Campus Circulars &amp; Bulletins
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Official university broadcasts, urgent departmental notices, and exam circulars with
              instant delivery and priority badges.
            </p>
          </div>

          {/* Capability 2 */}
          <div className="glass-card border-glass-border space-y-3 border p-6 text-left">
            <div className="bg-primary/10 border-primary/20 text-primary flex size-10 items-center justify-center rounded-xl border">
              <MessageSquare className="size-5" />
            </div>
            <h3 className="font-heading text-foreground text-base font-bold">
              Direct Chat &amp; Academic Groups
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              WhatsApp-inspired peer communication using unique handles (@username) and
              faculty-created lecture and lab groups.
            </p>
          </div>

          {/* Capability 3 */}
          <div className="glass-card border-glass-border space-y-3 border p-6 text-left">
            <div className="bg-primary/10 border-primary/20 text-primary flex size-10 items-center justify-center rounded-xl border">
              <Inbox className="size-5" />
            </div>
            <h3 className="font-heading text-foreground text-base font-bold">
              Service Requests &amp; Facility Bookings
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Digital workflows for bonafide certificates, leave clearances, laboratory reservations,
              and conflict-free auditorium scheduling.
            </p>
          </div>

          {/* Capability 4 */}
          <div className="glass-card border-glass-border space-y-3 border p-6 text-left">
            <div className="bg-primary/10 border-primary/20 text-primary flex size-10 items-center justify-center rounded-xl border">
              <FileText className="size-5" />
            </div>
            <h3 className="font-heading text-foreground text-base font-bold">
              Coursework &amp; Digital Dropboxes
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Syllabus tracking, assignment dropboxes with deadline enforcement, and verified
              submission receipts for students.
            </p>
          </div>

          {/* Capability 5 */}
          <div className="glass-card border-glass-border space-y-3 border p-6 text-left">
            <div className="bg-primary/10 border-primary/20 text-primary flex size-10 items-center justify-center rounded-xl border">
              <BarChart3 className="size-5" />
            </div>
            <h3 className="font-heading text-foreground text-base font-bold">
              Campus Polls &amp; Council Voting
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Departmental sentiment polls, anonymous course feedback surveys, and student council
              elections.
            </p>
          </div>

          {/* Capability 6 */}
          <div className="glass-card border-glass-border space-y-3 border p-6 text-left">
            <div className="bg-primary/10 border-primary/20 text-primary flex size-10 items-center justify-center rounded-xl border">
              <Scale className="size-5" />
            </div>
            <h3 className="font-heading text-foreground text-base font-bold">
              Student Grievance Portal
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Formal email-composer interface for submitting academic and campus grievances with
              direct adjudication routing to HODs and Director.
            </p>
          </div>
        </div>
      </section>

      {/* E. Institutional Governance & Identity */}
      <section id="about" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="glass-panel border-glass-border mx-auto max-w-4xl space-y-6 rounded-3xl border p-8 text-center sm:p-12">
          <div className="bg-primary/10 border-primary/20 text-primary mx-auto flex size-12 items-center justify-center rounded-2xl border">
            <Building2 className="size-6" />
          </div>

          <div className="space-y-2">
            <h2 className="font-heading text-foreground text-xl font-bold sm:text-2xl">
              Axis Institute of Technology &amp; Management (AITM)
            </h2>
            <p className="text-muted-foreground mx-auto max-w-xl text-xs sm:text-sm">
              Kanpur, Uttar Pradesh • Department of Computer Science &amp; Engineering
            </p>
          </div>

          <div className="bg-muted/30 border-border/40 text-muted-foreground mx-auto max-w-2xl rounded-2xl border p-4 text-left text-xs leading-relaxed">
            <p className="text-foreground mb-1 font-semibold">
              Notice: Closed Administrative Provisioning Policy
            </p>
            <p>
              Axis LinkUp is a closed institutional communications environment. In compliance with
              data governance and cybersecurity policies, self-service public registration is
              disabled. All scholar and faculty accounts are provisioned exclusively through
              authorized department administrators.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild variant="pill-primary" className="text-xs">
              <Link href="/sign-in">
                <span>Access Your Portal Door</span>
                <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* F. Institutional Footer */}
      <footer className="border-border/40 text-muted-foreground mt-auto border-t py-8 text-center text-xs">
        <div className="mx-auto max-w-7xl space-y-2 px-4 sm:px-6">
          <p>
            © {new Date().getUTCFullYear()} Axis Institute of Technology &amp; Management (AITM). All
            rights reserved.
          </p>
          <p className="text-muted-foreground/75 text-[11px]">
            Axis LinkUp Platform • Built with Next.js 15, TypeScript &amp; Glassmorphism Design
            System.
          </p>
        </div>
      </footer>
    </div>
  );
}
