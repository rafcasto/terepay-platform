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
import { fmtDate as fmtNzDate, fmtYmd } from '@/lib/loan/format';

const ACCENT = '#f5a623';
const INK = '#0c1620';
const MUTED = '#6b7280';
const SUCCESS = '#16a34a';

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 56, fontFamily: 'Helvetica', fontSize: 11, color: INK, lineHeight: 1.55 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 2 },
  brandSub: { fontSize: 8, color: MUTED, marginBottom: 28 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 6, color: SUCCESS },
  meta: { fontSize: 9, color: MUTED, marginBottom: 20 },
  para: { marginBottom: 12 },
  summary: { backgroundColor: '#dcfce7', borderLeftWidth: 3, borderLeftColor: SUCCESS, padding: 14, marginVertical: 14, fontSize: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  summaryLabel: { color: MUTED },
  summaryValue: { fontFamily: 'Helvetica-Bold' },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: SUCCESS },
  sigBlock: { marginTop: 30 },
  sigName: { fontFamily: 'Helvetica-Bold' },
  sigRole: { color: MUTED, fontSize: 9 },
  footer: { position: 'absolute', bottom: 28, left: 56, right: 56, fontSize: 7, color: MUTED, textAlign: 'center' },
});

const fmtNZD = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);
const fmtDate = (d?: string | null) => fmtNzDate(d);

export interface ClosureLetterProps {
  loan: Loan;
  /** Live derivation from the application — the source of truth for what was paid and charged. */
  summary: ActiveLoanSummary;
  applicantName?: string;
  referenceNumber?: string;
  closedAt: string;
  generatedAt: Date;
}

const ClosureLetterDocument: React.FC<ClosureLetterProps> = ({
  loan,
  summary,
  applicantName,
  referenceNumber,
  closedAt,
  generatedAt,
}) => {
  const { ledger, settlement, settledEarly } = summary;
  const arrearsTotal = ledger.lateFees + ledger.defaultFee + ledger.overdueInterest;
  const hadArrears = arrearsTotal > 0;
  const settledOn = settlement?.settlementDate
    ? fmtYmd(settlement.settlementDate)
    : fmtDate(settlement?.settledAt ?? closedAt);
  const ref = referenceNumber ?? loan.applicationId.slice(0, 8);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>TerePay</Text>
        <Text style={styles.brandSub}>Loan closure letter</Text>

        <Text style={styles.title}>Loan fully repaid</Text>
        <Text style={styles.meta}>Issued {fmtDate(generatedAt.toISOString())}</Text>

        <Text style={styles.para}>Kia ora {applicantName ?? 'there'},</Text>

        {settledEarly && settlement ? (
          <Text style={styles.para}>
            This letter confirms that your TerePay loan {ref} was settled early and repaid in full on{' '}
            {settledOn}. Interest stopped on that date, so {fmtNZD(settlement.interestRebate)} of the
            interest in your original schedule was not charged. Your settlement payment of{' '}
            {fmtNZD(settlement.amountPaid)} included the fixed {fmtNZD(settlement.fee)} early repayment fee
            {settlement.arrearsCharges > 0
              ? ` and ${fmtNZD(settlement.arrearsCharges)} in late fees and overdue interest already charged`
              : ''}
            . Your account is now closed and in good standing.
          </Text>
        ) : hadArrears ? (
          <Text style={styles.para}>
            This letter confirms that your TerePay loan {ref} has been repaid in full as of {fmtDate(closedAt)}.
            Because one or more instalments were paid late, your repayments included {fmtNZD(arrearsTotal)} in
            late payment fees, default fees and interest on the overdue balance, as set out below. Your
            account is now closed.
          </Text>
        ) : (
          <Text style={styles.para}>
            This letter confirms that your TerePay loan {ref} has been repaid in full as of {fmtDate(closedAt)}.
            Thank you for repaying on time — your account is now closed and in good standing.
          </Text>
        )}

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount borrowed</Text>
            <Text style={styles.summaryValue}>{fmtNZD(ledger.principal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Interest charged</Text>
            <Text style={styles.summaryValue}>{fmtNZD(ledger.interestCharged)}</Text>
          </View>
          {ledger.earlyRepaymentFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Early repayment fee</Text>
              <Text style={styles.summaryValue}>{fmtNZD(ledger.earlyRepaymentFee)}</Text>
            </View>
          )}
          {ledger.lateFees > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Late payment fee{ledger.lateFeeCount === 1 ? '' : `s (${ledger.lateFeeCount})`}
              </Text>
              <Text style={styles.summaryValue}>{fmtNZD(ledger.lateFees)}</Text>
            </View>
          )}
          {ledger.defaultFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment default fee</Text>
              <Text style={styles.summaryValue}>{fmtNZD(ledger.defaultFee)}</Text>
            </View>
          )}
          {ledger.overdueInterest > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Interest on overdue balance</Text>
              <Text style={styles.summaryValue}>{fmtNZD(ledger.overdueInterest)}</Text>
            </View>
          )}
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryLabel}>Total repaid</Text>
            <Text style={styles.summaryValue}>{fmtNZD(ledger.totalPaid)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Closed on</Text>
            <Text style={styles.summaryValue}>{settledEarly ? settledOn : fmtDate(closedAt)}</Text>
          </View>
        </View>

        <Text style={styles.para}>
          You may keep this letter for your records — it can be used as evidence of repayment for credit
          checks or other financial matters. Your full statement of account is available from your TerePay
          dashboard.
        </Text>

        <Text style={styles.para}>
          When you&apos;re ready for another loan, you&apos;ll qualify for our reduced existing-customer
          application fee. All loans are charged interest.
        </Text>

        <View style={styles.sigBlock}>
          <Text style={styles.sigName}>TerePay</Text>
          <Text style={styles.sigRole}>Borrowing made transparent</Text>
        </View>

        <Text style={styles.footer}>
          TerePay · This letter was issued automatically. Reach out at support@terepay.com if you have any questions.
        </Text>
      </Page>
    </Document>
  );
};

export async function renderClosureLetter(props: ClosureLetterProps): Promise<Buffer> {
  return renderToBuffer(<ClosureLetterDocument {...props} />);
}
