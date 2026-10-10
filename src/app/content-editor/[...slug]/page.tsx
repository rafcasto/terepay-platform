import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findContentPage } from '@/lib/content/pages';
import ContentEditor from '../_components/ContentEditor';

export const dynamic = 'force-dynamic';

/**
 * Every content-editor page (landing, login, each onboarding step, each
 * borrower status, each loan-request step…) is served here. The page registry
 * in `src/lib/content/pages.ts` decides which sections appear on which slug.
 */
export default async function ContentEditorPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const page = findContentPage(slug.join('/'));
  if (!page) notFound();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#16263B]">{page.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{page.description} Saves are live immediately.</p>
        </div>
        {page.previewHref && (
          <Link
            href={page.previewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            View live page
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </Link>
        )}
      </div>
      <ContentEditor sectionKeys={page.sectionKeys} />
    </div>
  );
}
