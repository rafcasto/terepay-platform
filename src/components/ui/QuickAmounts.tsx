'use client';

interface QuickAmountsProps {
  amounts: number[];
  value: number | null;
  onChange: (n: number) => void;
  formatLabel?: (n: number) => string;
}

export function QuickAmounts({ amounts, value, onChange, formatLabel }: QuickAmountsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {amounts.map((a) => {
        const selected = a === value;
        return (
          <button
            type="button"
            key={a}
            onClick={() => onChange(a)}
            className={`px-3.5 h-9 rounded-pill border-2 text-sm font-semibold font-tabular transition-colors ${
              selected
                ? 'border-brand bg-brand-soft text-brand-text'
                : 'border-border-default bg-surface-card text-ink-strong hover:border-border-strong hover:bg-surface-sunken'
            }`}
            aria-pressed={selected}
          >
            {formatLabel ? formatLabel(a) : a}
          </button>
        );
      })}
    </div>
  );
}
