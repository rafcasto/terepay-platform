'use client';

import { useState } from 'react';
import { Icons } from '@/components/ui';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        className="text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
      >
        <Icons.Bell size={22} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className="absolute right-0 top-11 z-50 w-[min(308px,calc(100vw-28px))] rounded-2xl border border-border-default bg-white shadow-lg p-2"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-bold text-text">Notifications</span>
            </div>
            <div className="px-3 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted">
                <Icons.Bell size={22} />
              </div>
              <p className="text-sm font-semibold text-text">Nothing yet</p>
              <p className="mt-1 text-xs text-muted">
                Payment reminders and account updates will show up here soon.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
