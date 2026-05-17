'use client';

import { useEffect, type ReactNode } from 'react';
import { CheckCircle, Info, AlertTriangle, X } from './Icons';

type Tone = 'success' | 'info' | 'error';

interface ToastProps {
  open: boolean;
  onClose: () => void;
  tone?: Tone;
  children: ReactNode;
  durationMs?: number;
}

const tones: Record<Tone, { icon: typeof CheckCircle; ring: string; text: string }> = {
  success: { icon: CheckCircle, ring: 'border-success/40 bg-success-soft', text: 'text-[#0e6b2e]' },
  info: { icon: Info, ring: 'border-info/40 bg-info-soft', text: 'text-[#1e40af]' },
  error: { icon: AlertTriangle, ring: 'border-danger/40 bg-danger-soft', text: 'text-[#991b1b]' },
};

export function Toast({ open, onClose, tone = 'success', children, durationMs = 2400 }: ToastProps) {
  // Auto-dismiss after durationMs. Caller owns the `open` state and provides onClose.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;
  const { icon: Icon, ring, text } = tones[tone];
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none">
      <div
        className={`toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border ${ring} px-4 py-3 shadow-soft-lg max-w-md ${text}`}
      >
        <Icon size={18} />
        <p className="text-sm font-semibold flex-1">{children}</p>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
