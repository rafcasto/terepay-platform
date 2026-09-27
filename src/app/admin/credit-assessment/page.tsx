'use client';

import { useEffect, useState } from 'react';

type InstalledModel = { name: string; sizeGb: number | null; modified: string | null };

type ModelSettings = {
  model: string | null;
  modelInstalled: boolean | null;
  updatedAt: number | null;
  queueConfigured: boolean;
  workerOnline: boolean;
  availableModels: InstalledModel[];
  modelsPublishedAt: number | null;
};

/** `<select>` value for "no choice made — the worker uses its own default". */
const WORKER_DEFAULT = '';

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' });

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

export default function CreditAssessmentModelPage() {
  const [settings, setSettings] = useState<ModelSettings | null>(null);
  const [choice, setChoice] = useState<string>(WORKER_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/admin/credit-assessment')
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(json.error?.message ?? 'Failed to load the model settings');
        return json;
      })
      .then((json) => {
        setSettings(json.data);
        setChoice(json.data.model ?? WORKER_DEFAULT);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the model settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/credit-assessment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: choice === WORKER_DEFAULT ? null : choice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to save the model');
      }
      setSettings(data.data);
      setChoice(data.data.model ?? WORKER_DEFAULT);
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
        <Spinner className="h-6 w-6 text-[var(--orange-500)]" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="rounded-lg border border-[var(--border-danger)] bg-[var(--surface-danger-soft)] px-3 py-2 text-sm text-[var(--text-danger)]">
          {error ?? 'Failed to load the model settings'}
        </p>
      </div>
    );
  }

  const saved = settings.model ?? WORKER_DEFAULT;
  const dirty = choice !== saved;
  const noModels = settings.availableModels.length === 0;
  // Keep a selected-but-uninstalled model visible so the admin can see what is stored.
  const orphan =
    settings.model !== null && settings.modelInstalled === false ? settings.model : null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[var(--ink-800)]">AI Assessment Model</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Choose the model that writes the analyst note when a lender runs the AI credit
          assessment. The rules engine still decides the rating and recommendation, and the
          lender still makes the lending decision.
        </p>
      </div>

      {!settings.queueConfigured && (
        <p className="mb-4 rounded-lg bg-[var(--surface-warning-soft)] px-3 py-2 text-sm text-[var(--text-warning)]">
          The assessment queue is not configured, so the installed models cannot be listed.
        </p>
      )}

      {settings.queueConfigured && !settings.workerOnline && (
        <p className="mb-4 rounded-lg bg-[var(--surface-warning-soft)] px-3 py-2 text-sm text-[var(--text-warning)]">
          The assessment worker is offline. The list below is the last one it reported and may be
          out of date.
        </p>
      )}

      {orphan && (
        <p className="mb-4 rounded-lg border border-[var(--border-danger)] bg-[var(--surface-danger-soft)] px-3 py-2 text-sm text-[var(--text-danger)]">
          The selected model <span className="font-mono">{orphan}</span> is not installed on the
          assessment machine. Assessments will fail or fall back until you choose another model.
        </p>
      )}

      <div className="tp-card p-6 mb-4">
        <label
          className="block text-sm font-semibold text-[var(--ink-800)] mb-1"
          htmlFor="assessment-model"
        >
          Model
        </label>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Only models installed on the assessment machine can be chosen. The change applies to
          assessments queued after you save. Assessments already queued or running are not
          affected.
        </p>
        <select
          id="assessment-model"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={saving}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2 font-mono text-sm text-[var(--text-body)] disabled:opacity-60"
        >
          <option value={WORKER_DEFAULT}>Worker default (OLLAMA_MODEL on the assessment machine)</option>
          {orphan && <option value={orphan}>{orphan} (not installed)</option>}
          {settings.availableModels.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
              {m.sizeGb !== null ? ` (${m.sizeGb} GB)` : ''}
            </option>
          ))}
        </select>

        {noModels && settings.queueConfigured && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            The worker has not reported any installed models yet. Start the worker on the
            assessment machine, then reload this page.
          </p>
        )}

        <dl className="mt-5 grid gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-3 text-xs text-[var(--text-muted)]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt>Currently saved</dt>
            <dd className="font-mono text-[var(--text-body)]">{settings.model ?? 'Worker default'}</dd>
          </div>
          {settings.updatedAt !== null && (
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Last changed</dt>
              <dd className="text-[var(--text-body)]">{fmtTime(settings.updatedAt)}</dd>
            </div>
          )}
          {settings.modelsPublishedAt !== null && (
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Model list reported</dt>
              <dd className="text-[var(--text-body)]">{fmtTime(settings.modelsPublishedAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      <p className="mb-4 text-xs text-[var(--text-muted)]">
        Every assessment records the model that actually produced it. If the worker runs a
        different model from the one selected here, the lender sees a notice on the result.
      </p>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-[var(--border-danger)] bg-[var(--surface-danger-soft)] px-3 py-2 text-sm text-[var(--text-danger)]"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-[var(--surface-success-soft)] px-3 py-2 text-sm text-[var(--text-success)]"
        >
          Model saved. New assessments will use it.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !dirty}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink-800)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--ink-900)] transition-colors disabled:opacity-60"
      >
        {saving && <Spinner />}
        {saving ? 'Saving...' : 'Save model'}
      </button>
    </div>
  );
}
