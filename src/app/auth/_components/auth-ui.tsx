import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { AuthIcon } from './auth-icons';

/* ---------------------------------------------------------------------------
   Auth form primitives — Tailwind re-implementations of the TerePay design
   system's Field / Input / Button / Checkbox, driven by the DS token layer in
   globals.css. Kept presentational so the page owns all state + behaviour.
   --------------------------------------------------------------------------- */

export function Field({
  htmlFor,
  label,
  required = false,
  hint,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text-strong)]">
        {label}
        {required && (
          <span className="font-bold text-[var(--danger-700)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-[12.5px] leading-snug text-[var(--text-muted)]">{hint}</p>}
      {error && (
        <p className="flex items-start gap-1.5 text-[12.5px] font-medium leading-snug text-[var(--text-danger)] [&_svg]:mt-px [&_svg]:h-[14px] [&_svg]:w-[14px] [&_svg]:flex-none">
          {AuthIcon.warn}
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

type InputShellProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
  invalid?: boolean;
};

const affixCls = 'inline-flex items-center text-[var(--text-muted)] [&_svg]:h-[18px] [&_svg]:w-[18px]';

export const InputShell = forwardRef<HTMLInputElement, InputShellProps>(function InputShell(
  { prefix, suffix, invalid = false, className = '', ...rest },
  ref,
) {
  const stateCls = invalid
    ? 'border-[var(--danger-500)] focus-within:border-[var(--danger-500)] focus-within:shadow-[0_0_0_3px_rgba(220,38,38,0.16)]'
    : 'border-[var(--border-default)] hover:border-[var(--slate-300)] focus-within:border-[var(--orange-500)] focus-within:shadow-[0_0_0_3px_rgba(240,128,0,0.18)]';
  return (
    <div className={`flex h-12 items-center gap-2 rounded-[10px] border bg-white px-3.5 transition-[border-color,box-shadow] duration-150 ${stateCls} ${className}`}>
      {prefix != null && <span className={affixCls}>{prefix}</span>}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[var(--text-strong)] outline-none placeholder:text-[var(--slate-400)]"
        {...rest}
      />
      {suffix != null && <span className={affixCls}>{suffix}</span>}
    </div>
  );
});

export function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="inline-flex items-center text-[var(--slate-400)] transition-colors hover:text-[var(--text-muted)] [&_svg]:h-[18px] [&_svg]:w-[18px]"
    >
      {shown ? AuthIcon.eyeOff : AuthIcon.eye}
    </button>
  );
}

export function SubmitButton({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
      className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--orange-700)] font-display text-[15px] font-semibold text-white transition-colors hover:bg-[var(--orange-800)] active:bg-[var(--orange-900)] disabled:cursor-not-allowed disabled:bg-[var(--slate-200)] disabled:text-[var(--slate-400)] [&_svg]:h-[18px] [&_svg]:w-[18px]"
    >
      {children}
    </button>
  );
}

export function Checkbox({
  id,
  checked,
  defaultChecked,
  onChange,
  children,
}: {
  id: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="mt-0.5 h-[18px] w-[18px] flex-none rounded-[5px] border-[var(--border-strong)] accent-[var(--orange-700)]"
      />
      <span className="text-[13.5px] leading-snug text-[var(--text-muted)] [&_a]:font-semibold [&_a]:text-[var(--text-link)] [&_a:hover]:underline">
        {children}
      </span>
    </label>
  );
}

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[14px] leading-snug text-[var(--text-danger)]">
      {children}
    </p>
  );
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-3.5 text-[13px] text-[var(--text-muted)] before:h-px before:flex-1 before:bg-[var(--border-default)] before:content-[''] after:h-px after:flex-1 after:bg-[var(--border-default)] after:content-['']">
      {children}
    </div>
  );
}
