'use client';

/**
 * Student Request Compose Modal Component (MOD-13 / Phase 5.8).
 * Enables collegiate students to submit standardized administrative applications.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea,
} from '@/components/ui';
import { FileUploader } from '@/components/assignments/file-uploader';
import {
  FileText,
  Calendar,
  CreditCard,
  Cpu,
  HelpCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { AssignmentAttachment } from '@/types/assignment';
import type {
  ServiceRequestCategory,
  ServiceRequestPriority,
  ServiceRequestDTO,
  IRequestAttachment,
} from '@/types/service-request';

interface StudentRequestComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newRequest: ServiceRequestDTO) => void;
}

const CATEGORIES: {
  id: ServiceRequestCategory;
  title: string;
  desc: string;
  icon: React.ElementType;
}[] = [
  {
    id: 'bonafide',
    title: 'Bonafide Certificate',
    desc: 'Official verification for visa, loan, or scholarship.',
    icon: FileText,
  },
  {
    id: 'leave',
    title: 'Leave Application',
    desc: 'Formal academic duty or medical leave clearance.',
    icon: Calendar,
  },
  {
    id: 'id_replacement',
    title: 'ID Replacement',
    desc: 'Re-issuance for lost, damaged, or stolen smartcard.',
    icon: CreditCard,
  },
  {
    id: 'lab_access',
    title: 'Special Lab Access',
    desc: 'Extended hours approval for departmental research labs.',
    icon: Cpu,
  },
  {
    id: 'general_inquiry',
    title: 'General Inquiry',
    desc: 'Official query to administrative desk.',
    icon: HelpCircle,
  },
];

export function StudentRequestComposeModal({
  isOpen,
  onClose,
  onSuccess,
}: StudentRequestComposeModalProps) {
  const [category, setCategory] = useState<ServiceRequestCategory>('bonafide');
  const [priority, setPriority] = useState<ServiceRequestPriority>('standard');
  const [subject, setSubject] = useState('');

  // Bonafide state
  const [bonafidePurpose, setBonafidePurpose] = useState('scholarship');
  const [customPurpose, setCustomPurpose] = useState('');

  // Leave state
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // ID Replacement state
  const [idReason, setIdReason] = useState<'lost' | 'damaged' | 'stolen'>('lost');
  const [policeReportRef, setPoliceReportRef] = useState('');

  // Lab Access state
  const [labName, setLabName] = useState('');
  const [facultySupervisor, setFacultySupervisor] = useState('');
  const [durationHours, setDurationHours] = useState(2);
  const [requiredDates, setRequiredDates] = useState('');

  // General Inquiry state
  const [queryDetails, setQueryDetails] = useState('');

  // Attachments state (managed via signed FileUploader — AUD-H14)
  const [uploadedFiles, setUploadedFiles] = useState<AssignmentAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);

    if (subject.trim().length < 5) {
      setError('Subject must be at least 5 characters long.');
      return;
    }

    // Prepare contextual details
    let details: Record<string, unknown> = {};

    if (category === 'bonafide') {
      if (bonafidePurpose === 'other' && (!customPurpose || customPurpose.trim().length < 3)) {
        setError('Please specify the custom purpose for your bonafide requisition (min 3 characters).');
        return;
      }
      details = {
        purpose: bonafidePurpose,
        ...(bonafidePurpose === 'other' ? { customPurpose: customPurpose.trim() } : {}),
      };
    } else if (category === 'leave') {
      if (!leaveStart || !leaveEnd) {
        setError('Start date and end date are required for leave requisitions.');
        return;
      }
      if (new Date(leaveEnd) < new Date(leaveStart)) {
        setError('Leave end date cannot be earlier than start date.');
        return;
      }
      if (leaveReason.trim().length < 5) {
        setError('Please provide a descriptive reason for leave (minimum 5 characters).');
        return;
      }
      if (!emergencyContact.trim()) {
        setError('Emergency contact number or details are required.');
        return;
      }
      details = {
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: leaveReason.trim(),
        emergencyContact: emergencyContact.trim(),
      };
    } else if (category === 'id_replacement') {
      details = {
        reason: idReason,
        ...(policeReportRef.trim() ? { policeReportRef: policeReportRef.trim() } : {}),
      };
    } else if (category === 'lab_access') {
      if (!labName.trim() || !facultySupervisor.trim() || !requiredDates.trim()) {
        setError('Lab name, supervising faculty, and required dates are mandatory.');
        return;
      }
      details = {
        labName: labName.trim(),
        facultySupervisor: facultySupervisor.trim(),
        durationHours: Number(durationHours) || 2,
        requiredDates: requiredDates.trim(),
      };
    } else if (category === 'general_inquiry') {
      if (queryDetails.trim().length < 10) {
        setError('Inquiry details must be at least 10 characters long.');
        return;
      }
      details = {
        queryDetails: queryDetails.trim(),
      };
    }

    setIsSubmitting(true);

    try {
      const attachments: IRequestAttachment[] = uploadedFiles.map((att) => ({
        name: att.name,
        url: att.url,
        fileType: att.mimeType || 'application/octet-stream',
        size: att.sizeBytes,
        ...(att.publicId ? { publicId: att.publicId } : {}),
      }));

      const payload = {
        category,
        priority,
        subject: subject.trim(),
        details,
        attachments,
      };

      const res = await fetch('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error?.message || data?.message || 'Failed to submit service request.';
        throw new Error(errorMsg);
      }

      onSuccess(data.data as ServiceRequestDTO);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Administrative Service Request</DialogTitle>
          <DialogDescription>
            Select a requisition category and provide the required verification details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-rose-700 dark:text-rose-400 text-sm flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Category Selector Cards */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Requisition Category
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mt-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id);
                      setError(null);
                    }}
                    className={`flex flex-col text-left p-3 rounded-lg border transition-all text-sm ${
                      isSelected
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                        : 'border-border/80 hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>{cat.title}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {cat.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="req-subject">Subject / Purpose Summary *</Label>
              <Input
                id="req-subject"
                placeholder="e.g., Bonafide for Passport Application"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-priority">Urgency / Priority</Label>
              <select
                id="req-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ServiceRequestPriority)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="standard">Standard</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Contextual Fields: Bonafide */}
          {category === 'bonafide' && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bonafide Specifics
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="bonafide-purpose">Purpose of Certificate *</Label>
                <select
                  id="bonafide-purpose"
                  value={bonafidePurpose}
                  onChange={(e) => setBonafidePurpose(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="scholarship">State / Central Government Scholarship</option>
                  <option value="visa_passport">Passport / Visa Verification</option>
                  <option value="education_loan">Bank Education Loan Subsidy</option>
                  <option value="internship">Corporate Internship / Training</option>
                  <option value="other">Other Official Purpose</option>
                </select>
              </div>
              {bonafidePurpose === 'other' && (
                <div className="space-y-1.5">
                  <Label htmlFor="bonafide-custom">Specify Custom Purpose *</Label>
                  <Input
                    id="bonafide-custom"
                    placeholder="Enter explicit purpose"
                    value={customPurpose}
                    onChange={(e) => setCustomPurpose(e.target.value)}
                    maxLength={200}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* Contextual Fields: Leave Application */}
          {category === 'leave' && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Leave Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="leave-start">Leave Start Date *</Label>
                  <Input
                    id="leave-start"
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="leave-end">Leave End Date *</Label>
                  <Input
                    id="leave-end"
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leave-reason">Reason for Absence *</Label>
                <Textarea
                  id="leave-reason"
                  placeholder="Provide legitimate grounds (medical, family emergency, academic competition)..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  rows={2}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emergency-contact">Parent / Guardian Emergency Contact *</Label>
                <Input
                  id="emergency-contact"
                  placeholder="e.g., +91 9876543210 (Father)"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Contextual Fields: ID Replacement */}
          {category === 'id_replacement' && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Smartcard Replacement Reason
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="id-reason">Reason for Replacement *</Label>
                <select
                  id="id-reason"
                  value={idReason}
                  onChange={(e) => setIdReason(e.target.value as 'lost' | 'damaged' | 'stolen')}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="lost">Lost / Misplaced</option>
                  <option value="damaged">Physically Damaged / Broken Chip</option>
                  <option value="stolen">Stolen / Pickpocketed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="police-ref">Police Complaint / Lost Diary Ref (Optional)</Label>
                <Input
                  id="police-ref"
                  placeholder="GD or Reference Number if stolen/lost"
                  value={policeReportRef}
                  onChange={(e) => setPoliceReportRef(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Contextual Fields: Special Lab Access */}
          {category === 'lab_access' && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lab Clearance Specification
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lab-name">Lab Name / Facility *</Label>
                  <Input
                    id="lab-name"
                    placeholder="e.g., IoT & Robotics Lab (Room 304)"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="faculty-supervisor">Faculty Supervisor *</Label>
                  <Input
                    id="faculty-supervisor"
                    placeholder="e.g., Dr. R. K. Verma"
                    value={facultySupervisor}
                    onChange={(e) => setFacultySupervisor(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="duration-hours">Duration (Hours per Day) *</Label>
                  <Input
                    id="duration-hours"
                    type="number"
                    min={1}
                    max={24}
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="required-dates">Required Dates / Range *</Label>
                  <Input
                    id="required-dates"
                    placeholder="e.g., Nov 20 to Nov 25, 2026"
                    value={requiredDates}
                    onChange={(e) => setRequiredDates(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contextual Fields: General Inquiry */}
          {category === 'general_inquiry' && (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Inquiry Particulars
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="query-details">Detailed Requisition / Query *</Label>
                <Textarea
                  id="query-details"
                  placeholder="Detail your academic or administrative requisition clearly (minimum 10 characters)..."
                  value={queryDetails}
                  onChange={(e) => setQueryDetails(e.target.value)}
                  rows={4}
                  required
                />
              </div>
            </div>
          )}

          {/* Attachments Section (Signed FileUploader — AUD-H14) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Supporting Evidence / Attachments (Max 5, up to 25MB each)
              </Label>
              <span className="text-xs text-muted-foreground">
                {uploadedFiles.length}/5 files
              </span>
            </div>

            <FileUploader
              scope="requests"
              attachments={uploadedFiles}
              onAttachmentsChange={setUploadedFiles}
              maxFiles={5}
              disabled={isSubmitting}
              onUploadingChange={setIsUploading}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Application...
                </>
              ) : (
                'Submit Application'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

