import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken, getAdminDb } from '@/lib/firebase/admin';
import Link from 'next/link';
import { ButtonLink, Pill, Icons } from '@/components/ui';

export default async function OnboardingIntroPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) redirect('/auth/login');

  const db = getAdminDb();
  const [userSnap, profileSnap] = await Promise.all([
    db.collection('users').doc(decoded.uid).get(),
    db.collection('users').doc(decoded.uid).collection('applicantProfile').doc('profile').get(),
  ]);
  const userData = userSnap.data();
  if (userData?.profileComplete) redirect('/applicant/dashboard');

  let nextStep = '/applicant/onboarding/verify-email';
  if (userData?.emailVerified && !userData?.phoneVerified) {
    nextStep = '/applicant/onboarding/verify-mobile';
  } else if (userData?.emailVerified && userData?.phoneVerified && !profileSnap.exists) {
    nextStep = '/applicant/onboarding/profile';
  } else if (userData?.emailVerified && userData?.phoneVerified && profileSnap.exists) {
    nextStep = '/applicant/onboarding/identity';
  }

  return (
    <div className="flex items-center justify-center min-h-full py-10 px-4">
      <div className="w-full max-w-lg screen-in">
        <h1 className="text-[26px] sm:text-3xl font-bold tracking-tight text-text mb-2">
          Welcome! Let&apos;s set up your account.
        </h1>
        <p className="text-muted mb-8 text-sm sm:text-base leading-relaxed">
          It takes a couple of minutes. Make sure to have your government identification ready.
        </p>

        <div className="space-y-3 mb-8">
          <StepCard
            tone="info"
            icon={<Icons.Bell size={20} />}
            title="Email verification"
            description="We'll send a link to your email address to confirm it belongs to you."
            done={Boolean(userData?.emailVerified)}
            badge={userData?.emailVerified ? 'Verified' : undefined}
          />
          <StepCard
            tone="amber"
            icon={<Icons.MessageCircle size={20} />}
            title="Mobile verification"
            description="This helps us confirm your identity and prevent unauthorised access."
            done={Boolean(userData?.phoneVerified)}
            badge={userData?.phoneVerified ? 'Verified' : undefined}
          />
          <StepCard
            tone="info"
            icon={<Icons.User size={20} />}
            title="Complete profile"
            description="We take security seriously, so we need to get to know you a little better before you can start."
            done={profileSnap.exists}
            badge={profileSnap.exists ? 'Saved' : undefined}
            editHref={profileSnap.exists && !userData?.profileComplete ? '/applicant/onboarding/profile' : undefined}
          />
          <StepCard
            tone="success"
            icon={<Icons.ShieldCheck size={20} />}
            title="Identity verification"
            description="As a final security measure, you'll upload a government-issued ID to complete this step."
            done={Boolean(userData?.profileComplete)}
            badge={userData?.profileComplete ? 'Submitted' : undefined}
          />
        </div>

        <ButtonLink href={nextStep} fullWidth size="lg">
          Continue
        </ButtonLink>
      </div>
    </div>
  );
}

const tones = {
  amber: 'bg-accent-soft text-accent-2',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  muted: 'bg-surface-2 text-muted',
};

function StepCard({
  icon,
  title,
  description,
  badge,
  done,
  editHref,
  tone,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: string | null;
  badge?: string;
  done?: boolean;
  editHref?: string;
  tone: keyof typeof tones;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-4 shadow-soft-sm">
      <div className={`shrink-0 mt-0.5 h-10 w-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${done ? 'line-through text-muted' : 'text-text'}`}>{title}</p>
          {badge && <Pill tone="success">{badge}</Pill>}
          {editHref && (
            <Link
              href={editHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-2 hover:underline"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
              Edit
            </Link>
          )}
        </div>
        {description && <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>}
      </div>
    </div>
  );
}
