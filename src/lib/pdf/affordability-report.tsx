import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { AffordabilityAssessment, LoanApplication } from '@/types/application';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const orange = '#E8651A';
const darkGray = '#374151';
const headerBg = '#4B5563';
const rowBg = '#F9FAFB';
const altRowBg = '#FFFFFF';
const noteBg = '#EFF6FF';
const noteBorder = '#93C5FD';
const warnBg = '#FFFBEB';
const warnBorder = '#F59E0B';

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 50, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 9, color: darkGray },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  headerTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  headerSub: { fontSize: 9, textAlign: 'right', color: '#6B7280' },
  fspLine: { fontSize: 8, color: '#6B7280', marginBottom: 6 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 10 },
  // Assessment note
  noteBox: { backgroundColor: noteBg, borderLeftWidth: 3, borderLeftColor: noteBorder, padding: 8, marginBottom: 14, fontSize: 8 },
  warnBox: { backgroundColor: warnBg, borderLeftWidth: 3, borderLeftColor: warnBorder, padding: 8, marginBottom: 8, fontSize: 8 },
  // Section
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: orange, marginBottom: 6, marginTop: 14 },
  sectionDivider: { borderBottomWidth: 1, borderBottomColor: orange, marginBottom: 10 },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: headerBg },
  tableHeaderCell: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 8, padding: 5, flex: 1 },
  tableRow: { flexDirection: 'row' },
  tableCell: { fontSize: 8, padding: 5, flex: 1 },
  tableCellBold: { fontSize: 8, padding: 5, flex: 1, fontFamily: 'Helvetica-Bold' },
  // Key-value overview
  overviewTable: { marginBottom: 8 },
  overviewRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  overviewKey: { width: '35%', backgroundColor: headerBg, color: '#FFFFFF', fontFamily: 'Helvetica-Bold', fontSize: 8, padding: 5 },
  overviewVal: { width: '65%', fontSize: 8, padding: 5 },
  // Sub heading
  subHeading: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 10, marginBottom: 4 },
  // Footer
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9CA3AF' },
  // Sign-off
  signatureBox: { borderWidth: 1, borderColor: '#E5E7EB', height: 40, marginTop: 4, marginBottom: 12 },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(val: number | undefined | null, decimals = 2): string {
  if (val == null) return '-';
  return `$${val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function fmtDate(d?: string | { toDate?: () => Date } | null): string {
  if (!d) return '-';
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object' && 'toDate' in d && typeof d.toDate === 'function') {
    return d.toDate().toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return '-';
}

function todayFmt(): string {
  return new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });
}

function refFromAssessment(a: AffordabilityAssessment): string {
  return `TERE-${a.applicationId.slice(-6).toUpperCase()}-V${a.version}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const TerePayLogo = () => (
  <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: orange }}>TerePay</Text>
);

const SectionTitle = ({ title }: { title: string }) => (
  <View>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionDivider} />
  </View>
);

const OverviewRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.overviewRow}>
    <Text style={styles.overviewKey}>{label}</Text>
    <Text style={styles.overviewVal}>{value}</Text>
  </View>
);

const TableHeaderRow = ({ cols }: { cols: string[] }) => (
  <View style={styles.tableHeader}>
    {cols.map((c, i) => <Text key={i} style={styles.tableHeaderCell}>{c}</Text>)}
  </View>
);

const TableRow = ({ cells, bold, shade }: { cells: string[]; bold?: number; shade?: boolean }) => (
  <View style={[styles.tableRow, { backgroundColor: shade ? rowBg : altRowBg }]}>
    {cells.map((c, i) => (
      <Text key={i} style={bold === i ? styles.tableCellBold : styles.tableCell}>{c}</Text>
    ))}
  </View>
);

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
const PageFooter = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>TerePay Neophile Limited | 27 Henry Partington Place, Greenhithe, Auckland | info@terepay.com | www.terepay.co.nz</Text>
    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

// ---------------------------------------------------------------------------
// Main Document
// ---------------------------------------------------------------------------
interface Props {
  assessment: AffordabilityAssessment;
  application: LoanApplication;
}

const AffordabilityReportDocument = ({ assessment, application }: Props) => {
  const pi = application.personalInfo;
  const emp = application.employment;
  const expenses = application.livingExpenses;
  const debts = application.existingDebts;
  const loanReq = application.loanRequest;
  const bank = application.bankDetails;

  const assessedAt = assessment.assessedAt as unknown as { toDate?: () => Date };
  const assessedAtStr = assessedAt?.toDate?.()
    ? assessedAt.toDate()!.toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' })
    : '-';

  // Household description
  const householdMap: Record<string, string> = {
    single: 'Single', single_children: 'Single + Children', couple: 'Couple', couple_children: 'Couple + Children',
  };
  const householdDesc = pi?.householdType ? (householdMap[pi.householdType] ?? pi.householdType) : '-';

  // Employment status
  const empStatusMap: Record<string, string> = {
    permanent: 'Permanent', fixed_term: 'Fixed Term', casual: 'Casual', part_time: 'Part-Time',
  };
  const empStatus = emp?.employmentStatus ? (empStatusMap[emp.employmentStatus] ?? emp.employmentStatus) : '-';

  // Visa
  const visaMap: Record<string, string> = {
    citizen: 'NZ Citizen', resident_visa: 'Permanent Resident', work_visa: 'Work Visa',
    student_visa: 'Student Visa', other: 'Other',
  };
  const visaStr = pi?.visaStatus ? (visaMap[pi.visaStatus] ?? pi.visaStatus) : '-';
  const visaFull = pi?.visaExpiryDate ? `${visaStr} - Expires ${pi.visaExpiryDate}` : visaStr;

  // Tenancy
  const tenancyMap: Record<string, string> = { rent: 'Renting', own: 'Owning', flatmates: 'Flatmates', other: 'Other' };
  const tenancy = pi?.housingStatus ? (tenancyMap[pi.housingStatus] ?? pi.housingStatus) : '-';

  // Income summary (use first incomeRow or employment data)
  const incomeRows = assessment.incomeRows ?? [];
  const totalVerifiedIncome = assessment.totalVerifiedIncome ?? 0;
  const totalExpenses = assessment.totalExpenses ?? 0;
  const netDisposableIncome = assessment.netDisposableIncome ?? 0;
  const loanFNPayment = assessment.loanFortnightlyPayment ?? 0;
  const finalSurplus = assessment.finalAvailableSurplus ?? 0;
  const isAffordable = finalSurplus >= 0;

  // Loan details
  const loanPrincipal = application.loanDetails?.requestedAmount ?? 0;
  const approvedAmount = application.loanDetails?.approvedAmount ?? loanPrincipal;
  const estFee = application.loanDetails?.applicationFee ?? 0;
  const totalRepayable = application.loanDetails?.totalRepayment ?? (approvedAmount + estFee);

  // Lender's decision label. `offer_declined` means the lender approved and the
  // applicant subsequently rejected — still reflect the lender's APPROVED decision.
  const approvedLenderStatuses = ['approved', 'loan_accepted', 'offer_declined', 'disbursed', 'active', 'closed_repaid'];
  const declinedLenderStatuses = ['declined', 'rejected'];
  const decisionLabel = approvedLenderStatuses.includes(application.status as string)
    ? 'APPROVED'
    : declinedLenderStatuses.includes(application.status as string)
      ? 'DECLINED'
      : 'PENDING';

  // Existing debts rows
  const debtRows: Array<{ type: string; total: number; fn: number }> = [];
  if (debts) {
    if (debts.mortgage?.totalOwed) debtRows.push({ type: 'Mortgage', total: debts.mortgage.totalOwed, fn: debts.mortgage.fortnightlyPayment });
    if (debts.personalLoans?.totalOwed) debtRows.push({ type: 'Personal Loan(s)', total: debts.personalLoans.totalOwed, fn: debts.personalLoans.fortnightlyPayment });
    if (debts.carLoans?.totalOwed) debtRows.push({ type: 'Car Loan(s)', total: debts.carLoans.totalOwed, fn: debts.carLoans.fortnightlyPayment });
    if (debts.creditCard?.totalOwed) debtRows.push({ type: 'Credit Card(s)', total: debts.creditCard.totalOwed, fn: debts.creditCard.fortnightlyPayment });
    if (debts.bankOverdrafts?.totalOwed) debtRows.push({ type: 'Overdraft(s)', total: debts.bankOverdrafts.totalOwed, fn: debts.bankOverdrafts.fortnightlyPayment });
    (debts.otherLoans ?? []).forEach(l => {
      if (l.totalOwed) debtRows.push({ type: l.description ?? 'Other Loan', total: l.totalOwed, fn: l.fortnightlyPayment });
    });
  }
  const totalDebtFN = debtRows.reduce((s, r) => s + r.fn, 0);

  // BNPL
  const bnpl = expenses?.bnpl;
  const bnplRows: Array<{ name: string; amount: number }> = [];
  if (bnpl) {
    if (bnpl.afterpay) bnplRows.push({ name: 'Afterpay', amount: bnpl.afterpay });
    if (bnpl.klarna) bnplRows.push({ name: 'Klarna', amount: bnpl.klarna });
    if (bnpl.zip) bnplRows.push({ name: 'Zip Co', amount: bnpl.zip });
  }

  // Expense rows
  const nd = expenses?.nonDiscretionary;
  const d = expenses?.discretionary;
  const nonDiscRows = nd ? [
    ['Food & Groceries', fmt(nd.food)],
    ['Utilities (power, water, internet)', fmt(nd.utilities)],
    ['Personal expenses (clothing, footwear)', fmt(nd.personalExpenses)],
    ['Transport (fuel, WoF/rego, maintenance)', fmt(nd.transport)],
    ['Medical', fmt(nd.medical)],
    ['Childcare / Dependants', fmt(nd.childcare)],
    ['Rent / Mortgage', fmt(nd.accommodation)],
    ['Health Insurance', fmt(nd.healthInsurance)],
    ['Car Insurance', fmt(nd.carInsurance)],
    ['Education', fmt(nd.education)],
    ['Remittances', fmt(nd.remittances)],
  ] : [];
  const nonDiscTotal = nd ? Object.values(nd).reduce((s, v) => s + (v ?? 0), 0) : 0;

  const discRows = d ? [
    ['Subscriptions (Netflix, Spotify, etc.)', fmt(d.subscriptions)],
    ['Travel / Holidays', fmt(d.travel)],
    ['Entertainment / Dining out', fmt((d.restaurants ?? 0) + (d.entertainment ?? 0))],
    ['Cash Withdrawals', fmt(d.cashWithdrawals)],
    ['Other', fmt(d.other)],
  ] : [];
  const discTotal = d ? Object.values(d).reduce((s, v) => s + (v ?? 0), 0) : 0;

  const surplusLabel = isAffordable
    ? `SURPLUS of ${fmt(finalSurplus)} FN - Affordability confirmed.`
    : `DEFICIT of ${fmt(Math.abs(finalSurplus))} FN - Approved subject to officer override and justification on file.`;

  return (
    <Document>
      {/* ------------------------------------------------------------------ */}
      {/* PAGE 1 – Header + Sections 1-2                                     */}
      {/* ------------------------------------------------------------------ */}
      <Page size="A4" style={styles.page}>
        <PageFooter />

        {/* Header */}
        <View style={styles.headerRow}>
          <TerePayLogo />
          <View>
            <Text style={styles.headerTitle}>AFFORDABILITY ASSESSMENT</Text>
            <Text style={[styles.headerTitle, { fontSize: 13 }]}>REPORT</Text>
            <Text style={styles.headerSub}>Date: {todayFmt()} | Ref: {refFromAssessment(assessment)}</Text>
          </View>
        </View>
        <Text style={styles.fspLine}>FSP1007414 | NZBN: 9429052055232</Text>
        <View style={styles.divider} />

        {/* Assessment Note box */}
        <View style={styles.noteBox}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>ⓘ ASSESSMENT NOTE (if applicable):</Text>
          <Text> Use this box to record any override, revision, or superseding information. Include reason for revision, the liability or item affected, and confirmation of the approving officer&apos;s decision.</Text>
        </View>

        {/* Section 1 – Client Overview */}
        <SectionTitle title="1. CLIENT OVERVIEW" />
        <View style={styles.overviewTable}>
          <OverviewRow label="Full Name" value={pi ? `${pi.firstName} ${pi.lastName}` : '-'} />
          <OverviewRow label="Date of Birth" value={pi?.dateOfBirth ?? '-'} />
          <OverviewRow label="Residential Address" value={pi ? `${pi.address}, ${pi.city} ${pi.postCode}` : '-'} />
          <OverviewRow label="Tenancy Status" value={tenancy} />
          <OverviewRow label="Household Type" value={householdDesc} />
          <OverviewRow label="No. of Dependants" value={pi ? `${pi.numberOfChildren} children, ${pi.numberOfDependents} total dependants` : '-'} />
          <OverviewRow label="Employer" value={emp?.employerName ?? '-'} />
          <OverviewRow label="Occupation" value={emp?.occupation ?? '-'} />
          <OverviewRow label="Employment Status" value={`${empStatus} - ${emp?.timeAtEmployer ?? '-'} at current employer`} />
          <OverviewRow label="Visa Status" value={visaFull} />
          <OverviewRow label="Loan Purpose" value={loanReq?.purposeDescription ?? loanPurposeLabel(application.loanDetails?.loanPurpose)} />
          <OverviewRow label="Amount Requested" value={`${fmt(loanPrincipal, 0)} - ${decisionLabel}`} />
          <OverviewRow label="AML/ID Verified" value={assessment.checklist.employmentVerificationMethod ?? '-'} />
          <OverviewRow label="PEP Status" value={loanReq?.isPEP ? 'Yes' : 'No'} />
        </View>

        {/* Section 2 – Income Verification */}
        <SectionTitle title="2. INCOME VERIFICATION" />
        <Text style={{ fontSize: 8, marginBottom: 6 }}>
          {`Income verified from ${assessment.checklist.payslipsReceived ? 'payslips' : 'stated income'} (${emp?.employerName ?? '-'}, Employment verified: ${assessment.checklist.employmentVerified ? 'Yes' : 'No'} via ${assessment.checklist.employmentVerificationMethod ?? '-'}).`}
        </Text>

        <TableHeaderRow cols={['Income Source', 'Centrix (FN)', 'Verified (FN)', 'Final (FN)']} />
        {incomeRows.map((row, i) => (
          <TableRow key={i} shade={i % 2 === 0}
            cells={[row.category, fmt(row.centrixAmount), fmt(row.verifiedAmount), fmt(row.finalAmount)]}
          />
        ))}
        {incomeRows.length === 0 && emp && (
          <TableRow shade cells={['Employment Income', fmt(emp.income.salaryAfterTax), '-', fmt(emp.income.salaryAfterTax), fmt(emp.income.salaryAfterTax)]} />
        )}
        <TableRow cells={['TOTAL VERIFIED (FN)', '', '', '', fmt(totalVerifiedIncome)]} bold={4} />

        <Text style={{ fontSize: 8, marginTop: 6 }}>
          {`Average Fortnightly Net Income (verified): ${fmt(totalVerifiedIncome)}`}
        </Text>
      </Page>

      {/* ------------------------------------------------------------------ */}
      {/* PAGE 2 – Sections 3-4                                              */}
      {/* ------------------------------------------------------------------ */}
      <Page size="A4" style={styles.page}>
        <PageFooter />
        <View style={styles.headerRow}>
          <TerePayLogo />
          <View>
            <Text style={styles.headerTitle}>AFFORDABILITY ASSESSMENT REPORT</Text>
            <Text style={styles.headerSub}>Date: {todayFmt()} | Ref: {refFromAssessment(assessment)}</Text>
          </View>
        </View>
        <Text style={styles.fspLine}>FSP1007414 | NZBN: 9429052055232</Text>
        <View style={styles.divider} />

        {/* Section 3 – Expense Assessment */}
        <SectionTitle title="3. EXPENSE ASSESSMENT" />

        <Text style={styles.subHeading}>3.1 Non-Discretionary Expenses (Fortnightly)</Text>
        <TableHeaderRow cols={['Category', 'Amount (FN)']} />
        {nonDiscRows.map(([cat, amt], i) => (
          <TableRow key={i} shade={i % 2 === 0} cells={[cat, amt]} />
        ))}
        <TableRow cells={['TOTAL Non-Discretionary', fmt(nonDiscTotal)]} bold={1} />

        <Text style={styles.subHeading}>3.2 Discretionary Expenses (Fortnightly)</Text>
        <TableHeaderRow cols={['Category', 'Amount (FN)']} />
        {discRows.map(([cat, amt], i) => (
          <TableRow key={i} shade={i % 2 === 0} cells={[cat, amt]} />
        ))}
        <TableRow cells={['TOTAL Discretionary', fmt(discTotal)]} bold={1} />

        {/* Section 4 – Existing Debts */}
        <SectionTitle title="4. EXISTING DEBTS & FINANCIAL COMMITMENTS" />
        <View style={styles.noteBox}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>ⓘ REVISION NOTE (if applicable):</Text>
          <Text> If any liability has been excluded or revised, document the reason here and confirm the approving officer&apos;s decision.</Text>
        </View>

        <TableHeaderRow cols={['Creditor / Type', 'Total Owed', 'FN Repayment', 'Included?']} />
        {debtRows.map((row, i) => (
          <TableRow key={i} shade={i % 2 === 0}
            cells={[row.type, fmt(row.total, 0), fmt(row.fn), 'YES - applicant\'s liability']}
          />
        ))}
        {bnplRows.map((row, i) => (
          <TableRow key={`bnpl-${i}`} shade={(debtRows.length + i) % 2 === 0}
            cells={[`BNPL - ${row.name}`, '-', fmt(row.amount), 'Noted / Included']}
          />
        ))}
        {(debtRows.length === 0 && bnplRows.length === 0) && (
          <TableRow shade cells={['No existing debts declared', '-', '-', '-']} />
        )}
        <TableRow cells={['TOTAL Debt Repayments (FN)', '', fmt(totalDebtFN), '']} bold={2} />
      </Page>

      {/* ------------------------------------------------------------------ */}
      {/* PAGE 3 – Sections 5-7                                              */}
      {/* ------------------------------------------------------------------ */}
      <Page size="A4" style={styles.page}>
        <PageFooter />
        <View style={styles.headerRow}>
          <TerePayLogo />
          <View>
            <Text style={styles.headerTitle}>AFFORDABILITY ASSESSMENT REPORT</Text>
            <Text style={styles.headerSub}>Date: {todayFmt()} | Ref: {refFromAssessment(assessment)}</Text>
          </View>
        </View>
        <Text style={styles.fspLine}>FSP1007414 | NZBN: 9429052055232</Text>
        <View style={styles.divider} />

        {/* Section 5 – Affordability Calculation */}
        <SectionTitle title="5. AFFORDABILITY CALCULATION" />

        <Text style={styles.subHeading}>{`5.1 TerePay Loan Cost - ${fmt(approvedAmount, 0)}`}</Text>
        <TableHeaderRow cols={['Component', 'Amount']} />
        <TableRow shade cells={['Loan Principal', fmt(approvedAmount)]} />
        <TableRow cells={['Application Fee', fmt(estFee)]} />
        <TableRow shade cells={['Total Repayable', fmt(totalRepayable)]} />
        <TableRow cells={['Repayment per Fortnight', fmt(loanFNPayment)]} bold={0} />

        <Text style={styles.subHeading}>5.2 Surplus / Deficit Analysis</Text>
        <TableHeaderRow cols={['Item', 'Fortnightly (NZD)']} />
        <TableRow shade cells={['Average Net Income (verified)', fmt(totalVerifiedIncome)]} />
        <TableRow cells={['Less: Non-Discretionary Expenses', `(${fmt(nonDiscTotal)})`]} />
        <TableRow shade cells={['Less: Discretionary Expenses', `(${fmt(discTotal)})`]} />
        <TableRow cells={['Less: Total Debt Repayments (FN)', `(${fmt(totalDebtFN)})`]} />
        <TableRow shade cells={['Surplus BEFORE TerePay Repayment', fmt(netDisposableIncome)]} bold={1} />
        <TableRow cells={['Less: TerePay Repayment', `(${fmt(loanFNPayment)})`]} />
        <TableRow shade cells={['Net Surplus AFTER TerePay Repayment', fmt(finalSurplus)]} bold={1} />

        <View style={[styles.warnBox, { marginTop: 8 }]}>
          <Text>{surplusLabel}</Text>
        </View>

        {/* Section 6 – Credit History */}
        <SectionTitle title={`6. CREDIT HISTORY (CENTRIX - ${assessment.checklist.centrixReportNumber ?? 'N/A'})`} />
        <TableHeaderRow cols={['Factor', 'Finding', 'Assessment']} />
        <TableRow shade cells={['Credit Report Ref', assessment.checklist.centrixReportNumber ?? '-', 'Noted']} />
        <TableRow cells={['Hard Decline Triggers', assessment.hardDeclineTriggers?.length > 0 ? assessment.hardDeclineTriggers.join('; ') : 'None', assessment.hardDeclineTriggers?.length > 0 ? 'TRIGGERED' : 'Clear']} />
        <TableRow shade cells={['Red Flags Raised', assessment.redFlagsRaised?.length > 0 ? assessment.redFlagsRaised.join('; ') : 'None', assessment.redFlagsRaised?.length > 0 ? 'Noted' : 'Clear']} />
        <TableRow cells={['Surplus Rating', assessment.surplusRating?.replace('_', ' ').toUpperCase() ?? '-', assessment.recommendation === 'proceed' ? 'Proceed' : 'Decline']} />
        <Text style={{ fontSize: 8, marginTop: 6, fontStyle: 'italic' }}>
          The credit risks noted above were considered by the approving officer in the context of the affordability position and the specific, identifiable loan purpose.
        </Text>

        {/* Section 7 – Assessment Decision */}
        <SectionTitle title="7. ASSESSMENT DECISION" />
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 6 }}>
          {`${decisionLabel} - ${fmt(approvedAmount, 0)} Loan`}
        </Text>
        <Text style={{ fontSize: 8, marginBottom: 8 }}>
          {application.decision?.rationale ?? 'Assessment completed. Refer to full application file for decision rationale.'}
        </Text>

        <Text style={styles.subHeading}>Loan Terms:</Text>
        <TableHeaderRow cols={['Component', 'Detail']} />
        <TableRow shade cells={['Approved Amount', fmt(approvedAmount)]} />
        <TableRow cells={['Application Fee', fmt(estFee)]} />
        <TableRow shade cells={['Total Repayable', fmt(totalRepayable)]} />
        <TableRow cells={['Repayment Schedule', loanFNPayment > 0 ? `Fortnightly payments of ${fmt(loanFNPayment)}` : '-']} />
        <TableRow shade cells={['Repayment Method', bank?.paymentMethod === 'direct_debit' ? `Direct Debit - ${bank.accountNumber ?? '-'}` : (bank?.paymentMethod ?? '-')]} />
      </Page>

      {/* ------------------------------------------------------------------ */}
      {/* PAGE 4 – Sections 8-9                                              */}
      {/* ------------------------------------------------------------------ */}
      <Page size="A4" style={styles.page}>
        <PageFooter />
        <View style={styles.headerRow}>
          <TerePayLogo />
          <View>
            <Text style={styles.headerTitle}>AFFORDABILITY ASSESSMENT REPORT</Text>
            <Text style={styles.headerSub}>Date: {todayFmt()} | Ref: {refFromAssessment(assessment)}</Text>
          </View>
        </View>
        <Text style={styles.fspLine}>FSP1007414 | NZBN: 9429052055232</Text>
        <View style={styles.divider} />

        {/* Section 8 – Regulatory Compliance */}
        <SectionTitle title="8. REGULATORY COMPLIANCE" />
        <TableHeaderRow cols={['Requirement', 'Status']} />
        <TableRow shade cells={['Reasonable Inquiries (CCCFA s.9C)', 'Completed']} />
        <TableRow cells={['Identity Verification (AML/CFT)', assessment.checklist.employmentVerificationMethod ? `${assessment.checklist.employmentVerificationMethod} sighted` : 'Completed']} />
        <TableRow shade cells={['Affordability Assessment', isAffordable ? 'Positive surplus confirmed' : 'Override on file']} />
        <TableRow cells={['Substantial Hardship Test', isAffordable ? 'Passed' : 'See notes']} />
        <TableRow shade cells={['Joint Liability Exclusion (if applicable)', 'N/A']} />
        <TableRow cells={['Record Keeping (CCCFA / Sept 2024 Guidance)', 'This document is the record']} />
        <TableRow shade cells={['Responsible Lending Code (July 2024)', 'Approval supported and documented']} />
        <TableRow cells={['Data Zoo AML/CFT Screening', 'Confirm completed separately']} />

        {/* Section 9 – Assessor Sign-Off */}
        <SectionTitle title="9. ASSESSOR SIGN-OFF" />
        <View style={styles.overviewTable}>
          <OverviewRow label="Assessed By" value={`${assessment.lenderName ?? '-'} - TerePay`} />
          <OverviewRow label="Approving Officer Override" value={assessment.redFlagsAcknowledged && Object.keys(assessment.redFlagsAcknowledged).length > 0 ? 'Yes - see red flags section' : 'No'} />
          <OverviewRow label="Assessment Date" value={assessedAtStr} />
          <OverviewRow label="Centrix Enquiry Ref" value={assessment.checklist.centrixReportNumber ?? '-'} />
          <OverviewRow label="TerePay Subscriber Ref" value={refFromAssessment(assessment)} />
          <OverviewRow label="Loan Amount Approved" value={fmt(approvedAmount)} />
          <OverviewRow label="Decision" value={decisionLabel} />
        </View>

        <Text style={styles.subHeading}>Approving Officer Signature</Text>
        <View style={styles.signatureBox} />
        <Text style={styles.subHeading}>Date</Text>
        <View style={[styles.signatureBox, { height: 24 }]} />

        <Text style={{ fontSize: 8, fontStyle: 'italic', marginTop: 12 }}>
          This assessment has been prepared in accordance with the CCCFA, the Responsible Lending Code (July 2024), and TerePay&apos;s internal affordability assessment procedures.
        </Text>
      </Page>
    </Document>
  );
};

// ---------------------------------------------------------------------------
// Export: server-side buffer generation
// ---------------------------------------------------------------------------
export async function generateAffordabilityPdf(
  assessment: AffordabilityAssessment,
  application: LoanApplication,
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <AffordabilityReportDocument assessment={assessment} application={application} />,
  );
  return Buffer.from(buffer);
}
