'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import type { OwnerProfileDTO } from '@/types/profile';
import {
  User,
  Phone,
  Mail,
  Shield,
  Key,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface ProfilePersonalCardProps {
  profile: OwnerProfileDTO;
}

export function ProfilePersonalCard({ profile }: ProfilePersonalCardProps) {
  return (
    <Card variant="glass" className="space-y-4 p-5 shadow-xs">
      <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-3">
        <div className="flex items-center gap-2">
          <User className="size-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Personal Information</CardTitle>
        </div>
        <Badge variant="glass" className="text-[10px]">
          Identity &amp; Contact
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 p-0 text-xs">
        {/* Personal Bio */}
        <div className="border-border/40 space-y-1.5 border-b pb-3">
          <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
            <FileText className="size-3.5 text-primary" />
            Personal Bio:
          </span>
          {profile.bio ? (
            <p className="text-foreground bg-muted/20 border-border/40 rounded-lg border p-2.5 text-[11px] leading-relaxed italic">
              &ldquo;{profile.bio}&rdquo;
            </p>
          ) : (
            <p className="text-muted-foreground text-[11px] italic">
              No personal bio provided yet. Click &ldquo;Edit Profile&rdquo; to add your introduction.
            </p>
          )}
        </div>

        {/* Contact Numbers */}
        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Phone className="size-3.5 text-muted-foreground" />
            Contact Phone:
          </span>
          <span className="text-foreground font-mono">
            {profile.phoneNumber || (
              <span className="text-muted-foreground italic">Not provided</span>
            )}
          </span>
        </div>

        {/* Institutional Email */}
        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Mail className="size-3.5 text-muted-foreground" />
            Institutional Email:
          </span>
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {profile.email}
          </span>
        </div>

        {/* Identity & Security Assurance Note */}
        <div className="bg-muted/20 text-muted-foreground border-border/40 mt-3 space-y-1.5 rounded-lg border p-2.5 text-[11px] leading-relaxed">
          <p className="text-foreground flex items-center gap-1 font-semibold">
            <Shield className="size-3.5 text-emerald-500" />
            Security &amp; Ingress Governance
          </p>
          <div className="space-y-1 pt-0.5 text-[10.5px]">
            <p className="flex items-center gap-1">
              <Key className="size-3 text-emerald-500" />
              Auth Provider: <span className="text-foreground font-medium">Clerk IAM (SOC-2 Type II)</span>
            </p>
            <p className="flex items-center gap-1">
              <ShieldCheck className="size-3 text-cyan-500" />
              Storage: <span className="text-foreground font-medium">MongoDB Atlas Multi-Region Cluster</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

