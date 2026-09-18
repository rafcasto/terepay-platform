import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type {
  ApplicationDocument,
  CommunicationLogEntry,
  DocumentStatus,
  DocumentType,
  LoanApplication,
  ScheduledPayment,
} from '@/types/application';
import type { PillTone } from '@/components/lender/ConsolePill';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';
import { computeApplicationFee } from '@/lib/constants/fees';
import { reconcileConsent } from '@/lib/qippay/reconcile-consent';
import { toPlainScheduledPayments } from '@/lib/loan/active-loan';
import {
  BANK_STATEMENT_REUSE_MONTHS,
  CREDIT_REPORT_REUSE_MONTHS,
  PAYSLIP_REUSE_MONTHS,
  evidenceAge,
  isWithinReuseWindow,
  reuseExpiry,
} from '@/lib/loan/evidence-reuse';
import LoanReview from './_components/LoanReview';
import type {
  ApplicantHistory,
  CommunicationItem,
  PreviousApplication,
  ReportItem,
  ReuseItem,
  ReviewData,
  ReviewableDocument,
} from './_components/review-types';

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

const IDENTITY_TYPES = new Set<DocumentType>(['passport', 'drivers_licence', 'visa']);
const INCOME_TYPES = new Set<DocumentType>(['payslip', 'bank_statement']);
const docKind = (t: DocumentType): ReviewableDocument['kind'] =>
  IDENTITY_TYPES.has(t) ? 'identity' : INCOME_TYPES.has(t) ? 'income' : 'other';

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

/** Onboarding docs use `pending_review`; normalise onto the application DocumentStatus. */
const normaliseDocStatus = (s?: string): DocumentStatus =>
  s === 'accepted' || s === 'approved' || s === 'verified'
    ? 'accepted'
    : s === 'rejected'
      ? 'rejected'
      : 'pending';

const VISA_LABEL: Record<string, string> = {
  work_visa: 'Work visa',
  resident_visa: 'Resident visa',
  student_visa: 'Student visa',
  citizen: 'Citizen',
  other: 'Other',
};

const ASSESSMENT_STATUSES = ['under_assessment', 'waiting_for_docs', 'credit_check'];
const REQUEST_DOCS_STATUSES = ['under_assessment', 'waiting_for_docs'];
const PAYMENT_STATUSES = new Set(['disbursed', 'active', 'closed_repaid']);
/** Statuses that count as a real previous loan (money went out). */
const LOAN_STATUSES = new Set(['disbursed', 'active', 'closed_repaid']);

const fmt = (n?: number | null) =>
  typeof n === 'number'
    ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n)
    : '—';

type TS = { _seconds?: number; toDate?: () => Date } | string | Date | null | undefined;

/** Firestore Timestamp / serialised timestamp / ISO string / Date → Date (or null). */
function toDate(ts: TS): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts._seconds) return new Date(ts._seconds * 1000);
  return null;
}

const fmtTs = (ts: TS) => {
  const d = toDate(ts);
  return d ? new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(d) : '—';
};

const fmtDate = (ts: TS) => {
  const d = toDate(ts);
  return d ? new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' }).format(d) : '—';
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildReuseItem(args: {
  key: string;
  label: string;
  fileName: string;
  fromLabel: string;
  date: Date;
  windowMonths: number | null;
  viewUrl: string;
}): ReuseItem {
  const age = evidenceAge(args.date);
  const base = {
    key: args.key,
    label: args.label,
    fileName: args.fileName,
    fromLabel: args.fromLabel,
    date: fmtDate(args.date),
    ageLabel: age.label,
    viewUrl: args.viewUrl,
  };
  if (args.windowMonths === null) return { ...base, reusable: null };
  return {
    ...base,
    reusable: isWithinReuseWindow(args.date, args.windowMonths),
    windowMonths: args.windowMonths,
    expiresLabel: fmtDate(reuseExpiry(args.date, args.windowMonths)),
  };
}

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
  const decided = Boolean(app.decision);

  // ---- Documents uploaded with this application -------------------------
  const documents: ReviewableDocument[] = (app.documents ?? []).map((d) => ({
    id: d.documentId,
    title: DOC_LABEL[d.type] ?? 'Document',
    subtitle: d.fileName,
    uploadedAt: fmtDate(d.uploadedAt as TS),
    status: d.status,
    viewUrl: `/api/applications/${id}/documents/${d.documentId}`,
    reviewUrl: `/api/applications/${id}/documents/${d.documentId}`,
    rejectionReason: d.rejectionReason || undefined,
    reviewedAt: d.reviewedAt ? fmtDate(d.reviewedAt as TS) : undefined,
    kind: docKind(d.type),
  }));
  const docsVerified = documents.filter((d) => d.status === 'accepted').length;
  const docsPending = documents.filter((d) => d.status === 'pending').length;

  // ---- Customer-profile data: lender reports + onboarding KYC docs ------
  type RawReport = ReportItem & { provider: string; date: Date | null; fromApplicationId?: string };
  const rawReports: RawReport[] = [];
  const borrowerKycDocuments: ReviewableDocument[] = [];

  if (app.applicantId) {
    try {
      const userRef = db.collection('users').doc(app.applicantId);
      const [repSnap, kycDocsSnap] = await Promise.all([
        userRef.collection('lenderReports').get(),
        userRef.collection('applicantProfile').doc('documents').get(),
      ]);
      repSnap.forEach((doc) => {
        const r = doc.data();
        rawReports.push({
          id: doc.id,
          provider: (r.provider as string) ?? '',
          fileName: (r.fileName as string) ?? 'Report',
          uploadedAt: fmtDate(r.uploadedAt as TS),
          uploadedBy: (r.uploadedByName as string) ?? 'Lender',
          date: toDate(r.uploadedAt as TS),
          fromApplicationId: r.uploadedFromApplicationId as string | undefined,
        });
      });
      const onboardingDocs = kycDocsSnap.data()?.documents;
      if (Array.isArray(onboardingDocs)) {
        for (const d of onboardingDocs as Array<Record<string, unknown>>) {
          const fileId = d.driveFileId as string | undefined;
          if (!fileId) continue;
          borrowerKycDocuments.push({
            id: fileId,
            title: kycDocLabel(d.docType as string | undefined),
            subtitle: (d.fileName as string) ?? 'Document',
            uploadedAt: fmtDate(d.uploadedAt as TS),
            status: normaliseDocStatus(d.status as string | undefined),
            viewUrl: `/api/applications/${id}/kyc-documents/${fileId}`,
            reviewUrl: `/api/applications/${id}/kyc-documents/${fileId}`,
            rejectionReason: (d.rejectionReason as string | null | undefined) || undefined,
            reviewedAt: d.reviewedAt ? fmtDate(d.reviewedAt as TS) : undefined,
            kind: 'identity',
          });
        }
      }
    } catch {
      // Best-effort — panels show empty states on failure.
    }
  }

  // Most recent first within each provider.
  rawReports.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  const byProvider = (p: string): ReportItem[] =>
    rawReports.filter((r) => r.provider === p).map(({ id, fileName, uploadedAt, uploadedBy }) => ({ id, fileName, uploadedAt, uploadedBy }));
  const datazooReports = byProvider('datazoo');
  const centrixReports = byProvider('centrix');
  const affordabilityReports = byProvider('affordability');

  const borrowerKycCount = borrowerKycDocuments.length;
  const borrowerAllAccepted =
    borrowerKycCount > 0 && borrowerKycDocuments.every((d) => d.status === 'accepted');
  const borrowerAnyRejected = borrowerKycDocuments.some((d) => d.status === 'rejected');
  const borrowerStatusLabel =
    borrowerKycCount === 0
      ? 'Not provided'
      : borrowerAllAccepted
        ? 'Verified'
        : borrowerAnyRejected
          ? 'Action needed'
          : 'Needs review';
  const borrowerStatusTone: PillTone =
    borrowerKycCount === 0 ? 'neutral' : borrowerAllAccepted ? 'success' : borrowerAnyRejected ? 'danger' : 'warning';

  // ---- Previous applications by the same customer ------------------------
  // Lets the lender reuse evidence (bank statements, payslips, credit report)
  // instead of asking a returning applicant for everything again.
  const previousApps: LoanApplication[] = [];
  try {
    const seen = new Set<string>([id]);
    const queries = [];
    if (app.applicantId) {
      queries.push(db.collection('loanApplications').where('applicantId', '==', app.applicantId).get());
    }
    if (app.offlineCustomerId) {
      queries.push(db.collection('loanApplications').where('offlineCustomerId', '==', app.offlineCustomerId).get());
    }
    const results = await Promise.all(queries);
    for (const qs of results) {
      qs.forEach((doc) => {
        if (seen.has(doc.id)) return;
        seen.add(doc.id);
        const data = { applicationId: doc.id, ...doc.data() } as LoanApplication;
        if (data.status === 'draft') return;
        previousApps.push(data);
      });
    }
    const sortKey = (a: LoanApplication) =>
      toDate((a.timeline?.submittedAt ?? a.timeline?.createdAt) as TS)?.getTime() ?? 0;
    previousApps.sort((a, b) => sortKey(b) - sortKey(a));
  } catch {
    // Best-effort — history panel shows nothing on failure.
  }

  const previous: PreviousApplication[] = previousApps.slice(0, 8).map((p) => ({
    id: p.applicationId,
    reference: p.referenceNumber ?? p.applicationId,
    statusLabel: STATUS_LABELS[p.status] ?? p.status,
    statusTone: STATUS_TONE[p.status] ?? 'neutral',
    amount: fmt(p.loanDetails?.approvedAmount ?? p.loanDetails?.requestedAmount),
    date: fmtDate((p.timeline?.submittedAt ?? p.timeline?.createdAt) as TS),
    href: `/lender/applications/${p.applicationId}`,
  }));

  const lastLoan = previousApps.find((p) => LOAN_STATUSES.has(p.status));
  const lastLoanLabel = lastLoan
    ? `${STATUS_LABELS[lastLoan.status] ?? lastLoan.status} · ${lastLoan.referenceNumber ?? lastLoan.applicationId} · ${fmt(
        lastLoan.loanDetails?.approvedAmount ?? lastLoan.loanDetails?.requestedAmount,
      )} · ${fmtDate((lastLoan.timeline?.disbursedAt ?? lastLoan.timeline?.submittedAt) as TS)}`
    : undefined;

  // Latest *accepted* document of a given type across previous applications.
  const latestAccepted = (type: DocumentType) => {
    let best: { doc: ApplicationDocument; app: LoanApplication; date: Date } | null = null;
    for (const p of previousApps) {
      for (const d of p.documents ?? []) {
        if (d.type !== type || d.status !== 'accepted') continue;
        const date = toDate(d.uploadedAt as TS);
        if (!date) continue;
        if (!best || date > best.date) best = { doc: d, app: p, date };
      }
    }
    return best;
  };

  const reuse: ReuseItem[] = [];
  const bank = latestAccepted('bank_statement');
  if (bank) {
    reuse.push(
      buildReuseItem({
        key: 'bank_statement',
        label: 'Bank statements',
        fileName: bank.doc.fileName,
        fromLabel: bank.app.referenceNumber ?? 'previous application',
        date: bank.date,
        windowMonths: BANK_STATEMENT_REUSE_MONTHS,
        viewUrl: `/api/applications/${bank.app.applicationId}/documents/${bank.doc.documentId}`,
      }),
    );
  }
  const pay = latestAccepted('payslip');
  if (pay) {
    reuse.push(
      buildReuseItem({
        key: 'payslip',
        label: 'Payslips',
        fileName: pay.doc.fileName,
        fromLabel: pay.app.referenceNumber ?? 'previous application',
        date: pay.date,
        windowMonths: PAYSLIP_REUSE_MONTHS,
        viewUrl: `/api/applications/${pay.app.applicationId}/documents/${pay.doc.documentId}`,
      }),
    );
  }
  const latestCentrix = rawReports.find((r) => r.provider === 'centrix' && r.date);
  if (latestCentrix?.date) {
    reuse.push(
      buildReuseItem({
        key: 'credit',
        label: 'Comprehensive credit report',
        fileName: latestCentrix.fileName,
        fromLabel: latestCentrix.fromApplicationId === id ? 'this application' : 'customer profile',
        date: latestCentrix.date,
        windowMonths: CREDIT_REPORT_REUSE_MONTHS,
        viewUrl: `/api/applications/${id}/reports/${latestCentrix.id}`,
      }),
    );
  }
  const latestDatazoo = rawReports.find((r) => r.provider === 'datazoo' && r.date);
  if (latestDatazoo?.date) {
    reuse.push(
      buildReuseItem({
        key: 'identity',
        label: 'DataZoo identity verification',
        fileName: latestDatazoo.fileName,
        fromLabel: latestDatazoo.fromApplicationId === id ? 'this application' : 'customer profile',
        date: latestDatazoo.date,
        windowMonths: null,
        viewUrl: `/api/applications/${id}/reports/${latestDatazoo.id}`,
      }),
    );
  }

  const history: ApplicantHistory = {
    previousCount: previousApps.length,
    previous,
    lastLoanLabel,
    reuse,
  };

  // ---- Communication log --------------------------------------------------
  const communications: CommunicationItem[] = ((app.communicationLog ?? []) as CommunicationLogEntry[])
    .map((c) => ({
      id: c.entryId,
      channel: c.channel,
      direction: c.direction,
      summary: c.summary,
      outcome: c.outcome || undefined,
      occurredAt: fmtTs(c.occurredAt as TS),
      loggedBy: c.loggedByName,
      _t: toDate(c.occurredAt as TS)?.getTime() ?? 0,
    }))
    .sort((a, b) => b._t - a._t)
    .map(({ _t, ...rest }) => {
      void _t;
      return rest;
    });

  // ---- Everything else ----------------------------------------------------
  const name = pi ? `${pi.firstName ?? ''} ${pi.lastName ?? ''}`.trim() : '';
  const monthlyIncome = typeof fin?.monthlyIncome === 'number' ? fin.monthlyIncome : null;
  const monthlyExpenses = typeof fin?.monthlyExpenses === 'number' ? fin.monthlyExpenses : null;
  const monthlySurplus =
    monthlyIncome !== null && monthlyExpenses !== null ? monthlyIncome - monthlyExpenses : null;

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
          bankDetails: app.bankDetails
            ? {
                bankName: app.bankDetails.bankName,
                accountHolderName: app.bankDetails.accountHolderName,
                accountNumber: app.bankDetails.accountNumber,
                paymentMethod: app.bankDetails.paymentMethod,
              }
            : undefined,
          consentStatus:
            status === 'awaiting_payment_consent'
              ? (app.paymentConsent?.status ?? 'not_started')
              : undefined,
          consentActivatedAt: fmtTs(app.paymentConsent?.activatedAt as TS),
        }
      : undefined;

  const documentRequest = app.documentRequest
    ? {
        requestedAt: fmtTs(app.documentRequest.requestedAt as TS),
        requiredDocuments: app.documentRequest.requiredDocuments ?? [],
        message: app.documentRequest.message || undefined,
        outstanding: status === 'waiting_for_docs',
      }
    : undefined;

  const kyc = {
    borrowerStatusLabel,
    borrowerStatusTone,
    borrowerDocuments: borrowerKycDocuments,
    reports: datazooReports,
  };
  // Credit summary metrics are still sample values until a report parser exists.
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
    canReviewDocs: isAssigned && !decided,
    canRequestDocs: isAssigned && REQUEST_DOCS_STATUSES.includes(status),
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
    docsPending,
    docsTotal: documents.length,
    documentRequest,
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
    history,
    communications,
  };

  return <LoanReview data={data} />;
}
