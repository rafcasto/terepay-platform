'use client';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (n: number) => void;
  formatLabel?: (n: number) => string;
}

export function RangeSlider({ min, max, step = 50, value, onChange, formatLabel }: RangeSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="relative h-1.5 rounded-pill bg-border-default overflow-hidden mb-3">
        <div
          className="absolute inset-y-0 left-0 rounded-pill"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--orange-500), var(--gold-500))',
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="range-amber w-full -mt-[18px]"
        aria-label="Amount"
      />
      <div className="mt-2 flex justify-between text-[11.5px] font-tabular text-[var(--text-muted)]">
        <span>{formatLabel ? formatLabel(min) : min}</span>
        <span>{formatLabel ? formatLabel(max) : max}</span>
      </div>
    </div>
  );
}
