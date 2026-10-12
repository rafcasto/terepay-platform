import Image from 'next/image';
import Link from 'next/link';
import { LEGAL_PAGES, legalHref } from '@/lib/legal/pages';
import { FacebookIcon, LinkedInIcon } from './icons';

const IMPORTANT_INFORMATION = LEGAL_PAGES.map((p) => ({
  label: p.footerLabel,
  href: legalHref(p.slug),
}));

const IMPORTANT_LINKS = [
  {
    label: 'Contract and Agreement',
    href: 'https://drive.google.com/file/d/1weraj0jfc1yPtet0bQV-fu332cpVTJG9/view?usp=share_link',
  },
];

const SOCIAL_LINKS = [
  { label: 'TerePay on Facebook', href: 'https://www.facebook.com/NeophileFinance/', Icon: FacebookIcon },
  { label: 'TerePay on LinkedIn', href: 'https://www.linkedin.com/company/terepay', Icon: LinkedInIcon },
];

const linkCls =
  'text-sm text-[rgba(234,240,247,0.75)] transition-colors duration-[120ms] hover:text-gold-light';
const headingCls = 'mb-4 font-display text-[13px] font-semibold uppercase tracking-[.1em] text-white';

export default function Footer() {
  return (
    <footer id="contact" className="bg-[var(--ink-900)] px-6 pb-8 pt-[clamp(48px,6vw,72px)] text-[var(--text-on-inverse)]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-10">
        <div className="min-w-0">
          <Image src="/brand/terepay-logo-white.png" alt="TerePay" width={720} height={843} className="h-24 w-auto" />
        </div>

        <div className="min-w-0">
          <h3 className={headingCls}>Important Information</h3>
          <ul className="flex flex-col gap-2.5">
            {IMPORTANT_INFORMATION.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <h3 className={headingCls}>Important Links</h3>
          <ul className="flex flex-col gap-2.5">
            {IMPORTANT_LINKS.map((l) => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <ul className="mt-5 flex items-center gap-2" aria-label="Social media">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.14] text-[rgba(234,240,247,0.75)] transition-colors duration-[120ms] hover:border-gold-light hover:text-gold-light"
                >
                  <Icon size={20} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <h3 className={headingCls}>Contact Us</h3>
          <address className="flex flex-col gap-2.5 text-sm not-italic leading-[1.5] text-[rgba(234,240,247,0.75)]">
            <span>27 Henry Partington Place, Greenhithe, Auckland</span>
            <a href="mailto:info@terepay.com" className={linkCls}>
              info@terepay.com
            </a>
            <a href="tel:+6498867158" className={linkCls}>
              +64 9 886 7158
            </a>
          </address>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-[1180px] flex-wrap justify-between gap-3 border-t border-white/[0.12] pt-6 text-[13px] text-[rgba(234,240,247,0.55)]">
        <span>© Copyright {new Date().getFullYear()}. All rights reserved.</span>
        <span>Registered financial service provider · FinTechNZ member</span>
        <span>TEREPAY NEOPHILE LIMITED (FSP1007414) (NZBN: 9429052055232)</span>
      </div>
    </footer>
  );
}
