/**
 * Shared Tailwind class strings for the onboarding flow.
 *
 * Built on the TerePay DS token layer (see src/app/globals.css).
 * Accessibility: primary CTA uses --orange-700 (white text passes AA);
 * --orange-500 is surface-only and never used as a text/CTA background here.
 */

// ── Form controls ──────────────────────────────────────────────────────────
export const obLabel = 'block text-sm font-semibold text-ink-strong mb-1.5';

export const obField =
  'w-full h-11 px-3.5 rounded-md border border-border-default bg-surface-card text-sm text-[var(--text-body)] placeholder:text-[var(--text-disabled)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand';

export const obSelect = `${obField} appearance-none pr-10`;

export const obReadonly =
  'w-full h-11 px-3.5 rounded-md border border-border-subtle bg-surface-sunken text-sm text-[var(--text-muted)] cursor-not-allowed flex items-center';

export const obError = 'mt-1.5 text-xs font-medium text-danger-text';

// ── Buttons ─────────────────────────────────────────────────────────────────
export const obPrimaryBtn =
  'inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[var(--orange-700)] text-white font-display font-semibold text-base shadow-[var(--shadow-md)] transition-all duration-150 hover:bg-[var(--orange-800)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2';

export const obSecondaryBtn =
  'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border-default bg-surface-card text-sm font-semibold text-ink-strong transition-colors hover:bg-surface-sunken disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2';

// ── Segmented radio option (used by profile + identity) ──────────────────────
export function obSegment(selected: boolean): string {
  return [
    'flex-1 min-w-[100px] text-center py-2.5 px-4 rounded-md border-2 text-sm font-medium cursor-pointer transition-colors',
    selected
      ? 'border-brand bg-brand-soft text-brand-text'
      : 'border-border-default bg-surface-card text-[var(--text-muted)] hover:border-border-strong',
  ].join(' ');
}

// ── Inline error / alert banner ──────────────────────────────────────────────
export const obAlert =
  'rounded-xl bg-danger-soft-ds border border-[var(--danger-500)]/40 px-4 py-3 text-sm text-danger-text';
