'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
} from '@/components/ui';
import type { DirectoryProfileDTO } from '@/types/profile';
import {
  User,
  Building,
  AtSign,
  Phone,
  DoorOpen,
  Clock,
  Sparkles,
  BookOpen,
  Layers,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface UserProfileDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ userId, open, onOpenChange }: UserProfileDialogProps) {
  const [profile, setProfile] = useState<DirectoryProfileDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) {
      setProfile(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    async function fetchProfile() {
      try {
        const res = await fetch(`/api/v1/users/${userId}/profile`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || json.error?.message || 'Failed to load profile');
        }

        if (isMounted) {
          setProfile(json.data as DirectoryProfileDTO);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error fetching user profile');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [userId, open]);

  const displayName = profile?.fullName || profile?.username || 'Collegiate Profile';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <User className="size-4 text-primary" />
            Collegiate Directory Profile
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Privacy-preserved profile projection from Axis LinkUp Institutional Directory.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading collegiate profile...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive border-destructive/20 my-2 flex items-center gap-2 rounded-lg border p-3 text-xs">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : profile ? (
          <div className="space-y-4 py-2 text-xs">
            {/* Header info */}
            <div className="flex items-center gap-3.5">
              <Avatar className="size-14 ring-1 ring-primary/20 shadow-xs">
                {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground font-heading font-semibold text-base truncate">
                    {displayName}
                  </h3>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {profile.role}
                  </Badge>
                </div>
                {profile.username && (
                  <p className="text-muted-foreground flex items-center gap-0.5 text-xs">
                    <AtSign className="size-3 text-primary" />
                    {profile.username}
                  </p>
                )}
                <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                  <Building className="size-3 text-muted-foreground" />
                  {profile.departmentName || profile.departmentCode || 'Campus Unassigned'}
                </p>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="bg-muted/20 border-border/40 rounded-lg border p-2.5 text-[11px] italic leading-relaxed text-foreground">
                <span className="font-semibold text-primary not-italic flex items-center gap-1 pb-1">
                  <FileText className="size-3" /> Bio:
                </span>
                &ldquo;{profile.bio}&rdquo;
              </div>
            )}

            {/* Student Specific Fields */}
            {profile.role === 'student' && (
              <div className="bg-muted/10 border-border/40 space-y-2 rounded-lg border p-3">
                <p className="text-primary font-semibold text-[11px] flex items-center gap-1">
                  <BookOpen className="size-3" /> Academic Cohort
                </p>
                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                  <span className="text-muted-foreground">Program:</span>
                  <span className="text-foreground font-medium font-mono">{profile.program || 'General'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Layers className="size-3" /> Current Cohort:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {profile.currentSemester && (
                      <Badge variant="info" className="text-[10px]">
                        Semester {profile.currentSemester}
                      </Badge>
                    )}
                    {profile.section && (
                      <Badge variant="outline" className="text-[10px]">
                        Section {profile.section}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Faculty Specific Fields */}
            {profile.role === 'faculty' && (
              <div className="bg-muted/10 border-border/40 space-y-2 rounded-lg border p-3">
                <p className="text-emerald-500 font-semibold text-[11px] flex items-center gap-1">
                  <Sparkles className="size-3" /> Faculty Details
                </p>
                {profile.designation && (
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Designation:</span>
                    <span className="text-foreground font-medium">{profile.designation}</span>
                  </div>
                )}
                {profile.cabinRoom && (
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <DoorOpen className="size-3" /> Cabin / Room:
                    </span>
                    <span className="text-foreground font-medium">{profile.cabinRoom}</span>
                  </div>
                )}
                {profile.officeHours && (
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" /> Office Hours:
                    </span>
                    <span className="text-foreground font-medium">
                      {profile.officeHours.start} - {profile.officeHours.end}
                    </span>
                  </div>
                )}
                {profile.phoneNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Phone className="size-3 text-primary" /> Contact Phone:
                    </span>
                    <span className="text-foreground font-mono font-medium">{profile.phoneNumber}</span>
                  </div>
                )}
                {profile.specialization && profile.specialization.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <span className="text-muted-foreground text-[10.5px]">Specializations:</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.specialization.map((spec, i) => (
                        <Badge key={i} variant="glass" className="text-[9.5px]">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

