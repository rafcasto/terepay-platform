import type { ReactNode } from 'react';

type Tone = 'amber' | 'success' | 'danger' | 'info' | 'muted' | 'warn';

const tones: Record<Tone, { wrap: string; dot: string }> = {
  amber: {
    wrap: 'bg-warning-soft text-warning-text border-[var(--warning-500)]/30',
    dot: 'bg-[var(--warning-500)]',
  },
  success: {
    wrap: 'bg-success-soft-ds text-success-text border-[var(--success-500)]/30',
    dot: 'bg-[var(--success-500)]',
  },
  danger: {
    wrap: 'bg-danger-soft-ds text-danger-text border-[var(--danger-500)]/30',
    dot: 'bg-[var(--danger-500)]',
  },
  info: {
    wrap: 'bg-info-soft-ds text-info-text border-[var(--info-500)]/30',
    dot: 'bg-[var(--info-500)]',
  },
  warn: {
    wrap: 'bg-warning-soft text-warning-text border-[var(--warning-500)]/30',
    dot: 'bg-[var(--warning-500)]',
  },
  muted: {
    wrap: 'bg-surface-sunken text-[var(--text-muted)] border-border-default',
    dot: 'bg-[var(--slate-400)]',
  },
};

interface PillProps {
  tone?: Tone;
  pulse?: boolean;
  onInk?: boolean;
  children: ReactNode;
}

export function Pill({ tone = 'muted', pulse = false, onInk = false, children }: PillProps) {
  const t = tones[tone];
  const wrap = onInk
    ? 'bg-white/10 text-white border border-white/15'
    : `border ${t.wrap}`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[11.5px] font-semibold tracking-[0.02em] ${wrap}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${onInk ? 'bg-[var(--gold-300)]' : t.dot} ${pulse ? 'pulse-dot' : ''}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
