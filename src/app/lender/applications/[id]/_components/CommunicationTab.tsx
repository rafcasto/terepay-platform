'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CommunicationChannel, CommunicationDirection } from '@/types/application';
import ConsoleIcon, { type ConsoleIconName } from '@/components/lender/ConsoleIcon';
import ConsolePill from '@/components/lender/ConsolePill';
import AddNoteForm from '../AddNoteForm';
import { Card, INPUT_CLASS, SECTION_LABEL } from './Card';
import type { CommunicationItem, ReviewData } from './review-types';

type Filter = 'all' | CommunicationChannel;

const CHANNEL_META: Record<CommunicationChannel, { label: string; plural: string; icon: ConsoleIconName }> = {
  call: { label: 'Call', plural: 'Calls', icon: 'phoneCall' },
  message: { label: 'Message', plural: 'Messages', icon: 'message' },
  email: { label: 'Email', plural: 'Emails', icon: 'mail' },
  system: { label: 'Tracker update', plural: 'Tracker updates', icon: 'cpu' },
};

/** Channels a lender can log by hand — `system` entries are only ever recorded automatically. */
const MANUAL_CHANNELS: CommunicationChannel[] = ['call', 'message', 'email'];

/**
 * Step 5 of the review flow — one place for every call, text/WhatsApp message
 * and email exchanged with the applicant, plus lender-only internal notes.
 */
export default function CommunicationTab({ data }: { data: ReviewData }) {
  const [filter, setFilter] = useState<Filter>('all');
  const items = filter === 'all' ? data.communications : data.communications.filter((c) => c.channel === filter);
  const count = (ch: CommunicationChannel) => data.communications.filter((c) => c.channel === ch).length;

  return (
    <>
      <Card
        title="Communication log"
        icon="phoneCall"
        action={
          <div className="flex items-center gap-2">
            {data.header.phone && (
              <a
                href={`tel:${data.header.phone}`}
                className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border-default)] bg-white px-2 py-1 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <ConsoleIcon name="phoneCall" size={14} />
                Call
              </a>
            )}
            {data.header.email && (
              <a
                href={`mailto:${data.header.email}`}
                className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border-default)] bg-white px-2 py-1 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <ConsoleIcon name="mail" size={14} />
                Email
              </a>
            )}
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(['all', 'call', 'message', 'email', 'system'] as Filter[]).map((f) => {
            const n = f === 'all' ? data.communications.length : count(f);
            const label = f === 'all' ? 'All' : CHANNEL_META[f].plural;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-[var(--ink-800)] text-white'
                    : 'bg-[var(--slate-100)] text-[var(--slate-600)] hover:bg-[var(--slate-200)]'
                }`}
              >
                {label}
                <span className={`tabular-nums ${filter === f ? 'opacity-80' : 'text-[var(--text-muted)]'}`}>{n}</span>
              </button>
            );
          })}
        </div>

        {items.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-white/70 p-4 text-sm text-[var(--text-muted)]">
            {data.communications.length === 0
              ? 'No contact logged yet. Document requests, decisions and rejections are recorded here automatically; log calls, messages and emails yourself.'
              : `No ${CHANNEL_META[filter as CommunicationChannel].plural.toLowerCase()} logged.`}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((c) => (
              <LogRow key={c.id} item={c} />
            ))}
          </ul>
        )}

        {data.isAssigned ? (
          <LogCommunicationForm applicationId={data.applicationId} />
        ) : (
          <p className="mt-4 text-xs text-[var(--text-muted)]">Claim this application to log calls, messages and emails.</p>
        )}
      </Card>

      <Card title={`Internal notes (${data.notes.length})`} icon="fileText">
        {data.notes.length > 0 && (
          <ul className="mb-4 space-y-3">
            {data.notes.map((n) => (
              <li key={n.id} className="rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-body)]">{n.author}</span>
                  <span className="text-xs text-[var(--text-muted)]">{n.date}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-[var(--text-body)]">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
        {data.isAssigned && <AddNoteForm applicationId={data.applicationId} />}
        <p className="mt-3 text-xs text-[var(--text-muted)]">Internal notes are never shown to the applicant.</p>
      </Card>
    </>
  );
}

function LogRow({ item }: { item: CommunicationItem }) {
  const meta = CHANNEL_META[item.channel];
  const outbound = item.direction === 'outbound';
  const auto = item.source === 'system';
  return (
    <li
      className={`rounded-[var(--radius-md)] border p-3 ${
        auto ? 'border-[var(--border-subtle)] bg-[var(--slate-50)]' : 'border-[var(--border-subtle)] bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            auto ? 'bg-[var(--slate-100)] text-[var(--slate-600)]' : 'bg-[var(--orange-50)] text-[var(--orange-700)]'
          }`}
        >
          <ConsoleIcon name={meta.icon} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--text-body)]">
              {item.channel === 'system' ? meta.label : `${outbound ? 'Outbound' : 'Inbound'} ${meta.label.toLowerCase()}`}
            </p>
            {auto ? (
              <ConsolePill tone="neutral">Recorded automatically</ConsolePill>
            ) : (
              <ConsolePill tone={outbound ? 'info' : 'neutral'}>{outbound ? 'We contacted them' : 'They contacted us'}</ConsolePill>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-body)]">{item.summary}</p>
          {item.outcome && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-body)]">Outcome:</span> {item.outcome}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            {item.occurredAt} · {auto ? item.loggedBy : `logged by ${item.loggedBy}`}
          </p>
        </div>
      </div>
    </li>
  );
}

function localNowForInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function LogCommunicationForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<CommunicationChannel>('call');
  const [direction, setDirection] = useState<CommunicationDirection>('outbound');
  const [occurredAt, setOccurredAt] = useState(localNowForInput);
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setChannel('call');
    setDirection('outbound');
    setOccurredAt(localNowForInput());
    setSummary('');
    setOutcome('');
    setError(null);
  };

  const submit = async () => {
    if (summary.trim().length < 3) {
      setError('Add a short summary of the conversation.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const when = new Date(occurredAt);
      const res = await fetch(`/api/applications/${applicationId}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          direction,
          summary: summary.trim(),
          outcome: outcome.trim() || undefined,
          occurredAt: Number.isNaN(when.getTime()) ? undefined : when.toISOString(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error?.message ?? 'Could not save entry');
      }
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--ink-800)] px-3 py-1.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
        >
          <ConsoleIcon name="plus" size={16} />
          Log a call, message or email
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--slate-50)] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className={`${SECTION_LABEL} mb-1.5`}>Channel</p>
          <div className="flex gap-1">
            {MANUAL_CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={`inline-flex flex-1 items-center justify-center gap-1 rounded-[8px] border px-2 py-1.5 text-xs font-semibold transition-colors ${
                  channel === ch
                    ? 'border-[var(--ink-800)] bg-[var(--ink-800)] text-white'
                    : 'border-[var(--border-default)] bg-white text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                }`}
              >
                <ConsoleIcon name={CHANNEL_META[ch].icon} size={14} />
                {CHANNEL_META[ch].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={`${SECTION_LABEL} mb-1.5 block`}>Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as CommunicationDirection)}
            className={INPUT_CLASS}
          >
            <option value="outbound">Outbound — we contacted the applicant</option>
            <option value="inbound">Inbound — the applicant contacted us</option>
          </select>
        </div>
        <div>
          <label className={`${SECTION_LABEL} mb-1.5 block`}>When</label>
          <input
            type="datetime-local"
            value={occurredAt}
            max={localNowForInput()}
            onChange={(e) => setOccurredAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div>
        <label className={`${SECTION_LABEL} mb-1.5 block`}>Summary</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={
            channel === 'call'
              ? 'e.g. Confirmed employer and start date; applicant will send latest payslip today.'
              : channel === 'message'
                ? 'e.g. Texted reminder that bank statements are still outstanding.'
                : 'e.g. Emailed request for proof of address and visa copy.'
          }
          className={`${INPUT_CLASS} resize-none`}
        />
      </div>

      <div>
        <label className={`${SECTION_LABEL} mb-1.5 block`}>Outcome / next step (optional)</label>
        <input
          type="text"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          maxLength={500}
          placeholder="e.g. Follow up Friday if payslip not received"
          className={INPUT_CLASS}
        />
      </div>

      {error && <p className="text-xs text-[var(--danger-700)]">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={busy}
          className="rounded-[10px] px-3 py-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-body)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || summary.trim().length < 3}
          className="rounded-[10px] bg-[var(--ink-800)] px-4 py-1.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </div>
  );
}
