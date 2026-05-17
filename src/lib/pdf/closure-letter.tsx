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
  sigBlock: { marginTop: 30 },
  sigName: { fontFamily: 'Helvetica-Bold' },
  sigRole: { color: MUTED, fontSize: 9 },
  footer: { position: 'absolute', bottom: 28, left: 56, right: 56, fontSize: 7, color: MUTED, textAlign: 'center' },
});

const fmtNZD = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'long' }).format(date);
};

interface Props {
  loan: Loan;
  applicantName?: string;
  referenceNumber?: string;
  closedAt: string;
  generatedAt: Date;
}

const ClosureLetterDocument: React.FC<Props> = ({
  loan,
  applicantName,
  referenceNumber,
  closedAt,
  generatedAt,
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.brand}>TerePay</Text>
      <Text style={styles.brandSub}>Loan closure letter</Text>

      <Text style={styles.title}>Loan fully repaid</Text>
      <Text style={styles.meta}>Issued {fmtDate(generatedAt.toISOString())}</Text>

      <Text style={styles.para}>
        Kia ora {applicantName ?? 'there'},
      </Text>

      <Text style={styles.para}>
        This letter confirms that your TerePay loan{' '}
        {referenceNumber ?? loan.applicationId.slice(0, 8)} has been repaid in full as of{' '}
        {fmtDate(closedAt)}. Thank you for repaying on time — your account is now closed and
        in good standing.
      </Text>

      <View style={styles.summary}>
        <Text>Principal disbursed: {fmtNZD(loan.principal)}</Text>
        <Text>Total repaid: {fmtNZD(loan.totalPaid)}</Text>
        <Text>Closed on: {fmtDate(closedAt)}</Text>
      </View>

      <Text style={styles.para}>
        You may keep this letter for your records — it can be used as evidence of repayment
        for credit checks or other financial matters.
      </Text>

      <Text style={styles.para}>
        When you&apos;re ready for another loan, you&apos;ll qualify for our reduced existing-customer
        application fee.
      </Text>

      <View style={styles.sigBlock}>
        <Text style={styles.sigName}>TerePay</Text>
        <Text style={styles.sigRole}>Borrowing made transparent</Text>
      </View>

      <Text style={styles.footer}>
        TerePay · This letter was issued automatically. Reach out at support@terepay.co.nz if you have any questions.
      </Text>
    </Page>
  </Document>
);

export async function renderClosureLetter(props: Props): Promise<Buffer> {
  return renderToBuffer(<ClosureLetterDocument {...props} />);
}
