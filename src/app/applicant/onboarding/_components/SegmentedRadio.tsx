'use client';

import { obSegment } from './onboarding-styles';

interface Option {
  value: string;
  label: string;
}

interface SegmentedRadioProps {
  name: string;
  value: string | null;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
}

/** DS segmented radio — accessible (real radio inputs), keyboard + focus friendly. */
export function SegmentedRadio({ name, value, options, onChange, className = '' }: SegmentedRadioProps) {
  return (
    <div className={`flex gap-2.5 flex-wrap ${className}`}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label key={opt.value} className={obSegment(selected)}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
