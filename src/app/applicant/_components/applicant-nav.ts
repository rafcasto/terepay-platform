import type { ComponentType, SVGProps } from 'react';
import { Icons } from '@/components/ui';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

export type ApplicantNavItem = {
  label: string;
  /** Optional shorter label for tight spaces (e.g. the mobile tab bar). */
  shortLabel?: string;
  description: string;
  Icon: IconComponent;
  /** Implemented destination. When omitted the item renders as a "Soon" placeholder. */
  href?: string;
  /** Path prefix that marks this item active. */
  match?: string;
};

// Borrower navigation (matches the design handoff). Items without an `href`
// are placeholders for views that aren't built yet — shown disabled with a
// "Soon" tag in both the mobile drawer and the desktop sidebar.
export const APPLICANT_NAV: ApplicantNavItem[] = [
  {
    label: 'Account',
    description: 'Your loan and dashboard',
    Icon: Icons.Wallet,
    href: '/applicant/dashboard',
    match: '/applicant/dashboard',
  },
  {
    label: 'Applications',
    description: 'Past and active applications',
    Icon: Icons.History,
    href: '/applicant/applications',
    match: '/applicant/applications',
  },
  {
    label: 'Profile',
    description: 'Edit your personal details',
    Icon: Icons.User,
    href: '/applicant/profile',
    match: '/applicant/profile',
  },
  { label: 'Repayments', description: 'Schedule and payment history', Icon: Icons.Calendar },
  { label: 'Documents', description: 'Agreement, disclosure & statements', Icon: Icons.File },
  { label: 'Help & support', shortLabel: 'Help', description: 'Questions about your loan or account', Icon: Icons.HelpCircle },
];

const byLabel = (label: string): ApplicantNavItem => {
  const item = APPLICANT_NAV.find((n) => n.label === label);
  if (!item) throw new Error(`Unknown applicant nav item: ${label}`);
  return item;
};

// Primary destinations for the fixed mobile bottom tab bar. The hamburger
// drawer still exposes the full nav (Profile, Help & support, etc.).
export const APPLICANT_TABS: ApplicantNavItem[] = [
  byLabel('Account'),
  byLabel('Applications'),
  byLabel('Repayments'),
  byLabel('Documents'),
];
