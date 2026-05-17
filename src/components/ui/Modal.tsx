'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from './Icons';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 scrim-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${sizes[size]} bg-surface rounded-t-2xl sm:rounded-2xl shadow-soft-lg sheet-in mx-0 sm:mx-4 max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0">
            {title && <h2 className="text-lg font-bold tracking-tight text-text">{title}</h2>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 -m-1 rounded-md text-muted hover:bg-surface-2 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-border bg-bg/60 rounded-b-2xl sm:rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
