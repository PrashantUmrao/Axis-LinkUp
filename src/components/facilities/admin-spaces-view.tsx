'use client';

/**
 * Admin Spaces & Facility Bookings Console (MOD-14 / Phase 5.9).
 * Tabbed administrative workspace:
 * - Reservation Queue (Pending / Approved / Rejected / All) with Review Modal
 * - Campus Spaces Inventory (Add / Edit / Maintenance toggle)
 * - KPI Metric Overview Cards
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Badge, Button, Input, EmptyState } from '@/components/ui';
import {
  Building2,
  CheckCircle2,
  Clock,
  Wrench,
  Plus,
  Search,
  Users,
  CalendarPlus,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { FacilityDirectoryGrid } from './facility-directory-grid';
import { FacilityFormModal } from './facility-form-modal';
import { BookingCreateModal } from './booking-create-modal';
import { BookingReviewModal } from './booking-review-modal';
import type {
  FacilityDTO,
  FacilityBookingDTO,
  FacilityStatsDTO,
  FacilityBookingStatus,
  FacilityStatus,
} from '@/types/facility';
import type { UserDTO } from '@/types/user';

interface AdminSpacesViewProps {
  user?: UserDTO;
  initialFacilities?: FacilityDTO[];
  initialBookings?: FacilityBookingDTO[];
  initialStats?: FacilityStatsDTO | null;
}

export function AdminSpacesView({
  user: _user,
  initialFacilities = [],
  initialBookings = [],
  initialStats = null,
}: AdminSpacesViewProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'inventory'>('queue');
  const [facilities, setFacilities] = useState<FacilityDTO[]>(initialFacilities);
  const [bookings, setBookings] = useState<FacilityBookingDTO[]>(initialBookings);
  const [stats, setStats] = useState<FacilityStatsDTO | null>(initialStats);

  // Queue filters
  const [statusFilter, setStatusFilter] = useState<'all' | FacilityBookingStatus>('all');
  const [queueSearch, setQueueSearch] = useState('');

  // Modals
  const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<FacilityDTO | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingTargetFacility, setBookingTargetFacility] = useState<FacilityDTO | null>(null);
  const [reviewingBooking, setReviewingBooking] = useState<FacilityBookingDTO | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      const [facRes, bkgRes, statsRes] = await Promise.all([
        fetch('/api/v1/facilities?page=1&limit=100'),
        fetch('/api/v1/facilities/bookings?page=1&limit=100'),
        fetch('/api/v1/facilities/stats'),
      ]);

      const facJson = await facRes.json();
      if (facRes.ok && facJson.success && facJson.data?.facilities) {
        setFacilities(facJson.data.facilities);
      }

      const bkgJson = await bkgRes.json();
      if (bkgRes.ok && bkgJson.success && bkgJson.data?.bookings) {
        setBookings(bkgJson.data.bookings);
      }

      const statsJson = await statsRes.json();
      if (statsRes.ok && statsJson.success && statsJson.data) {
        setStats(statsJson.data);
      }
    } catch (err) {
      console.error('Failed to refresh facility admin console', err);
    }
  }, []);

  const handleToggleFacilityStatus = async (
    facility: FacilityDTO,
    nextStatus: FacilityStatus
  ) => {
    try {
      const res = await fetch(`/api/v1/facilities/${facility.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setFacilities((prev) =>
          prev.map((f) => (f.id === facility.id ? (json.data as FacilityDTO) : f))
        );
        void refreshAll();
      }
    } catch (err) {
      console.error('Failed to toggle facility status', err);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (queueSearch.trim()) {
        const q = queueSearch.toLowerCase().trim();
        const matchCode = b.bookingCode.toLowerCase().includes(q);
        const matchTitle = b.title.toLowerCase().includes(q);
        const matchSpace = b.facilitySnapshot.name.toLowerCase().includes(q);
        const matchReq = b.requesterSnapshot.fullName.toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchSpace && !matchReq) return false;
      }
      return true;
    });
  }, [bookings, statusFilter, queueSearch]);

  const computedStats = useMemo(() => {
    if (stats) return stats;
    return {
      totalSpaces: facilities.length,
      availableSpaces: facilities.filter((f) => f.status === 'available').length,
      maintenanceSpaces: facilities.filter((f) => f.status === 'maintenance').length,
      inactiveSpaces: facilities.filter((f) => f.status === 'inactive').length,
      pendingBookings: bookings.filter((b) => b.status === 'pending').length,
      approvedToday: bookings.filter((b) => b.status === 'approved').length,
      totalBookings: bookings.length,
    };
  }, [stats, facilities, bookings]);

  const getStatusBadge = (status: FacilityBookingStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      case 'completed':
        return <Badge variant="info">Completed</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Facility Bookings &amp; Campus Spaces
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Manage institutional auditoriums, computing laboratories, seminar halls, and reservation approvals with atomic conflict protection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBookingTargetFacility(null);
              setIsBookingModalOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            New Booking
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingFacility(null);
              setIsFacilityModalOpen(true);
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Space
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Total Spaces</span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{computedStats.totalSpaces}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Available</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-emerald-500">
            {computedStats.availableSpaces}
          </p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Maintenance</span>
            <Wrench className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-amber-500">
            {computedStats.maintenanceSpaces}
          </p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Pending Bookings</span>
            <Clock className="h-4 w-4 text-orange-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-orange-500">
            {computedStats.pendingBookings}
          </p>
        </Card>

        <Card variant="glass" className="col-span-2 p-4 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Approved Today</span>
            <ClipboardList className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-indigo-500">
            {computedStats.approvedToday}
          </p>
        </Card>
      </div>

      {/* Console Tab Bar */}
      <div className="border-border/50 flex items-center gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'queue'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          Reservation Queue ({bookings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'inventory'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          Campus Spaces Inventory ({facilities.length})
        </button>
      </div>

      {/* Tab 1: Reservation Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <Card variant="glass" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Search booking code, event title, room, or faculty name..."
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                    statusFilter === st
                      ? 'bg-primary/15 text-primary ring-primary/30 ring-1'
                      : 'text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </Card>

          {filteredBookings.length === 0 ? (
            <EmptyState
              glass
              title="No Reservations Found"
              description="There are no campus space reservations matching the selected status or search criteria."
              className="py-10"
            />
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => (
                <Card
                  key={booking.id}
                  variant="glass"
                  className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                >
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
                        {booking.expectedAttendees}/{booking.facilitySnapshot.capacity}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-indigo-500" />
                        {new Date(booking.startTime).toLocaleString()} –{' '}
                        {new Date(booking.endTime).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-muted-foreground text-[11px]">
                      Requested by{' '}
                      <span className="text-foreground font-medium">
                        {booking.requesterSnapshot.fullName}
                      </span>
                      {booking.requesterSnapshot.department &&
                        ` • ${booking.requesterSnapshot.department}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={booking.status === 'pending' ? 'default' : 'outline'}
                      onClick={() => setReviewingBooking(booking)}
                      className="gap-1 text-xs"
                    >
                      {booking.status === 'pending' ? 'Review & Decide' : 'Inspect'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Campus Spaces Inventory */}
      {activeTab === 'inventory' && (
        <FacilityDirectoryGrid
          facilities={facilities}
          canBook
          isAdmin
          onRequestBooking={(fac) => {
            setBookingTargetFacility(fac);
            setIsBookingModalOpen(true);
          }}
          onEditFacility={(fac) => {
            setEditingFacility(fac);
            setIsFacilityModalOpen(true);
          }}
          onToggleStatus={handleToggleFacilityStatus}
        />
      )}

      {/* Modals */}
      <FacilityFormModal
        isOpen={isFacilityModalOpen}
        facility={editingFacility}
        onClose={() => setIsFacilityModalOpen(false)}
        onSuccess={(saved) => {
          setFacilities((prev) => {
            const exists = prev.some((f) => f.id === saved.id);
            return exists ? prev.map((f) => (f.id === saved.id ? saved : f)) : [saved, ...prev];
          });
          void refreshAll();
        }}
      />

      <BookingCreateModal
        isOpen={isBookingModalOpen}
        facilities={facilities}
        initialFacility={bookingTargetFacility}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={(created) => {
          setBookings((prev) => [created, ...prev]);
          void refreshAll();
        }}
      />

      <BookingReviewModal
        booking={reviewingBooking}
        isOpen={Boolean(reviewingBooking)}
        onClose={() => setReviewingBooking(null)}
        onSuccess={(updated) => {
          setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          void refreshAll();
        }}
      />
    </div>
  );
}
