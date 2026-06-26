import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type { DocumentStatus, DocumentType, LoanApplication, ScheduledPayment } from '@/types/application';
import type { PillTone } from '@/components/lender/ConsolePill';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';
import { computeApplicationFee } from '@/lib/constants/fees';
import { reconcileConsent } from '@/lib/qippay/reconcile-consent';
import { toPlainScheduledPayments } from '@/lib/loan/active-loan';
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

  // ---- Lender-uploaded reports (stored on the customer profile) ----------
  // DataZoo (KYC) and Centrix (credit) reports are uploaded by the lender and
  // kept on the borrower's profile so they carry across future applications.
  type ReportItem = { id: string; fileName: string; uploadedAt: string; uploadedBy: string };
  type BorrowerKycDoc = {
    label: string;
    fileName: string;
    uploadedAt: string;
    status: string;
    downloadUrl: string;
  };
  const datazooReports: ReportItem[] = [];
  const centrixReports: ReportItem[] = [];
  const affordabilityReports: ReportItem[] = [];
  const borrowerKycDocuments: BorrowerKycDoc[] = [];

  // Identity documents the applicant uploaded with their application.
  const IDENTITY_TYPES = new Set<DocumentType>(['passport', 'drivers_licence', 'visa']);
  for (const d of app.documents ?? []) {
    if (!IDENTITY_TYPES.has(d.type)) continue;
    borrowerKycDocuments.push({
      label: DOC_LABEL[d.type] ?? 'Identity document',
      fileName: d.fileName,
      uploadedAt: fmtDate(d.uploadedAt as TS),
      status: d.status,
      downloadUrl: `/api/applications/${id}/documents/${d.documentId}`,
    });
  }

  if (app.applicantId) {
    try {
      const userRef = db.collection('users').doc(app.applicantId);
      const [repSnap, kycDocsSnap] = await Promise.all([
        userRef.collection('lenderReports').get(),
        userRef.collection('applicantProfile').doc('documents').get(),
      ]);
      repSnap.forEach((doc) => {
        const r = doc.data();
        const item: ReportItem = {
          id: doc.id,
          fileName: (r.fileName as string) ?? 'Report',
          uploadedAt: fmtDate(r.uploadedAt as TS),
          uploadedBy: (r.uploadedByName as string) ?? 'Lender',
        };
        if (r.provider === 'datazoo') datazooReports.push(item);
        else if (r.provider === 'centrix') centrixReports.push(item);
        else if (r.provider === 'affordability') affordabilityReports.push(item);
      });
      // Identity evidence captured during onboarding (if any).
      const onboardingDocs = kycDocsSnap.data()?.documents;
      if (Array.isArray(onboardingDocs)) {
        for (const d of onboardingDocs as Array<Record<string, unknown>>) {
          if (!d.driveFileId) continue;
          borrowerKycDocuments.push({
            label: kycDocLabel(d.docType as string | undefined),
            fileName: (d.fileName as string) ?? 'Document',
            uploadedAt: fmtDate(d.uploadedAt as TS),
            status: (d.status as string) ?? 'pending_review',
            downloadUrl: `/api/applications/${id}/kyc-documents/${d.driveFileId as string}`,
          });
        }
      }
    } catch {
      // Best-effort — panels show empty states on failure.
    }
  }

  const borrowerKycCount = borrowerKycDocuments.length;
  const borrowerAllAccepted =
    borrowerKycCount > 0 && borrowerKycDocuments.every((d) => d.status === 'accepted');
  const borrowerStatusLabel =
    borrowerKycCount === 0 ? 'Not provided' : borrowerAllAccepted ? 'Verified' : 'Provided';
  const borrowerStatusTone: PillTone =
    borrowerKycCount === 0 ? 'neutral' : borrowerAllAccepted ? 'success' : 'info';

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
  // KYC: the borrower uploads identity evidence at onboarding (downloadable by
  // the lender), and the lender runs the DataZoo identity check and uploads
  // that report — both kept on the customer profile and reused across apps.
  const kyc = {
    borrowerStatusLabel,
    borrowerStatusTone,
    borrowerDocuments: borrowerKycDocuments,
    reports: datazooReports,
  };
  const credit = {
    reports: centrixReports,
    affordabilityReports,
    score: 643,
    band: 'Fair',
    min: 380,
    max: 800,
    defaults: 0,
    enquiries: 2,
    utilisation: '38%',
    dti: typeof fin?.debtToIncomeRatio === 'number' ? `${Math.round(fin.debtToIncomeRatio)}%` : '27%',
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
      scheduled: toPlainScheduledPayments((app.scheduledPayments ?? []) as ScheduledPayment[]),
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
