'use client';

/**
 * Closed Account Provisioning Desk Component.
 * Reflects Phase 4.8.2 closed account provisioning specification:
 * Only System Administrators can provision Student, Faculty, and Admin accounts.
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input } from '@/components/ui';
import { UserPlus, Upload, ShieldCheck, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export function AdminProvisioningCard() {
  const [selectedRole, setSelectedRole] = useState<'student' | 'faculty' | 'admin'>('student');
  const [emailInput, setEmailInput] = useState('');
  const [provisionSuccess, setProvisionSuccess] = useState(false);

  const handleProvision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    setProvisionSuccess(true);
    setTimeout(() => {
      setProvisionSuccess(false);
      setEmailInput('');
    }, 3500);
  };

  return (
    <Card variant="glass" className="border-glass-border space-y-4 border p-5">
      <CardHeader className="flex flex-row items-center justify-between p-0 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <UserPlus className="size-4" />
          </div>
          <div>
            <CardTitle className="font-heading text-foreground text-sm font-bold">
              Closed Account Provisioning Desk
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Statutory Administrative Gate — Public self-registration is permanently closed
            </p>
          </div>
        </div>

        <Badge variant="glass" className="text-primary gap-1 font-mono text-[10px]">
          <ShieldCheck className="size-3 text-emerald-500" />
          IAM Master Desk
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Role Selector Tabs */}
        <div className="border-border/30 flex items-center gap-2 border-b pb-2">
          {(['student', 'faculty', 'admin'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                selectedRole === role
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              {role === 'student' ? 'Student' : role === 'faculty' ? 'Faculty' : 'Administrator'}
            </button>
          ))}
        </div>

        {/* Quick Provision Form */}
        <form onSubmit={handleProvision} className="space-y-3">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Mail className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
              <Input
                type="email"
                placeholder={`Enter authorized ${selectedRole} email (e.g. user@axis.edu.in)`}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="bg-card/40 border-glass-border h-9 pl-9 text-xs"
              />
            </div>
            <Button
              type="submit"
              variant="pill-primary"
              size="sm"
              className="h-9 shrink-0 px-4 text-xs"
            >
              <UserPlus className="mr-1 size-3.5" />
              Provision Account
            </Button>
          </div>

          {provisionSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                Invitation dispatched to <strong>{emailInput}</strong> with pre-provisioned{' '}
                <strong>{selectedRole}</strong> institutional credential token.
              </span>
            </div>
          )}
        </form>

        {/* Batch Onboarding Bar */}
        <div className="border-border/30 flex flex-col items-start justify-between gap-3 border-t pt-2 text-xs sm:flex-row sm:items-center">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="size-3.5 text-sky-500" />
            <span>Need bulk onboarding? Upload Registrar Master CSV Roster.</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="border-glass-border hover:bg-card/60 h-7 gap-1 text-xs"
          >
            <Upload className="size-3" />
            Upload CSV Roster
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
