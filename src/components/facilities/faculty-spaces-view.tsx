'use client';

/**
 * Faculty Spaces & Reservations Workspace (MOD-14 / Phase 5.9).
 * Tabbed workspace:
 * - Browse & Book Spaces (filterable campus directory + BookingCreateModal)
 * - My Reservations (status badges, review remarks, and cancel action)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, Badge, Button, EmptyState, Input } from '@/components/ui';
import {
  Building2,
  CalendarPlus,
  Clock,
  Users,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { FacilityDirectoryGrid } from './facility-directory-grid';
import { BookingCreateModal } from './booking-create-modal';
import type {
  FacilityDTO,
  FacilityBookingDTO,
  FacilityBookingStatus,
} from '@/types/facility';
import type { UserDTO } from '@/types/user';

interface FacultySpacesViewProps {
  user?: UserDTO;
  initialFacilities?: FacilityDTO[];
  initialBookings?: FacilityBookingDTO[];
}

export function FacultySpacesView({
  user: _user,
  initialFacilities = [],
  initialBookings = [],
}: FacultySpacesViewProps) {
  const [activeTab, setActiveTab] = useState<'browse' | 'reservations'>('browse');
  const [facilities, setFacilities] = useState<FacilityDTO[]>(initialFacilities);
  const [bookings, setBookings] = useState<FacilityBookingDTO[]>(initialBookings);

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<FacilityDTO | null>(null);

  // Inline cancellation state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [facRes, bkgRes] = await Promise.all([
        fetch('/api/v1/facilities?page=1&limit=100'),
        fetch('/api/v1/facilities/bookings?page=1&limit=100'),
      ]);

      const facJson = await facRes.json();
      if (facRes.ok && facJson.success && facJson.data?.facilities) {
        setFacilities(facJson.data.facilities);
      }

      const bkgJson = await bkgRes.json();
      if (bkgRes.ok && bkgJson.success && bkgJson.data?.bookings) {
        setBookings(bkgJson.data.bookings);
      }
    } catch (err) {
      console.error('Failed to refresh faculty space reservations', err);
    }
  }, []);

  const handleConfirmCancel = async (bookingId: string) => {
    setCancelError(null);
    if (cancelReason.trim().length < 5) {
      setCancelError('Please provide a cancellation reason of at least 5 characters.');
      return;
    }

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/v1/facilities/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setCancelError(json.error?.message || json.message || 'Failed to cancel booking.');
        return;
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? (json.data as FacilityBookingDTO) : b))
      );
      setCancellingId(null);
      setCancelReason('');
      void refreshData();
    } catch {
      setCancelError('Network error while cancelling reservation.');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: FacilityBookingStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="warning" className="gap-1 text-[10px]">
            <Clock className="h-3 w-3" />
            Pending Approval
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="success" className="gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="text-[10px]">
            Cancelled
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="info" className="text-[10px]">
            Completed
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Campus Spaces &amp; Facility Bookings
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Discover available laboratories, seminar halls, and auditoriums and reserve time slots for lectures, workshops, and labs.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setSelectedFacility(null);
            setIsBookingModalOpen(true);
          }}
          className="gap-1.5 text-xs"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Request Space Booking
        </Button>
      </div>

      {/* Tab Bar */}
      <div className="border-border/50 flex items-center gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('browse')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'browse'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          Browse &amp; Book Spaces ({facilities.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reservations')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'reservations'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          My Reservations ({bookings.length})
        </button>
      </div>

      {/* Tab 1: Browse & Book Spaces */}
      {activeTab === 'browse' && (
        <FacilityDirectoryGrid
          facilities={facilities}
          canBook
          isAdmin={false}
          onRequestBooking={(fac) => {
            setSelectedFacility(fac);
            setIsBookingModalOpen(true);
          }}
        />
      )}

      {/* Tab 2: My Reservations */}
      {activeTab === 'reservations' && (
        <div className="space-y-3">
          {bookings.length === 0 ? (
            <EmptyState
              glass
              title="No Reservations Yet"
              description="You have not submitted any campus facility booking requests. Switch to Browse & Book Spaces to reserve a laboratory or hall."
              className="py-10"
            />
          ) : (
            bookings.map((booking) => {
              const isCancellable =
                (booking.status === 'pending' || booking.status === 'approved') &&
                nowMs !== null &&
                new Date(booking.endTime).getTime() > nowMs;

              return (
                <Card key={booking.id} variant="glass" className="space-y-3 p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {booking.bookingCode}
                        </Badge>
                        {getStatusBadge(booking.status)}
                        <span className="truncate text-sm font-semibold">{booking.title}</span>
                      </div>

                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-blue-500" />
                          {booking.facilitySnapshot.name} ({booking.facilitySnapshot.code})
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-emerald-500" />
                          {booking.expectedAttendees} Attendees
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-indigo-500" />
                          {new Intl.DateTimeFormat('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Asia/Kolkata',
                          }).format(new Date(booking.startTime))}{' '}
                          –{' '}
                          {new Intl.DateTimeFormat('en-IN', {
                            timeStyle: 'short',
                            timeZone: 'Asia/Kolkata',
                          }).format(new Date(booking.endTime))}
                        </span>
                      </div>

                      {booking.reviewRemarks && (
                        <p className="text-muted-foreground text-xs">
                          Admin Remarks:{' '}
                          <span className="text-foreground">{booking.reviewRemarks}</span>
                        </p>
                      )}

                      {booking.cancellationReason && (
                        <p className="text-muted-foreground text-xs">
                          Cancellation Reason:{' '}
                          <span className="text-foreground">{booking.cancellationReason}</span>
                        </p>
                      )}
                    </div>

                    {isCancellable && cancellingId !== booking.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCancellingId(booking.id);
                          setCancelReason('');
                          setCancelError(null);
                        }}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs"
                      >
                        Cancel Booking
                      </Button>
                    )}
                  </div>

                  {cancellingId === booking.id && (
                    <div className="border-border/50 bg-muted/20 space-y-2 rounded-lg border p-3">
                      {cancelError && (
                        <div className="text-destructive flex items-center gap-1.5 text-xs">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>{cancelError}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Reason for cancellation (min 5 characters)..."
                          className="flex-1 text-xs"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isCancelling}
                            onClick={() => handleConfirmCancel(booking.id)}
                            className="gap-1 text-xs"
                          >
                            {isCancelling && <Loader2 className="h-3 w-3 animate-spin" />}
                            Confirm Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCancellingId(null)}
                            className="text-xs"
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      <BookingCreateModal
        isOpen={isBookingModalOpen}
        facilities={facilities}
        initialFacility={selectedFacility}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={(created) => {
          setBookings((prev) => [created, ...prev]);
          setActiveTab('reservations');
          void refreshData();
        }}
      />
    </div>
  );
}
