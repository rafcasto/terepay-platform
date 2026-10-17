import type { ReactNode } from 'react';
import { isQippayEnabled } from '@/lib/qippay/feature';

/**
 * SetPay test cadence only exists while the Qippay feature flag is on. With it
 * off the API behind this page 404s, so show why instead of a broken screen.
 */
export default async function SetPayTestingLayout({ children }: { children: ReactNode }) {
  if (await isQippayEnabled()) return <>{children}</>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="tp-card p-6">
        <p className="tp-eyebrow">SetPay Testing</p>
        <h1 className="mt-2 font-display text-[var(--text-h2)] font-bold text-[var(--text-body)]">
          Qippay payments are switched off
        </h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          This environment is running in manual repayment mode: lenders record each repayment
          by hand from the application page, and no SetPay mandates or instalments are created.
          The test cadence has nothing to compress until Qippay is enabled.
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          To turn Qippay on, set <code className="font-tabular">QIPPAY_ENABLED=true</code> (or
          enable the <code className="font-tabular">qippay_enabled</code> flag in the Vercel
          dashboard) and redeploy or restart the server.
        </p>
      </div>
    </div>
  );
}
