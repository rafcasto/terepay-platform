import type { Metadata } from 'next';
import Link from 'next/link';
import { findLegalPage, LEGAL_PAGES, legalHref } from '@/lib/legal/pages';

/** Build page metadata for a registered legal slug. */
export function legalMetadata(slug: string): Metadata {
  const page = findLegalPage(slug);
  if (!page) return {};
  const url = `https://terepay.com${legalHref(page.slug)}`;
  return {
    title: `${page.title} — TerePay`,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${page.title} — TerePay`,
      description: page.description,
      url,
      siteName: 'TerePay',
      type: 'article',
    },
  };
}

interface LegalArticleProps {
  slug: string;
  /** Optional one-line lead shown under the heading. */
  lead?: string;
  children: React.ReactNode;
}

/**
 * Page shell for a legal document: eyebrow, title, the document body in a
 * card, and a "related documents" list so every policy is one click from the
 * others (hardship + dispute-resolution must stay reachable — see CLAUDE.md).
 */
export default function LegalArticle({ slug, lead, children }: LegalArticleProps) {
  const page = findLegalPage(slug);
  const title = page?.title ?? slug;
  const related = LEGAL_PAGES.filter((p) => p.slug !== slug);

  return (
    <>
      <section className="bg-[var(--ink-900)] px-6 pb-[clamp(40px,6vw,64px)] pt-[clamp(40px,6vw,64px)] text-[var(--text-on-inverse)]">
        <div className="mx-auto max-w-[860px]">
          <p className="tp-eyebrow mb-3 !text-gold-light">Important information</p>
          <h1 className="font-display text-[clamp(28px,4vw,40px)] font-semibold leading-[1.15] text-white">
            {title}
          </h1>
          {lead && (
            <p className="mt-4 max-w-[640px] text-[17px] leading-[1.55] text-[rgba(234,240,247,0.78)]">{lead}</p>
          )}
          <p className="mt-5 text-sm text-[rgba(234,240,247,0.62)]">TerePay Neophile Limited (FSP1007414)</p>
        </div>
      </section>

      <section className="px-6 py-[clamp(32px,5vw,56px)]">
        <div className="mx-auto max-w-[860px]">
          <article className="tp-card tp-prose px-[clamp(20px,4vw,48px)] py-[clamp(28px,4vw,44px)]">{children}</article>

          <nav aria-label="Related documents" className="mt-10">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[.1em] text-ink-muted">
              Related documents
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={legalHref(p.slug)}
                    className="text-sm font-medium text-[var(--text-link)] underline-offset-2 hover:text-[var(--text-link-hover)] hover:underline"
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </>
  );
}
