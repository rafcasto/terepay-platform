'use client';

import type { ReactNode } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label
      className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
    >
      <div className="flex-1 min-w-0">
        {label && <p className="text-sm font-semibold text-text">{label}</p>}
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
          checked ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-soft-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}
