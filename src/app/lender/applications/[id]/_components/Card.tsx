import ConsoleIcon, { type ConsoleIconName } from '@/components/lender/ConsoleIcon';

export function Card({
  title,
  icon,
  action,
  muted,
  children,
}: {
  title?: string;
  icon?: ConsoleIconName;
  action?: React.ReactNode;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border bg-white p-5 shadow-[var(--shadow-xs)] ${
        muted ? 'border-dashed border-[var(--border-default)] bg-[var(--slate-50)]' : 'border-[var(--border-default)]'
      }`}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            className={`flex items-center gap-2 font-display text-[15px] font-bold ${
              muted ? 'text-[var(--text-muted)]' : 'text-[var(--text-strong)]'
            }`}
          >
            {icon && (
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-[8px] ${
                  muted ? 'bg-[var(--slate-100)] text-[var(--slate-400)]' : 'bg-[var(--orange-50)] text-[var(--orange-700)]'
                }`}
              >
                <ConsoleIcon name={icon} size={16} />
              </span>
            )}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm text-[var(--text-body)]">{value}</dd>
    </div>
  );
}

export const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]';
export const INPUT_CLASS =
  'w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]';
