import { describe, expect, it } from 'vitest';
import { buildAccountDashboard, type AccountDashboardSource } from './account-dashboard';
import type { ScheduledPayment } from '@/types/application';

const TODAY = '2026-09-20';

function payment(
  installmentNumber: number,
  dueDate: string,
  status: ScheduledPayment['status'],
): ScheduledPayment {
  return { installmentNumber, dueDate, amountCents: 26186, status, retryCount: 0 };
}

function loan(
  id: string,
  payments: ScheduledPayment[],
  extra: Partial<AccountDashboardSource> = {},
): AccountDashboardSource {
  return {
    id,
    referenceNumber: `TP-2026-${id}`,
    status: 'active',
    loanDetails: {
      requestedAmount: 1000,
      currency: 'NZD',
      loanPurpose: 'other',
      purposeDescription: '',
      approvedAmount: 1000,
      totalRepayment: 1047.44,
    },
    scheduledPayments: payments,
    ...extra,
  } as AccountDashboardSource;
}

describe('buildAccountDashboard', () => {
  it('splits money lent on active loans from repayments received', () => {
    const d = buildAccountDashboard(
      [
        loan('1', [
          payment(1, '2026-09-01', 'success'),
          payment(2, '2026-09-15', 'success'),
          payment(3, '2026-09-29', 'scheduled'),
          payment(4, '2026-10-13', 'scheduled'),
        ]),
      ],
      TODAY,
    );

    expect(d.activeLoanCount).toBe(1);
    expect(d.lentCents).toBe(100000);
    expect(d.collectedActiveCents).toBe(52372);
    expect(d.outstandingCents).toBe(104744 - 52372);
    expect(d.pastDueCents).toBe(0);
    expect(d.attention).toEqual([]);
  });

  it('buckets by the oldest unpaid instalment: 1–3 late, 4–7 overdue, 8+ default', () => {
    const d = buildAccountDashboard(
      [
        loan('late', [payment(1, '2026-09-17', 'scheduled')]), // 3 days
        loan('overdue', [payment(1, '2026-09-16', 'scheduled')]), // 4 days
        loan('overdue7', [payment(1, '2026-09-13', 'scheduled')]), // 7 days
        loan('default', [payment(1, '2026-09-12', 'scheduled')]), // 8 days
        loan('dueToday', [payment(1, TODAY, 'scheduled')]),
      ],
      TODAY,
    );

    expect(d.categories.late.count).toBe(1);
    expect(d.categories.overdue.count).toBe(2);
    expect(d.categories.overdue_7_plus.count).toBe(1);
    expect(d.pastDueCents).toBe(4 * 26186);
    expect(d.attention.map((r) => r.applicationId)).toEqual([
      'default',
      'overdue7',
      'overdue',
      'late',
    ]);
  });

  it('flags failed and retrying debits as insufficient funds', () => {
    const d = buildAccountDashboard(
      [
        loan('retry', [payment(1, TODAY, 'retrying')]),
        loan('failed', [payment(1, '2026-09-10', 'failed')]),
      ],
      TODAY,
    );

    expect(d.categories.insufficient_funds).toEqual({ count: 2, amountCents: 52372 });
    expect(d.attention.find((r) => r.applicationId === 'failed')?.categories).toEqual([
      'overdue_7_plus',
      'insufficient_funds',
    ]);
  });

  it('counts an early payoff at the amount actually paid, not instalment face value', () => {
    const d = buildAccountDashboard(
      [
        loan(
          'early',
          [
            payment(1, '2026-09-01', 'success'),
            payment(2, '2026-09-15', 'success'),
            payment(3, '2026-09-29', 'success'),
            payment(4, '2026-10-13', 'success'),
          ],
          {
            status: 'closed_repaid',
            earlyRepayment: {
              status: 'paid',
              quote: { totalPayoffCents: 53000, installmentsCleared: [3, 4] },
            },
          } as Partial<AccountDashboardSource>,
        ),
      ],
      TODAY,
    );

    expect(d.categories.early_payment).toEqual({ count: 1, amountCents: 53000 });
    expect(d.collectedAllTimeCents).toBe(52372 + 53000);
    expect(d.activeLoanCount).toBe(0);
    expect(d.collectedActiveCents).toBe(0);
  });

  it('ignores applications that were never disbursed', () => {
    const d = buildAccountDashboard(
      [loan('pending', [payment(1, '2026-09-01', 'pending')], { status: 'approved' })],
      TODAY,
    );
    expect(d.activeLoanCount).toBe(0);
    expect(d.collectedAllTimeCents).toBe(0);
  });
});
