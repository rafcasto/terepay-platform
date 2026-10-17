'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ScheduledPayment } from '@/types/application';
import ConsoleIcon from '@/components/lender/ConsoleIcon';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';
import { fmtYmd } from '@/lib/loan/format';

type Props = {
  applicationId: string;
  scheduledPayments: ScheduledPayment[];
  /** Only the assigned lender may record repayments. */
  canRecord: boolean;
};

const fmtNzd = (cents: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(cents / 100);

/** Today's NZ calendar date (YYYY-MM-DD). */
function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

type RowView = { label: string; tone: PillTone; note?: string };

function describe(p: ScheduledPayment, today: string): RowView {
  if (p.status === 'success') {
    const rec = p.manualRecord;
    const who = rec?.recordedByName ? ` by ${rec.recordedByName}` : '';
    return {
      label: 'Paid',
      tone: 'success',
      note: rec
        ? `Received ${fmtYmd(rec.paidOn)}${who}${rec.reference ? ` · Ref ${rec.reference}` : ''}`
        : undefined,
    };
  }
  if (p.status === 'cancelled') return { label: 'Cancelled', tone: 'neutral' };
  if (p.dueDate < today) {
    const days = daysBetween(p.dueDate, today);
    return {
      label: 'Overdue',
      tone: 'danger',
      note: `${days} ${days === 1 ? 'day' : 'days'} past due`,
    };
  }
  if (p.dueDate === today) return { label: 'Due today', tone: 'warning' };
  return { label: 'Upcoming', tone: 'neutral' };
}

type RecordForm = { installmentNumber: number; paidOn: string; reference: string };

/**
 * Manual repayment mode (Qippay feature flag off). The borrower pays TerePay
 * directly and the lender marks each instalment received here. Writes go
 * through POST /api/applications/[id]/payments/record, which refreshes the
 * loan record and closes the loan once the last instalment is in.
 */
export default function ManualPaymentsPanel({
  applicationId,
  scheduledPayments: initial,
  canRecord,
}: Props) {
  const router = useRouter();
  const [payments, setPayments] = useState<ScheduledPayment[]>(initial);
  const [form, setForm] = useState<RecordForm | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const today = nzToday();
  const sorted = [...payments].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const paidCount = payments.filter((p) => p.status === 'success').length;
  const overdueCount = sorted.filter(
    (p) => p.status !== 'success' && p.status !== 'cancelled' && p.dueDate < today,
  ).length;
  const paidCents = payments
    .filter((p) => p.status === 'success')
    .reduce((acc, p) => acc + p.amountCents, 0);
  const totalCents = payments.reduce((acc, p) => acc + p.amountCents, 0);

  const openForm = (p: ScheduledPayment) => {
    setError(null);
    setNotice(null);
    setForm({ installmentNumber: p.installmentNumber, paidOn: today, reference: '' });
  };

  const submit = (body: Record<string, unknown>, successMessage: string) => {
    setError(null);
    setNotice(null);
    startSaving(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/payments/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error?.message ?? 'Could not record the payment');
          return;
        }
        if (data.data?.scheduledPayments) setPayments(data.data.scheduledPayments);
        setForm(null);
        setNotice(
          data.data?.status === 'closed_repaid'
            ? `${successMessage} All instalments received — loan closed as repaid.`
            : successMessage,
        );
        // Status / balance cards elsewhere on the page read server data.
        router.refresh();
      } catch {
        setError('Network error — could not record the payment');
      }
    });
  };

  const markPaid = () => {
    if (!form) return;
    if (!form.paidOn) {
      setError('Enter the date the payment was received');
      return;
    }
    if (form.paidOn > today) {
      setError('Payment date cannot be in the future');
      return;
    }
    submit(
      {
        installmentNumber: form.installmentNumber,
        action: 'mark_paid',
        paidOn: form.paidOn,
        ...(form.reference.trim() ? { reference: form.reference.trim() } : {}),
      },
      `Instalment ${form.installmentNumber} recorded as paid.`,
    );
  };

  const markUnpaid = (p: ScheduledPayment) => {
    submit(
      { installmentNumber: p.installmentNumber, action: 'mark_unpaid' },
      `Instalment ${p.installmentNumber} reverted to unpaid.`,
    );
  };

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-[var(--text-strong)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--orange-50)] text-[var(--orange-700)]">
              <ConsoleIcon name="wallet" size={16} />
            </span>
            Repayments
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {paidCount} of {payments.length} paid · {fmtNzd(paidCents)} of {fmtNzd(totalCents)} received
            {overdueCount > 0 && (
              <span className="ml-2 font-semibold text-[var(--danger-700)]">· {overdueCount} overdue</span>
            )}
          </p>
        </div>
        <ConsolePill tone="info">Recorded manually</ConsolePill>
      </div>

      <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--info-700)]/20 bg-[var(--info-50)] px-3 py-2 text-xs text-[var(--info-700)]">
        Automatic bank collection is not switched on. Mark each instalment as paid once the
        borrower&apos;s payment has arrived in the TerePay account.
      </p>

      {error && <p className="mb-3 text-xs text-[var(--danger-700)]">{error}</p>}
      {notice && <p className="mb-3 text-xs text-[var(--success-700)]">{notice}</p>}

      {sorted.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No repayment schedule on this loan yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">#</th>
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Due</th>
                <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Amount</th>
                <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Status</th>
                {canRecord && (
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const view = describe(p, today);
                const editing = form?.installmentNumber === p.installmentNumber;
                const isPaid = p.status === 'success';
                const qippayManaged = Boolean(p.qippayPaymentId);
                return (
                  <tr
                    key={p.installmentNumber}
                    className="border-b border-[var(--border-subtle)] align-top last:border-b-0"
                  >
                    <td className="py-2.5 text-[var(--text-muted)]">{p.installmentNumber}</td>
                    <td className="py-2.5 text-[var(--text-body)]">{fmtYmd(p.dueDate)}</td>
                    <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-[var(--text-strong)]">
                      {fmtNzd(p.amountCents)}
                    </td>
                    <td className="py-2.5">
                      <ConsolePill tone={view.tone}>{view.label}</ConsolePill>
                      {view.note && (
                        <p
                          className={`mt-1 max-w-[34ch] text-[11px] leading-snug ${
                            view.tone === 'danger' ? 'text-[var(--danger-700)]' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {view.note}
                        </p>
                      )}
                    </td>
                    {canRecord && (
                      <td className="py-2.5 text-right">
                        {qippayManaged ? (
                          <span className="text-[11px] text-[var(--text-muted)]">Managed by Qippay</span>
                        ) : isPaid ? (
                          p.manualRecord && (
                            <button
                              type="button"
                              onClick={() => markUnpaid(p)}
                              disabled={isSaving}
                              className="text-[11px] font-semibold text-[var(--text-muted)] underline-offset-2 hover:underline disabled:opacity-50"
                            >
                              Undo
                            </button>
                          )
                        ) : editing ? (
                          <div className="ml-auto flex w-full max-w-[260px] flex-col items-stretch gap-2 text-left">
                            <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                              Received on
                              <input
                                type="date"
                                max={today}
                                value={form.paidOn}
                                onChange={(e) => setForm({ ...form, paidOn: e.target.value })}
                                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-2 py-1.5 text-xs text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]"
                              />
                            </label>
                            <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                              Reference (optional)
                              <input
                                type="text"
                                maxLength={120}
                                placeholder="Bank reference or receipt no."
                                value={form.reference}
                                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-2 py-1.5 text-xs text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]"
                              />
                            </label>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setForm(null)}
                                disabled={isSaving}
                                className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:underline disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={markPaid}
                                disabled={isSaving}
                                className="rounded-[8px] bg-[var(--success-700)] px-3 py-1.5 text-[11px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
                              >
                                {isSaving ? 'Saving…' : `Confirm ${fmtNzd(p.amountCents)}`}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openForm(p)}
                            disabled={isSaving || form !== null}
                            className="rounded-[8px] border border-[var(--border-default)] bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50"
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                    )}
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
