'use client';

import { useEffect, useState } from 'react';
import type { TrainingSettings } from '@/types/training';
import { rpc } from './lib';
import { Field, Section, inputCls, primaryBtn } from './ui';
import type { TabProps } from './TrainingConsole';

export default function SettingsTab({ notify, fail }: TabProps) {
  const [form, setForm] = useState<TrainingSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    rpc<TrainingSettings>('settings.get').then(setForm).catch((e) => fail(e instanceof Error ? e.message : 'Could not load settings'));
  }, [fail]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const settings: Partial<TrainingSettings> = { ...form };
      delete settings.local_gpu;
      setForm(await rpc<TrainingSettings>('settings.set', { settings }));
      notify('Worker settings saved.');
    } catch (e) { fail(e instanceof Error ? e.message : 'Could not save'); } finally { setSaving(false); }
  };

  if (!form) return <p className="text-sm text-slate-500">Loading worker settings…</p>;
  const set = <K extends keyof TrainingSettings>(k: K, v: TrainingSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <Section
      title="GPU host and model names"
      hint="Fine-tuning runs off the assessment machine on an NVIDIA host reached over SSH (or locally when the worker itself has a GPU). Stored on the worker; admin only."
      actions={<button type="button" onClick={save} disabled={saving} className={primaryBtn}>{saving ? 'Saving…' : 'Save'}</button>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="GPU mode">
          <select value={form.gpu_mode} onChange={(e) => set('gpu_mode', e.target.value as TrainingSettings['gpu_mode'])} className={`${inputCls} w-full`}>
            <option value="ssh">Remote host over SSH</option>
            <option value="local" disabled={!form.local_gpu}>This machine{form.local_gpu ? '' : ' (no NVIDIA GPU detected)'}</option>
          </select>
        </Field>
        <Field label="Epochs (1–10)"><input type="number" min={1} max={10} value={form.epochs} onChange={(e) => set('epochs', Number(e.target.value))} className={`${inputCls} w-full`} /></Field>
        <Field label="SSH host"><input value={form.ssh_host} onChange={(e) => set('ssh_host', e.target.value)} placeholder="gpu.example.com" className={`${inputCls} w-full`} /></Field>
        <Field label="SSH user"><input value={form.ssh_user} onChange={(e) => set('ssh_user', e.target.value)} className={`${inputCls} w-full`} /></Field>
        <Field label="SSH key path on the worker (optional)"><input value={form.ssh_key} onChange={(e) => set('ssh_key', e.target.value)} placeholder="~/.ssh/id_ed25519" className={`${inputCls} w-full`} /></Field>
        <Field label="Remote working directory"><input value={form.remote_dir} onChange={(e) => set('remote_dir', e.target.value)} className={`${inputCls} w-full`} /></Field>
        <Field label="Base model (Hugging Face id)"><input value={form.base_model} onChange={(e) => set('base_model', e.target.value)} className={`${inputCls} w-full`} /></Field>
        <Field label="Ollama name for the fine-tuned model"><input value={form.ollama_name} onChange={(e) => set('ollama_name', e.target.value)} className={`${inputCls} w-full`} /></Field>
      </div>
    </Section>
  );
}
