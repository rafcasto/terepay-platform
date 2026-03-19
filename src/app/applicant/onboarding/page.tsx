import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken, getAdminDb } from '@/lib/firebase/admin';
import Link from 'next/link';

export default async function OnboardingIntroPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;

  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) redirect('/auth/login');

  // If already complete, skip onboarding
  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(decoded.uid).get();
  const userData = userSnap.data();
  if (userData?.profileComplete) redirect('/applicant/dashboard');

  return (
    <div className="flex items-center justify-center min-h-full py-10 px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0D1B2A] mb-2">
          Welcome! Let&apos;s set up your account.
        </h1>
        <p className="text-gray-500 mb-8 text-sm sm:text-base">
          It should take a couple of minutes to complete your account setup. Make sure to have your
          government identification ready to go.
        </p>

        {/* Step overview cards */}
        <div className="space-y-4 mb-8">
          {/* Email — already verified */}
          <StepCard
            icon={<EmailIcon />}
            title={<span className="line-through text-gray-400">Email verification</span>}
            description={null}
            badge="Verified"
          />

          <StepCard
            icon={<MobileIcon />}
            title="Mobile verification"
            description="This helps us confirm your identity and prevent unauthorised access or usage of your account."
          />

          <StepCard
            icon={<ProfileIcon />}
            title="Complete profile"
            description="We take security seriously, so we need to get to know you a little better before you can start."
          />

          <StepCard
            icon={<IdIcon />}
            title="Identity verification"
            description="As a final security measure, we need to verify your ID. You'll need to upload a government-issued ID to complete this step."
          />
        </div>

        <Link
          href="/applicant/onboarding/verify-mobile"
          className="block w-full text-center bg-[#F5A523] hover:bg-[#E08B00] text-white font-semibold rounded-full py-3.5 px-6 transition-colors"
        >
          Continue
        </Link>
      </div>
    </div>
  );
}

function StepCard({
  icon,
  title,
  description,
  badge,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: string | null;
  badge?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {badge && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
    </div>
  );
}

function EmailIcon() {
  return (
    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
      <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    </div>
  );
}

function MobileIcon() {
  return (
    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
      <svg className="h-5 w-5 text-[#F5A523]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
      </svg>
    </div>
  );
}

function ProfileIcon() {
  return (
    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
      <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    </div>
  );
}

function IdIcon() {
  return (
    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
      <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
      </svg>
    </div>
  );
}
