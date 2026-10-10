'use client';

import { useEffect, useState } from 'react';

type RefreshSettings = {
  enabled: boolean;
  refreshHourNzt: number;
  lastRunDateNzt: string | null;
  lastRunAt: number | null;
  lastRunCount: number | null;
};

const fmtHour = (h: number) => {
  const label = new Date(2000, 0, 1, h).toLocaleTimeString('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return label;
};

export default function PaymentRefreshPage() {
  const [settings, setSettings] = useState<RefreshSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/admin/payment-refresh')
      .then((r) => r.json())
      .then((json) => {
        setSettings({
          enabled: json.data.enabled,
          refreshHourNzt: json.data.refreshHourNzt,
          lastRunDateNzt: json.data.lastRunDateNzt,
          lastRunAt: json.data.lastRunAt,
          lastRunCount: json.data.lastRunCount,
        });
      })
      .catch(() => setError('Failed to load payment refresh settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/payment-refresh', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          refreshHourNzt: settings.refreshHourNzt,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to save settings');
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <svg className="h-6 w-6 animate-spin text-[#F08000]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Payment Refresh</h1>
        <p className="text-sm text-slate-500 mt-1">
          TerePay re-checks every active loan&rsquo;s scheduled repayments against the bank once a
          day. Choose when that daily sweep runs. Applicants and lenders can still refresh manually
          at any time from an application.
        </p>
      </div>

      <div className="tp-card p-6 mb-4">
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div>
            <p className="text-sm font-medium text-[#1C2A3A]">Daily automatic refresh</p>
            <p className="text-xs text-slate-500 mt-0.5">
              When off, payment statuses only update from provider webhooks or manual checks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettings((p) => (p ? { ...p, enabled: !p.enabled } : p))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F08000] focus-visible:ring-offset-2 ${
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
          <label className="block text-sm font-semibold text-[#16263B] mb-1" htmlFor="refresh-hour">
            Refresh time (New Zealand time)
          </label>
          <p className="text-xs text-slate-500 mb-3">
            The sweep runs at the start of the selected hour, NZT. Default is 12:00 AM (midnight).
          </p>
          <select
            id="refresh-hour"
            value={settings.refreshHourNzt}
            disabled={!settings.enabled}
            onChange={(e) =>
              setSettings((p) => (p ? { ...p, refreshHourNzt: Number(e.target.value) } : p))
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523] disabled:opacity-60 disabled:bg-slate-50"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {fmtHour(h)} NZT
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="tp-card p-6 mb-6">
        <h2 className="text-sm font-semibold text-[#16263B] mb-3">Last run</h2>
        {settings.lastRunAt ? (
          <dl className="text-sm text-slate-600 space-y-1">
            <div className="flex justify-between">
              <dt className="text-slate-500">Completed</dt>
              <dd>{new Date(settings.lastRunAt).toLocaleString('en-NZ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">NZT date</dt>
              <dd>{settings.lastRunDateNzt ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Applications refreshed</dt>
              <dd>{settings.lastRunCount ?? 0}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-400">The daily sweep has not run yet.</p>
        )}
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
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#E08B00] transition-colors disabled:opacity-60"
      >
        {saving && (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
