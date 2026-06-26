'use client';

import { useState, useTransition } from 'react';
import type { ScheduledPayment } from '@/types/application';
import ConsoleIcon from '@/components/lender/ConsoleIcon';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';

type Props = {
  applicationId: string;
  scheduledPayments: ScheduledPayment[];
};

const fmtNzd = (cents: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(
    cents / 100,
  );

/** Today's NZ calendar date (YYYY-MM-DD) — matches the server scheduling rule. */
function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

function daysUntil(due: string, today: string): number {
  const a = new Date(`${due}T00:00:00Z`).getTime();
  const b = new Date(`${today}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86_400_000);
}

type RowView = { label: string; tone: PillTone; note?: string; suffix?: string };

/**
 * Turn the raw instalment state into something an operator can read at a glance.
 * The key distinction is *why* an instalment has no Qippay ID yet:
 *   - `Awaiting window`  → its SetPay rolling period isn't open yet (expected).
 *   - `Needs attention`  → its window is open but Qippay rejected it (real issue).
 *   - `Missed window`    → its due date passed before it could be lodged.
 */
function describe(p: ScheduledPayment, today: string): RowView {
  switch (p.status) {
    case 'success':
      return { label: 'Paid', tone: 'success' };
    case 'scheduled':
      return { label: 'Scheduled', tone: 'info', note: 'Lodged with bank' };
    case 'retrying':
      return {
        label: 'Retrying',
        tone: 'warning',
        suffix: p.retryCount > 0 ? `×${p.retryCount}` : undefined,
        note: p.failureReason,
      };
    case 'failed':
      return { label: 'Failed', tone: 'danger', note: p.failureReason };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' };
    case 'pending':
    default: {
      if (p.dueDate < today) {
        return {
          label: 'Missed window',
          tone: 'danger',
          note: p.failureReason ?? 'Due date passed before it could be scheduled',
        };
      }
      const soon = daysUntil(p.dueDate, today) <= 16;
      if (p.failureReason && soon) {
        return { label: 'Needs attention', tone: 'danger', note: p.failureReason };
      }
      return {
        label: 'Awaiting window',
        tone: 'neutral',
        note: 'Will be lodged automatically closer to the due date',
      };
    }
  }
}

export default function ScheduledPaymentsPanel({
  applicationId,
  scheduledPayments: initial,
}: Props) {
  const [payments, setPayments] = useState<ScheduledPayment[]>(initial);
  const [isChecking, startChecking] = useTransition();
  const [isScheduling, startScheduling] = useTransition();
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const today = nzToday();
  const rows = payments.map((p) => ({ p, view: describe(p, today) }));

  const paidCount = payments.filter((p) => p.status === 'success').length;
  const lodgedCount = payments.filter(
    (p) => p.status === 'scheduled' || p.status === 'success' || p.status === 'retrying',
  ).length;
  const awaitingCount = rows.filter((r) => r.view.label === 'Awaiting window').length;
  const attentionCount = rows.filter(
    (r) => r.view.label === 'Needs attention' || r.view.label === 'Missed window',
  ).length;
  const failedCount = payments.filter((p) => p.status === 'failed').length;
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  const handleCheckStatus = () => {
    setError(null);
    setNotice(null);
    startChecking(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/payment-status`);
        const body = await res.json();
        if (!res.ok) {
          setError(body.error?.message ?? 'Failed to check payment status');
          return;
        }
        if (body.data?.scheduledPayments) setPayments(body.data.scheduledPayments);
        setLastChecked(new Date().toLocaleTimeString('en-NZ'));
      } catch {
        setError('Network error — could not check payment status');
      }
    });
  };

  const handleSchedulePending = () => {
    setError(null);
    setNotice(null);
    startScheduling(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/schedule-payments`, {
          method: 'POST',
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error?.message ?? 'Failed to schedule payments');
          return;
        }
        if (body.data?.scheduledPayments) setPayments(body.data.scheduledPayments);
        const lodged = body.data?.scheduledCount ?? 0;
        const stillPending = body.data?.pendingCount ?? 0;
        setNotice(
          `${lodged} lodged with the bank · ${stillPending} still awaiting their window.`,
        );
        setLastChecked(new Date().toLocaleTimeString('en-NZ'));
      } catch {
        setError('Network error — could not schedule payments');
      }
    });
  };

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-[var(--text-strong)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--orange-50)] text-[var(--orange-700)]">
              <ConsoleIcon name="wallet" size={16} />
            </span>
            Scheduled Repayments
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {paidCount} of {payments.length} paid · {lodgedCount} lodged with bank
            {awaitingCount > 0 && (
              <span className="ml-2 text-[var(--text-muted)]">· {awaitingCount} awaiting window</span>
            )}
            {attentionCount > 0 && (
              <span className="ml-2 font-semibold text-[var(--danger-700)]">· {attentionCount} need attention</span>
            )}
            {failedCount > 0 && (
              <span className="ml-2 font-semibold text-[var(--danger-700)]">· {failedCount} failed</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastChecked && (
            <span className="text-xs text-[var(--text-muted)]">Checked {lastChecked}</span>
          )}
          {pendingCount > 0 && (
            <button
              onClick={handleSchedulePending}
              disabled={isScheduling}
              className="rounded-[10px] bg-[var(--orange-600)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--orange-700)] disabled:opacity-50"
            >
              {isScheduling ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                  Scheduling…
                </span>
              ) : (
                'Schedule pending'
              )}
            </button>
          )}
          <button
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50"
          >
            {isChecking ? (
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

      {error && <p className="mb-3 text-xs text-[var(--danger-700)]">{error}</p>}
      {notice && <p className="mb-3 text-xs text-[var(--text-muted)]">{notice}</p>}

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
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Status</th>
                <th className="hidden py-2 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] sm:table-cell">
                  Qippay ID
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, view }) => (
                <tr
                  key={p.installmentNumber}
                  className="border-b border-[var(--border-subtle)] align-top last:border-b-0"
                >
                  <td className="py-2.5 text-[var(--text-muted)]">{p.installmentNumber}</td>
                  <td className="py-2.5 text-[var(--text-body)]">{p.dueDate}</td>
                  <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-[var(--text-strong)]">
                    {fmtNzd(p.amountCents)}
                  </td>
                  <td className="py-2.5">
                    <ConsolePill tone={view.tone}>
                      {view.label}
                      {view.suffix && <span className="ml-1 opacity-70">{view.suffix}</span>}
                    </ConsolePill>
                    {view.note && (
                      <p
                        className={`mt-1 max-w-[34ch] text-[11px] leading-snug ${
                          view.tone === 'danger'
                            ? 'text-[var(--danger-700)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {view.note}
                      </p>
                    )}
                  </td>
                  <td className="hidden py-2.5 text-right font-mono text-[var(--text-muted)] sm:table-cell">
                    {p.qippayPaymentId ? (
                      <span title={p.qippayPaymentId}>{p.qippayPaymentId.slice(0, 14)}…</span>
                    ) : (
                      <span className="text-[var(--slate-400)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
