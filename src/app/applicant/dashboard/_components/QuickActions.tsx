import { ActionRow, Icons } from '@/components/ui';
import type { LoanDisplayState } from '@/lib/loan/status-display';
import { withDefaults, type ContentSectionValues } from '@/types/content';

interface QuickActionsProps {
  state: LoanDisplayState;
  pendingAppId?: string | null;
  /** Editable `borrower.status.<state>` section (defaults applied if absent). */
  content?: ContentSectionValues;
  /** Editable section heading (from `borrower.dashboard`). */
  heading?: string;
}

export default function QuickActions({ state, pendingAppId, content, heading }: QuickActionsProps) {
  const c = withDefaults(`borrower.status.${state}`, content);
  const items: Array<{
    href: string;
    title: string;
    subtitle: string;
    icon: React.ReactElement;
    tone: 'amber' | 'info' | 'muted' | 'success' | 'danger';
  }> = [];

  if (state === 'active') {
    items.push({
      href: pendingAppId ? `/applicant/applications/${pendingAppId}` : '/applicant/dashboard',
      title: c.actionTitle,
      subtitle: c.actionSubtitle,
      icon: <Icons.Calendar size={20} />,
      tone: 'amber',
    });
  } else if (state === 'review' || state === 'approved') {
    if (pendingAppId) {
      items.push({
        href: `/applicant/applications/${pendingAppId}`,
        title: c.actionTitle,
        subtitle: c.actionSubtitle,
        icon: <Icons.Receipt size={20} />,
        tone: state === 'approved' ? 'success' : 'amber',
      });
    }
  } else if (state === 'rejected') {
    items.push({
      href: '/applicant/apply',
      title: c.actionTitle,
      subtitle: c.actionSubtitle,
      icon: <Icons.Refresh size={20} />,
      tone: 'amber',
    });
  } else if (state === 'paid') {
    items.push({
      href: '/applicant/apply',
      title: c.actionTitle,
      subtitle: c.actionSubtitle,
      icon: <Icons.Sparkles size={20} />,
      tone: 'amber',
    });
  } else {
    // new (and draft, which shares the "new" actions)
    const n = withDefaults('borrower.status.new', state === 'new' ? content : undefined);
    items.push(
      {
        href: '/applicant/apply',
        title: n.action1Title,
        subtitle: n.action1Subtitle,
        icon: <Icons.Card size={20} />,
        tone: 'amber',
      },
      {
        href: '/applicant/profile',
        title: n.action2Title,
        subtitle: n.action2Subtitle,
        icon: <Icons.User size={20} />,
        tone: 'info',
      },
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <p className="text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">
        {heading ?? withDefaults('borrower.dashboard', undefined).quickActionsHeading}
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
