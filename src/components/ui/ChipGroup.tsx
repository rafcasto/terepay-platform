'use client';

import type { ReactNode } from 'react';

export interface ChipOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface ChipGroupProps<T extends string = string> {
  options: ChipOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4;
}

export function ChipGroup<T extends string = string>({
  options,
  value,
  onChange,
  columns = 3,
}: ChipGroupProps<T>) {
  return (
    <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center gap-2 px-3 h-10 rounded-xl border text-sm font-semibold transition-all ${
              selected
                ? 'border-accent bg-accent-soft text-accent-2 shadow-soft-sm'
                : 'border-border bg-surface text-text hover:border-accent/40 hover:bg-accent-soft/40'
            }`}
            aria-pressed={selected}
          >
            {opt.icon && <span className="opacity-80">{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
