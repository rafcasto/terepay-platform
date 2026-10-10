import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from './Icons';

interface ActionRowProps {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  iconTone?: 'amber' | 'info' | 'muted' | 'success' | 'danger';
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

const iconTones = {
  amber: 'bg-brand-soft text-brand-text',
  info: 'bg-info-soft-ds text-info-text',
  muted: 'bg-surface-sunken text-[var(--text-muted)]',
  success: 'bg-success-soft-ds text-success-text',
  danger: 'bg-danger-soft-ds text-danger-text',
};

export function ActionRow({
  href,
  onClick,
  icon,
  iconTone = 'amber',
  title,
  subtitle,
  badge,
  disabled,
}: ActionRowProps) {
  const inner = (
    <>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${iconTones[iconTone]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[14.5px] font-semibold text-ink-strong">{title}</p>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      <ChevronRight size={16} className="shrink-0 text-[var(--text-disabled)] group-hover:text-brand-text transition-colors" />
    </>
  );

  const classes =
    'group flex items-center gap-4 bg-surface-card rounded-card px-4 py-3.5 border border-border-default hover:border-brand/50 hover:shadow-md transition-all duration-150 hover:-translate-y-0.5';

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${classes} w-full text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:border-border-default`}
    >
      {inner}
    </button>
  );
}
