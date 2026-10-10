import Link from 'next/link';
import { CONTENT_NAV, CONTENT_PAGES } from '@/lib/content/pages';

export const dynamic = 'force-dynamic';

function sectionCount(slug: string): number | null {
  const page = CONTENT_PAGES.find((p) => p.slug === slug);
  return page ? page.sectionKeys.length : null;
}

export default function ContentEditorDashboard() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Content management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Edit the copy across the public site, sign-in, onboarding, borrower dashboard, loan application and
          email sequences. Changes save instantly and go live for users right away.
        </p>
      </div>

      <div className="space-y-8">
        {CONTENT_NAV.map((group) => (
          <section key={group.label}>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {group.label}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {group.items.map((item) => {
                const leaves = item.children ?? (item.slug ? [{ label: item.label, slug: item.slug }] : []);
                const primary = leaves[0];
                if (!primary) return null;
                const count = item.children
                  ? item.children.reduce((n, c) => n + (sectionCount(c.slug) ?? 0), 0)
                  : sectionCount(primary.slug);
                return (
                  <div key={item.label} className="tp-card p-5">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/content-editor/${primary.slug}`}
                        className="font-display text-lg font-semibold text-[#16263B] hover:text-[#B45600]"
                      >
                        {item.label}
                      </Link>
                      {count !== null && count > 0 && (
                        <span className="text-xs font-medium text-slate-400">
                          {count} section{count === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    {item.children && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {item.children.map((c) => (
                          <li key={c.slug}>
                            <Link
                              href={`/content-editor/${c.slug}`}
                              className="inline-block rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-[#F5A523] hover:text-[#B45600]"
                            >
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
        <strong className="font-semibold">Compliance reminder:</strong> keep interest and fee disclosures
        visible wherever a borrow or apply action appears, never imply a loan is free, guaranteed or
        instant with no checks, and always state that applications can be declined.
      </div>
    </div>
  );
}
