import { ActionRow, Icons } from '@/components/ui';
import type { LoanDisplayState } from '@/lib/loan/status-display';

interface QuickActionsProps {
  state: LoanDisplayState;
  pendingAppId?: string | null;
}

export default function QuickActions({ state, pendingAppId }: QuickActionsProps) {
  const items: Array<{
    href: string;
    title: string;
    subtitle: string;
    icon: React.ReactElement;
    tone: 'amber' | 'info' | 'muted' | 'success' | 'danger';
  }> = [];

  if (state === 'active') {
    items.push(
      {
        href: pendingAppId ? `/applicant/applications/${pendingAppId}` : '/applicant/applications',
        title: 'View repayment schedule',
        subtitle: 'Each instalment is auto-debited on its due date',
        icon: <Icons.Calendar size={20} />,
        tone: 'amber',
      },
      {
        href: '/applicant/applications',
        title: 'Loan history',
        subtitle: 'View all past and active loans',
        icon: <Icons.History size={20} />,
        tone: 'muted',
      },
    );
  } else if (state === 'review' || state === 'approved') {
    if (pendingAppId) {
      items.push({
        href: `/applicant/applications/${pendingAppId}`,
        title: state === 'approved' ? 'Review your offer' : 'Track application',
        subtitle:
          state === 'approved'
            ? 'Accept or decline your loan offer'
            : 'See the current step and estimated timing',
        icon: <Icons.Receipt size={20} />,
        tone: state === 'approved' ? 'success' : 'amber',
      });
    }
    items.push({
      href: '/applicant/applications',
      title: 'All applications',
      subtitle: 'See past applications and decisions',
      icon: <Icons.History size={20} />,
      tone: 'muted',
    });
  } else if (state === 'rejected') {
    items.push(
      {
        href: '/applicant/apply',
        title: 'Apply again',
        subtitle: 'Start a fresh application',
        icon: <Icons.Refresh size={20} />,
        tone: 'amber',
      },
      {
        href: '/applicant/applications',
        title: 'Application history',
        subtitle: 'Review past applications',
        icon: <Icons.History size={20} />,
        tone: 'muted',
      },
    );
  } else if (state === 'paid') {
    items.push(
      {
        href: '/applicant/apply',
        title: 'Start a new loan',
        subtitle: 'Your repayment history is on your side',
        icon: <Icons.Sparkles size={20} />,
        tone: 'amber',
      },
      {
        href: '/applicant/applications',
        title: 'Loan history',
        subtitle: 'Download statements and view past loans',
        icon: <Icons.History size={20} />,
        tone: 'muted',
      },
    );
  } else {
    // new
    items.push(
      {
        href: '/applicant/apply',
        title: 'Apply for a loan',
        subtitle: 'Quick application · decision in 1–2 business days',
        icon: <Icons.Card size={20} />,
        tone: 'amber',
      },
      {
        href: '/applicant/profile',
        title: 'Update your profile',
        subtitle: 'Keep your details current for faster approvals',
        icon: <Icons.User size={20} />,
        tone: 'info',
      },
    );
  }

  return (
    <section className="space-y-2.5">
      <p className="text-[11.5px] font-display font-semibold tracking-[0.08em] text-brand-text uppercase">
        Quick actions
      </p>
      {items.map((it) => (
        <ActionRow
          key={it.title}
          href={it.href}
          icon={it.icon}
          iconTone={it.tone}
          title={it.title}
          subtitle={it.subtitle}
        />
      ))}
    </section>
  );
}
