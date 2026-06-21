'use client';

import { useState, useTransition } from 'react';
import type { ScheduledPayment } from '@/types/application';

type Props = {
  applicationId: string;
  scheduledPayments: ScheduledPayment[];
};

const STATUS_CONFIG: Record<
  ScheduledPayment['status'],
  { label: string; bg: string; text: string }
> = {
  pending:   { label: 'Pending',   bg: 'bg-gray-100',   text: 'text-gray-600'   },
  scheduled: { label: 'Scheduled', bg: 'bg-blue-100',   text: 'text-blue-700'   },
  success:   { label: 'Paid',      bg: 'bg-green-100',  text: 'text-green-700'  },
  retrying:  { label: 'Retrying',  bg: 'bg-amber-100',  text: 'text-amber-700'  },
  failed:    { label: 'Failed',    bg: 'bg-red-100',    text: 'text-red-700'    },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100',   text: 'text-gray-500'   },
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
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Scheduled Repayments</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {paidCount} of {payments.length} paid
            {failedCount > 0 && (
              <span className="ml-2 text-red-500 font-medium">· {failedCount} failed</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastChecked && (
            <span className="text-xs text-gray-400">Checked {lastChecked}</span>
          )}
          <button
            onClick={handleCheckStatus}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                Checking…
              </span>
            ) : (
              'Check Status'
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-gray-400">No payments scheduled yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-left font-medium text-gray-500">#</th>
                <th className="py-2 text-left font-medium text-gray-500">Due Date</th>
                <th className="py-2 text-right font-medium text-gray-500">Amount</th>
                <th className="py-2 text-center font-medium text-gray-500">Status</th>
                <th className="py-2 text-right font-medium text-gray-500 hidden sm:table-cell">
                  Qippay ID
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
                return (
                  <tr key={p.installmentNumber} className="border-b border-gray-50">
                    <td className="py-2 text-gray-500">{p.installmentNumber}</td>
                    <td className="py-2 text-gray-700">{p.dueDate}</td>
                    <td className="py-2 text-right font-medium text-gray-900">
                      {fmtNzd(p.amountCents)}
                    </td>
                    <td className="py-2 text-center">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}
                      >
                        {cfg.label}
                        {p.status === 'retrying' && p.retryCount > 0 && (
                          <span className="ml-1 opacity-70">×{p.retryCount}</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-400 font-mono hidden sm:table-cell">
                      {p.qippayPaymentId ? (
                        <span title={p.qippayPaymentId}>
                          {p.qippayPaymentId.slice(0, 14)}…
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
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
