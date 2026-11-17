'use client';

/**
 * Facility Directory Grid Component (MOD-14 / Phase 5.9).
 * Filterable directory cards for campus spaces by building, type, minimum capacity,
 * amenities, and availability status. Supports booking triggers and admin management actions.
 */

import React, { useState, useMemo } from 'react';
import { Card, Badge, Button, Input, EmptyState } from '@/components/ui';
import {
  Building2,
  Users,
  Monitor,
  Search,
  Wrench,
  CheckCircle2,
  XCircle,
  CalendarPlus,
  Edit3,
  Layers,
  Filter,
} from 'lucide-react';
import {
  FACILITY_AMENITIES,
  type FacilityDTO,
  type FacilityStatus,
  type FacilityType,
} from '@/types/facility';

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  auditorium: 'Auditorium',
  computer_lab: 'Computer Lab',
  seminar_hall: 'Seminar Hall',
  classroom: 'Smart Classroom',
  conference_room: 'Conference Room',
  workshop: 'Workshop',
};

export const AMENITY_LABELS: Record<string, string> = {
  projector: 'Projector',
  ac: 'Air Conditioned',
  smart_board: 'Smart Board',
  audio_system: 'Audio System',
  high_speed_lan: 'High-Speed LAN',
  pcs: 'Workstation PCs',
};

interface FacilityDirectoryGridProps {
  facilities: FacilityDTO[];
  canBook?: boolean;
  isAdmin?: boolean;
  onRequestBooking?: (facility: FacilityDTO) => void;
  onEditFacility?: (facility: FacilityDTO) => void;
  onToggleStatus?: (facility: FacilityDTO, nextStatus: FacilityStatus) => void;
}

export function FacilityDirectoryGrid({
  facilities,
  canBook = true,
  isAdmin = false,
  onRequestBooking,
  onEditFacility,
  onToggleStatus,
}: FacilityDirectoryGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | FacilityType>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | FacilityStatus>('all');
  const [minCapacity, setMinCapacity] = useState<string>('');
  const [selectedAmenity, setSelectedAmenity] = useState<string>('all');

  const buildings = useMemo(() => {
    const set = new Set<string>();
    facilities.forEach((f) => {
      if (f.building) set.add(f.building);
    });
    return Array.from(set).sort();
  }, [facilities]);

  const filteredFacilities = useMemo(() => {
    const parsedMinCap = Number(minCapacity) || 0;

    return facilities.filter((fac) => {
      if (selectedBuilding !== 'all' && fac.building !== selectedBuilding) return false;
      if (selectedType !== 'all' && fac.type !== selectedType) return false;
      if (selectedStatus !== 'all' && fac.status !== selectedStatus) return false;
      if (parsedMinCap > 0 && fac.capacity < parsedMinCap) return false;
      if (selectedAmenity !== 'all' && !fac.amenities.includes(selectedAmenity)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = fac.code.toLowerCase().includes(q);
        const matchesName = fac.name.toLowerCase().includes(q);
        const matchesBuilding = fac.building.toLowerCase().includes(q);
        const matchesDept = (fac.department || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesBuilding && !matchesDept) return false;
      }

      return true;
    });
  }, [
    facilities,
    selectedBuilding,
    selectedType,
    selectedStatus,
    minCapacity,
    selectedAmenity,
    searchQuery,
  ]);

  const getStatusBadge = (status: FacilityStatus) => {
    switch (status) {
      case 'available':
        return (
          <Badge variant="success" className="gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" />
            Available
          </Badge>
        );
      case 'maintenance':
        return (
          <Badge variant="warning" className="gap-1 text-[10px]">
            <Wrench className="h-3 w-3" />
            Maintenance
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <XCircle className="h-3 w-3" />
            Inactive
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <Card variant="glass" className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, room name, block..."
              aria-label="Search campus facilities"
              className="pl-9 text-xs"
            />
          </div>

          <select
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding(e.target.value)}
            aria-label="Filter by building"
            className="border-input bg-background/60 h-9 rounded-md border px-2.5 text-xs"
          >
            <option value="all">All Buildings</option>
            {buildings.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as 'all' | FacilityType)}
            aria-label="Filter by facility type"
            className="border-input bg-background/60 h-9 rounded-md border px-2.5 text-xs"
          >
            <option value="all">All Space Types</option>
            {(Object.keys(FACILITY_TYPE_LABELS) as FacilityType[]).map((t) => (
              <option key={t} value={t}>
                {FACILITY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          <select
            value={selectedAmenity}
            onChange={(e) => setSelectedAmenity(e.target.value)}
            aria-label="Filter by amenity"
            className="border-input bg-background/60 h-9 rounded-md border px-2.5 text-xs"
          >
            <option value="all">All Amenities</option>
            {FACILITY_AMENITIES.map((a) => (
              <option key={a} value={a}>
                {AMENITY_LABELS[a] || a}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={2000}
              value={minCapacity}
              onChange={(e) => setMinCapacity(e.target.value)}
              placeholder="Min Cap"
              aria-label="Minimum capacity"
              className="h-9 text-xs"
            />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'all' | FacilityStatus)}
              aria-label="Filter by status"
              className="border-input bg-background/60 h-9 rounded-md border px-2 text-xs"
            >
              <option value="all">Status</option>
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="text-muted-foreground mt-2.5 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Showing {filteredFacilities.length} of {facilities.length} campus spaces
          </span>
          {(searchQuery ||
            selectedBuilding !== 'all' ||
            selectedType !== 'all' ||
            selectedStatus !== 'all' ||
            selectedAmenity !== 'all' ||
            minCapacity) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedBuilding('all');
                setSelectedType('all');
                setSelectedStatus('all');
                setSelectedAmenity('all');
                setMinCapacity('');
              }}
              className="text-primary font-medium hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* Directory Cards */}
      {filteredFacilities.length === 0 ? (
        <EmptyState
          glass
          title="No Matching Campus Spaces"
          description="No facilities match your current filter criteria. Try broadening capacity, building, or amenity filters."
          className="py-10"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFacilities.map((facility) => {
            const isAvailable = facility.status === 'available';

            return (
              <Card
                key={facility.id}
                variant="glass"
                className="flex flex-col justify-between p-5 transition-shadow hover:shadow-md"
              >
                <div className="space-y-3">
                  {/* Top Row: Code + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-[10px] font-semibold">
                          {facility.code}
                        </Badge>
                        <Badge variant="glass" className="text-[10px]">
                          {FACILITY_TYPE_LABELS[facility.type] || facility.type}
                        </Badge>
                      </div>
                      <h3 className="text-foreground mt-2 truncate text-sm font-semibold">
                        {facility.name}
                      </h3>
                    </div>
                    {getStatusBadge(facility.status)}
                  </div>

                  {/* Location & Specs */}
                  <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <span className="truncate">{facility.building}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                      <span>{facility.floor === 0 ? 'Ground Floor' : `Floor ${facility.floor}`}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>Capacity: {facility.capacity}</span>
                    </div>
                    {facility.pcCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Monitor className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                        <span>{facility.pcCount} PCs</span>
                      </div>
                    )}
                  </div>

                  {facility.department && (
                    <p className="text-muted-foreground text-[11px]">
                      Department: <span className="text-foreground font-medium">{facility.department}</span>
                    </p>
                  )}

                  {facility.description && (
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {facility.description}
                    </p>
                  )}

                  {/* Amenities Chips */}
                  {facility.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {facility.amenities.map((amenity) => (
                        <span
                          key={amenity}
                          className="border-border/50 bg-muted/40 text-muted-foreground rounded-md border px-2 py-0.5 text-[10px]"
                        >
                          {AMENITY_LABELS[amenity] || amenity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="border-border/40 mt-4 flex items-center gap-2 border-t pt-3">
                  {canBook && onRequestBooking && (
                    <Button
                      size="sm"
                      disabled={!isAvailable}
                      onClick={() => onRequestBooking(facility)}
                      className="flex-1 gap-1.5 text-xs"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      {isAvailable ? 'Request Booking' : 'Unavailable'}
                    </Button>
                  )}

                  {isAdmin && onEditFacility && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditFacility(facility)}
                      className="gap-1 text-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  )}

                  {isAdmin && onToggleStatus && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onToggleStatus(
                          facility,
                          facility.status === 'available' ? 'maintenance' : 'available'
                        )
                      }
                      className="text-xs"
                      title={
                        facility.status === 'available'
                          ? 'Mark under maintenance'
                          : 'Mark available'
                      }
                    >
                      <Wrench className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
