import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { Loan } from '@/types/application';
import type { ActiveLoanSummary } from '@/lib/loan/active-loan';
import { ARREARS_POLICY } from '@/lib/loan/arrears-charges';
import { EARLY_REPAYMENT_FEE } from '@/lib/constants/fees';
import { fmtDate as fmtNzDate, fmtYmd } from '@/lib/loan/format';

// TerePay brand palette (mirrors the handoff tokens — kept inline since PDF
// renderer doesn't read CSS variables).
const ACCENT = '#f5a623';
const INK = '#0c1620';
const MUTED = '#6b7280';
const BORDER = '#e8eaee';
const SUCCESS = '#16a34a';
const DANGER = '#dc2626';

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontFamily: 'Helvetica', fontSize: 10, color: INK },
  // Header
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 2 },
  brandSub: { fontSize: 8, color: MUTED, marginBottom: 18 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  meta: { fontSize: 9, color: MUTED, marginBottom: 14 },
  // Summary card
  summaryBox: {
    backgroundColor: '#fef4e0',
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    padding: 12,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 9, color: MUTED },
  summaryValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: ACCENT,
  },
  // Callouts
  noteBox: {
    backgroundColor: '#f6f8fb',
    borderLeftWidth: 3,
    borderLeftColor: INK,
    padding: 10,
    marginBottom: 16,
  },
  noteTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  noteText: { fontSize: 8.5, color: MUTED, lineHeight: 1.45 },
  // Section
  sectionHeader: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 8, color: INK },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: INK, color: '#fff' },
  th: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8, padding: 6 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER },
  td: { fontSize: 9, padding: 6 },
  tdNote: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  totalRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: INK, marginTop: 2 },
  totalCell: { fontSize: 9, fontFamily: 'Helvetica-Bold', padding: 6 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 7,
    color: MUTED,
    textAlign: 'center',
  },
  policy: { fontSize: 7.5, color: MUTED, marginTop: 12, lineHeight: 1.45 },
});

const fmtNZD = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);
// ASCII hyphen: the built-in Helvetica has no glyph for U+2212.
const fmtSigned = (n: number) => (n < 0 ? `-${fmtNZD(-n)}` : fmtNZD(n));
const fmtDate = (d?: string | null) => fmtNzDate(d);
/** Ledger dates are either ISO datetimes or NZ calendar dates. */
const fmtLedgerDate = (d?: string) =>
  d ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? fmtYmd(d) : fmtNzDate(d)) : '';

export interface StatementProps {
  loan: Loan;
  /** Live derivation from the application — the source of truth for what was paid and charged. */
  summary: ActiveLoanSummary;
  /** Application fee deducted at disbursement, when known. */
  applicationFee?: number;
  applicantName?: string;
  referenceNumber?: string;
  generatedAt: Date;
}

function statusLabel(s: string, settledEarly: boolean): string {
  switch (s) {
    case 'paid':
      return settledEarly ? 'Settled early' : 'Paid';
    case 'overdue':
      return 'Overdue';
    case 'failed':
      return 'Failed';
    case 'retrying':
      return 'Retrying';
    case 'cancelled':
      return 'Cancelled';
    case 'scheduled':
    case 'upcoming':
      return 'Scheduled';
    default:
      return s;
  }
}

function statusColor(s: string): string {
  if (s === 'paid') return SUCCESS;
  if (s === 'overdue' || s === 'failed') return DANGER;
  return MUTED;
}

function loanStatusLabel(summary: ActiveLoanSummary, loan: Loan): string {
  if (summary.settledEarly) return 'Closed — settled early';
  if (summary.isFullyPaid) return 'Closed — repaid in full';
  if (summary.isDelinquent) return 'Active — payment overdue';
  return loan.status.replace(/_/g, ' ');
}

const LoanStatementDocument: React.FC<StatementProps> = ({
  loan,
  summary,
  applicationFee,
  applicantName,
  referenceNumber,
  generatedAt,
}) => {
  const { ledger, settlement, settledEarly } = summary;
  const cleared = new Set(settlement?.instalmentsCleared ?? []);
  const hasArrears = ledger.lateFees + ledger.defaultFee + ledger.overdueInterest > 0;
  const chargeLines = ledger.lines.filter((l) => l.kind !== 'principal');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>TerePay</Text>
        <Text style={styles.brandSub}>Loan statement</Text>

        <Text style={styles.title}>Loan {referenceNumber ?? loan.applicationId.slice(0, 8)}</Text>
        <Text style={styles.meta}>
          Issued to {applicantName ?? 'Customer'} · Generated {fmtDate(generatedAt.toISOString())}
        </Text>

        {/* Summary of account */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount borrowed</Text>
            <Text style={styles.summaryValue}>{fmtNZD(ledger.principal)}</Text>
          </View>
          {typeof applicationFee === 'number' && applicationFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid to your account (after {fmtNZD(applicationFee)} application fee)</Text>
              <Text style={styles.summaryValue}>{fmtNZD(loan.principal)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Interest charged</Text>
            <Text style={styles.summaryValue}>{fmtNZD(ledger.interestCharged)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fees charged</Text>
            <Text style={styles.summaryValue}>{fmtNZD(ledger.feesCharged)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total cost of loan</Text>
            <Text style={styles.summaryValue}>{fmtNZD(ledger.totalCost)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Paid to date</Text>
            <Text style={styles.summaryValue}>{fmtNZD(ledger.totalPaid)}</Text>
          </View>
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryLabel}>Balance owing{hasArrears && !settledEarly ? ' (including fees and overdue interest)' : ''}</Text>
            <Text style={styles.summaryValue}>{fmtNZD(ledger.outstanding)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Status</Text>
            <Text style={styles.summaryValue}>{loanStatusLabel(summary, loan)}</Text>
          </View>
        </View>

        {/* Early settlement working */}
        {settledEarly && settlement && (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>
              Settled early on {settlement.settlementDate ? fmtYmd(settlement.settlementDate) : fmtDate(settlement.settledAt)}
            </Text>
            <Text style={styles.noteText}>
              You paid {fmtNZD(settlement.amountPaid)} to settle instalment
              {settlement.instalmentsCleared.length === 1 ? '' : 's'} {settlement.instalmentsCleared.join(', ')} ahead of
              schedule. This covered
              {typeof settlement.outstandingPrincipal === 'number'
                ? ` the principal still owed (${fmtNZD(settlement.outstandingPrincipal)})`
                : ' the balance still owed'}
              {typeof settlement.accruedInterest === 'number' && typeof settlement.accrualDays === 'number'
                ? `, ${settlement.accrualDays} day${settlement.accrualDays === 1 ? '' : 's'} of interest since your last instalment (${fmtNZD(settlement.accruedInterest)})`
                : ''}
              , the {fmtNZD(settlement.fee)} early repayment fee
              {settlement.arrearsCharges > 0
                ? ` and ${fmtNZD(settlement.arrearsCharges)} in late fees and overdue interest already charged`
                : ''}
              . Interest stopped on the settlement date, so {fmtNZD(settlement.interestRebate)} of scheduled
              interest was not charged.
            </Text>
          </View>
        )}

        {/* Charges and credits */}
        <Text style={styles.sectionHeader}>Interest, fees and credits</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 1.2 }]}>Date</Text>
          <Text style={[styles.th, { flex: 3 }]}>Description</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Amount</Text>
        </View>
        {chargeLines.map((line) => (
          <View key={line.id} style={styles.row}>
            <Text style={[styles.td, { flex: 1.2 }]}>{fmtLedgerDate(line.date) || '—'}</Text>
            <View style={[styles.td, { flex: 3 }]}>
              <Text>{line.label}</Text>
              {line.note ? <Text style={styles.tdNote}>{line.note}</Text> : null}
            </View>
            <Text
              style={[
                styles.td,
                { flex: 1.2, textAlign: 'right', color: line.amount < 0 ? SUCCESS : INK },
              ]}
            >
              {fmtSigned(line.amount)}
            </Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={[styles.totalCell, { flex: 4.2 }]}>Total interest and fees</Text>
          <Text style={[styles.totalCell, { flex: 1.2, textAlign: 'right' }]}>
            {fmtNZD(ledger.interestCharged + ledger.feesCharged)}
          </Text>
        </View>

        {/* Repayment schedule */}
        <Text style={styles.sectionHeader}>Repayment schedule</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
          <Text style={[styles.th, { flex: 1.4 }]}>Due date</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Amount</Text>
          <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Status</Text>
        </View>
        {summary.installments.map((i) => {
          const clearedEarly = settledEarly && cleared.has(i.installmentNumber);
          return (
            <View key={i.installmentNumber} style={styles.row}>
              <Text style={[styles.td, { flex: 0.5 }]}>{i.installmentNumber}</Text>
              <Text style={[styles.td, { flex: 1.4 }]}>{fmtYmd(i.dueDate)}</Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: 'right' }]}>{fmtNZD(i.amount)}</Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: 'right', color: statusColor(i.status) }]}>
                {statusLabel(i.status, clearedEarly)}
              </Text>
            </View>
          );
        })}
        {settledEarly && settlement && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalCell, { flex: 3.1 }]}>
              Instalments {settlement.instalmentsCleared.join(', ')} replaced by early settlement
            </Text>
            <Text style={[styles.totalCell, { flex: 1.2, textAlign: 'right' }]}>{fmtNZD(settlement.amountPaid)}</Text>
          </View>
        )}

        <Text style={styles.policy}>
          Interest is charged at {ARREARS_POLICY.annualInterestRatePct}% a year on the reducing balance. If an instalment is
          not paid, a {fmtNZD(ARREARS_POLICY.lateFee)} late payment fee applies per instalment more than{' '}
          {ARREARS_POLICY.lateFeeGraceDays} days overdue (up to {fmtNZD(ARREARS_POLICY.lateFeeMax)} per loan), a one-off{' '}
          {fmtNZD(ARREARS_POLICY.defaultFee)} payment default fee applies after {ARREARS_POLICY.defaultFeeGraceDays} days,
          and interest accrues daily on the overdue balance. Repaying early stops interest on the settlement date and
          carries a fixed {fmtNZD(EARLY_REPAYMENT_FEE)} early repayment fee. If you are struggling to pay, contact us
          about hardship support.
        </Text>

        <Text style={styles.footer}>
          TerePay · Borrowing made transparent · This is a statement of account, not a tax invoice.
        </Text>
      </Page>
    </Document>
  );
};

export async function renderLoanStatement(props: StatementProps): Promise<Buffer> {
  return renderToBuffer(<LoanStatementDocument {...props} />);
}
