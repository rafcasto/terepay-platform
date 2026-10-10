'use client';

import { useEffect, useState } from 'react';
import type { ContentSectionDef, ContentSectionValues } from '@/types/content';

type ApiResponse = {
  sections: ContentSectionDef[];
  values: Record<string, ContentSectionValues>;
};

/**
 * Renders one save-able form per section key, in the order given. Loads the
 * full content payload once (it's small) and picks the requested sections.
 */
export default function ContentEditor({ sectionKeys }: { sectionKeys: string[] }) {
  const [sections, setSections] = useState<ContentSectionDef[]>([]);
  const [values, setValues] = useState<Record<string, ContentSectionValues>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const keysSig = sectionKeys.join('|');

  useEffect(() => {
    let active = true;
    const wanted = keysSig.split('|');
    fetch('/api/content')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error?.message ?? `Server error ${r.status}`);
        return json.data as ApiResponse;
      })
      .then((data) => {
        if (!active) return;
        const byKey = new Map(data.sections.map((s) => [s.key, s]));
        setSections(wanted.map((k) => byKey.get(k)).filter((s): s is ContentSectionDef => Boolean(s)));
        setValues(data.values);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Failed to load content'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [keysSig]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-6 w-6 animate-spin text-[#F08000]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
    );
  }

  if (sections.length === 0) {
    return <p className="text-sm text-slate-500">No editable sections are registered for this page yet.</p>;
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <SectionForm
          key={section.key}
          section={section}
          initialValues={values[section.key] ?? {}}
        />
      ))}
    </div>
  );
}

function SectionForm({
  section,
  initialValues,
}: {
  section: ContentSectionDef;
  initialValues: ContentSectionValues;
}) {
  const [draft, setDraft] = useState<ContentSectionValues>(initialValues);
  const [saved, setSaved] = useState<ContentSectionValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const dirty = section.fields.some((f) => (draft[f.key] ?? '') !== (saved[f.key] ?? ''));

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/content/${encodeURIComponent(section.key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Failed to save');
      const next = (json.data?.values ?? draft) as ContentSectionValues;
      setDraft(next);
      setSaved(next);
      setStatus({ kind: 'ok', msg: 'Saved — live now.' });
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setStatus({ kind: 'err', msg: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="tp-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#16263B]">{section.label}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
        </div>
        {status && (
          <span
            className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${
              status.kind === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}
          >
            {status.msg}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {section.fields.map((field) => {
          const value = draft[field.key] ?? '';
          const id = `${section.key}-${field.key}`;
          return (
            <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
              <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-700">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  id={id}
                  rows={3}
                  maxLength={field.maxLength}
                  value={value}
                  onChange={(e) => setDraft((p) => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                />
              ) : (
                <input
                  id={id}
                  type="text"
                  maxLength={field.maxLength}
                  value={value}
                  onChange={(e) => setDraft((p) => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                />
              )}
              <div className="mt-1 flex items-center justify-between">
                {field.help ? (
                  <span className="text-[11px] text-slate-400">{field.help}</span>
                ) : (
                  <span />
                )}
                <span className="text-[11px] text-slate-300 font-tabular">
                  {value.length}/{field.maxLength}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E08B00] disabled:opacity-50"
        >
          {saving && (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {dirty && !saving && (
          <button
            type="button"
            onClick={() => setDraft(saved)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Discard
          </button>
        )}
      </div>
    </section>
  );
}
