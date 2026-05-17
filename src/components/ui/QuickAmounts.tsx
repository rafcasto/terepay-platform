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
            className={`px-3.5 h-9 rounded-full border text-sm font-semibold transition-colors ${
              selected
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-surface text-text hover:border-accent/50 hover:bg-accent-soft'
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
