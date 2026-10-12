import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContentSection, getContentSections } from '@/lib/content/site-content';
import { renderDocument } from '@/lib/content/document';
import { findLegalPage, isLegalPublished, LEGAL_PAGES, legalHref, legalSectionKey as sectionKey } from '@/lib/legal/pages';
import LegalArticle from './LegalArticle';

/**
 * `generateMetadata` helper for a legal page. Reads the editable title so the
 * browser tab / search snippet follow whatever the content editor saved.
 */
export async function legalPageMetadata(slug: string): Promise<Metadata> {
  const page = findLegalPage(slug);
  if (!page) return {};
  const content = await getContentSection(sectionKey(slug));
  if (!isLegalPublished(content)) return { robots: { index: false, follow: false } };
  const title = content.title?.trim() || page.title;
  const description = content.lead?.trim() || page.description;
  const url = `https://terepay.com${legalHref(page.slug)}`;
  return {
    title: `${title} — TerePay`,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} — TerePay`, description, url, siteName: 'TerePay', type: 'article' },
  };
}

/**
 * Server component behind every public legal page. Content comes from the
 * `legal.<slug>` content section (editable in the content editor, defaults in
 * `src/lib/legal/documents.ts`) and is rendered through the safe plain-text
 * document renderer — never as HTML.
 */
export default async function LegalDocumentPage({ slug }: { slug: string }) {
  const page = findLegalPage(slug);
  if (!page) notFound();

  // One round-trip for every legal section: this page's content plus the
  // (possibly edited) titles of the others for the "Related documents" nav.
  const all = await getContentSections(LEGAL_PAGES.map((p) => sectionKey(p.slug)));
  const content = all[sectionKey(slug)] ?? {};
  // Drafts (e.g. a page an editor hasn't published yet) are not public.
  if (!isLegalPublished(content)) notFound();

  const related = LEGAL_PAGES.filter((p) => p.slug !== slug && isLegalPublished(all[sectionKey(p.slug)])).map((p) => ({
    href: legalHref(p.slug),
    title: all[sectionKey(p.slug)]?.title?.trim() || p.title,
  }));

  return (
    <LegalArticle title={content.title?.trim() || page.title} lead={content.lead?.trim() || undefined} related={related}>
      {renderDocument(content.body ?? '')}
    </LegalArticle>
  );
}
