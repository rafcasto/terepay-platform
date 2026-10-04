'use client';

interface Props {
  /** Shared `name` for the radio pair. */
  name: string;
  question: string;
  hint?: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  error?: string;
}

/** A required yes / no question rendered as a pair of radio cards. */
export default function YesNoQuestion({ name, question, hint, value, onChange, error }: Props) {
  return (
    <fieldset className="rounded-xl border border-border-default bg-surface-sunken p-4">
      <legend className="float-left w-full text-sm font-semibold text-ink-strong">
        {question} <span className="text-danger-text">*</span>
      </legend>
      {hint && <p className="clear-both pt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
      <div className="clear-both grid grid-cols-2 gap-3 pt-3">
        {[
          { label: 'Yes', v: true },
          { label: 'No', v: false },
        ].map(({ label, v }) => {
          const checked = value === v;
          return (
            <label
              key={label}
              className={[
                'flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition-colors',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]',
                checked
                  ? 'border-brand bg-brand-soft text-brand-text'
                  : 'border-border-default bg-surface-card text-ink-strong hover:border-border-strong',
              ].join(' ')}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(v)}
              />
              {label}
            </label>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-danger-text">{error}</p>}
    </fieldset>
  );
}
