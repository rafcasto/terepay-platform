import Link from 'next/link';

const applyAction = {
  href: '/applicant/apply',
  label: 'Apply for a Loan',
  description: 'Get funds in as little as 24 hours',
  icon: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="1" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 9h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4" y="13" width="5" height="2" rx="1" fill="currentColor" />
    </svg>
  ),
  iconBg: 'bg-amber-50',
  iconColor: 'text-amber-600',
};

const viewBalanceAction = {
  href: '/applicant/applications',
  label: 'View Account Balance',
  description: 'Check your remaining balance and payment schedule',
  icon: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="1" y="5" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 9h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4" y="13" width="5" height="2" rx="1" fill="currentColor" />
    </svg>
  ),
  iconBg: 'bg-amber-50',
  iconColor: 'text-amber-600',
};

const STATIC_ACTIONS = [
  {
    href: '/applicant/applications',
    label: 'Make a Payment',
    description: 'Pay off your balance or schedule a payment',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M7 10.5C7 8.015 9.015 6 11.5 6c1.38 0 2.618.59 3.484 1.534M15 11.5c0 2.485-2.015 4.5-4.5 4.5a4.493 4.493 0 0 1-3.484-1.534" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M11.5 3v2M11.5 17v2M3 11.5h2M18 11.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    href: '/applicant/applications',
    label: 'Loan History',
    description: 'View all past and active loans',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <rect x="4" y="2" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7h6M8 11h6M8 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
];

interface QuickActionsProps {
  hasActiveLoan?: boolean;
}

export default function QuickActions({ hasActiveLoan = false }: QuickActionsProps) {
  const primaryAction = hasActiveLoan ? viewBalanceAction : applyAction;
  const actions = [primaryAction, ...STATIC_ACTIONS];

  return (
    <section>
      <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
        Quick Actions
      </p>
      <div className="space-y-2.5">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-4 bg-white rounded-xl px-4 py-4 hover:shadow-sm transition-shadow border border-gray-100"
          >
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${action.iconBg} ${action.iconColor}`}>
              {action.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{action.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-gray-300">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}
