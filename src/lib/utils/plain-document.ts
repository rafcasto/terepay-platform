import type { ApplicationDocument } from '@/types/application';

/**
 * `ApplicationDocument` minus its Firestore `Timestamp` fields (`uploadedAt`,
 * `reviewedAt`). Timestamps are class instances, and Next.js refuses to pass
 * them from a Server Component to a Client Component ("Only plain objects …
 * can be passed to Client Components"). Use this shape for any document list
 * that crosses that boundary; the UI only needs the identifying/status fields.
 */
export type PlainApplicationDocument = Omit<ApplicationDocument, 'uploadedAt' | 'reviewedAt'> & {
  /** ISO 8601 — derived from the Firestore Timestamp when present. */
  uploadedAt?: string;
  reviewedAt?: string;
};

type TimestampLike =
  | { toDate?: () => Date; _seconds?: number; seconds?: number }
  | Date
  | string
  | null
  | undefined;

function toIso(value: TimestampLike): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  const s = value._seconds ?? value.seconds;
  return typeof s === 'number' ? new Date(s * 1000).toISOString() : undefined;
}

/** Strip Firestore Timestamps so the array is safe to hand to a Client Component. */
export function toPlainApplicationDocuments(
  docs: ApplicationDocument[] | undefined | null,
): PlainApplicationDocument[] {
  return (docs ?? []).map((d) => {
    const uploadedAt = toIso(d.uploadedAt as unknown as TimestampLike);
    const reviewedAt = toIso(d.reviewedAt as unknown as TimestampLike);
    return {
      documentId: d.documentId,
      type: d.type,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      fileSize: d.fileSize,
      uploadedBy: d.uploadedBy,
      status: d.status,
      ...(d.rejectionReason ? { rejectionReason: d.rejectionReason } : {}),
      ...(d.reviewedBy ? { reviewedBy: d.reviewedBy } : {}),
      ...(uploadedAt ? { uploadedAt } : {}),
      ...(reviewedAt ? { reviewedAt } : {}),
    };
  });
}
