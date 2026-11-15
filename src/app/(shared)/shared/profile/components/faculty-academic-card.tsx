'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import type { OwnerProfileDTO } from '@/types/profile';
import {
  Briefcase,
  Building2,
  Phone,
  Clock,
  DoorOpen,
  Sparkles,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface FacultyAcademicCardProps {
  profile: OwnerProfileDTO;
  onProfileUpdated?: (updated: OwnerProfileDTO) => void;
}

export function FacultyAcademicCard({ profile, onProfileUpdated }: FacultyAcademicCardProps) {
  const faculty = profile.facultyProfile;
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [privacySuccess, setPrivacySuccess] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  if (!faculty) {
    return null;
  }

  const isPhoneShared = Boolean(faculty.sharePhoneWithStudents);

  const handleTogglePhoneSharing = async () => {
    setIsUpdatingPrivacy(true);
    setPrivacySuccess(null);
    setPrivacyError(null);

    try {
      const res = await fetch('/api/v1/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyProfile: {
            sharePhoneWithStudents: !isPhoneShared,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Failed to update privacy preference');
      }

      setPrivacySuccess(
        !isPhoneShared
          ? 'Phone sharing enabled for authenticated collegiate students.'
          : 'Phone sharing disabled. Your phone number is now hidden from students.'
      );

      if (onProfileUpdated && json.data) {
        onProfileUpdated(json.data as OwnerProfileDTO);
      }
    } catch (err) {
      setPrivacyError(err instanceof Error ? err.message : 'Error updating privacy settings.');
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  return (
    <Card variant="glass" className="space-y-4 p-5 shadow-xs">
      <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-3">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4 text-emerald-500" />
          <CardTitle className="text-sm font-semibold">Faculty Credentials &amp; Office</CardTitle>
        </div>
        <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
          Faculty Registry
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 p-0 text-xs">
        {/* Core Institutional Attributes */}
        <div className="space-y-2.5">
          <div className="border-border/40 flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3.5 text-muted-foreground" />
              Department:
            </span>
            <span className="text-foreground font-medium text-right">
              {profile.departmentName || profile.departmentCode || 'Unassigned'}
            </span>
          </div>

          <div className="border-border/40 flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-muted-foreground" />
              Employee Designation:
            </span>
            <span className="text-foreground font-medium text-right">
              {faculty.designation || 'Faculty Member'}
            </span>
          </div>

          <div className="border-border/40 flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">Employee ID:</span>
            <span className="text-foreground font-mono font-semibold">
              {faculty.employeeId || 'Not Configured'}
            </span>
          </div>

          <div className="border-border/40 flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <DoorOpen className="size-3.5 text-muted-foreground" />
              Cabin / Office Room:
            </span>
            <span className="text-foreground font-medium">
              {faculty.cabinRoom || <span className="text-muted-foreground italic">Not specified</span>}
            </span>
          </div>

          <div className="border-border/40 flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              Office Consultation Hours:
            </span>
            <span className="text-foreground font-medium">
              {faculty.officeHours ? (
                <span>
                  {faculty.officeHours.start} - {faculty.officeHours.end}
                  {faculty.officeHours.isAcceptingDMs && (
                    <Badge variant="glass" className="ml-1.5 text-[9px] text-primary">
                      DMs Open
                    </Badge>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground italic">By appointment</span>
              )}
            </span>
          </div>
        </div>

        {/* Areas of Specialization */}
        {faculty.specialization && faculty.specialization.length > 0 && (
          <div className="border-border/40 space-y-1.5 border-b pb-3">
            <span className="text-muted-foreground flex items-center gap-1">
              <Sparkles className="size-3.5 text-primary" />
              Areas of Specialization:
            </span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {faculty.specialization.map((spec, idx) => (
                <Badge key={idx} variant="glass" className="text-[10px]">
                  {spec}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Student Phone Privacy Preference Toggle Card */}
        <div className="glass-panel border-glass-border space-y-2.5 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                <Phone className="size-3.5 text-primary" />
                Share phone number with students
              </p>
              <p className="text-muted-foreground text-[11px] leading-tight">
                Controls whether enrolled students can view your contact number.
              </p>
            </div>

            <Button
              variant={isPhoneShared ? 'pill-primary' : 'outline'}
              size="xs"
              onClick={handleTogglePhoneSharing}
              disabled={isUpdatingPrivacy}
              className="gap-1 min-w-[70px]"
            >
              {isUpdatingPrivacy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : isPhoneShared ? (
                <>
                  <Eye className="size-3" /> Enabled
                </>
              ) : (
                <>
                  <EyeOff className="size-3" /> Disabled
                </>
              )}
            </Button>
          </div>

          <div className="bg-muted/30 text-muted-foreground rounded-md p-2 text-[10.5px] leading-relaxed">
            <span className="text-foreground font-semibold inline-flex items-center gap-1">
              <ShieldCheck className="size-3 text-emerald-500" />
              Institutional Privacy Policy:
            </span>{' '}
            Default is <span className="font-semibold text-foreground">OFF</span>. When turned ON,
            only authenticated students logged into Axis LinkUp can view your phone number for
            urgent collegiate matters. Public directory searches always mask your number.
          </div>

          {privacySuccess && (
            <div className="text-emerald-500 flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="size-3.5" />
              <span>{privacySuccess}</span>
            </div>
          )}

          {privacyError && (
            <div className="text-destructive flex items-center gap-1 text-[11px]">
              <AlertCircle className="size-3.5" />
              <span>{privacyError}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

