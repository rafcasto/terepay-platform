'use client';

import { useState, useEffect } from 'react';
import type { EmailTemplate, EmailTemplateType, EmailTemplateCategory } from '@/types/admin';
import {
  EMAIL_TEMPLATE_TYPE_LABELS,
  EMAIL_TEMPLATE_CATEGORY_LABELS,
  EMAIL_TEMPLATE_TYPE_CATEGORY,
} from '@/types/admin';

type TemplateForm = {
  name: string;
  type: EmailTemplateType;
  subject: string;
  htmlBody: string;
  textBody: string;
  sequenceOrder: string;
  delayDays: string;
  availableVariables: string;
  isActive: boolean;
};

const EMPTY_FORM: TemplateForm = {
  name: '',
  type: 'welcome_sequence',
  subject: '',
  htmlBody: '',
  textBody: '',
  sequenceOrder: '',
  delayDays: '',
  availableVariables: 'firstName, lastName, loanAmount, loanPurpose',
  isActive: true,
};

const ALL_TYPES = Object.keys(EMAIL_TEMPLATE_TYPE_LABELS) as EmailTemplateType[];
const ALL_CATEGORIES = Object.keys(EMAIL_TEMPLATE_CATEGORY_LABELS) as EmailTemplateCategory[];

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<EmailTemplateCategory | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/email-templates')
      .then((r) => r.json())
      .then((json) => setTemplates(json.data ?? []))
      .catch(() => setError('Failed to load templates'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filteredTemplates =
    activeCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      type: t.type,
      subject: t.subject,
      htmlBody: t.htmlBody,
      textBody: t.textBody,
      sequenceOrder: t.sequenceOrder?.toString() ?? '',
      delayDays: t.delayDays?.toString() ?? '',
      availableVariables: (t.availableVariables ?? []).join(', '),
      isActive: t.isActive,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name,
      type: form.type,
      subject: form.subject,
      htmlBody: form.htmlBody,
      textBody: form.textBody,
      sequenceOrder: form.sequenceOrder ? parseInt(form.sequenceOrder, 10) : undefined,
      delayDays: form.delayDays ? parseInt(form.delayDays, 10) : undefined,
      availableVariables: form.availableVariables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      isActive: form.isActive,
    };

    try {
      const url = editingId
        ? `/api/admin/email-templates/${editingId}`
        : '/api/admin/email-templates';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Save failed');
      }
      setShowForm(false);
      setSuccess(editingId ? 'Template updated.' : 'Template created.');
      setTimeout(() => setSuccess(null), 4000);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/email-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setSuccess('Template deleted.');
      setTimeout(() => setSuccess(null), 4000);
      load();
    } catch {
      setError('Failed to delete template');
    }
  };

  const isSequenceType = (type: EmailTemplateType) =>
    type === 'onboarding_followup' || type === 'welcome_sequence';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#16263B]">Email Templates</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage transactional and sequence emails.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-4 py-2 text-sm font-medium text-white hover:bg-[#E08B00] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Template
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(['all', ...ALL_CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeCategory === cat
                ? 'border-[#F5A523] text-[#B45600]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {cat === 'all' ? 'All' : EMAIL_TEMPLATE_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="h-6 w-6 animate-spin text-[#F08000]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="tp-card py-16 text-center">
          <p className="text-sm text-slate-500 mb-3">No templates in this category yet.</p>
          <button type="button" onClick={openCreate} className="text-sm font-medium text-[#B45600] hover:underline">
            Create the first one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((t) => (
            <div key={t.id} className="tp-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[#1C2A3A] text-sm">{t.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {EMAIL_TEMPLATE_TYPE_LABELS[t.type]}
                    </span>
                    {!t.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{t.subject}</p>
                  {isSequenceType(t.type) && (t.sequenceOrder != null || t.delayDays != null) && (
                    <p className="text-xs text-slate-400 mt-1">
                      {t.sequenceOrder != null && `Step ${t.sequenceOrder}`}
                      {t.delayDays != null && ` · +${t.delayDays} days`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="text-xs font-medium text-[#B45600] hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id, t.name)}
                    className="text-xs font-medium text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8 p-6">
            <h2 className="font-display text-lg font-semibold text-[#16263B] mb-5">
              {editingId ? 'Edit Template' : 'New Template'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Template name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as EmailTemplateType }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                  >
                    {ALL_TYPES.map((t) => (
                      <option key={t} value={t}>{EMAIL_TEMPLATE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subject line</label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                />
              </div>

              {isSequenceType(form.type) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Sequence order (1-based)</label>
                    <input
                      type="number"
                      min={1}
                      value={form.sequenceOrder}
                      onChange={(e) => setForm((p) => ({ ...p, sequenceOrder: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Delay (days after trigger)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.delayDays}
                      onChange={(e) => setForm((p) => ({ ...p, delayDays: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">HTML body</label>
                <textarea
                  required
                  rows={8}
                  value={form.htmlBody}
                  onChange={(e) => setForm((p) => ({ ...p, htmlBody: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523] resize-y"
                  placeholder="<p>Hello {{firstName}},</p>"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Plain text body</label>
                <textarea
                  required
                  rows={4}
                  value={form.textBody}
                  onChange={(e) => setForm((p) => ({ ...p, textBody: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523] resize-y"
                  placeholder="Hello {{firstName}},"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Available variables <span className="font-normal text-slate-400">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={form.availableVariables}
                  onChange={(e) => setForm((p) => ({ ...p, availableVariables: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
                  placeholder="firstName, loanAmount, dueDate"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isActive}
                  onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.isActive ? 'bg-[#F5A523]' : 'bg-slate-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-slate-700">Active</span>
              </div>

              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {formError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-4 py-2 text-sm font-medium text-white hover:bg-[#E08B00] transition-colors disabled:opacity-60"
                >
                  {saving && (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Template'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
