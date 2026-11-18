import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import {
  ShieldCheck,
  Users,
  Activity,
  BellRing,
  Sparkles,
  Server,
  KeyRound,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Executive Console | Axis LinkUp',
  description: 'Executive IT administration, emergency dispatch dock, and role management.',
};

export default async function SuperAdminDashboardPage() {
  const session = await requireRole('super_admin');

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      {/* Executive Welcome Hero */}
      <div className="glass-panel border-glass-border relative overflow-hidden rounded-2xl border p-4 shadow-md sm:p-6 lg:p-8">
        {/* Ambient light blue background glow (Reference 1) */}
        <div
          className="bg-primary/10 dark:bg-primary/15 pointer-events-none absolute -top-20 -right-20 size-80 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="bg-primary/10 text-primary ring-primary/20 flex size-12 items-center justify-center rounded-xl ring-1">
              <ShieldCheck className="size-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                  Central Executive IT Console
                </h1>
                <Badge variant="glass" className="text-primary gap-1 text-[10px] font-semibold">
                  <Sparkles className="size-3" />
                  Super Admin
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                Session Identity: {session.email} • Tier-1 Institutional Governance Clearance
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Module Ingress Grid (Reference 2 Grid Layout) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/super-admin/emergency"
          className="block rounded-xl focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
        >
          <Card
            variant="glass"
            className="border-glass-border hover:border-destructive/50 h-full space-y-2 border p-5 shadow-sm transition-all hover:shadow-md"
          >
            <CardHeader className="p-0 pb-2">
              <div className="text-destructive flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="size-4" />
                  <CardTitle className="text-sm font-semibold">Emergency Broadcast (MOD-16)</CardTitle>
                </div>
                <ArrowRight className="size-3.5" />
              </div>
              <CardDescription className="text-xs">
                Campus-wide lockdown, weather closure alerts, portal takeovers, and acknowledgment tracking.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-destructive p-0 text-xs font-medium">
              Open Emergency Command Console
            </CardContent>
          </Card>
        </Link>

        <Link
          href="/super-admin/roles"
          className="block rounded-xl focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
        >
          <Card
            variant="glass"
            className="border-glass-border hover:border-primary/40 h-full space-y-2 border p-5 shadow-sm transition-all hover:shadow-md"
          >
            <CardHeader className="p-0 pb-2">
              <div className="flex items-center justify-between text-sky-500">
                <div className="flex items-center gap-2">
                  <Users className="size-4" />
                  <CardTitle className="text-sm font-semibold">IAM Governance</CardTitle>
                </div>
                <ArrowRight className="size-3.5" />
              </div>
              <CardDescription className="text-xs">
                Manage institutional roles, administrative sub-roles, suspensions, and the live RBAC permission matrix.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-primary p-0 text-xs font-medium">
              Open IAM Governance Console
            </CardContent>
          </Card>
        </Link>

        <Link
          href="/super-admin/audit"
          className="block rounded-xl focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
        >
          <Card
            variant="glass"
            className="border-glass-border hover:border-primary/40 h-full space-y-2 border p-5 shadow-sm transition-all hover:shadow-md"
          >
            <CardHeader className="p-0 pb-2">
              <div className="flex items-center justify-between text-cyan-500">
                <div className="flex items-center gap-2">
                  <Activity className="size-4" />
                  <CardTitle className="text-sm font-semibold">
                    Security Audit Logs
                  </CardTitle>
                </div>
                <ArrowRight className="size-3.5" />
              </div>
              <CardDescription className="text-xs">
                Inspect append-only hash-chained security events, verify cryptographic integrity, and export compliance reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-primary p-0 text-xs font-medium">
              Open Immutable Audit Trail
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Governance & Architecture Details Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-4">
          <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
            <KeyRound className="text-primary size-3.5" />
            <span>Cryptographic Keys</span>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Clerk Public JWT &amp; Svix Webhook Secret active in institutional enclave.
          </p>
        </div>

        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-4">
          <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
            <Server className="size-3.5 text-emerald-500" />
            <span>MongoDB Atlas Cluster</span>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Primary Replica Set healthy • Sharded indexes on authProviderId &amp; email.
          </p>
        </div>

        <div className="bg-card/40 border-glass-border space-y-1 rounded-xl border p-4">
          <div className="text-foreground flex items-center gap-2 text-xs font-semibold">
            <Cpu className="size-3.5 text-sky-500" />
            <span>Tier-2 Security Active</span>
          </div>
          <p className="text-muted-foreground text-[11px]">
            DOC-AUTH-005 RBAC enforcement active across all institutional portals and API handlers.
          </p>
        </div>
      </div>
    </ContentContainer>
  );
}
