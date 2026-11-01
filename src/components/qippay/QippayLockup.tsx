import Image from 'next/image';
import {
  QIPPAY_CONSUMERS_URL,
  QIPPAY_DESCRIPTOR,
  QIPPAY_LEARN_MORE_LABEL,
  QIPPAY_LOGO,
} from '@/lib/qippay/brand';

type Props = {
  /** Rendered logo height in px — never below the 24px guideline minimum. */
  logoHeight?: number;
  /** Show the "Pay by bank with Qippay" tagline under the logo (Figure 2). */
  tagline?: boolean;
  /** Show the "Learn how Qippay works" link under the tagline (Figure 2). */
  learnMore?: boolean;
  align?: 'center' | 'start';
  className?: string;
};

/**
 * Qippay logo lockup per Merchant Brand Guidelines §3 — approved artwork, the
 * fixed tagline and the fixed "Learn more" line linking to qippay.com/consumers.
 * Light backgrounds only (the artwork is the primary-colour version).
 */
export function QippayLockup({
  logoHeight = 32,
  tagline = true,
  learnMore = true,
  align = 'center',
  className = '',
}: Props) {
  const h = Math.max(logoHeight, QIPPAY_LOGO.minHeightPx);
  const w = Math.round((h * QIPPAY_LOGO.width) / QIPPAY_LOGO.height);
  const alignCls = align === 'center' ? 'items-center text-center' : 'items-start text-left';

  return (
    <div className={`flex flex-col gap-1.5 ${alignCls} ${className}`}>
      <Image
        src={QIPPAY_LOGO.src}
        alt={QIPPAY_LOGO.alt}
        width={QIPPAY_LOGO.width}
        height={QIPPAY_LOGO.height}
        style={{ height: h, width: w }}
        className="object-contain"
      />
      {tagline && <p className="text-sm font-semibold text-ink-strong">{QIPPAY_DESCRIPTOR}</p>}
      {learnMore && (
        <a
          href={QIPPAY_CONSUMERS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-[var(--text-body)] underline underline-offset-2 hover:text-ink-strong"
        >
          {QIPPAY_LEARN_MORE_LABEL}
        </a>
      )}
    </div>
  );
}
