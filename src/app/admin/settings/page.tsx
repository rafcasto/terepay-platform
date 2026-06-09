'use client';

import { useState, useEffect } from 'react';
import type { SiteSettings } from '@/types/admin';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Omit<SiteSettings, 'updatedAt' | 'updatedBy'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((json) => {
        setSettings({
          maintenanceMode: json.data.maintenanceMode,
          maintenanceMessage: json.data.maintenanceMessage,
        });
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (key: keyof SiteSettings['maintenanceMode']) => {
    if (!settings) return;
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            maintenanceMode: { ...prev.maintenanceMode, [key]: !prev.maintenanceMode[key] },
          }
        : prev,
    );
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
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
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Site Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Control access to each portal and manage maintenance windows.</p>
      </div>

      <div className="tp-card p-6 mb-4">
        <h2 className="text-sm font-semibold text-[#16263B] mb-1">Maintenance Mode</h2>
        <p className="text-xs text-slate-500 mb-5">
          Enabling maintenance mode replaces the portal with a maintenance page. Admin access is unaffected.
        </p>

        <div className="space-y-4">
          {[
            {
              key: 'public' as const,
              label: 'Public Site',
              description: 'The landing page at terepay.co.nz',
            },
            {
              key: 'applicants' as const,
              label: 'Applicant Portal',
              description: 'All applicant-facing pages at /applicant/*',
            },
            {
              key: 'lenders' as const,
              label: 'Lender Portal',
              description: 'All lender-facing pages at /lender/*',
            },
          ].map(({ key, label, description }) => {
            const isOn = settings.maintenanceMode[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-[#1C2A3A]">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F08000] focus-visible:ring-offset-2 ${
                    isOn ? 'bg-amber-500' : 'bg-slate-200'
                  }`}
                  role="switch"
                  aria-checked={isOn}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      isOn ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tp-card p-6 mb-6">
        <label className="block text-sm font-semibold text-[#16263B] mb-1" htmlFor="maintenance-message">
          Maintenance Message
        </label>
        <p className="text-xs text-slate-500 mb-3">Shown to users when any portal is in maintenance mode.</p>
        <textarea
          id="maintenance-message"
          rows={3}
          value={settings.maintenanceMessage}
          onChange={(e) =>
            setSettings((prev) => (prev ? { ...prev, maintenanceMessage: e.target.value } : prev))
          }
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523] resize-none"
          maxLength={500}
        />
        <p className="text-xs text-slate-400 mt-1 text-right">
          {settings.maintenanceMessage.length}/500
        </p>
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
