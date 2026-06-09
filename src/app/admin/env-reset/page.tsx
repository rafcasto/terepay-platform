import { envResetEnabled } from '@/lib/flags/flags';
import EnvResetPanel from './_components/EnvResetPanel';

export default async function EnvResetPage() {
  const flagEnabled = await envResetEnabled();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-2xl font-semibold text-[#16263B]">Environment Reset</h1>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            Destructive
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Wipes all Firestore data and non-admin Auth users. Admin accounts and configuration are preserved.
          Controlled by a Vercel feature flag — off by default.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <svg
          className="h-5 w-5 text-amber-600 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800">Intended for development and staging only</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Do not enable the <span className="font-mono">env_reset_enabled</span> Vercel flag on the production
            project. This action is irreversible — deleted data cannot be recovered.
          </p>
        </div>
      </div>

      <EnvResetPanel flagEnabled={flagEnabled} />
    </div>
  );
}
