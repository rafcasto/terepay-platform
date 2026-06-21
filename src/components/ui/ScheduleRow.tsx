import type { ReactNode } from 'react';
import { Pill } from './Pill';

type Status = 'paid' | 'next' | 'upcoming' | 'overdue';

interface ScheduleRowProps {
  date: Date | string;
  label: ReactNode;
  amount: string;
  status: Status;
}

const STATUS_PILLS: Record<Status, { tone: Parameters<typeof Pill>[0]['tone']; text: string; pulse?: boolean }> = {
  paid: { tone: 'success', text: 'Paid' },
  next: { tone: 'amber', text: 'Next', pulse: true },
  upcoming: { tone: 'muted', text: 'Upcoming' },
  overdue: { tone: 'danger', text: 'Overdue', pulse: true },
};

const TILE_BG: Record<Status, string> = {
  paid: 'bg-success-soft text-[#0e6b2e]',
  next: 'bg-accent-soft text-accent-2',
  upcoming: 'bg-surface-2 text-muted',
  overdue: 'bg-danger-soft text-danger',
};

export function ScheduleRow({ date, label, amount, status }: ScheduleRowProps) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const isValid = !isNaN(d.getTime());
  const month = isValid ? d.toLocaleDateString('en-NZ', { month: 'short' }).toUpperCase() : '—';
  const day = isValid ? d.getDate().toString() : '—';
  const pill = STATUS_PILLS[status];

  return (
    <div className="flex items-center gap-4 py-3 border-b border-border-2 last:border-0">
      <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${TILE_BG[status]}`}>
        <span className="text-[9.5px] font-semibold tracking-wider">{month}</span>
        <span className="text-base font-bold leading-none">{day}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text">{label}</p>
        <div className="mt-1">
          <Pill tone={pill.tone} pulse={pill.pulse}>
            {pill.text}
          </Pill>
        </div>
      </div>
      <div className={`text-sm font-bold tabular-nums ${status === 'paid' ? 'text-muted line-through' : 'text-text'}`}>
        {amount}
      </div>
    </div>
  );
}
