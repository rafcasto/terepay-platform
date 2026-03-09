import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type { LoanApplication } from '@/types/application';
import AffordabilityForm from './AffordabilityForm';

export const dynamic = 'force-dynamic';

interface BenchmarkEntry {
  benchmarkId: string;
  categoryName: string;
  fortnightlyAmount: number;
  isActive: boolean;
}

async function getApplicationAndBenchmarks(applicationId: string) {
  const db = getAdminDb();
  const [appSnap, benchmarksSnap] = await Promise.all([
    db.collection('loanApplications').doc(applicationId).get(),
    db.collection('benchmarks').where('isActive', '==', true).get(),
  ]);

  if (!appSnap.exists) return null;

  const application = { applicationId: appSnap.id, ...appSnap.data() } as LoanApplication;
  const benchmarks = benchmarksSnap.docs.map((d) => ({
    benchmarkId: d.id,
    ...(d.data() as Omit<BenchmarkEntry, 'benchmarkId'>),
  }));

  return { application, benchmarks };
}

export default async function AffordabilityPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  // Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get('__session')?.value;
  if (!token) redirect('/auth/login');

  let lenderUid: string;
  try {
    const decoded = await verifySessionOrIdToken(token);
    lenderUid = decoded.uid;
    if (decoded.role !== 'lender') redirect('/auth/login');
  } catch {
    redirect('/auth/login');
  }

  const data = await getApplicationAndBenchmarks(id);
  if (!data) notFound();

  const { application, benchmarks } = data;

  // Only the assigned lender can run affordability
  if (application.assignedLenderId !== lenderUid) {
    return (
      <div className="p-8 text-center text-red-600">
        <p className="font-semibold">Access denied.</p>
        <p className="text-sm mt-1">Only the assigned lender can complete the affordability assessment.</p>
        <Link href={`/lender/applications/${id}`} className="text-indigo-600 underline text-sm mt-4 inline-block">
          Back to application
        </Link>
      </div>
    );
  }

  // Allow assessment for under_assessment, waiting_for_docs, credit_check statuses
  const allowedStatuses = ['under_assessment', 'waiting_for_docs', 'credit_check'];
  if (!allowedStatuses.includes(application.status)) {
    return (
      <div className="p-8 text-center text-amber-700">
        <p className="font-semibold">Assessment not available</p>
        <p className="text-sm mt-1">
          Affordability assessment requires status: under_assessment, waiting_for_docs, or credit_check.
          Current status: <strong>{application.status}</strong>.
        </p>
        <Link href={`/lender/applications/${id}`} className="text-indigo-600 underline text-sm mt-4 inline-block">
          Back to application
        </Link>
      </div>
    );
  }

  const emp = application.employment;
  const expenses = application.livingExpenses;
  const debts = application.existingDebts;

  // Pre-fill income map (fortnightly — form stores fortnightly figures)
  const preFillIncome: Record<string, number> = {};
  if (emp?.income) {
    // Salary/Wages: convert monthly after-tax to fortnightly
    preFillIncome['Salary/Wages'] = emp.income.salaryAfterTax
      ? Math.round((emp.income.salaryAfterTax / 12) * 26) / 26 * 2
      : 0;
    preFillIncome['Government Benefits / WINZ'] = emp.income.winz ?? 0;
    preFillIncome['Other Income'] = emp.income.otherIncome ?? 0;
  }

  // Pre-fill expense map
  const preFillExpenses: Record<string, number> = {};
  if (expenses?.nonDiscretionary) {
    const nd = expenses.nonDiscretionary;
    preFillExpenses['Food & Groceries'] = nd.food ?? 0;
    preFillExpenses['Utilities'] = nd.utilities ?? 0;
    preFillExpenses['Personal/Clothing'] = nd.personalExpenses ?? 0;
    preFillExpenses['Transport'] = nd.transport ?? 0;
    preFillExpenses['Medical'] = nd.medical ?? 0;
    preFillExpenses['Childcare'] = nd.childcare ?? 0;
    preFillExpenses['Accommodation/Rent'] = nd.accommodation ?? 0;
    preFillExpenses['Health Insurance'] = nd.healthInsurance ?? 0;
    preFillExpenses['Car Insurance'] = nd.carInsurance ?? 0;
    preFillExpenses['Rates'] = nd.rates ?? 0;
    preFillExpenses['Education'] = nd.education ?? 0;
    preFillExpenses['Child Support'] = nd.childSupport ?? 0;
    preFillExpenses['Remittances'] = nd.remittances ?? 0;
  }
  if (expenses?.discretionary) {
    const d = expenses.discretionary;
    preFillExpenses['Restaurants/Takeaways'] = d.restaurants ?? 0;
    preFillExpenses['Entertainment'] = d.entertainment ?? 0;
    preFillExpenses['Travel'] = d.travel ?? 0;
    preFillExpenses['Home Improvement'] = d.homeImprovement ?? 0;
    preFillExpenses['Cash Withdrawals'] = d.cashWithdrawals ?? 0;
    preFillExpenses['Other'] = d.other ?? 0;
    // Subscriptions: sum up known subscriptions
    if (expenses.subscriptionDetails) {
      const subs = expenses.subscriptionDetails;
      preFillExpenses['Subscriptions'] =
        (subs.gym?.amount ?? 0) + (subs.netflix?.amount ?? 0) +
        (subs.spotify?.amount ?? 0) + (subs.sports?.amount ?? 0) +
        (subs.others?.amount ?? 0);
    }
  }
  if (expenses?.bnpl) {
    preFillExpenses['Buy Now Pay Later'] =
      (expenses.bnpl.afterpay ?? 0) + (expenses.bnpl.klarna ?? 0) + (expenses.bnpl.zip ?? 0);
  }
  if (debts) {
    const debtPayments =
      (debts.mortgage?.fortnightlyPayment ?? 0) +
      (debts.personalLoans?.fortnightlyPayment ?? 0) +
      (debts.carLoans?.fortnightlyPayment ?? 0) +
      (debts.creditCard?.fortnightlyPayment ?? 0) +
      (debts.bankOverdrafts?.fortnightlyPayment ?? 0) +
      (debts.otherLoans ?? []).reduce((s, l) => s + (l.fortnightlyPayment ?? 0), 0);
    preFillExpenses['Existing Debt Repayments'] = debtPayments;
  }

  const loanAmount = application.loanDetails?.requestedAmount ?? 0;
  const householdType = application.personalInfo?.householdType ?? 'single';
  const visaExpiryDate = application.personalInfo?.visaExpiryDate;

  // Use the benchmarks snapshot version — just use timestamp string
  const catalogVersionId = `benchmarks-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/lender/applications/${id}`}
            className="text-indigo-600 text-sm hover:underline inline-flex items-center gap-1"
          >
            ← Back to Application
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Affordability Assessment
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-500 text-sm">
              Application{' '}
              <span className="font-mono text-gray-700">
                {application.referenceNumber ?? id}
              </span>
              {' — '}
              <span className="font-medium text-gray-700">
                {application.personalInfo?.firstName ?? ''}{' '}
                {application.personalInfo?.lastName ?? ''}
              </span>
            </p>
            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
              {application.affordabilityStatus === 'complete' ? 'Re-assessment' : 'New Assessment'}
            </span>
          </div>
        </div>

        {/* Previous assessment warning */}
        {application.affordabilityStatus === 'complete' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm mb-6">
            <strong>Note:</strong> A completed assessment already exists. Submitting a new one will
            create a new version and mark the previous as superseded.
          </div>
        )}

        {/* Loan product summary */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-indigo-500 font-medium mb-0.5">Loan Amount</p>
            <p className="font-bold text-indigo-900">
              {new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(loanAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-indigo-500 font-medium mb-0.5">Interest Rate</p>
            <p className="font-bold text-indigo-900">4.7% / 8 weeks</p>
          </div>
          <div>
            <p className="text-xs text-indigo-500 font-medium mb-0.5">Repayments</p>
            <p className="font-bold text-indigo-900">4 × fortnightly</p>
          </div>
          <div>
            <p className="text-xs text-indigo-500 font-medium mb-0.5">Household</p>
            <p className="font-bold text-indigo-900 capitalize">{householdType.replace('_', ' + ')}</p>
          </div>
        </div>

        {/* Client form */}
        <AffordabilityForm
          applicationId={id}
          loanAmount={loanAmount}
          householdType={householdType}
          preFillIncome={preFillIncome}
          preFillExpenses={preFillExpenses}
          visaExpiryDate={visaExpiryDate}
          catalogVersionId={catalogVersionId}
        />
      </div>
    </div>
  );
}
