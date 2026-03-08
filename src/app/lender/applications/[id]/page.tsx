import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Badge from '@/components/shared/Badge';
import type { ApplicationStatus } from '@/types/application';
import ApproveRejectForm from './ApproveRejectForm';

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

const fmt = (n?: number) =>
  n !== undefined
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
    : '—';

const fmtDate = (ts?: { toDate?: () => Date } | Date | null) => {
  if (!ts) return '—';
  const d = typeof (ts as { toDate?: () => Date }).toDate === 'function'
    ? (ts as { toDate: () => Date }).toDate()
    : (ts as Date);
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

export default async function LenderApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'lender') return null;

  const snap = await adminDb.collection('applications').doc(id).get();
  if (!snap.exists) notFound();

  const app = { id: snap.id, ...snap.data() } as Record<string, unknown> & { id: string };
  const status = app.status as ApplicationStatus;
  const ld = app.loanDetails as {
    requestedAmount?: number;
    loanPurpose?: string;
    requestedTerm?: number;
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

  if (status === 'draft') notFound();

  const actionable = status === 'submitted' || status === 'under_review';

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-4">
        <Link href="/lender/applications" className="text-sm text-indigo-600 hover:underline">
          ← All Applications
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Application #{app.applicationNumber as string}</h1>
          <p className="text-sm text-gray-500 mt-1">Submitted {fmtDate(app.submittedAt as Parameters<typeof fmtDate>[0])}</p>
        </div>
        <Badge variant={STATUS_VARIANT[status]}>
          {(status as string).replace('_', ' ')}
        </Badge>
      </div>

      {/* Loan Details */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">Loan Details</h2>
        <dl className="grid grid-cols-2 gap-5">
          <Field label="Requested Amount" value={fmt(ld?.requestedAmount)} />
          <Field label="Purpose" value={ld?.loanPurpose?.replace('_', ' ')} />
          <Field label="Requested Term" value={ld?.requestedTerm != null ? `${ld.requestedTerm} months` : undefined} />
          <Field label="Debt-to-Income" value={app.debtToIncomeRatio != null ? `${((app.debtToIncomeRatio as number) * 100).toFixed(1)}%` : undefined} />
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
        </dl>
      </section>

      {/* Approve / Reject Form */}
      {actionable && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Decision</h2>
          <ApproveRejectForm
            applicationId={id}
            requestedAmount={ld?.requestedAmount as number | undefined}
            requestedTerm={ld?.requestedTerm as number | undefined}
          />
        </section>
      )}

      {/* Already decided */}
      {la && !actionable && (
        <section
          className={`rounded-xl border p-6 mb-4 ${status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}
        >
          <h2 className={`font-semibold mb-4 ${status === 'rejected' ? 'text-red-800' : 'text-green-800'}`}>
            Decision
          </h2>
          <dl className="grid grid-cols-2 gap-5">
            {status !== 'rejected' && (
              <>
                <Field label="Approved Amount" value={fmt(la.approvedAmount)} />
                <Field label="Interest Rate" value={la.interestRate != null ? `${la.interestRate}%` : undefined} />
                <Field label="Term" value={la.term != null ? `${la.term} months` : undefined} />
              </>
            )}
            {la.rejectionReason && (
              <div className="col-span-2">
                <Field label="Rejection Reason" value={la.rejectionReason as string} />
              </div>
            )}
            {la.notes && (
              <div className="col-span-2">
                <Field label="Notes" value={la.notes as string} />
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
