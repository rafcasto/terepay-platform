'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
          <svg className="animate-spin h-6 w-6 text-[#F5A523]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
      <div className="w-full max-w-lg">
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-[#0D1B2A]">Verify your identity</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Upload clear photos or scans of the required documents. Files must be JPEG, PNG, WebP,
            or PDF — max 10 MB each.
          </p>
        </div>

        {/* Primary doc selector (permanent resident / citizen only) */}
        {isPermanent && (
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Primary ID document <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-3">
              {(['nz_drivers_licence', 'nz_passport'] as const).map((opt) => (
                <label
                  key={opt}
                  className={[
                    'flex-1 text-center py-2.5 px-3 rounded-lg border-2 text-sm font-medium cursor-pointer transition-colors',
                    primaryDocType === opt
                      ? 'border-[#F5A523] bg-[#FEF7E9] text-[#E08B00]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="primaryDoc"
                    value={opt}
                    checked={primaryDocType === opt}
                    onChange={() => setPrimaryDocType(opt)}
                    className="sr-only"
                  />
                  {opt === 'nz_drivers_licence' ? "NZ Driver's Licence" : 'NZ Passport'}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Document upload slots */}
        {slots.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <svg className="h-6 w-6 animate-spin text-[#F5A523]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
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

        {submitError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || slots.length === 0}
          className="w-full bg-[#F5A523] hover:bg-[#E08B00] disabled:opacity-60 text-white font-semibold rounded-full py-3.5 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit & continue'}
        </button>

        <p className="text-xs text-gray-400 mt-3 text-center">
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
        isDone ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            {slot.label}
            {slot.required && <span className="text-red-500 ml-0.5">*</span>}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{slot.description}</p>
        </div>
        {isDone && (
          <span className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100">
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </span>
        )}
      </div>

      <div className="mt-3">
        {isDone ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-green-200 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileIcon />
              <span className="text-xs text-gray-700 truncate">{slot.uploaded!.fileName}</span>
            </div>
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={slot.removing}
              className="shrink-0 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {slot.removing ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ) : slot.uploading ? (
          <div className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2.5">
            <svg className="h-4 w-4 animate-spin text-[#F5A523]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-gray-500">Uploading {slot.file?.name}…</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 w-full rounded-lg border-2 border-dashed border-gray-300 hover:border-[#F5A523] px-4 py-3 text-sm text-gray-500 hover:text-[#E08B00] transition-colors"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
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
        {slot.error && <p className="mt-1 text-xs text-red-600">{slot.error}</p>}
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}
