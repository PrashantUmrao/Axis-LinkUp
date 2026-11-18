'use client';

/**
 * File Uploader Component for Coursework Materials, Complaints & Service Requests.
 * Integrates direct Cloudinary signed uploads via /api/v1/assignments/upload-signature
 * with user-scoped folder isolation, allowed_formats, max_file_size, multi-file accumulation,
 * and drag-and-drop support (AUD-C09 / AUD-H13 / AUD-H14).
 * In non-production environments without Cloudinary configured, gracefully provides a dev-mock envelope.
 */

import React, { useState, useRef } from 'react';
import { Button, Badge } from '@/components/ui';
import {
  UploadCloud,
  File,
  X,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import type { AssignmentAttachment } from '@/types/assignment';

export type UploaderScope = 'assignments' | 'complaints' | 'requests';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface UploadSignatureEnvelope {
  timestamp: number;
  folder: string;
  allowedFormats?: string;
  maxFileSize?: number;
  isMock: boolean;
  signature?: string;
  apiKey?: string;
  cloudName?: string;
}

/**
 * Pure multi-file batch uploader helper (AUD-C09).
 * Accumulates each newly uploaded attachment onto a local mutable copy rather than
 * reusing a stale React `attachments` prop closure, ensuring N selected/dropped files
 * all persist into the final list.
 */
export async function accumulateUploadedFiles(
  existing: AssignmentAttachment[],
  files: ArrayLike<File>,
  uploadSingleFile: (file: File) => Promise<AssignmentAttachment>,
  onProgressUpdate: (updatedAttachments: AssignmentAttachment[]) => void
): Promise<AssignmentAttachment[]> {
  const accumulated: AssignmentAttachment[] = [...existing];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const uploaded = await uploadSingleFile(file);
    accumulated.push(uploaded);
    onProgressUpdate([...accumulated]);
  }
  return accumulated;
}

interface FileUploaderProps {
  attachments: AssignmentAttachment[];
  onAttachmentsChange: (attachments: AssignmentAttachment[]) => void;
  scope?: UploaderScope;
  maxFiles?: number;
  disabled?: boolean;
  onUploadingChange?: (isUploading: boolean) => void;
}

export function FileUploader({
  attachments,
  onAttachmentsChange,
  scope = 'assignments',
  maxFiles = 5,
  disabled = false,
  onUploadingChange,
}: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMockEnvironment, setIsMockEnvironment] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setUploadingState = (uploading: boolean) => {
    setIsUploading(uploading);
    onUploadingChange?.(uploading);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadSingleFile = async (file: File): Promise<AssignmentAttachment> => {
    // Step 1: Request signed upload envelope scoped to caller + domain
    const sigRes = await fetch(
      `/api/v1/assignments/upload-signature?scope=${encodeURIComponent(scope)}`
    );
    if (!sigRes.ok) {
      let errMsg = 'Failed to retrieve upload authorization signature.';
      try {
        const errJson = (await sigRes.json()) as { error?: { message?: string }; message?: string };
        errMsg = errJson.error?.message || errJson.message || errMsg;
      } catch {
        // Use fallback error message
      }
      throw new Error(errMsg);
    }

    const sigJson = (await sigRes.json()) as { data: UploadSignatureEnvelope };
    const envelope = sigJson.data;
    setIsMockEnvironment(envelope.isMock);

    if (envelope.isMock || !envelope.apiKey || !envelope.signature || !envelope.cloudName) {
      // Graceful local development fallback (blocked server-side in production)
      await new Promise((resolve) => setTimeout(resolve, 250));
      setUploadProgress(100);

      return {
        name: file.name,
        url: `https://storage.axislinkup.internal/${encodeURIComponent(scope)}/${Date.now()}_${encodeURIComponent(
          file.name
        )}`,
        sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
        publicId: null,
        uploadedAt: new Date().toISOString(),
      };
    }

    // Step 2: Upload directly to Cloudinary with all server-signed parameters
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', envelope.apiKey);
    formData.append('timestamp', String(envelope.timestamp));
    formData.append('signature', envelope.signature);
    formData.append('folder', envelope.folder);
    if (envelope.allowedFormats) {
      formData.append('allowed_formats', envelope.allowedFormats);
    }
    if (envelope.maxFileSize) {
      formData.append('max_file_size', String(envelope.maxFileSize));
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${envelope.cloudName}/auto/upload`;

    const uploadedData = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 90);
            setUploadProgress(Math.max(15, percent));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = JSON.parse(xhr.responseText);
              resolve({
                secure_url: parsed.secure_url,
                public_id: parsed.public_id,
              });
            } catch {
              reject(new Error('Failed to parse Cloudinary response.'));
            }
          } else {
            reject(new Error(`Cloudinary upload failed with HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during file upload.'));
        xhr.send(formData);
      }
    );

    return {
      name: file.name,
      url: uploadedData.secure_url,
      sizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      publicId: uploadedData.public_id,
      uploadedAt: new Date().toISOString(),
    };
  };

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0 || disabled || isUploading) return;

    if (attachments.length + files.length > maxFiles) {
      setErrorMessage(`You can only attach a maximum of ${maxFiles} files.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Pre-validate all selected files before beginning network uploads
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`File "${file.name}" exceeds the statutory 25MB limit.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const lowerName = file.name.toLowerCase();
      const isAllowed =
        ALLOWED_MIME_TYPES.includes(file.type) ||
        file.type.startsWith('image/') ||
        lowerName.endsWith('.zip') ||
        lowerName.endsWith('.rar') ||
        lowerName.endsWith('.7z') ||
        lowerName.endsWith('.pdf') ||
        lowerName.endsWith('.doc') ||
        lowerName.endsWith('.docx') ||
        lowerName.endsWith('.ppt') ||
        lowerName.endsWith('.pptx') ||
        lowerName.endsWith('.xls') ||
        lowerName.endsWith('.xlsx') ||
        lowerName.endsWith('.txt');

      if (!isAllowed) {
        setErrorMessage(
          `File "${file.name}" has an unsupported format. Allowed formats: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, ZIP, RAR, PNG, JPG.`
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setErrorMessage(null);
    setUploadingState(true);
    setUploadProgress(10);

    try {
      await accumulateUploadedFiles(attachments, files, uploadSingleFile, onAttachmentsChange);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setUploadingState(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragActive(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      e.dataTransfer.dropEffect = 'copy';
      if (!isDragActive) setIsDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled || isUploading) return;
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      await processFiles(droppedFiles);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    if (disabled) return;
    const next = [...attachments];
    next.splice(index, 1);
    onAttachmentsChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Upload Drop Area */}
      <div
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isUploading) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-all ${
          isDragActive
            ? 'border-primary bg-primary/10 ring-primary/30 ring-2'
            : 'border-border/60 hover:border-primary/50 hover:bg-muted/20'
        } ${disabled || isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp"
        />

        <div className="bg-primary/10 text-primary mb-3 flex size-12 items-center justify-center rounded-full">
          {isUploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <UploadCloud className="size-6" />
          )}
        </div>

        <p className="text-sm font-medium">
          {isUploading
            ? 'Uploading file deliverable...'
            : isDragActive
              ? 'Release files to upload'
              : 'Click or drop files to upload'}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          PDF, Word, Excel, PowerPoint, Text, Archive, or Images (Max 25MB each)
        </p>

        {isUploading && (
          <div className="mt-4 w-full max-w-xs">
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-[11px] font-mono">{uploadProgress}%</p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Development Mock Indicator */}
      {isMockEnvironment && (
        <div className="border-border/40 bg-muted/20 text-muted-foreground flex items-center justify-between rounded-lg border px-3 py-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Info className="size-3.5 text-amber-500" />
            <span>Development Mode: Cloudinary unconfigured. Secure simulated envelope active.</span>
          </div>
          <Badge variant="glass" className="text-[9px]">
            DEV-MOCK
          </Badge>
        </div>
      )}

      {/* Attachment List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Attached Deliverables ({attachments.length}/{maxFiles})
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {attachments.map((file, idx) => (
              <div
                key={file.url + idx}
                className="border-border/50 bg-background/50 flex items-center justify-between rounded-lg border p-2.5 text-xs shadow-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded">
                    <File className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{file.name}</p>
                    <p className="text-muted-foreground text-[10px] font-mono">
                      {formatFileSize(file.sizeBytes)}
                    </p>
                  </div>
                </div>

                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="text-muted-foreground hover:text-destructive size-7 p-0"
                  >
                    <X className="size-3.5" />
                    <span className="sr-only">Remove file</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
