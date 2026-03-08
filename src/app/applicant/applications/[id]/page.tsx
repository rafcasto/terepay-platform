import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Badge from '@/components/shared/Badge';
import type { ApplicationStatus } from '@/types/application';
import SubmitButton from './SubmitButton';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

const STATUS_VARIANT: Record<ApplicationStatus, BadgeVariant> = {
  draft: 'default',
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  rejected: 'error',
  funded: 'success',
  completed: 'success',
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value ?? '—'}</dd>
    </div>
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const snap = await adminDb.collection('applications').doc(id).get();
  if (!snap.exists) notFound();

  const app = { id: snap.id, ...snap.data() } as Record<string, unknown> & { id: string };
  const status = app.status as ApplicationStatus;

  // Applicants can only see their own applications
  if (app.applicantId !== decoded.uid) notFound();

  const ld = app.loanDetails as {
    requestedAmount?: number;
    loanPurpose?: string;
    requestedTerm?: number;
    approvedAmount?: number;
    purposeDescription?: string;
  } | undefined;
  const fi = app.financialInformation as {
    monthlyIncome?: number;
    monthlyExpenses?: number;
    currentDebts?: number;
    savingsBalance?: number;
    incomeSource?: string;
    employmentType?: string;
  } | undefined;
  const la = app.lenderApproval as {
    approvedAmount?: number;
    interestRate?: number;
    term?: number;
    approvedAt?: { toDate?: () => Date };
    notes?: string;
    rejectionReason?: string;
  } | undefined;

  const fmt = (n?: number) =>
    n !== undefined ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) : '—';

  const fmtDate = (ts?: { toDate?: () => Date } | Date | null) => {
    if (!ts) return '—';
    const d = typeof (ts as { toDate?: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : (ts as Date);
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/applicant/applications" className="text-sm text-indigo-600 hover:underline">
          ← All Applications
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application #{app.applicationNumber as string}</h1>
          <p className="text-sm text-gray-500 mt-1">Created {fmtDate(app.createdAt as Parameters<typeof fmtDate>[0])}</p>
        </div>
        <Badge variant={STATUS_VARIANT[status]}>
          {(app.status as string).replace('_', ' ')}
        </Badge>
      </div>

      {/* Loan Details */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Loan Details</h2>
        <dl className="grid grid-cols-2 gap-5">
          <Field label="Requested Amount" value={fmt(ld?.requestedAmount)} />
          <Field label="Purpose" value={ld?.loanPurpose?.replace('_', ' ')} />
          <Field label="Term" value={ld?.requestedTerm != null ? `${ld.requestedTerm} months` : undefined} />
          <Field label="Approved Amount" value={ld?.approvedAmount != null ? fmt(ld.approvedAmount) : undefined} />
          <div className="col-span-2">
            <Field label="Description" value={ld?.purposeDescription as string | undefined} />
          </div>
        </dl>
      </section>

      {/* Financial Information */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Financial Information</h2>
        <dl className="grid grid-cols-2 gap-5">
          <Field label="Monthly Income" value={fmt(fi?.monthlyIncome)} />
          <Field label="Monthly Expenses" value={fmt(fi?.monthlyExpenses)} />
          <Field label="Current Debts" value={fmt(fi?.currentDebts)} />
          <Field label="Savings Balance" value={fmt(fi?.savingsBalance)} />
          <Field label="Income Source" value={fi?.incomeSource} />
          <Field label="Employment Type" value={fi?.employmentType} />
          <Field label="Debt-to-Income Ratio" value={app.debtToIncomeRatio != null ? `${((app.debtToIncomeRatio as number) * 100).toFixed(1)}%` : undefined} />
        </dl>
      </section>

      {/* Approval Terms (if approved) */}
      {la && (
        <section className="bg-green-50 border border-green-200 rounded-xl p-6 mb-4">
          <h2 className="font-semibold text-green-800 mb-4">Approval Terms</h2>
          <dl className="grid grid-cols-2 gap-5">
            <Field label="Approved Amount" value={fmt(la.approvedAmount)} />
            <Field label="Interest Rate" value={la.interestRate != null ? `${la.interestRate}%` : undefined} />
            <Field label="Term" value={la.term != null ? `${la.term} months` : undefined} />
            <Field label="Approved At" value={fmtDate(la.approvedAt ?? null)} />
            {la.notes && (
              <div className="col-span-2">
                <Field label="Lender Notes" value={la.notes as string} />
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Rejection Reason */}
      {status === 'rejected' && la?.rejectionReason && (
        <section className="bg-red-50 border border-red-200 rounded-xl p-6 mb-4">
          <h2 className="font-semibold text-red-800 mb-2">Rejection Reason</h2>
          <p className="text-sm text-red-700">{la.rejectionReason as string}</p>
        </section>
      )}

      {/* Actions */}
      {status === 'draft' && (
        <div className="flex gap-3 mt-6">
          <Link
            href={`/applicant/applications/${app.id}/edit`}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          <SubmitButton id={app.id} />
        </div>
      )}
    </div>
  );
}

