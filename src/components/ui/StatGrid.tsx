import type { ReactNode } from 'react';

export interface Stat {
  label: ReactNode;
  value: ReactNode;
}

interface StatGridProps {
  stats: Stat[];
  onInk?: boolean;
  columns?: 2 | 3;
}

export function StatGrid({ stats, onInk = true, columns = 2 }: StatGridProps) {
  return (
    <div
      className={`grid gap-px rounded-xl overflow-hidden ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'} ${
        onInk ? 'bg-white/10' : 'bg-border-default'
      }`}
    >
      {stats.map((s, i) => (
        <div
          key={i}
          className={`p-3.5 ${onInk ? 'bg-[var(--surface-inverse)]' : 'bg-surface-card'}`}
        >
          <p className={`text-[11.5px] font-medium tracking-[0.02em] ${onInk ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
            {s.label}
          </p>
          <p className={`mt-1 text-[18px] font-bold font-tabular tracking-tight ${onInk ? 'text-white' : 'text-ink-strong'}`}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
