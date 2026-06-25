import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  children: ReactNode;
}

export function Card({ padded = true, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`bg-surface-card rounded-card border border-border-default shadow-md ${padded ? 'p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ eyebrow, title, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && (
          <p className="text-[11.5px] font-display font-semibold tracking-[0.08em] uppercase text-brand-text">
            {eyebrow}
          </p>
        )}
        {title && <h2 className="mt-1 text-[17px] font-bold tracking-tight text-ink-strong">{title}</h2>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
