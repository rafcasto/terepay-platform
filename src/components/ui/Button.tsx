import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'secondary' | 'ghost-light' | 'danger';
type Size = 'md' | 'lg' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2';

const variants: Record<Variant, string> = {
  // Accessible brand CTA — --orange-700 passes AA with white text (gold did not)
  primary:
    'bg-[var(--orange-700)] text-white shadow-[var(--shadow-md)] hover:bg-[var(--orange-800)] hover:-translate-y-0.5 active:translate-y-0',
  secondary:
    'bg-surface-card text-ink-strong border border-border-default hover:bg-surface-sunken hover:-translate-y-0.5',
  // For use on dark / navy surfaces (e.g. Hero)
  'ghost-light':
    'bg-white/10 text-white border border-white/15 hover:bg-white/15',
  danger:
    'bg-[var(--danger-500)] text-white hover:bg-[var(--danger-700)] hover:-translate-y-0.5',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth,
  className = '',
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </Link>
  );
}
