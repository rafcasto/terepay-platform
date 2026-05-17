import type { ReactNode } from 'react';

type Tone = 'amber' | 'success' | 'danger' | 'info' | 'muted' | 'warn';

const tones: Record<Tone, { wrap: string; dot: string }> = {
  amber: {
    wrap: 'bg-accent-soft text-[#a76408] border-[#f5cd83]/40',
    dot: 'bg-accent',
  },
  success: {
    wrap: 'bg-success-soft text-[#0e6b2e] border-[#86efac]/40',
    dot: 'bg-success',
  },
  danger: {
    wrap: 'bg-danger-soft text-[#991b1b] border-[#fecaca]/40',
    dot: 'bg-danger',
  },
  info: {
    wrap: 'bg-info-soft text-[#1e40af] border-[#bfdbfe]/40',
    dot: 'bg-info',
  },
  warn: {
    wrap: 'bg-warn-soft text-[#9a3412] border-[#fdba74]/40',
    dot: 'bg-warn',
  },
  muted: {
    wrap: 'bg-surface-2 text-muted border-border',
    dot: 'bg-muted',
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold tracking-[0.02em] ${wrap}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${onInk ? 'bg-accent' : t.dot} ${pulse ? 'pulse-dot' : ''}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}
