import type { ReactNode, SVGProps } from 'react';

// Lucide line icons, inlined (the project does not ship an icon package).
// Stroke 1.75 and `currentColor` per the TerePay design system.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Line({ size = 20, strokeWidth = 1.75, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Line>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="m6 9 6 6 6-6" />
    </Line>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="m15 18-6-6 6-6" />
    </Line>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="m9 18 6-6-6-6" />
    </Line>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Line {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </Line>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Line>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Line>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    </Line>
  );
}

/** Filled star for ratings — the one filled glyph the DS allows. */
export function StarIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <path d="m12 2 2.9 6.26 6.85.72-5.1 4.6 1.44 6.72L12 16.9l-6.09 3.4 1.44-6.72-5.1-4.6 6.85-.72z" />
    </svg>
  );
}

// Social marks (Lucide `facebook` / `linkedin`, line style to match the set).
export function FacebookIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </Line>
  );
}

export function LinkedInIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </Line>
  );
}
