import CleanupPanel from './_components/CleanupPanel';

export const dynamic = 'force-dynamic';

export default function AdminCleanupPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Data cleanup</h1>
        <p className="text-sm text-slate-500 mt-1">
          Remove test or non-production borrowers and loan applications from this environment. Each deletion
          cascades to the borrower&apos;s applications, loan records, assessments and sign-in account, and is
          written to the audit log. Staff accounts are never touched here.
        </p>
      </div>
      <CleanupPanel />
    </div>
  );
}
