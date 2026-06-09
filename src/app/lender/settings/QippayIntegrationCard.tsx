'use client';

import { useEffect, useState, useTransition } from 'react';

type Bank = { id: string; name: string };

type IntegrationConfig = {
  mode: 'live' | 'stub';
  baseUrl: string;
  beneficiaryId: string;
  merchantName: string;
  receivingAccount: string;
  webhookUrl: string;
  paymentConfirmationMode: 'polling' | 'webhook';
  webhookEnabled: boolean;
  webhookSecretSet: boolean;
  connected: boolean;
  banks: Bank[];
};

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
        connected
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      {connected ? 'Connected' : 'Disconnected'}
    </span>
  );
}

function ModeBadge({ mode }: { mode: 'live' | 'stub' }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
        mode === 'live'
          ? 'bg-green-100 text-green-800'
          : 'bg-amber-100 text-amber-800'
      }`}
    >
      {mode === 'live' ? '● LIVE' : '○ STUB'}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="text-xs text-[#F5A523] hover:text-[#E08B00] font-medium transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0 w-36">{label}</span>
      <span className="text-sm text-gray-900 text-right break-all">{children}</span>
    </div>
  );
}

export default function QippayIntegrationCard() {
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, startTesting] = useTransition();
  const [saving, startSaving] = useTransition();

  // Local editable state
  const [mode, setMode] = useState<'polling' | 'webhook'>('polling');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [secretSaved, setSecretSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchConfig = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/lender/integration/qippay');
      const body = await res.json();
      if (res.ok && body.data) {
        setConfig(body.data);
        setMode(body.data.paymentConfirmationMode);
        setWebhookEnabled(body.data.webhookEnabled);
      }
    } catch {
      // leave as null — UI handles it
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleTestConnection = () => {
    startTesting(async () => {
      await fetchConfig(true);
    });
  };

  const handleSaveMode = () => {
    setSaveError(null);
    startSaving(async () => {
      const res = await fetch('/api/lender/integration/qippay', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentConfirmationMode: mode, webhookEnabled }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSaveError(body.error?.message ?? 'Failed to save');
      } else {
        await fetchConfig(true);
      }
    });
  };

  const handleSaveSecret = () => {
    if (!secretInput.trim()) return;
    setSaveError(null);
    setSecretSaved(false);
    startSaving(async () => {
      const res = await fetch('/api/lender/integration/qippay', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookSecret: secretInput.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSaveError(body.error?.message ?? 'Failed to save secret');
      } else {
        setSecretInput('');
        setSecretSaved(true);
        await fetchConfig(true);
        setTimeout(() => setSecretSaved(false), 3000);
      }
    });
  };

  const isDirty =
    config &&
    (mode !== config.paymentConfirmationMode || webhookEnabled !== config.webhookEnabled);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-gray-100 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-sm text-red-600">Failed to load Qippay configuration.</p>
        <button onClick={() => fetchConfig()} className="mt-3 text-sm text-[#F5A523] hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FEF7E9] rounded-lg flex items-center justify-center">
            <span className="text-[#F5A523] text-sm font-bold">Q</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Qippay SetPay</h3>
            <p className="text-xs text-gray-400">Open-banking recurring payments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge connected={config.connected} />
          <ModeBadge mode={config.mode} />
        </div>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* ── Read-only connection details ── */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Connection
          </h4>
          <div className="divide-y divide-gray-100">
            <Row label="Environment">{config.baseUrl || '—'}</Row>
            <Row label="Beneficiary ID">
              <span className="font-mono text-xs">{config.beneficiaryId || '—'}</span>
            </Row>
            <Row label="Merchant">{config.merchantName}</Row>
            <Row label="Receiving account">
              <span className="font-mono text-xs">{config.receivingAccount}</span>
            </Row>
          </div>

          {config.banks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {config.banks.map((b) => (
                <span
                  key={b.id}
                  className="text-xs px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-full text-gray-600"
                >
                  {b.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Payment confirmation method ── */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Payment Confirmation
          </h4>

          {/* Toggle */}
          <div className="flex items-center gap-4 mb-4">
            <span className={`text-sm font-medium ${mode === 'polling' ? 'text-gray-900' : 'text-gray-400'}`}>
              Polling
            </span>
            <button
              onClick={() => setMode(mode === 'polling' ? 'webhook' : 'polling')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#F5A523] focus:ring-offset-2 ${
                mode === 'webhook' ? 'bg-[#F5A523]' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={mode === 'webhook'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  mode === 'webhook' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${mode === 'webhook' ? 'text-gray-900' : 'text-gray-400'}`}>
              Webhook
            </span>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            {mode === 'polling'
              ? 'Payment status is checked manually by the lender from each application. A "Check Status" button is shown next to each scheduled instalment.'
              : 'Qippay pushes payment events to your webhook URL instantly. Status updates automatically without lender action.'}
          </p>

          {/* Webhook details — only shown when webhook mode is selected */}
          {mode === 'webhook' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              {/* Webhook URL */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Webhook URL
                  <span className="ml-1 text-gray-400 font-normal">(provide this to Qippay)</span>
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-gray-200 rounded px-3 py-2 text-gray-800 font-mono break-all">
                    {config.webhookUrl}
                  </code>
                  <CopyButton text={config.webhookUrl} />
                </div>
              </div>

              {/* Webhook secret */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Webhook Secret
                  <span className="ml-1 text-gray-400 font-normal">(provided by Qippay)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={secretInput}
                    onChange={(e) => setSecretInput(e.target.value)}
                    placeholder={config.webhookSecretSet ? '••••••••  (configured — enter to rotate)' : 'Paste secret from Qippay'}
                    className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-[#F5A523] focus:outline-none font-mono"
                    autoComplete="new-password"
                  />
                  <button
                    onClick={handleSaveSecret}
                    disabled={!secretInput.trim() || saving}
                    className="px-3 py-2 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {saving ? 'Saving…' : 'Save secret'}
                  </button>
                </div>
                {config.webhookSecretSet && !secretInput && (
                  <p className="mt-1 text-xs text-green-600">✓ Secret configured</p>
                )}
                {secretSaved && (
                  <p className="mt-1 text-xs text-green-600">✓ Secret saved and encrypted</p>
                )}
              </div>

              {/* Enable toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={webhookEnabled}
                  onChange={(e) => setWebhookEnabled(e.target.checked)}
                  disabled={!config.webhookSecretSet && !secretInput.trim()}
                  className="w-4 h-4 rounded border-gray-300 text-[#F5A523] focus:ring-[#F5A523]"
                />
                <span className="text-sm text-gray-700">Enable webhook receiver</span>
                {!config.webhookSecretSet && (
                  <span className="text-xs text-gray-400">(save a secret first)</span>
                )}
              </label>
            </div>
          )}

          {/* Save mode + enabled state */}
          {(isDirty || (mode === 'webhook' && webhookEnabled !== config.webhookEnabled)) && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSaveMode}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-[#F5A523] text-white rounded-md hover:bg-[#E08B00] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() => {
                  setMode(config.paymentConfirmationMode);
                  setWebhookEnabled(config.webhookEnabled);
                }}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {saveError && (
            <p className="mt-2 text-xs text-red-600">{saveError}</p>
          )}
        </div>

        {/* ── Test connection ── */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Last tested:{' '}
            <span className="text-gray-600">
              {config.connected ? 'Connection OK' : 'Not reachable'}
            </span>
          </p>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        </div>
      </div>
    </div>
  );
}
