import React from 'react';
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
        <Card
          variant="glass"
          className="border-glass-border hover:border-glass-border-hover space-y-2 border p-5 shadow-sm transition-colors"
        >
          <CardHeader className="p-0 pb-2">
            <div className="text-primary flex items-center gap-2">
              <BellRing className="size-4" />
              <CardTitle className="text-sm font-semibold">Emergency Broadcast (MOD-16)</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Campus-wide lockdown and critical weather disaster notification triggers.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground p-0 text-xs">
            Super Administrator Master Override Only
          </CardContent>
        </Card>

        <Card
          variant="glass"
          className="border-glass-border hover:border-glass-border-hover space-y-2 border p-5 shadow-sm transition-colors"
        >
          <CardHeader className="p-0 pb-2">
            <div className="flex items-center gap-2 text-sky-500">
              <Users className="size-4" />
              <CardTitle className="text-sm font-semibold">User &amp; Role Governance</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Manage accounts, assign administrative scopes, and enforce suspensions.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground p-0 text-xs">
            RBAC Matrix Modifications Restricted
          </CardContent>
        </Card>

        <Card
          variant="glass"
          className="border-glass-border hover:border-glass-border-hover space-y-2 border p-5 shadow-sm transition-colors"
        >
          <CardHeader className="p-0 pb-2">
            <div className="flex items-center gap-2 text-cyan-500">
              <Activity className="size-4" />
              <CardTitle className="text-sm font-semibold">
                System Telemetry &amp; Auditing
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Monitor active sessions, database connections, and immutable audit logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground p-0 text-xs">
            Real-time Ingress Monitored
          </CardContent>
        </Card>
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
            DOC-AUTH-005 RBAC enforcement active on all 15 Next.js server components.
          </p>
        </div>
      </div>
    </ContentContainer>
  );
}
