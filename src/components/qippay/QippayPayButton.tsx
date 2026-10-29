import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { QIPPAY_DESCRIPTOR } from '@/lib/qippay/brand';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children?: ReactNode;
  fullWidth?: boolean;
};

/**
 * The dedicated "Pay by bank with Qippay" button — Merchant Brand Guidelines §5.
 * Background #F47820 with #F4F4F4 text; hover/secondary #000000. Colours come
 * from the `--qippay-*` tokens in globals.css and are deliberately not the
 * TerePay orange scale. Label defaults to the product descriptor; pass
 * children only for a descriptor-preserving variant such as
 * "Continue to ANZ".
 */
export function QippayPayButton({
  children,
  fullWidth,
  className = '',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={
        'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold ' +
        'bg-[var(--qippay-orange)] text-[var(--qippay-text)] transition-colors duration-150 ' +
        'hover:bg-[var(--qippay-hover)] focus-visible:outline-none focus-visible:ring-2 ' +
        'focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ' +
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--qippay-orange)] ' +
        `${fullWidth ? 'w-full' : ''} ${className}`
      }
      {...rest}
    >
      {children ?? QIPPAY_DESCRIPTOR}
    </button>
  );
}
