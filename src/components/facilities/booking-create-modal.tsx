'use client';

/**
 * Booking Create Modal Component (MOD-14 / Phase 5.9).
 * Enables Faculty and Administrators to request a campus space reservation with
 * real-time capacity validation, time-slot bounds (30m–12h), and conflict error alerts.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Textarea,
  Badge,
} from '@/components/ui';
import { AlertCircle, CalendarPlus, Loader2, Users, Clock, AlertTriangle } from 'lucide-react';
import type { FacilityDTO, FacilityBookingDTO } from '@/types/facility';

interface BookingCreateModalProps {
  isOpen: boolean;
  facilities: FacilityDTO[];
  initialFacility?: FacilityDTO | null;
  onClose: () => void;
  onSuccess: (booking: FacilityBookingDTO) => void;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function BookingCreateModal({
  isOpen,
  facilities,
  initialFacility = null,
  onClose,
  onSuccess,
}: BookingCreateModalProps) {
  const availableFacilities = useMemo(
    () => facilities.filter((f) => f.status === 'available'),
    [facilities]
  );

  const [facilityId, setFacilityId] = useState<string>(
    initialFacility?.id || availableFacilities[0]?.id || ''
  );
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expectedAttendees, setExpectedAttendees] = useState('30');

  const defaultStart = useMemo(() => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return toLocalDateTimeInput(d);
  }, []);

  const defaultEnd = useMemo(() => {
    const d = new Date(Date.now() + 4 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return toLocalDateTimeInput(d);
  }, []);

  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictBanner, setConflictBanner] = useState<string | null>(null);

  useEffect(() => {
    if (initialFacility) {
      setFacilityId(initialFacility.id);
    } else if (!facilityId && availableFacilities[0]) {
      setFacilityId(availableFacilities[0].id);
    }
    setError(null);
    setConflictBanner(null);
  }, [initialFacility, isOpen, availableFacilities, facilityId]);

  const selectedFacility = useMemo(
    () => facilities.find((f) => f.id === facilityId) || null,
    [facilities, facilityId]
  );

  const attendeeCount = Number(expectedAttendees) || 0;
  const isOverCapacity =
    selectedFacility !== null && attendeeCount > selectedFacility.capacity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflictBanner(null);

    if (!selectedFacility) {
      setError('Please select an available campus facility.');
      return;
    }

    if (isOverCapacity) {
      setError(
        `Expected attendees (${attendeeCount}) exceeds ${selectedFacility.name} maximum capacity (${selectedFacility.capacity}).`
      );
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError('Please provide valid start and end timestamps.');
      return;
    }

    const durationMinutes = (endDate.getTime() - startDate.getTime()) / (60 * 1000);
    if (durationMinutes < 30 || durationMinutes > 720) {
      setError('Reservation duration must be between 30 minutes and 12 hours.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/facilities/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: selectedFacility.id,
          title: title.trim(),
          purpose: purpose.trim(),
          expectedAttendees: attendeeCount,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const msg =
          json.error?.message || json.message || 'Could not submit reservation request.';
        if (res.status === 409) {
          setConflictBanner(msg);
        } else {
          setError(msg);
        }
        return;
      }

      setTitle('');
      setPurpose('');
      onSuccess(json.data as FacilityBookingDTO);
      onClose();
    } catch {
      setError('Network error while submitting space reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="text-primary h-4 w-4" />
            Request Campus Space Reservation
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select a campus space and time window (30 minutes to 12 hours). Reservations are checked against confirmed bookings for conflicts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {conflictBanner && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Time-Slot Conflict Detected</p>
                <p className="mt-0.5">{conflictBanner}</p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Facility Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="booking-facility" className="text-xs">
              Campus Facility *
            </Label>
            <select
              id="booking-facility"
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              required
              className="border-input bg-background h-9 w-full rounded-md border px-2.5 text-xs"
            >
              <option value="" disabled>
                Select an available space...
              </option>
              {availableFacilities.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.code}] {f.name} — {f.building} (Cap: {f.capacity})
                </option>
              ))}
            </select>
            {selectedFacility && (
              <div className="text-muted-foreground flex items-center justify-between pt-1 text-[11px]">
                <span>
                  {selectedFacility.building} • Floor {selectedFacility.floor}
                </span>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Users className="h-3 w-3" />
                  Max Capacity: {selectedFacility.capacity}
                </Badge>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="booking-title" className="text-xs">
              Session / Event Title *
            </Label>
            <Input
              id="booking-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., AI Workshop — B.Tech CSE Sem 6"
              minLength={5}
              maxLength={120}
              required
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="booking-start" className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" /> Start Date &amp; Time *
              </Label>
              <Input
                id="booking-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="booking-end" className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" /> End Date &amp; Time *
              </Label>
              <Input
                id="booking-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="booking-attendees" className="text-xs">
              Expected Attendees *
            </Label>
            <Input
              id="booking-attendees"
              type="number"
              min={1}
              max={selectedFacility?.capacity || 2000}
              value={expectedAttendees}
              onChange={(e) => setExpectedAttendees(e.target.value)}
              required
              className="text-xs"
            />
            {isOverCapacity && selectedFacility && (
              <p className="text-destructive text-[11px] font-medium">
                Exceeds room capacity limit ({selectedFacility.capacity} seats).
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="booking-purpose" className="text-xs">
              Academic Purpose &amp; Requirements *
            </Label>
            <Textarea
              id="booking-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe the session, batch participating, and any AV/projector setup required..."
              minLength={10}
              maxLength={1000}
              rows={3}
              required
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isOverCapacity || !selectedFacility}
              className="gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit Reservation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
