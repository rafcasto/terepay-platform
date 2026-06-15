import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info';

// Token-backed tone classes — mirrors the design system's .sc-pill--* tones.
const TONE_CLASSES: Record<PillTone, string> = {
  neutral: 'bg-[var(--slate-100)] text-[var(--slate-600)]',
  brand: 'bg-[var(--orange-50)] text-[var(--orange-700)]',
  success: 'bg-[var(--success-50)] text-[var(--success-700)]',
  danger: 'bg-[var(--danger-50)] text-[var(--danger-700)]',
  warning: 'bg-[var(--warning-50)] text-[var(--warning-700)]',
  info: 'bg-[var(--info-50)] text-[var(--info-700)]',
};

const DOT_CLASSES: Record<PillTone, string> = {
  neutral: 'bg-[var(--slate-400)]',
  brand: 'bg-[var(--orange-500)]',
  success: 'bg-[var(--success-500)]',
  danger: 'bg-[var(--danger-500)]',
  warning: 'bg-[var(--warning-500)]',
  info: 'bg-[var(--info-500)]',
};

export default function ConsolePill({
  tone = 'neutral',
  dot = false,
  children,
}: {
  tone?: PillTone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-[23px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold leading-none ${TONE_CLASSES[tone]}`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[tone]}`} />}
      {children}
    </span>
  );
}
