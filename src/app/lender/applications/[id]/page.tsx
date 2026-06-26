import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type { DocumentStatus, DocumentType, LoanApplication, ScheduledPayment } from '@/types/application';
import type { PillTone } from '@/components/lender/ConsolePill';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';
import { computeApplicationFee } from '@/lib/constants/fees';
import { reconcileConsent } from '@/lib/qippay/reconcile-consent';
import LoanReview, { type ReviewData } from './_components/LoanReview';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  under_assessment: 'Under Assessment',
  waiting_for_docs: 'Waiting for Docs',
  credit_check: 'Credit Check',
  approved: 'Approved',
  loan_accepted: 'Loan Accepted',
  awaiting_payment_consent: 'Awaiting Bank Authorisation',
  offer_declined: 'Offer Declined',
  disbursed: 'Disbursed',
  active: 'Active',
  closed_repaid: 'Repaid',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

const STATUS_TONE: Record<string, PillTone> = {
  draft: 'neutral',
  pending_review: 'info',
  under_assessment: 'warning',
  waiting_for_docs: 'warning',
  credit_check: 'info',
  approved: 'success',
  loan_accepted: 'success',
  awaiting_payment_consent: 'warning',
  offer_declined: 'neutral',
  disbursed: 'success',
  active: 'success',
  closed_repaid: 'neutral',
  declined: 'danger',
  withdrawn: 'neutral',
  expired: 'neutral',
};

const DOC_LABEL: Record<DocumentType, string> = {
  passport: 'Passport',
  drivers_licence: 'NZ Driver Licence',
  visa: 'Visa document',
  payslip: 'Payslips',
  bank_statement: 'Bank statements',
  other: 'Document',
};

const KYC_DOC_LABEL: Record<string, string> = {
  nz_passport: 'NZ Passport',
  passport: 'Passport',
  nz_drivers_licence: 'NZ Driver Licence',
  drivers_licence: 'NZ Driver Licence',
  proof_of_address: 'Proof of address',
  visa: 'Visa document',
  birth_certificate: 'Birth certificate',
  selfie: 'Selfie / liveness photo',
};

const kycDocLabel = (t?: string) =>
  (t && KYC_DOC_LABEL[t]) ||
  (t ? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Document');

const KYC_STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted — awaiting review',
  approved: 'Verified',
  rejected: 'Rejected',
};

const KYC_STATUS_TONE: Record<string, PillTone> = {
  not_started: 'neutral',
  in_progress: 'warning',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
};

const VISA_LABEL: Record<string, string> = {
  work_visa: 'Work visa',
  resident_visa: 'Resident visa',
  student_visa: 'Student visa',
  citizen: 'Citizen',
  other: 'Other',
};

const ASSESSMENT_STATUSES = ['under_assessment', 'waiting_for_docs', 'credit_check'];

const fmt = (n?: number | null) =>
  typeof n === 'number'
    ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n)
    : '—';

type TS = { _seconds?: number; toDate?: () => Date } | null | undefined;

const fmtTs = (ts: TS) => {
  if (!ts) return '—';
  let d: Date;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts._seconds) d = new Date(ts._seconds * 1000);
  else return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

const fmtDate = (ts: TS) => {
  if (!ts) return '—';
  let d: Date;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts._seconds) d = new Date(ts._seconds * 1000);
  else return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' }).format(d);
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PAYMENT_STATUSES = new Set(['disbursed', 'active', 'closed_repaid']);

export default async function LenderApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('__session')?.value;
  if (!token) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(token).catch(() => null);
  if (!decoded || decoded.role !== 'lender') redirect('/auth/login');

  const db = getAdminDb();
  let snap = await db.collection('loanApplications').doc(id).get();
  if (!snap.exists) notFound();

  let app = { applicationId: snap.id, ...snap.data() } as LoanApplication;

  // Reconcile a SetPay mandate that is still in flight before rendering.
  if (app.status === 'awaiting_payment_consent') {
    const pc = app.paymentConsent;
    const nonTerminal =
      pc && pc.status !== 'active' && pc.status !== 'failed' &&
      pc.status !== 'expired' && pc.status !== 'cancelled';
    if (nonTerminal) {
      const reconciled = await reconcileConsent({
        applicationId: id,
        caller: 'lender',
        callerUid: decoded.uid,
      }).catch(() => null);
      if (reconciled?.status === 'active') {
        snap = await db.collection('loanApplications').doc(id).get();
        app = { applicationId: snap.id, ...snap.data() } as LoanApplication;
      }
    }
  }

  const status = app.status;
  const pi = app.personalInfo;
  const emp = app.employment;
  const ld = app.loanDetails;
  const fin = app.financialInformation;
  const expenses = app.livingExpenses;
  const debts = app.existingDebts;
  const isAssigned = app.assignedLenderId === decoded.uid;

  // ---- Borrower KYC (manual verification, attached to the profile) -------
  // KYC status lives on the user doc; the evidence documents are uploaded to
  // Google Drive with metadata in users/{uid}/applicantProfile/documents.
  let kycStatusRaw = 'not_started';
  let kycDocs: { docType?: string; fileName?: string; uploadedAt?: TS; status?: string }[] = [];
  let kycSubmittedAt: TS;
  if (app.applicantId) {
    try {
      const userRef = db.collection('users').doc(app.applicantId);
      const [userSnap, kycDocsSnap] = await Promise.all([
        userRef.get(),
        userRef.collection('applicantProfile').doc('documents').get(),
      ]);
      kycStatusRaw = (userSnap.data()?.kycStatus as string) ?? 'not_started';
      kycSubmittedAt = userSnap.data()?.kycSubmittedAt as TS;
      const docsData = kycDocsSnap.data()?.documents;
      if (Array.isArray(docsData)) kycDocs = docsData as typeof kycDocs;
    } catch {
      // Best-effort — KYC panel will show "not started" if the read fails.
    }
  }

  const name = pi ? `${pi.firstName ?? ''} ${pi.lastName ?? ''}`.trim() : '';
  const monthlyIncome = typeof fin?.monthlyIncome === 'number' ? fin.monthlyIncome : null;
  const monthlyExpenses = typeof fin?.monthlyExpenses === 'number' ? fin.monthlyExpenses : null;
  const monthlySurplus =
    monthlyIncome !== null && monthlyExpenses !== null ? monthlyIncome - monthlyExpenses : null;

  const documents = (app.documents ?? []).map((d) => ({
    title: DOC_LABEL[d.type] ?? 'Document',
    subtitle: d.fileName,
    status: d.status as DocumentStatus,
  }));
  const docsVerified = (app.documents ?? []).filter((d) => d.status === 'accepted').length;

  const employment = emp
    ? [
        { label: 'Occupation', value: emp.occupation || '—' },
        { label: 'Status', value: emp.employmentStatus?.replace(/_/g, ' ') ?? '—' },
        { label: 'Hours / week', value: emp.hoursPerWeek != null ? String(emp.hoursPerWeek) : '—' },
        { label: 'Time at employer', value: emp.timeAtEmployer || '—' },
        { label: 'Salary (after tax)', value: fmt(emp.income?.salaryAfterTax) },
        { label: 'WINZ', value: fmt(emp.income?.winz) },
        { label: 'Other income', value: fmt(emp.income?.otherIncome) },
      ]
    : [];

  const expenseRows = expenses?.nonDiscretionary
    ? Object.entries(expenses.nonDiscretionary)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ label: k.replace(/([A-Z])/g, ' $1').trim(), value: fmt(v) }))
    : [];

  const debtRows = debts
    ? (Object.entries(debts) as [string, { totalOwed: number; fortnightlyPayment: number }][])
        .filter(([k, v]) => k !== 'debtPurposeDescription' && !Array.isArray(v) && v?.totalOwed > 0)
        .map(([k, v]) => ({
          label: k.replace(/([A-Z])/g, ' $1').trim(),
          owed: fmt(v.totalOwed),
          fortnightly: fmt(v.fortnightlyPayment),
        }))
    : [];

  const notes = (app.internalNotes ?? []).map((n) => ({
    id: n.noteId,
    author: n.lenderName,
    date: fmtTs(n.createdAt as TS),
    text: n.text,
  }));

  const timeline = Object.entries(app.timeline ?? {}).map(([key, val]) => ({
    label: key.replace(/([A-Z])/g, ' $1').trim(),
    date: fmtTs(val as TS),
  }));

  const decision = app.decision
    ? {
        approved: app.decision.action === 'approved',
        approvedAmount: app.decision.approvedAmount ? fmt(app.decision.approvedAmount) : undefined,
        decidedAt: fmtTs(app.decision.decidedAt as TS),
        rationale: app.decision.rationale,
        declineReasons: app.decision.declineReasons,
      }
    : undefined;

  const applicantRejection =
    status === 'offer_declined' && app.applicantRejection
      ? {
          rejectedAt: fmtTs(app.applicantRejection.rejectedAt as TS),
          reason: app.applicantRejection.reason || 'No reason provided',
        }
      : undefined;

  const disburse =
    (status === 'loan_accepted' || status === 'awaiting_payment_consent') &&
    typeof ld?.approvedAmount === 'number'
      ? {
          approvedAmount: ld.approvedAmount,
          applicationFee: ld.applicationFee ?? 0,
          consentStatus:
            status === 'awaiting_payment_consent'
              ? (app.paymentConsent?.status ?? 'not_started')
              : undefined,
          consentActivatedAt: fmtTs(app.paymentConsent?.activatedAt as TS),
        }
      : undefined;

  // ---- Mocked panels (no backing endpoint/data yet) ---------------------
  // KYC verification and Centrix credit assessment are not yet integrated.
  // These are rendered greyed-out and clearly labelled as sample data.
  const kyc = {
    status: kycStatusRaw,
    statusLabel: KYC_STATUS_LABEL[kycStatusRaw] ?? kycStatusRaw,
    statusTone: KYC_STATUS_TONE[kycStatusRaw] ?? ('neutral' as PillTone),
    submittedAt: fmtDate(kycSubmittedAt),
    documents: kycDocs.map((d) => ({
      label: kycDocLabel(d.docType),
      fileName: d.fileName ?? '—',
      uploadedAt: fmtDate(d.uploadedAt as TS),
      status: d.status ?? 'pending_review',
    })),
  };
  const credit = {
    score: 643,
    band: 'Fair',
    min: 380,
    max: 800,
    defaults: 0,
    enquiries: 2,
    utilisation: '38%',
    dti: typeof fin?.debtToIncomeRatio === 'number' ? `${Math.round(fin.debtToIncomeRatio)}%` : '27%',
    pulled: 'sample',
  };

  const data: ReviewData = {
    applicationId: id,
    status,
    statusLabel: STATUS_LABELS[status] ?? status,
    statusTone: STATUS_TONE[status] ?? 'neutral',
    isAssigned,
    isExistingCustomer: Boolean(app.isExistingCustomer),
    header: {
      reference: app.referenceNumber ?? id,
      name: name || 'Applicant',
      initials: initialsOf(name || 'Applicant'),
      email: pi?.email ?? '',
      phone: pi?.phone ?? '',
      requested: fmt(ld?.requestedAmount),
      purpose: `${loanPurposeLabel(ld?.loanPurpose)}${ld?.purposeDescription ? ` · ${ld.purposeDescription}` : ''}`,
      submittedLabel: fmtDate(app.timeline?.submittedAt as TS),
    },
    snapshot: {
      dob: pi?.dateOfBirth ?? '—',
      address: pi ? `${pi.city ?? ''}${pi.city && pi.postCode ? ', ' : ''}${pi.postCode ?? ''}`.trim() || (pi.address ?? '—') : '—',
      visa: pi
        ? `${VISA_LABEL[pi.visaStatus] ?? pi.visaStatus?.replace(/_/g, ' ') ?? '—'}${pi.visaExpiryDate ? ` · valid to ${pi.visaExpiryDate}` : ''}`
        : '—',
      employer: emp?.employerName ?? '—',
      monthlyIncome: monthlyIncome !== null ? fmt(monthlyIncome) : '—',
      monthlyExpenses: monthlyExpenses !== null ? fmt(monthlyExpenses) : '—',
      monthlySurplus: monthlySurplus !== null ? fmt(monthlySurplus) : '—',
      surplusTone: monthlySurplus === null ? 'none' : monthlySurplus >= 0 ? 'pos' : 'neg',
    },
    documents,
    docsVerified,
    docsTotal: documents.length,
    affordability: {
      statusLabel: app.affordabilityStatus?.replace(/_/g, ' ') ?? 'not started',
      complete: app.affordabilityStatus === 'complete',
      assessmentCount: app.affordabilityAssessmentIds?.length ?? 0,
      canAssess: isAssigned && ASSESSMENT_STATUSES.includes(status),
      pdfUrl: `/api/applications/${id}/affordability/pdf`,
      assessUrl: `/lender/applications/${id}/affordability`,
    },
    estimatedFee: ld?.applicationFee !== undefined ? fmt(ld.applicationFee) : fmt(computeApplicationFee(app.isExistingCustomer)),
    feeIsEstimated: ld?.applicationFee === undefined,
    employment,
    expenses: expenseRows,
    debts: debtRows,
    notes,
    timeline,
    decision,
    applicantRejection,
    payments: {
      show: PAYMENT_STATUSES.has(status),
      scheduled: (app.scheduledPayments ?? []) as ScheduledPayment[],
    },
    disburse,
    decisionInput: {
      requestedAmount: ld?.requestedAmount ?? 0,
      assessedAmount: ld?.assessedAmount,
    },
    kyc,
    credit,
  };

  return <LoanReview data={data} />;
}
