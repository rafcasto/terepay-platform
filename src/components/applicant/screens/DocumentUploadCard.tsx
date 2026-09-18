'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, DropZone, Pill, SelectField, Icons } from '@/components/ui';
import type { DocumentType } from '@/types/application';
import type { PlainApplicationDocument } from '@/lib/utils/plain-document';
import {
  DOCUMENT_TYPE_LABELS,
  fulfilRequest,
  type DocumentRequestItem,
  type ItemFulfilment,
} from '@/lib/loan/document-requests';

interface Props {
  applicationId: string;
  /** Structured request (one upload slot per item). */
  items?: DocumentRequestItem[];
  /** Legacy request made before structured items existed — labels only. */
  requiredDocuments?: string[];
  message?: string;
  requestedAt?: string;
  existingDocuments: PlainApplicationDocument[];
}

interface UploadingFile {
  name: string;
  size?: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

const GENERIC_TYPE_OPTIONS: DocumentType[] = [
  'bank_statement',
  'payslip',
  'passport',
  'drivers_licence',
  'visa',
  'proof_of_address',
  'other_income',
  'other',
];

const DEFAULT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.csv';

/**
 * Applicant-side document upload.
 *
 * When the lender has made a structured request, each requested item gets
 * its own slot: drop the file in, and it is uploaded as that item — the
 * applicant never picks a document type. The generic "type + drop zone"
 * form only appears when there is no structured request to follow.
 */
export default function DocumentUploadCard({
  applicationId,
  items,
  requiredDocuments,
  message,
  requestedAt,
  existingDocuments,
}: Props) {
  const router = useRouter();
  const structured = Boolean(items && items.length > 0);
  const legacyRequest = !structured && Boolean(requiredDocuments && requiredDocuments.length > 0);

  const upload = async (file: File, body: { requestKey?: string; type?: DocumentType }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (body.requestKey) fd.append('requestKey', body.requestKey);
    if (body.type) fd.append('type', body.type);
    const res = await fetch(`/api/applications/${applicationId}/documents`, { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({} as { error?: { message?: string } }));
    if (!res.ok) throw new Error(json.error?.message ?? 'Upload failed');
  };

  if (structured) {
    const requestedAtMs = requestedAt ? new Date(requestedAt).getTime() : undefined;
    const fulfilment = fulfilRequest(
      items!,
      existingDocuments.map((d) => ({
        documentId: d.documentId,
        type: d.type,
        status: d.status,
        fileName: d.fileName,
        requestKey: d.requestKey,
        uploadedAtMs: d.uploadedAt ? new Date(d.uploadedAt).getTime() : undefined,
      })),
      requestedAtMs,
    );
    const provided = fulfilment.filter((f) => f.fulfilled).length;
    const done = provided === fulfilment.length;
    const reasonById: Record<string, string> = {};
    for (const d of existingDocuments) if (d.rejectionReason) reasonById[d.documentId] = d.rejectionReason;

    return (
      <Card>
        <CardHeader
          eyebrow={done ? 'All sent' : 'Action needed'}
          title={done ? 'Thanks — we have everything' : 'Documents requested'}
          action={
            <Pill tone={done ? 'success' : 'warn'}>
              {provided} of {fulfilment.length} provided
            </Pill>
          }
        />
        <p className="mt-2 text-sm text-muted">
          {done
            ? 'Your lender has been notified and will review the new files. No further action is needed unless we get in touch.'
            : 'Add each document to its slot below. Your application goes back to your lender automatically once every slot has a file.'}
        </p>
        {message && (
          <p className="mt-3 rounded-xl bg-surface-2/60 px-3 py-2.5 text-sm text-text">
            <span className="font-semibold">From your lender:</span> {message}
          </p>
        )}

        <ol className="mt-5 space-y-4">
          {fulfilment.map((f, i) => (
            <RequestSlot
              key={f.item.key}
              index={i + 1}
              fulfilment={f}
              reasonById={reasonById}
              onUpload={(file, type) => upload(file, { requestKey: f.item.key, type })}
              onSettled={() => router.refresh()}
            />
          ))}
        </ol>

        <ExtraUpload onUpload={(file, type) => upload(file, { type })} onSettled={() => router.refresh()} />
      </Card>
    );
  }

  return (
    <GenericUpload
      requiredDocuments={legacyRequest ? requiredDocuments : undefined}
      message={message}
      existingDocuments={existingDocuments}
      onUpload={(file, type) => upload(file, { type })}
      onSettled={() => router.refresh()}
    />
  );
}

// ---------------------------------------------------------------------------
// One slot per requested item
// ---------------------------------------------------------------------------
function RequestSlot({
  index,
  fulfilment,
  reasonById,
  onUpload,
  onSettled,
}: {
  index: number;
  fulfilment: ItemFulfilment;
  reasonById: Record<string, string>;
  onUpload: (file: File, type: DocumentType) => Promise<void>;
  onSettled: () => void;
}) {
  const { item, files, fulfilled, needsReupload } = fulfilment;
  const [type, setType] = useState<DocumentType>(item.types[0]);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [open, setOpen] = useState(!fulfilled);

  const handleFiles = async (picked: File[]) => {
    setUploading((prev) => [...prev, ...picked.map((f) => ({ name: f.name, size: f.size, status: 'uploading' as const }))]);
    for (const file of picked) {
      try {
        await onUpload(file, type);
        setUploading((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: 'done' as const } : u)));
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Upload failed';
        setUploading((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: 'error' as const, error } : u)));
      }
    }
    onSettled();
  };

  const tone = fulfilled ? 'success' : needsReupload ? 'danger' : 'warn';
  const label = fulfilled ? 'Provided' : needsReupload ? 'Please upload again' : 'Needed';
  const rejected = files.filter((f) => f.status === 'rejected');

  return (
    <li className={`rounded-2xl border p-4 ${fulfilled ? 'border-border bg-surface-2/30' : 'border-border bg-surface'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              fulfilled ? 'bg-success text-white' : needsReupload ? 'bg-danger text-white' : 'bg-accent-soft text-accent-2'
            }`}
          >
            {fulfilled ? <Icons.Check size={14} /> : index}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">{item.label}</p>
            {item.hint && <p className="mt-0.5 text-xs text-muted">{item.hint}</p>}
            {item.typical && <p className="mt-0.5 text-xs text-muted">{item.typical}</p>}
          </div>
        </div>
        <Pill tone={tone}>{label}</Pill>
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f) => (
            <li key={f.documentId} className="flex items-center gap-2 text-xs">
              <Icons.File size={14} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-text">{f.fileName}</span>
              <span className={f.status === 'rejected' ? 'text-danger' : f.status === 'accepted' ? 'text-success' : 'text-muted'}>
                {f.status === 'accepted' ? 'Accepted' : f.status === 'rejected' ? 'Rejected' : 'Being reviewed'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rejected.map((f) =>
        reasonById[f.documentId] ? (
          <p key={f.documentId} className="mt-2 rounded-xl bg-danger-soft-ds px-3 py-2 text-xs text-danger-text">
            <span className="font-semibold">{f.fileName} was rejected:</span> {reasonById[f.documentId]}
          </p>
        ) : null,
      )}

      {open || !fulfilled ? (
        <div className="mt-3">
          {item.types.length > 1 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {item.types.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    type === t ? 'border-accent bg-accent-soft text-accent-2' : 'border-border bg-surface text-muted hover:text-text'
                  }`}
                >
                  {DOCUMENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          )}
          <DropZone
            accept={item.accept ?? DEFAULT_ACCEPT}
            multiple
            maxSizeMb={10}
            onFiles={handleFiles}
            files={uploading}
            hint={`${(item.accept ?? DEFAULT_ACCEPT).replace(/\./g, '').toUpperCase().replace(/,/g, ', ')} · up to 10 MB each`}
          />
          {fulfilled && (
            <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs font-semibold text-muted hover:text-text">
              Done adding files
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 text-xs font-semibold text-accent-2 hover:underline">
          Add another file
        </button>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// "Something else to send?" — untyped extra upload below the slots
// ---------------------------------------------------------------------------
function ExtraUpload({
  onUpload,
  onSettled,
}: {
  onUpload: (file: File, type: DocumentType) => Promise<void>;
  onSettled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  const handleFiles = async (picked: File[]) => {
    setUploading((prev) => [...prev, ...picked.map((f) => ({ name: f.name, size: f.size, status: 'uploading' as const }))]);
    for (const file of picked) {
      try {
        await onUpload(file, 'other');
        setUploading((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: 'done' as const } : u)));
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Upload failed';
        setUploading((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: 'error' as const, error } : u)));
      }
    }
    onSettled();
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-5 text-sm font-semibold text-accent-2 hover:underline">
        Something else to send that wasn&apos;t asked for?
      </button>
    );
  }
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-border p-4">
      <p className="mb-2 text-sm font-semibold text-text">Anything else</p>
      <p className="mb-3 text-xs text-muted">Only use this for documents your lender didn&apos;t list above.</p>
      <DropZone accept={DEFAULT_ACCEPT} multiple maxSizeMb={10} onFiles={handleFiles} files={uploading} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic upload (no structured request to follow)
// ---------------------------------------------------------------------------
function GenericUpload({
  requiredDocuments,
  message,
  existingDocuments,
  onUpload,
  onSettled,
}: {
  requiredDocuments?: string[];
  message?: string;
  existingDocuments: PlainApplicationDocument[];
  onUpload: (file: File, type: DocumentType) => Promise<void>;
  onSettled: () => void;
}) {
  const [docType, setDocType] = useState<DocumentType>('bank_statement');
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const hasRequest = Boolean(requiredDocuments && requiredDocuments.length > 0);

  const handleFiles = async (picked: File[]) => {
    setUploading((prev) => [...prev, ...picked.map((f) => ({ name: f.name, size: f.size, status: 'uploading' as const }))]);
    for (const file of picked) {
      try {
        await onUpload(file, docType);
        setUploading((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: 'done' as const } : u)));
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Upload failed';
        setUploading((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: 'error' as const, error } : u)));
      }
    }
    onSettled();
  };

  return (
    <Card>
      <CardHeader
        eyebrow={hasRequest ? 'Action needed' : 'Documents'}
        title={hasRequest ? 'Documents requested' : 'Upload supporting documents'}
        action={hasRequest ? <Pill tone="warn">{requiredDocuments!.length} required</Pill> : undefined}
      />

      {hasRequest && (
        <div className="mt-3">
          <p className="mb-2 text-sm text-muted">Your lender has requested:</p>
          <ul className="space-y-1.5 text-sm text-text">
            {requiredDocuments!.map((d) => (
              <li key={d} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {d}
              </li>
            ))}
          </ul>
          {message && <p className="mt-3 text-sm text-warn">{message}</p>}
        </div>
      )}

      <div className="mt-5">
        <SelectField label="Document type" value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}>
          {GENERIC_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-4">
        <DropZone
          accept={DEFAULT_ACCEPT}
          multiple
          maxSizeMb={10}
          onFiles={handleFiles}
          files={uploading}
          hint="PDF, JPEG, PNG, WebP, or CSV · up to 10 MB each"
        />
      </div>

      {existingDocuments.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Uploaded so far</p>
          <ul className="space-y-2">
            {existingDocuments.map((doc) => (
              <li key={doc.documentId} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Icons.File size={18} className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{doc.fileName}</p>
                    <p className="text-xs text-muted">{DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}</p>
                  </div>
                  <Pill tone={doc.status === 'accepted' ? 'success' : doc.status === 'rejected' ? 'danger' : 'muted'}>
                    {doc.status === 'accepted' ? 'Accepted' : doc.status === 'rejected' ? 'Please re-upload' : 'Being reviewed'}
                  </Pill>
                </div>
                {doc.status === 'rejected' && doc.rejectionReason && (
                  <p className="mt-2 text-xs text-text">
                    <span className="font-semibold">Why:</span> {doc.rejectionReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
