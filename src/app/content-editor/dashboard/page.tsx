import Link from 'next/link';
import { CONTENT_SECTIONS } from '@/types/content';

export const dynamic = 'force-dynamic';

const CARDS = [
  {
    href: '/content-editor/landing',
    title: 'Public site',
    body: 'Homepage hero, call-to-action banner and FAQ shown to everyone.',
    group: 'landing' as const,
  },
  {
    href: '/content-editor/borrower',
    title: 'Borrower pages',
    body: 'Copy shown to signed-in borrowers, including the dashboard.',
    group: 'borrower' as const,
  },
  {
    href: '/content-editor/emails',
    title: 'Email sequences',
    body: 'Subject lines and bodies for onboarding, welcome and loan-event emails.',
    group: null,
  },
];

export default function ContentEditorDashboard() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Content management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Edit the copy across the public site, borrower pages and email sequences. Changes save instantly and
          go live for users right away.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((card) => {
          const count =
            card.group === null
              ? null
              : CONTENT_SECTIONS.filter((s) => s.group === card.group).length;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="tp-card group p-5 transition-shadow hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-[#16263B] group-hover:text-[#B45600]">
                  {card.title}
                </h2>
                <svg className="h-5 w-5 text-slate-300 group-hover:text-[#F5A523]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
              <p className="mt-1 text-sm text-slate-500">{card.body}</p>
              {count !== null && (
                <p className="mt-3 text-xs font-medium text-slate-400">
                  {count} editable section{count === 1 ? '' : 's'}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
        <strong className="font-semibold">Compliance reminder:</strong> keep interest and fee disclosures
        visible wherever a borrow or apply action appears, and never imply a loan is free, guaranteed or
        instant with no checks.
      </div>
    </div>
  );
}
