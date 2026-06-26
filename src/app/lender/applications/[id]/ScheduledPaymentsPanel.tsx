'use client';

import { useState, useTransition } from 'react';
import type { ScheduledPayment } from '@/types/application';
import ConsoleIcon from '@/components/lender/ConsoleIcon';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';

type Props = {
  applicationId: string;
  scheduledPayments: ScheduledPayment[];
};

const STATUS_CONFIG: Record<
  ScheduledPayment['status'],
  { label: string; tone: PillTone }
> = {
  pending:   { label: 'Pending',   tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'info'    },
  success:   { label: 'Paid',      tone: 'success' },
  retrying:  { label: 'Retrying',  tone: 'warning' },
  failed:    { label: 'Failed',    tone: 'danger'  },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const fmtNzd = (cents: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(
    cents / 100,
  );

export default function ScheduledPaymentsPanel({
  applicationId,
  scheduledPayments: initial,
}: Props) {
  const [payments, setPayments] = useState<ScheduledPayment[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckStatus = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/payment-status`);
        const body = await res.json();
        if (!res.ok) {
          setError(body.error?.message ?? 'Failed to check payment status');
          return;
        }
        if (body.data?.scheduledPayments) {
          setPayments(body.data.scheduledPayments);
        }
        setLastChecked(new Date().toLocaleTimeString('en-NZ'));
      } catch {
        setError('Network error — could not check payment status');
      }
    });
  };

  const paidCount = payments.filter((p) => p.status === 'success').length;
  const failedCount = payments.filter((p) => p.status === 'failed').length;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-[var(--text-strong)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--orange-50)] text-[var(--orange-700)]">
              <ConsoleIcon name="wallet" size={16} />
            </span>
            Scheduled Repayments
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {paidCount} of {payments.length} paid
            {failedCount > 0 && (
              <span className="ml-2 font-semibold text-[var(--danger-700)]">· {failedCount} failed</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastChecked && (
            <span className="text-xs text-[var(--text-muted)]">Checked {lastChecked}</span>
          )}
          <button
            onClick={handleCheckStatus}
            disabled={isPending}
            className="rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--slate-400)] border-t-transparent" />
                Checking…
              </span>
            ) : (
              'Check Status'
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 text-xs text-[var(--danger-700)]">{error}</p>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No payments scheduled yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">#</th>
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Due Date</th>
                <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Amount</th>
                <th className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Status</th>
                <th className="hidden py-2 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] sm:table-cell">
                  Qippay ID
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
                return (
                  <tr key={p.installmentNumber} className="border-b border-[var(--border-subtle)] last:border-b-0">
                    <td className="py-2 text-[var(--text-muted)]">{p.installmentNumber}</td>
                    <td className="py-2 text-[var(--text-body)]">{p.dueDate}</td>
                    <td className="py-2 text-right font-mono font-semibold tabular-nums text-[var(--text-strong)]">
                      {fmtNzd(p.amountCents)}
                    </td>
                    <td className="py-2 text-center">
                      <ConsolePill tone={cfg.tone}>
                        {cfg.label}
                        {p.status === 'retrying' && p.retryCount > 0 && (
                          <span className="ml-1 opacity-70">×{p.retryCount}</span>
                        )}
                      </ConsolePill>
                    </td>
                    <td className="hidden py-2 text-right font-mono text-[var(--text-muted)] sm:table-cell">
                      {p.qippayPaymentId ? (
                        <span title={p.qippayPaymentId}>
                          {p.qippayPaymentId.slice(0, 14)}…
                        </span>
                      ) : (
                        <span className="text-[var(--slate-400)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
