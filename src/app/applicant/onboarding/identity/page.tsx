'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/ui';
import { Spinner } from '../_components/Spinner';
import { SegmentedRadio } from '../_components/SegmentedRadio';
import { obPrimaryBtn, obLabel, obAlert } from '../_components/onboarding-styles';

type ImmigrationStatus = 'student' | 'work_visa' | 'resident' | 'permanent_resident' | 'citizen';

interface UploadedDoc {
  docType: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
}

interface FileSlot {
  docType: string;
  label: string;
  required: boolean;
  description: string;
  file: File | null;
  uploaded: UploadedDoc | null;
  uploading: boolean;
  removing: boolean;
  error: string;
}

const PERMANENT_SLOTS: Omit<FileSlot, 'file' | 'uploaded' | 'uploading' | 'removing' | 'error'>[] = [
  {
    docType: 'nz_id_primary',
    label: "NZ Driver's Licence or Passport",
    required: true,
    description: "Upload your NZ Driver's Licence or NZ Passport (front page).",
  },
  {
    docType: 'proof_of_address',
    label: 'Proof of Address',
    required: true,
    description: 'Bank statement or utility bill showing your name and address — dated within the last 3 months.',
  },
];

const NON_PERMANENT_SLOTS: Omit<FileSlot, 'file' | 'uploaded' | 'uploading' | 'removing' | 'error'>[] = [
  {
    docType: 'foreign_passport',
    label: 'Passport (country of origin)',
    required: true,
    description: 'Upload the photo page of your passport.',
  },
  {
    docType: 'nz_visa',
    label: 'NZ Visa',
    required: true,
    description: 'Upload your current NZ visa (e.g. student visa, work visa permit).',
  },
  {
    docType: 'proof_of_address',
    label: 'Proof of Address',
    required: true,
    description: 'Bank statement or utility bill showing your name and address — dated within the last 3 months.',
  },
];

function makeSlots(templates: typeof PERMANENT_SLOTS): FileSlot[] {
  return templates.map((t) => ({ ...t, file: null, uploaded: null, uploading: false, removing: false, error: '' }));
}

export default function KycIdentityPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [immigrationStatus, setImmigrationStatus] = useState<ImmigrationStatus | null>(null);
  const [slots, setSlots] = useState<FileSlot[]>([]);
  const [primaryDocType, setPrimaryDocType] = useState<'nz_drivers_licence' | 'nz_passport'>('nz_drivers_licence');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Skip this step if already submitted; fetch immigration status and restore any upload draft
  useEffect(() => {
    Promise.all([
      fetch('/api/users/profile').then((r) => r.json()),
      fetch('/api/kyc/draft').then((r) => r.json()).catch(() => ({ data: {} })),
    ])
      .then(([profileData, draftData]) => {
        if (profileData?.data?.profileComplete) {
          router.replace('/applicant/dashboard');
          return;
        }
        const status: ImmigrationStatus =
          profileData?.data?.immigrationStatus ?? profileData?.user?.immigrationStatus ?? 'resident';
        setImmigrationStatus(status);

        const isPermanent = status === 'permanent_resident' || status === 'citizen';
        const templates = isPermanent ? PERMANENT_SLOTS : NON_PERMANENT_SLOTS;
        const builtSlots = makeSlots(templates);

        const uploads: Record<string, { driveFileId: string; fileName: string; mimeType: string }> =
          draftData?.data ?? {};

        // For permanent residents, infer the primary doc radio from draft
        if (isPermanent) {
          if (uploads['nz_passport']) setPrimaryDocType('nz_passport');
          else if (uploads['nz_drivers_licence']) setPrimaryDocType('nz_drivers_licence');
        }

        const restoredSlots = builtSlots.map((slot) => {
          if (slot.docType === 'nz_id_primary') {
            const primaryType = uploads['nz_passport']
              ? 'nz_passport'
              : uploads['nz_drivers_licence']
              ? 'nz_drivers_licence'
              : null;
            if (primaryType && uploads[primaryType]) {
              return { ...slot, uploaded: { docType: primaryType, ...uploads[primaryType] } };
            }
          } else if (uploads[slot.docType]) {
            return { ...slot, uploaded: { docType: slot.docType, ...uploads[slot.docType] } };
          }
          return slot;
        });

        setSlots(restoredSlots);
        setChecking(false);
      })
      .catch(() => {
        setImmigrationStatus('resident');
        setSlots(makeSlots(NON_PERMANENT_SLOTS));
        setChecking(false);
      });
  }, [router]);

  // Update primary doc label when radio changes (permanent residents only)
  useEffect(() => {
    setSlots((prev) =>
      prev.map((s) =>
        s.docType === 'nz_id_primary'
          ? {
              ...s,
              label: primaryDocType === 'nz_drivers_licence' ? "NZ Driver's Licence" : 'NZ Passport',
              description:
                primaryDocType === 'nz_drivers_licence'
                  ? "Upload the front and back of your NZ Driver's Licence."
                  : 'Upload the photo page of your NZ Passport.',
            }
          : s,
      ),
    );
  }, [primaryDocType]);

  const handleFileChange = async (index: number, file: File | null) => {
    if (!file) return;

    setSlots((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, file, error: '', uploading: true, uploaded: null } : s,
      ),
    );

    const effectiveDocType =
      slots[index].docType === 'nz_id_primary' ? primaryDocType : slots[index].docType;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', effectiveDocType);

      const res = await fetch('/api/kyc/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setSlots((prev) =>
          prev.map((s, i) =>
            i === index
              ? { ...s, uploading: false, error: data.error?.message ?? 'Upload failed. Please try again.' }
              : s,
          ),
        );
        return;
      }

      setSlots((prev) =>
        prev.map((s, i) =>
          i === index
            ? { ...s, uploading: false, uploaded: { docType: effectiveDocType, ...data } }
            : s,
        ),
      );
    } catch {
      setSlots((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, uploading: false, error: 'Network error. Please try again.' } : s,
        ),
      );
    }
  };

  const handleRemove = async (index: number) => {
    const slot = slots[index];
    if (!slot.uploaded) return;

    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, removing: true } : s)));

    try {
      await fetch('/api/kyc/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId: slot.uploaded.driveFileId,
          docType: slot.uploaded.docType,
        }),
      });
    } catch {
      // If the request fails, still clear the slot — Drive cleanup can be done manually
    }

    setSlots((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, file: null, uploaded: null, error: '', removing: false } : s,
      ),
    );
  };

  const handleSubmit = async () => {
    setSubmitError('');
    const allUploaded = slots.filter((s) => s.required).every((s) => s.uploaded !== null);
    if (!allUploaded) {
      setSubmitError('Please upload all required documents before continuing.');
      return;
    }

    setSubmitting(true);
    try {
      const documents = slots
        .filter((s) => s.uploaded !== null)
        .map((s) => s.uploaded!);

      const res = await fetch('/api/kyc/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error?.message ?? 'Failed to submit. Please try again.');
        return;
      }
      router.push('/applicant/dashboard');
    } catch {
      setSubmitError('Network error. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const isPermanent =
    immigrationStatus === 'permanent_resident' || immigrationStatus === 'citizen';

  return (
    <div className="flex items-start justify-center min-h-full py-8 px-4">
      {checking ? (
        <div className="flex justify-center w-full py-16">
          <Spinner size={24} className="text-brand-text" />
        </div>
      ) : (
      <div className="w-full max-w-lg screen-in">
        <div className="mb-7">
          <h2 className="font-display text-2xl font-bold text-ink-strong">Verify your identity</h2>
          <p className="text-[var(--text-muted)] mt-1 text-sm">
            Upload clear photos or scans of the required documents. Files must be JPEG, PNG, WebP,
            or PDF — max 10 MB each.
          </p>
        </div>

        {/* Primary doc selector (permanent resident / citizen only) */}
        {isPermanent && (
          <div className="mb-5">
            <p className={obLabel}>
              Primary ID document <span className="text-danger-text">*</span>
            </p>
            <SegmentedRadio
              name="primaryDoc"
              value={primaryDocType}
              options={[
                { value: 'nz_drivers_licence', label: "NZ Driver's Licence" },
                { value: 'nz_passport', label: 'NZ Passport' },
              ]}
              onChange={(v) => setPrimaryDocType(v as 'nz_drivers_licence' | 'nz_passport')}
            />
          </div>
        )}

        {/* Document upload slots */}
        {slots.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size={24} className="text-brand-text" />
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {slots.map((slot, index) => (
              <FileUploadSlot
                key={slot.docType}
                slot={slot}
                index={index}
                onFileChange={handleFileChange}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        {submitError && <div className={`${obAlert} mb-4`}>{submitError}</div>}

        <button onClick={handleSubmit} disabled={submitting || slots.length === 0} className={obPrimaryBtn}>
          {submitting ? 'Submitting…' : 'Submit & continue'}
        </button>

        <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
          Your documents are reviewed by our compliance team. You&apos;ll receive an update within 1–2 business days.
        </p>
      </div>
      )}
    </div>
  );
}

function FileUploadSlot({
  slot,
  index,
  onFileChange,
  onRemove,
}: {
  slot: FileSlot;
  index: number;
  onFileChange: (i: number, f: File | null) => void;
  onRemove: (i: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDone = slot.uploaded !== null;

  return (
    <div
      className={[
        'rounded-xl border-2 p-4 transition-colors',
        isDone ? 'border-[var(--success-500)]/40 bg-success-soft-ds' : 'border-border-default bg-surface-sunken',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-strong">
            {slot.label}
            {slot.required && <span className="text-danger-text ml-0.5">*</span>}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{slot.description}</p>
        </div>
        {isDone && (
          <span className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-success-soft-ds text-success-text">
            <Icons.Check size={14} strokeWidth={2.5} />
          </span>
        )}
      </div>

      <div className="mt-3">
        {isDone ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-surface-card border border-[var(--success-500)]/40 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icons.File size={16} className="shrink-0 text-[var(--text-muted)]" />
              <span className="text-xs text-ink-strong truncate">{slot.uploaded!.fileName}</span>
            </div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={slot.removing}
              className="shrink-0 text-xs text-danger-text hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
            >
              {slot.removing ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ) : slot.uploading ? (
          <div className="flex items-center gap-2 rounded-md bg-surface-card border border-border-default px-3 py-2.5">
            <Spinner size={16} className="text-brand-text" />
            <span className="text-xs text-[var(--text-muted)]">Uploading {slot.file?.name}…</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center justify-center gap-2 w-full rounded-md border-2 border-dashed border-border-strong hover:border-brand px-4 py-3 text-sm text-[var(--text-muted)] hover:text-brand-text transition-colors"
            >
              <Icons.Upload size={16} className="shrink-0" />
              <span>Choose file or tap to browse</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => onFileChange(index, e.target.files?.[0] ?? null)}
            />
          </>
        )}
        {slot.error && <p className="mt-1 text-xs text-danger-text">{slot.error}</p>}
      </div>
    </div>
  );
}
