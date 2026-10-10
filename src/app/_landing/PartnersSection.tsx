import Image from 'next/image';

// Intrinsic sizes keep next/image happy; `max-*` classes set the visual size.
const PARTNERS = [
  { src: '/partners/ofx.jpg', alt: 'OFX', w: 200, h: 200, cls: 'max-h-14 max-w-14 rounded-[8px]' },
  { src: '/partners/datazoo.png', alt: 'Data Zoo', w: 526, h: 155, cls: 'max-h-10 max-w-[150px]' },
  { src: '/partners/orbitremit.png', alt: 'OrbitRemit', w: 512, h: 512, cls: 'max-h-14 max-w-14 rounded-[8px]' },
  { src: '/partners/founder-institute.png', alt: 'Founder Institute', w: 400, h: 400, cls: 'max-h-[68px] max-w-[68px]' },
  { src: '/partners/complianceplus.png', alt: 'CompliancePlus', w: 682, h: 86, cls: 'max-h-[30px] max-w-[150px]' },
  { src: '/partners/qippay.png', alt: 'Qippay', w: 244, h: 206, cls: 'max-h-[50px] max-w-24' },
  { src: '/partners/fintechnz.png', alt: 'FinTech New Zealand member', w: 1190, h: 321, cls: 'max-h-[34px] max-w-[150px]' },
  { src: '/partners/centrix.png', alt: 'Centrix — Credit Bureau of New Zealand', w: 217, h: 85, cls: 'max-h-11 max-w-[150px]' },
];

function LogoRow({ decorative }: { decorative?: boolean }) {
  return (
    <>
      {PARTNERS.map((p) => (
        <div
          key={p.src}
          aria-hidden={decorative || undefined}
          className="flex h-24 w-[200px] flex-none items-center justify-center overflow-hidden rounded-card bg-surface-card p-[18px]"
        >
          <Image
            src={p.src}
            alt={decorative ? '' : p.alt}
            width={p.w}
            height={p.h}
            className={`h-auto w-auto object-contain ${p.cls}`}
          />
        </div>
      ))}
    </>
  );
}

export default function PartnersSection() {
  return (
    <section className="bg-surface-card px-6 pb-14 pt-2" aria-labelledby="partners-heading">
      <div className="mx-auto max-w-[1180px]">
        <h2
          id="partners-heading"
          className="mb-6 text-center font-display text-[13px] font-semibold uppercase tracking-[.14em] text-ink-muted"
        >
          Meet Our Partners
        </h2>
        <div className="relative overflow-hidden [-webkit-mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)] [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <div className="tp-marquee flex w-max gap-3.5 pr-3.5">
            <LogoRow />
            <LogoRow decorative />
          </div>
        </div>
      </div>
    </section>
  );
}
