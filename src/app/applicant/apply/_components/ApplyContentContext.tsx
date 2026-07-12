'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';

/**
 * Bridges server-fetched, editable disclaimer copy into the client-side
 * application form (a `'use client'` tree that can't call `getContentSection`).
 * The server apply layout fetches the content and provides it here; deep client
 * steps read it via `useApplyContent()`.
 */
const ApplyContentContext = createContext<ContentSectionValues>(
  DEFAULT_CONTENT['apply.disclaimers'],
);

export function ApplyContentProvider({
  value,
  children,
}: {
  value: ContentSectionValues;
  children: ReactNode;
}) {
  return <ApplyContentContext.Provider value={value}>{children}</ApplyContentContext.Provider>;
}

/** Read the application disclaimer copy (falls back to defaults). */
export function useApplyContent(): ContentSectionValues {
  return { ...DEFAULT_CONTENT['apply.disclaimers'], ...useContext(ApplyContentContext) };
}
