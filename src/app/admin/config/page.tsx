'use client';

import { useState, useEffect } from 'react';
import type { AdminConfigKey } from '@/types/admin';
import { ADMIN_CONFIG_KEYS } from '@/types/admin';

type ConfigValues = Record<AdminConfigKey, string>;
type EditValues = Record<AdminConfigKey, string>;

export default function AdminConfigPage() {
  const [maskedValues, setMaskedValues] = useState<ConfigValues | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({} as EditValues);
  const [editing, setEditing] = useState<AdminConfigKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((json) => setMaskedValues(json.data))
      .catch(() => setError('Failed to load config'))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = (key: AdminConfigKey) => {
    setEditing(key);
    setEditValues((prev) => ({ ...prev, [key]: '' }));
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setEditing(null);
    setEditValues((prev) => ({ ...prev, [editing!]: '' }));
  };

  const handleSave = async (key: AdminConfigKey) => {
    const newValue = editValues[key];
    if (!newValue.trim()) {
      setError('Value cannot be empty. To clear a key, use the clear button.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to save');
      }
      const json = await res.json();
      setMaskedValues(json.data);
      setEditing(null);
      setSuccess(`${ADMIN_CONFIG_KEYS.find((k) => k.key === key)?.label} updated successfully.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (key: AdminConfigKey) => {
    if (!confirm('Clear this value? The system will fall back to the environment variable.')) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: '' }),
      });
      if (!res.ok) throw new Error('Failed to clear');
      const json = await res.json();
      setMaskedValues(json.data);
      setSuccess(`${ADMIN_CONFIG_KEYS.find((k) => k.key === key)?.label} cleared.`);
      setTimeout(() => setSuccess(null), 3000);
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Integration Config</h1>
        <p className="text-sm text-slate-500 mt-1">
          API keys and credentials stored encrypted in Firestore. Values override environment variables at runtime.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-start gap-3">
        <svg className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs text-blue-700">
          Values are encrypted with AES-256-GCM before storage. Current values are masked for display.
          If a key shows <span className="font-mono">(not set)</span>, the system uses the deployment environment variable.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </p>
      )}

      <div className="tp-card divide-y divide-slate-100">
        {ADMIN_CONFIG_KEYS.map(({ key, label, envVar }) => {
          const isEditing = editing === key;
          const displayVal = maskedValues?.[key] ?? '(not set)';
          const isNotSet = displayVal === '(not set)';

          return (
            <div key={key} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1C2A3A]">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{envVar}</p>

                  {isEditing ? (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={editValues[key] ?? ''}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={`Enter new value…`}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 font-mono focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSave(key)}
                        disabled={saving}
                        className="rounded-lg bg-[#F5A523] px-3 py-2 text-xs font-medium text-white hover:bg-[#E08B00] transition-colors disabled:opacity-60 shrink-0"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p
                      className={`mt-2 text-sm font-mono ${
                        isNotSet ? 'text-slate-400 italic' : 'text-[#1C2A3A]'
                      }`}
                    >
                      {displayVal}
                    </p>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(key)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    {!isNotSet && (
                      <button
                        type="button"
                        onClick={() => handleClear(key)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
