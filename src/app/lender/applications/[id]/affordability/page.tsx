import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type { LoanApplication } from '@/types/application';
import AffordabilityForm from './AffordabilityForm';

export const dynamic = 'force-dynamic';

async function getApplication(applicationId: string) {
  const db = getAdminDb();
  const appSnap = await db.collection('loanApplications').doc(applicationId).get();
  if (!appSnap.exists) return null;
  return { applicationId: appSnap.id, ...appSnap.data() } as LoanApplication;
}

async function getLenderName(lenderUid: string): Promise<string> {
  const db = getAdminDb();
  const snap = await db.collection('users').doc(lenderUid).get();
  if (!snap.exists) return 'Lender';
  const d = snap.data() as { firstName?: string; lastName?: string };
  return `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim() || 'Lender';
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

  const [application, lenderName] = await Promise.all([
    getApplication(id),
    getLenderName(lenderUid),
  ]);
  if (!application) notFound();

  // Only the assigned lender can run affordability
  if (application.assignedLenderId !== lenderUid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="font-semibold text-red-700">Access denied.</p>
          <p className="text-sm text-gray-600 mt-1">Only the assigned lender can complete this affordability assessment.</p>
          <Link href={`/lender/applications/${id}`} className="text-indigo-600 underline text-sm mt-4 inline-block">
            Back to application
          </Link>
        </div>
      </div>
    );
  }

  const allowedStatuses = ['under_assessment', 'waiting_for_docs', 'credit_check'];
  if (!allowedStatuses.includes(application.status)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="font-semibold text-amber-700">Assessment not available</p>
          <p className="text-sm text-gray-600 mt-1">
            Status must be <em>under_assessment</em>, <em>waiting_for_docs</em>, or <em>credit_check</em>.
            Current: <strong>{application.status}</strong>
          </p>
          <Link href={`/lender/applications/${id}`} className="text-indigo-600 underline text-sm mt-4 inline-block">
            Back to application
          </Link>
        </div>
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
    preFillIncome['Government Benefits'] = emp.income.winz ?? 0;
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
  const loanTerm = 8; // Fixed 8-week product
  const householdType = application.personalInfo?.householdType ?? 'single';
  const visaExpiryDate = application.personalInfo?.visaExpiryDate;
  const customerName =
    `${application.personalInfo?.firstName ?? ''} ${application.personalInfo?.lastName ?? ''}`.trim();
  const referenceNumber = application.referenceNumber ?? id;
  const today = new Date();
  const assessmentDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const catalogVersionId = `benchmarks-${today.toISOString().slice(0, 10)}`;
  const isReassessment = application.affordabilityStatus === 'complete';

  return (
    <AffordabilityForm
      applicationId={id}
      customerName={customerName}
      referenceNumber={referenceNumber}
      loanAmount={loanAmount}
      loanTerm={loanTerm}
      householdType={householdType}
      assessmentDate={assessmentDate}
      lenderName={lenderName}
      preFillIncome={preFillIncome}
      preFillExpenses={preFillExpenses}
      visaExpiryDate={visaExpiryDate}
      catalogVersionId={catalogVersionId}
      isReassessment={isReassessment}
    />
  );
}
