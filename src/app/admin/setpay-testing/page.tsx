'use client';

import { useEffect, useState } from 'react';

type TestSettings = {
  enabled: boolean;
  intervalMinutes: number;
  lockedInProduction: boolean;
  qippayMode: 'live' | 'stub' | 'unknown';
  lastVerifyAt: number | null;
  lastVerifyCount: number | null;
};

type VerifyApplication = {
  applicationId: string;
  consentStatus: string;
  changed: boolean;
  paidCount: number;
  totalCount: number;
  testCadenceMinutes: number | null;
  error?: string;
};

type VerifyResult = {
  ranAt: number;
  total: number;
  processed: number;
  changed: number;
  errored: number;
  applications: VerifyApplication[];
};

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' });

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

export default function SetPayTestingPage() {
  const [settings, setSettings] = useState<TestSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/setpay-testing')
      .then((r) => r.json())
      .then((json) => setSettings(json.data))
      .catch(() => setError('Failed to load SetPay testing settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/setpay-testing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          intervalMinutes: settings.intervalMinutes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to save settings');
      }
      setSettings(data.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch('/api/admin/setpay-testing/verify', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Verification failed');
      }
      setVerifyResult(data.data);
      setSettings((p) =>
        p ? { ...p, lastVerifyAt: data.data.ranAt, lastVerifyCount: data.data.processed } : p,
      );
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <Spinner className="h-6 w-6 text-[#F08000]" />
      </div>
    );
  }

  if (!settings) return null;

  const locked = settings.lockedInProduction;
  const intervalValid =
    Number.isInteger(settings.intervalMinutes) &&
    settings.intervalMinutes >= 1 &&
    settings.intervalMinutes <= 1440;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">SetPay Testing</h1>
        <p className="text-sm text-slate-500 mt-1">
          Repayments are normally collected fortnightly. For testing, compress the cadence so
          instalments are collected a few minutes apart, then verify them here without waiting
          for the daily refresh.
        </p>
      </div>

      {locked && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This is a production build. The test cadence is locked off and cannot be enabled here.
        </p>
      )}

      <div className="tp-card p-6 mb-4">
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div>
            <p className="text-sm font-medium text-[#1C2A3A]">Test cadence</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Applies to payment consents created while this is on. The minute clock starts when
              the lender disburses the loan.
            </p>
          </div>
          <button
            type="button"
            disabled={locked}
            onClick={() => setSettings((p) => (p ? { ...p, enabled: !p.enabled } : p))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F08000] focus-visible:ring-offset-2 disabled:opacity-50 ${
              settings.enabled ? 'bg-amber-500' : 'bg-slate-200'
            }`}
            role="switch"
            aria-checked={settings.enabled}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                settings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="pt-5">
          <label className="block text-sm font-semibold text-[#16263B] mb-1" htmlFor="interval-minutes">
            Minutes between instalments
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Instalment 1 is collected this many minutes after disbursement, instalment 2 the same
            again after that, and so on. Default is 4. Amounts are unchanged — only timing.
          </p>
          <input
            id="interval-minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            step={1}
            value={settings.intervalMinutes}
            disabled={locked || !settings.enabled}
            onChange={(e) =>
              setSettings((p) =>
                p ? { ...p, intervalMinutes: Number(e.target.value) } : p,
              )
            }
            className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 font-tabular focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523] disabled:opacity-60 disabled:bg-slate-50"
          />
          {!intervalValid && (
            <p className="mt-1 text-xs text-red-600">Enter a whole number from 1 to 1440.</p>
          )}
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p>
            Qippay mode: <span className="font-medium">{settings.qippayMode}</span>.{' '}
            {settings.qippayMode === 'stub'
              ? 'The stub reports each instalment as collected once its time has passed, so the full loop can be tested offline.'
              : 'Instalments are lodged with Qippay as a Daily consent covering the whole loan; Qippay decides whether a same-day time is accepted.'}
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Settings saved successfully.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || locked || !intervalValid}
        className="mb-8 inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#E08B00] transition-colors disabled:opacity-60"
      >
        {saving && <Spinner />}
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      <div className="tp-card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#16263B] mb-1">Verify payments now</h2>
            <p className="text-xs text-slate-500">
              Checks every active loan against Qippay and marks collected instalments as paid.
              Same sweep as the daily refresh, run immediately. While the test cadence is on the
              hourly cron also runs it on every tick.
            </p>
          </div>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[#16263B] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F1D2E] transition-colors disabled:opacity-60"
          >
            {verifying && <Spinner />}
            {verifying ? 'Verifying...' : 'Verify now'}
          </button>
        </div>

        {settings.lastVerifyAt && !verifyResult && (
          <p className="mt-4 text-xs text-slate-500">
            Last verified {fmtTime(settings.lastVerifyAt)} · {settings.lastVerifyCount ?? 0}{' '}
            applications
          </p>
        )}

        {verifyError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {verifyError}
          </p>
        )}

        {verifyResult && (
          <div className="mt-5">
            <p className="text-xs text-slate-500 mb-3">
              Ran {fmtTime(verifyResult.ranAt)} · {verifyResult.processed} of {verifyResult.total}{' '}
              checked · {verifyResult.changed} updated
              {verifyResult.errored > 0 ? ` · ${verifyResult.errored} errors` : ''}
            </p>
            {verifyResult.applications.length === 0 ? (
              <p className="text-sm text-slate-400">No loans with an active payment consent.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                      <th className="py-2 pr-3">Application</th>
                      <th className="py-2 pr-3">Cadence</th>
                      <th className="py-2 pr-3">Consent</th>
                      <th className="py-2 pr-3 text-right">Paid</th>
                      <th className="py-2 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifyResult.applications.map((a) => (
                      <tr key={a.applicationId} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3">
                          <a
                            href={`/lender/applications/${a.applicationId}`}
                            className="font-mono text-xs text-[#B45600] hover:underline"
                          >
                            {a.applicationId.slice(0, 12)}
                          </a>
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-600">
                          {a.testCadenceMinutes ? `Every ${a.testCadenceMinutes} min` : 'Fortnightly'}
                        </td>
                        <td className="py-2 pr-3 text-xs text-slate-600">{a.consentStatus}</td>
                        <td className="py-2 pr-3 text-right font-tabular tabular-nums">
                          {a.paidCount}/{a.totalCount}
                        </td>
                        <td className="py-2 text-right text-xs">
                          {a.error ? (
                            <span className="text-red-600">Error</span>
                          ) : a.changed ? (
                            <span className="text-green-700">Updated</span>
                          ) : (
                            <span className="text-slate-400">No change</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
