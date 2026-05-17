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

// TerePay brand palette (mirrors the handoff tokens — kept inline since PDF
// renderer doesn't read CSS variables).
const ACCENT = '#f5a623';
const INK = '#0c1620';
const MUTED = '#6b7280';
const BORDER = '#e8eaee';
const SUCCESS = '#16a34a';
const DANGER = '#dc2626';

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 48, paddingHorizontal: 48, fontFamily: 'Helvetica', fontSize: 10, color: INK },
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
  // Section
  sectionHeader: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 8, color: INK },
  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: INK, color: '#fff' },
  th: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8, padding: 6 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER },
  td: { fontSize: 9, padding: 6 },
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
});

const fmtNZD = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' }).format(date);
};

interface StatementProps {
  loan: Loan;
  applicantName?: string;
  referenceNumber?: string;
  generatedAt: Date;
}

function statusLabel(s: string): string {
  switch (s) {
    case 'paid':
      return 'Paid';
    case 'overdue':
      return 'Overdue';
    case 'retrying':
      return 'Retrying';
    case 'scheduled':
      return 'Scheduled';
    default:
      return s;
  }
}

function statusColor(s: string): string {
  if (s === 'paid') return SUCCESS;
  if (s === 'overdue') return DANGER;
  return MUTED;
}

const LoanStatementDocument: React.FC<StatementProps> = ({
  loan,
  applicantName,
  referenceNumber,
  generatedAt,
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.brand}>TerePay</Text>
      <Text style={styles.brandSub}>Loan statement</Text>

      <Text style={styles.title}>
        Loan {referenceNumber ?? loan.applicationId.slice(0, 8)}
      </Text>
      <Text style={styles.meta}>
        Issued to {applicantName ?? 'Customer'} · Generated {fmtDate(generatedAt.toISOString())}
      </Text>

      <View style={styles.summaryBox}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Principal disbursed</Text>
          <Text style={styles.summaryValue}>{fmtNZD(loan.principal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total repayable</Text>
          <Text style={styles.summaryValue}>{fmtNZD(loan.totalRepayable)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Paid to date</Text>
          <Text style={styles.summaryValue}>{fmtNZD(loan.totalPaid)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Remaining balance</Text>
          <Text style={styles.summaryValue}>{fmtNZD(loan.remainingBalance)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Status</Text>
          <Text style={styles.summaryValue}>{loan.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Repayment schedule</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, { flex: 0.5 }]}>#</Text>
        <Text style={[styles.th, { flex: 1.4 }]}>Due date</Text>
        <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Amount</Text>
        <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Status</Text>
      </View>
      {loan.installments.map((i) => (
        <View key={i.installmentNumber} style={styles.row}>
          <Text style={[styles.td, { flex: 0.5 }]}>{i.installmentNumber}</Text>
          <Text style={[styles.td, { flex: 1.4 }]}>{fmtDate(i.dueDate)}</Text>
          <Text style={[styles.td, { flex: 1.2, textAlign: 'right' }]}>{fmtNZD(i.amount)}</Text>
          <Text
            style={[
              styles.td,
              { flex: 1, textAlign: 'right', color: statusColor(i.status) },
            ]}
          >
            {statusLabel(i.status)}
          </Text>
        </View>
      ))}

      <Text style={styles.footer}>
        TerePay · Borrowing made transparent · This is a statement of account, not a tax invoice.
      </Text>
    </Page>
  </Document>
);

export async function renderLoanStatement(props: StatementProps): Promise<Buffer> {
  return renderToBuffer(<LoanStatementDocument {...props} />);
}
