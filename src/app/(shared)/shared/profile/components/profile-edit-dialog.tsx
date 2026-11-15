'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
  Input,
  Textarea,
  Label,
  Checkbox,
} from '@/components/ui';
import type { OwnerProfileDTO } from '@/types/profile';
import {
  User,
  Phone,
  FileText,
  Image as ImageIcon,
  DoorOpen,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface ProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: OwnerProfileDTO;
  onSaved: (updatedProfile: OwnerProfileDTO) => void;
}

export function ProfileEditDialog({
  open,
  onOpenChange,
  profile,
  onSaved,
}: ProfileEditDialogProps) {
  const isFaculty = profile.role === 'faculty';

  // Form State
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');

  // Faculty specific
  const [cabinRoom, setCabinRoom] = useState(profile.facultyProfile?.cabinRoom || '');
  const [officeStart, setOfficeStart] = useState(profile.facultyProfile?.officeHours?.start || '10:00');
  const [officeEnd, setOfficeEnd] = useState(profile.facultyProfile?.officeHours?.end || '12:00');
  const [isAcceptingDMs, setIsAcceptingDMs] = useState(
    profile.facultyProfile?.officeHours?.isAcceptingDMs ?? true
  );
  const [specializations, setSpecializations] = useState(
    profile.facultyProfile?.specialization?.join(', ') || ''
  );
  const [sharePhoneWithStudents, setSharePhoneWithStudents] = useState(
    Boolean(profile.facultyProfile?.sharePhoneWithStudents)
  );

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
        bio: bio.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      };

      if (isFaculty) {
        payload.facultyProfile = {
          cabinRoom: cabinRoom.trim() || undefined,
          officeHours: officeStart && officeEnd ? {
            start: officeStart.trim(),
            end: officeEnd.trim(),
            isAcceptingDMs,
          } : undefined,
          specialization: specializations
            ? specializations
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          sharePhoneWithStudents,
        };
      }

      const res = await fetch('/api/v1/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorDetail =
          json.error?.details && Array.isArray(json.error.details)
            ? json.error.details.map((d: { message: string }) => d.message).join('. ')
            : json.message || json.error?.message || 'Failed to update profile';
        throw new Error(errorDetail);
      }

      setSuccessMessage('Profile updated successfully!');
      onSaved(json.data as OwnerProfileDTO);

      // Close modal after brief success presentation
      setTimeout(() => {
        onOpenChange(false);
      }, 700);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error updating profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <User className="size-4 text-primary" />
            Edit Profile
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update your public collegiate persona and contact preferences.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div className="bg-destructive/10 text-destructive border-destructive/20 flex items-start gap-2 rounded-lg border p-3 text-xs leading-snug">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex items-center gap-2 rounded-lg border p-3 text-xs font-medium">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-xs font-medium flex items-center gap-1.5">
              <User className="size-3.5 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full collegiate name"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Personal Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bio" className="text-xs font-medium flex items-center gap-1.5">
                <FileText className="size-3.5 text-muted-foreground" />
                Personal Bio
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {bio.length}/500 chars
              </span>
            </div>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Brief professional or academic summary..."
              maxLength={500}
              disabled={isSubmitting}
              className="resize-none text-xs"
            />
          </div>

          {/* Contact Phone Number */}
          <div className="space-y-1.5">
            <Label htmlFor="phoneNumber" className="text-xs font-medium flex items-center gap-1.5">
              <Phone className="size-3.5 text-muted-foreground" />
              Contact Phone (E.164 Format)
            </Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+919876543210"
              disabled={isSubmitting}
            />
            <p className="text-[10.5px] text-muted-foreground">
              Include country code (e.g. +91 for India).
            </p>
          </div>

          {/* Avatar URL */}
          <div className="space-y-1.5">
            <Label htmlFor="avatarUrl" className="text-xs font-medium flex items-center gap-1.5">
              <ImageIcon className="size-3.5 text-muted-foreground" />
              Profile Photo URL
            </Label>
            <Input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              disabled={isSubmitting}
            />
          </div>

          {/* Faculty Exclusive Section */}
          {isFaculty && (
            <div className="border-border/60 bg-muted/15 space-y-3.5 rounded-xl border p-3.5 pt-2.5">
              <p className="text-primary text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                Faculty Office &amp; Consultation Preferences
              </p>

              {/* Cabin Room */}
              <div className="space-y-1.5">
                <Label htmlFor="cabinRoom" className="text-xs font-medium flex items-center gap-1.5">
                  <DoorOpen className="size-3.5 text-muted-foreground" />
                  Cabin / Office Room
                </Label>
                <Input
                  id="cabinRoom"
                  value={cabinRoom}
                  onChange={(e) => setCabinRoom(e.target.value)}
                  placeholder="Block B, Room 204"
                  disabled={isSubmitting}
                />
              </div>

              {/* Office Hours */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="officeStart" className="text-xs font-medium flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground" /> Start Time
                  </Label>
                  <Input
                    id="officeStart"
                    value={officeStart}
                    onChange={(e) => setOfficeStart(e.target.value)}
                    placeholder="10:00"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="officeEnd" className="text-xs font-medium flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground" /> End Time
                  </Label>
                  <Input
                    id="officeEnd"
                    value={officeEnd}
                    onChange={(e) => setOfficeEnd(e.target.value)}
                    placeholder="12:00"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Accepting DMs Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="isAcceptingDMs"
                  checked={isAcceptingDMs}
                  onCheckedChange={(checked) => setIsAcceptingDMs(Boolean(checked))}
                  disabled={isSubmitting}
                />
                <Label htmlFor="isAcceptingDMs" className="text-xs font-normal cursor-pointer">
                  Accept student direct messages during office hours
                </Label>
              </div>

              {/* Specializations */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="specializations" className="text-xs font-medium">
                  Areas of Specialization (comma-separated)
                </Label>
                <Input
                  id="specializations"
                  value={specializations}
                  onChange={(e) => setSpecializations(e.target.value)}
                  placeholder="Machine Learning, Distributed Systems, Cloud Computing"
                  disabled={isSubmitting}
                />
              </div>

              {/* Phone Sharing Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="sharePhoneWithStudents"
                  checked={sharePhoneWithStudents}
                  onCheckedChange={(checked) => setSharePhoneWithStudents(Boolean(checked))}
                  disabled={isSubmitting}
                />
                <Label htmlFor="sharePhoneWithStudents" className="text-xs font-normal cursor-pointer">
                  Share contact phone with enrolled students
                </Label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

