'use client';

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';

const inputBase =
  'w-full h-11 px-3 rounded-xl border bg-surface text-text placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent disabled:bg-surface-2 disabled:cursor-not-allowed';

interface FieldLabelProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  htmlFor?: string;
}

function FieldLabel({ label, required, hint, htmlFor }: FieldLabelProps) {
  if (!label) return null;
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-text">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function FieldError({ error }: { error?: ReactNode }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs text-danger font-medium">{error}</p>;
}

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  prefilled?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, required, hint, error, leading, trailing, prefilled, id, className = '', ...rest },
  ref,
) {
  const fieldId = id ?? rest.name;
  const borderCls = error
    ? 'border-danger focus:ring-danger focus:border-danger'
    : prefilled
      ? 'border-info/40 bg-info-soft/30'
      : 'border-border';

  return (
    <div className={className}>
      <FieldLabel label={label} required={required} hint={hint} htmlFor={fieldId} />
      <div className="relative flex items-center">
        {leading && (
          <span className="absolute left-3 text-sm text-muted font-medium pointer-events-none select-none">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={`${inputBase} ${borderCls} ${leading ? 'pl-10' : ''} ${trailing ? 'pr-10' : ''}`}
          {...rest}
        />
        {trailing && (
          <span className="absolute right-3 text-sm text-muted pointer-events-none select-none">{trailing}</span>
        )}
      </div>
      <FieldError error={error} />
    </div>
  );
});

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  prefilled?: boolean;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, required, hint, error, prefilled, id, className = '', children, ...rest },
  ref,
) {
  const fieldId = id ?? rest.name;
  const borderCls = error
    ? 'border-danger focus:ring-danger focus:border-danger'
    : prefilled
      ? 'border-info/40 bg-info-soft/30'
      : 'border-border';
  return (
    <div className={className}>
      <FieldLabel label={label} required={required} hint={hint} htmlFor={fieldId} />
      <select
        ref={ref}
        id={fieldId}
        className={`${inputBase} ${borderCls} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 stroke=%22%236b7280%22 stroke-width=%221.75%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[length:18px_18px] bg-[position:right_12px_center] pr-10`}
        {...rest}
      >
        {children}
      </select>
      <FieldError error={error} />
    </div>
  );
});

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  prefilled?: boolean;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, required, hint, error, prefilled, id, className = '', rows = 4, ...rest },
  ref,
) {
  const fieldId = id ?? rest.name;
  const borderCls = error
    ? 'border-danger focus:ring-danger focus:border-danger'
    : prefilled
      ? 'border-info/40 bg-info-soft/30'
      : 'border-border';
  return (
    <div className={className}>
      <FieldLabel label={label} required={required} hint={hint} htmlFor={fieldId} />
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={`w-full px-3 py-2.5 rounded-xl border ${borderCls} bg-surface text-text placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent`}
        {...rest}
      />
      <FieldError error={error} />
    </div>
  );
});

export interface CheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  error?: ReactNode;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { label, error, className = '', ...rest },
  ref,
) {
  return (
    <div className={className}>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent shrink-0"
          {...rest}
        />
        <span className="text-sm text-text">{label}</span>
      </label>
      <FieldError error={error} />
    </div>
  );
});
