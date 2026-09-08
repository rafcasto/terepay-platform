'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { withDefaults, type ContentSectionValues } from '@/types/content';

/**
 * Bridges server-fetched, editable copy into `'use client'` trees that can't
 * call `getContentSection()` themselves.
 *
 * A server layout fetches the sections it owns with `getContentSections()` and
 * wraps its subtree in `<SiteContentProvider content={...}>`; deep client
 * components read a section with `useSiteContent('section.key')`. Providers
 * nest — an inner provider merges over (never replaces) what the outer one
 * supplied. Reading a section that was never provided falls back to defaults,
 * so components never render blank strings.
 */
const SiteContentContext = createContext<Record<string, ContentSectionValues>>({});

export function SiteContentProvider({
  content,
  children,
}: {
  content: Record<string, ContentSectionValues>;
  children: ReactNode;
}) {
  const parent = useContext(SiteContentContext);
  const merged = { ...parent, ...content };
  return <SiteContentContext.Provider value={merged}>{children}</SiteContentContext.Provider>;
}

/** Read one section's values (defaults-merged) from the nearest provider. */
export function useSiteContent(key: string): ContentSectionValues {
  const all = useContext(SiteContentContext);
  return withDefaults(key, all[key]);
}
