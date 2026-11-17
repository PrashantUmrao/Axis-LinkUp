'use client';

/**
 * Facility Form Modal Component (MOD-14 / Phase 5.9).
 * Enables Administrators and Super Administrators to register or update campus spaces,
 * capacities, laboratory PC counts, amenities, and maintenance status.
 */

import React, { useState, useEffect } from 'react';
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
} from '@/components/ui';
import { AlertCircle, Loader2, Building2 } from 'lucide-react';
import {
  FACILITY_AMENITIES,
  type FacilityDTO,
  type FacilityStatus,
  type FacilityType,
} from '@/types/facility';
import { FACILITY_TYPE_LABELS, AMENITY_LABELS } from './facility-directory-grid';

interface FacilityFormModalProps {
  isOpen: boolean;
  facility?: FacilityDTO | null;
  onClose: () => void;
  onSuccess: (facility: FacilityDTO) => void;
}

export function FacilityFormModal({
  isOpen,
  facility = null,
  onClose,
  onSuccess,
}: FacilityFormModalProps) {
  const isEditing = Boolean(facility);

  const [code, setCode] = useState(facility?.code || '');
  const [name, setName] = useState(facility?.name || '');
  const [building, setBuilding] = useState(facility?.building || '');
  const [floor, setFloor] = useState(String(facility?.floor ?? 0));
  const [type, setType] = useState<FacilityType>(facility?.type || 'computer_lab');
  const [department, setDepartment] = useState(facility?.department || '');
  const [capacity, setCapacity] = useState(String(facility?.capacity ?? 60));
  const [pcCount, setPcCount] = useState(String(facility?.pcCount ?? 0));
  const [status, setStatus] = useState<FacilityStatus>(facility?.status || 'available');
  const [amenities, setAmenities] = useState<string[]>(facility?.amenities || ['projector', 'ac']);
  const [description, setDescription] = useState(facility?.description || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (facility) {
      setCode(facility.code);
      setName(facility.name);
      setBuilding(facility.building);
      setFloor(String(facility.floor));
      setType(facility.type);
      setDepartment(facility.department || '');
      setCapacity(String(facility.capacity));
      setPcCount(String(facility.pcCount));
      setStatus(facility.status);
      setAmenities(facility.amenities || []);
      setDescription(facility.description || '');
    } else {
      setCode('');
      setName('');
      setBuilding('');
      setFloor('0');
      setType('computer_lab');
      setDepartment('');
      setCapacity('60');
      setPcCount('0');
      setStatus('available');
      setAmenities(['projector', 'ac']);
      setDescription('');
    }
    setError(null);
  }, [facility, isOpen]);

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.trim().length < 2) {
      setError('Facility code must be at least 2 characters (e.g., BLK-A-LAB-402).');
      return;
    }
    if (name.trim().length < 3) {
      setError('Facility name must be at least 3 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        building: building.trim(),
        floor: Number(floor),
        type,
        department: department.trim() || null,
        capacity: Number(capacity),
        pcCount: Number(pcCount) || 0,
        status,
        amenities,
        description: description.trim() || null,
      };

      const url = isEditing && facility ? `/api/v1/facilities/${facility.id}` : '/api/v1/facilities';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || json.message || 'Failed to save campus facility.');
        return;
      }

      onSuccess(json.data as FacilityDTO);
      onClose();
    } catch {
      setError('Network error while saving campus facility.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="text-primary h-4 w-4" />
            {isEditing ? 'Edit Campus Facility' : 'Add Campus Facility / Space'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure room identifiers, capacity ceilings, available equipment, and operational status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-xs">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fac-code" className="text-xs">
                Facility Code *
              </Label>
              <Input
                id="fac-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="BLK-A-LAB-402"
                required
                className="font-mono text-xs uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fac-type" className="text-xs">
                Space Type *
              </Label>
              <select
                id="fac-type"
                value={type}
                onChange={(e) => setType(e.target.value as FacilityType)}
                className="border-input bg-background h-9 w-full rounded-md border px-2.5 text-xs"
              >
                {(Object.keys(FACILITY_TYPE_LABELS) as FacilityType[]).map((t) => (
                  <option key={t} value={t}>
                    {FACILITY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fac-name" className="text-xs">
              Facility Name *
            </Label>
            <Input
              id="fac-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Central Computing Lab 402"
              required
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="fac-building" className="text-xs">
                Building / Block *
              </Label>
              <Input
                id="fac-building"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="Block A"
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fac-floor" className="text-xs">
                Floor (0–20) *
              </Label>
              <Input
                id="fac-floor"
                type="number"
                min={0}
                max={20}
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fac-status" className="text-xs">
                Status *
              </Label>
              <select
                id="fac-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as FacilityStatus)}
                className="border-input bg-background h-9 w-full rounded-md border px-2.5 text-xs"
              >
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="fac-capacity" className="text-xs">
                Seating Capacity *
              </Label>
              <Input
                id="fac-capacity"
                type="number"
                min={1}
                max={2000}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fac-pc-count" className="text-xs">
                Workstation PCs
              </Label>
              <Input
                id="fac-pc-count"
                type="number"
                min={0}
                max={1000}
                value={pcCount}
                onChange={(e) => setPcCount(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fac-dept" className="text-xs">
                Department (Optional)
              </Label>
              <Input
                id="fac-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Shared Institutional"
                className="text-xs"
              />
            </div>
          </div>

          {/* Amenities Checkboxes */}
          <div className="space-y-2">
            <Label className="text-xs">Amenities &amp; Equipment</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FACILITY_AMENITIES.map((amenity) => {
                const checked = amenities.includes(amenity);
                return (
                  <label
                    key={amenity}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition-colors ${
                      checked
                        ? 'border-primary/50 bg-primary/10 text-foreground font-medium'
                        : 'border-border/60 bg-background/40 text-muted-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAmenity(amenity)}
                      className="accent-primary h-3.5 w-3.5"
                    />
                    <span>{AMENITY_LABELS[amenity] || amenity}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fac-desc" className="text-xs">
              Description / Notes
            </Label>
            <Textarea
              id="fac-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional usage guidelines, lab software stack, or AV notes..."
              rows={2}
              maxLength={500}
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Register Facility'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
