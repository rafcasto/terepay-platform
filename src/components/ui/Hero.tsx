import type { ReactNode } from 'react';

type State = 'default' | 'approved' | 'rejected' | 'paid';

const gradients: Record<State, string> = {
  default: 'hero-default',
  approved: 'hero-approved',
  rejected: 'hero-rejected',
  paid: 'hero-paid',
};

interface HeroProps {
  state?: State;
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  emoji?: string;
  pill?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Hero({
  state = 'default',
  eyebrow,
  title,
  subtitle,
  emoji,
  pill,
  children,
  className = '',
}: HeroProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 text-white ${gradients[state]} shadow-soft ${className}`}
    >
      {/* Accent radial glow — handoff signature */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative">
        {(eyebrow || pill) && (
          <div className="mb-4 flex items-center justify-between gap-4">
            {eyebrow && (
              <p className="text-[11.5px] font-semibold tracking-[0.08em] uppercase text-white/60">
                {eyebrow}
              </p>
            )}
            {pill}
          </div>
        )}

        {emoji && <div className="text-2xl mb-2 leading-none">{emoji}</div>}

        {title && (
          <h2 className="text-xl font-bold tracking-tight leading-tight">{title}</h2>
        )}

        {subtitle && (
          <p className="mt-2 text-[14.5px] text-white/70 leading-relaxed">{subtitle}</p>
        )}

        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>
  );
}

export function HeroBalance({ amount }: { amount: number }) {
  const [whole, cents] = amount.toFixed(2).split('.');
  const formattedWhole = Number(whole).toLocaleString('en-NZ');
  return (
    <div className="flex items-start leading-none">
      <span className="text-xl font-bold mt-1 mr-0.5 text-white/70">$</span>
      <span className="text-[40px] font-bold tracking-tight">{formattedWhole}</span>
      <span className="text-xl font-bold text-white/60 mt-1">.{cents}</span>
    </div>
  );
}
