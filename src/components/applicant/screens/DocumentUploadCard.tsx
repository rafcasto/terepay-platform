'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, DropZone, Pill, SelectField, Icons } from '@/components/ui';
import type { ApplicationDocument, DocumentType } from '@/types/application';

interface Props {
  applicationId: string;
  requiredDocuments?: string[];
  message?: string;
  existingDocuments: ApplicationDocument[];
}

interface UploadingFile {
  name: string;
  size?: number;
  status: 'uploading' | 'done' | 'error';
  progress?: number;
  error?: string;
}

const DOC_TYPE_OPTIONS: Array<{ value: DocumentType; label: string }> = [
  { value: 'bank_statement', label: 'Bank statement' },
  { value: 'payslip', label: 'Payslip' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_licence', label: "Driver's licence" },
  { value: 'visa', label: 'Visa' },
  { value: 'other', label: 'Other' },
];

export default function DocumentUploadCard({
  applicationId,
  requiredDocuments,
  message,
  existingDocuments,
}: Props) {
  const router = useRouter();
  const [docType, setDocType] = useState<DocumentType>('bank_statement');
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  const handleFiles = async (files: File[]) => {
    setUploading((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, size: f.size, status: 'uploading' as const })),
    ]);

    // Upload sequentially — keeps audit log readable and avoids hammering Drive.
    for (const file of files) {
      const idx = uploading.length;
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', docType);
        const res = await fetch(`/api/applications/${applicationId}/documents`, {
          method: 'POST',
          body: fd,
        });
        const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
        if (!res.ok) {
          throw new Error(body.error?.message ?? 'Upload failed');
        }
        setUploading((prev) =>
          prev.map((u, i) =>
            u.name === file.name && i >= idx ? { ...u, status: 'done' as const } : u,
          ),
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setUploading((prev) =>
          prev.map((u, i) =>
            u.name === file.name && i >= idx
              ? { ...u, status: 'error' as const, error: errorMessage }
              : u,
          ),
        );
      }
    }

    router.refresh();
  };

  const hasRequest = requiredDocuments && requiredDocuments.length > 0;

  return (
    <Card>
      <CardHeader
        eyebrow={hasRequest ? 'Action needed' : 'Documents'}
        title={hasRequest ? 'Documents requested' : 'Upload supporting documents'}
        action={
          hasRequest ? (
            <Pill tone="warn">{requiredDocuments!.length} required</Pill>
          ) : undefined
        }
      />

      {hasRequest && (
        <div className="mt-3">
          <p className="text-sm text-muted mb-2">Your lender has requested:</p>
          <ul className="space-y-1.5 text-sm text-text">
            {requiredDocuments!.map((d) => (
              <li key={d} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 rounded-full bg-accent shrink-0" />
                {d}
              </li>
            ))}
          </ul>
          {message && <p className="mt-3 text-sm text-warn">{message}</p>}
        </div>
      )}

      <div className="mt-5">
        <SelectField
          label="Document type"
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocumentType)}
        >
          {DOC_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-4">
        <DropZone
          accept=".pdf,.jpg,.jpeg,.png,.webp,.csv"
          multiple
          maxSizeMb={10}
          onFiles={handleFiles}
          files={uploading}
          hint="PDF, JPEG, PNG, WebP, or CSV · up to 10 MB each"
        />
      </div>

      {existingDocuments.length > 0 && (
        <div className="mt-5">
          <p className="text-[11.5px] font-semibold tracking-[0.08em] uppercase text-muted mb-2">
            Uploaded so far
          </p>
          <ul className="space-y-2">
            {existingDocuments.map((doc) => (
              <li
                key={doc.documentId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-surface"
              >
                <Icons.File size={18} className="text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{doc.fileName}</p>
                  <p className="text-xs text-muted">{doc.type.replace(/_/g, ' ')}</p>
                </div>
                <Pill
                  tone={
                    doc.status === 'accepted'
                      ? 'success'
                      : doc.status === 'rejected'
                        ? 'danger'
                        : 'muted'
                  }
                >
                  {doc.status}
                </Pill>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
