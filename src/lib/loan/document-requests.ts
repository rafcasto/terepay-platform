import type { DocumentType } from '@/types/application';

/**
 * Structured document requests.
 *
 * A lender asks for documents by picking from this catalogue. Each item
 * already knows which `DocumentType`(s) satisfy it, so the applicant never
 * has to classify their own upload — they drop the file into the slot for
 * the item, and the server derives the type from the request key.
 *
 * Pure constants + pure functions: safe to import from server routes,
 * Server Components and Client Components alike.
 */

export interface DocumentRequestItem {
  /** Stable key — catalogue key, or `other:<slug>` for a custom ask. */
  key: string;
  label: string;
  /** Document types that satisfy this item. First one is the default. */
  types: DocumentType[];
  /** Plain-language guidance shown to the applicant inside the slot. */
  hint?: string;
  /** e.g. "Usually 3 files — one per month". */
  typical?: string;
  /** File-input accept string for the slot. */
  accept?: string;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  passport: 'Passport',
  drivers_licence: 'NZ Driver Licence',
  visa: 'Visa document',
  payslip: 'Payslips',
  bank_statement: 'Bank statements',
  proof_of_address: 'Proof of address',
  other_income: 'Other income evidence',
  other: 'Document',
};

const IMAGES_OR_PDF = '.pdf,.jpg,.jpeg,.png,.webp';

export const DOCUMENT_REQUEST_CATALOGUE: readonly DocumentRequestItem[] = [
  {
    key: 'photo_id',
    label: 'Photo ID (passport or driver licence)',
    types: ['passport', 'drivers_licence'],
    hint: 'A clear photo or scan. For a driver licence, include both sides.',
    accept: IMAGES_OR_PDF,
  },
  {
    key: 'bank_statements_3m',
    label: 'Bank statements (last 3 months)',
    types: ['bank_statement'],
    hint: 'Every account your income and rent go through. Download the PDF or CSV from your bank — screenshots are usually rejected.',
    typical: 'Usually 3 files (one per month) or a single 90-day statement.',
    accept: '.pdf,.csv',
  },
  {
    key: 'payslips_3m',
    label: 'Payslips (last 3 months)',
    types: ['payslip'],
    hint: 'Your most recent payslips, showing your employer and pay after tax.',
    typical: 'Weekly pay: about 12 payslips. Fortnightly: about 6. Monthly: 3.',
    accept: IMAGES_OR_PDF,
  },
  {
    key: 'proof_of_address',
    label: 'Proof of address',
    types: ['proof_of_address'],
    hint: 'A power, phone or internet bill, tenancy agreement, or bank letter from the last 3 months showing your name and address.',
    accept: IMAGES_OR_PDF,
  },
  {
    key: 'visa',
    label: 'Visa / residency document',
    types: ['visa'],
    hint: 'Your current visa or eVisa letter, showing the expiry date.',
    accept: IMAGES_OR_PDF,
  },
  {
    key: 'other_income',
    label: 'Evidence of other income (WINZ etc.)',
    types: ['other_income'],
    hint: 'A Work and Income letter, benefit statement or similar showing the amount and how often you receive it.',
    accept: IMAGES_OR_PDF,
  },
];

export const CUSTOM_REQUEST_KEY = 'other';
export const CUSTOM_REQUEST_PREFIX = 'other:';

export const catalogueItem = (key: string) => DOCUMENT_REQUEST_CATALOGUE.find((i) => i.key === key);

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'item';

/**
 * Turn the lender's selection into concrete request items. Catalogue keys
 * are expanded; custom asks (`key: 'other'`, with a label) become
 * `other:<slug>-<n>` items of type `other`. Returns `null` for an unknown key.
 */
export function buildRequestItems(
  selection: Array<{ key: string; label?: string }>,
): DocumentRequestItem[] | null {
  const out: DocumentRequestItem[] = [];
  const seen = new Set<string>();
  selection.forEach((sel, i) => {
    const cat = catalogueItem(sel.key);
    if (cat) {
      if (seen.has(cat.key)) return;
      seen.add(cat.key);
      out.push({ key: cat.key, label: cat.label, types: [...cat.types], hint: cat.hint, typical: cat.typical, accept: cat.accept });
      return;
    }
    if (sel.key === CUSTOM_REQUEST_KEY || sel.key.startsWith(CUSTOM_REQUEST_PREFIX)) {
      const label = sel.label?.trim();
      if (!label) return;
      const key = `${CUSTOM_REQUEST_PREFIX}${slug(label)}-${i + 1}`;
      out.push({ key, label, types: ['other'], accept: `${IMAGES_OR_PDF},.csv` });
      return;
    }
    out.length = 0; // signal invalid selection
    out.push({ key: '__invalid__', label: sel.key, types: ['other'] });
  });
  if (out.some((o) => o.key === '__invalid__')) return null;
  return out;
}

/** Minimal document shape needed to work out whether a request item is satisfied. */
export interface FulfilmentDoc {
  documentId: string;
  type: DocumentType;
  status: 'pending' | 'accepted' | 'rejected';
  fileName: string;
  requestKey?: string;
  /** Epoch ms — used only for untagged legacy uploads. */
  uploadedAtMs?: number;
}

export interface ItemFulfilment {
  item: DocumentRequestItem;
  files: FulfilmentDoc[];
  /** At least one non-rejected file has been supplied for this item. */
  fulfilled: boolean;
  /** Every supplied file was rejected — applicant must upload again. */
  needsReupload: boolean;
}

/**
 * Match uploaded documents to request items. A file counts toward an item if
 * it was uploaded into that slot (`requestKey`), or — for uploads made
 * without a slot — if its type satisfies the item and it arrived after the
 * request was made.
 */
export function fulfilRequest(
  items: DocumentRequestItem[],
  docs: FulfilmentDoc[],
  requestedAtMs?: number,
): ItemFulfilment[] {
  return items.map((item) => {
    const files = docs.filter((d) => {
      if (d.requestKey) return d.requestKey === item.key;
      if (!item.types.includes(d.type)) return false;
      return requestedAtMs == null || (d.uploadedAtMs ?? 0) >= requestedAtMs;
    });
    const fulfilled = files.some((f) => f.status !== 'rejected');
    return { item, files, fulfilled, needsReupload: files.length > 0 && !fulfilled };
  });
}

export const allFulfilled = (f: ItemFulfilment[]) => f.length > 0 && f.every((x) => x.fulfilled);
