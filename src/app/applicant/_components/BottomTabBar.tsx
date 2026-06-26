'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APPLICANT_TABS } from './applicant-nav';

export default function BottomTabBar() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border-default bg-white/95 backdrop-blur-md shadow-[0_-3px_14px_rgba(15,29,46,0.06)] px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
    >
      {APPLICANT_TABS.map((tab) => {
        const isActive = tab.match ? pathname.startsWith(tab.match) : false;
        const label = tab.shortLabel ?? tab.label;

        const inner = (
          <>
            <span className="relative inline-flex">
              <tab.Icon size={23} />
              {!tab.href && (
                <span className="absolute -top-1.5 -right-2.5 rounded-full bg-surface-2 px-1 text-[8px] font-semibold leading-[1.4] text-muted">
                  Soon
                </span>
              )}
            </span>
            <span className="text-[11px] font-semibold tracking-[0.01em]">{label}</span>
          </>
        );

        const base =
          'flex-1 min-h-[52px] flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors';

        if (tab.href) {
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`${base} ${isActive ? 'text-brand-text' : 'text-muted hover:text-text'}`}
            >
              {inner}
            </Link>
          );
        }

        return (
          <div
            key={tab.label}
            aria-disabled="true"
            className={`${base} text-muted/55 cursor-default`}
          >
            {inner}
          </div>
        );
      })}
    </nav>
  );
}
