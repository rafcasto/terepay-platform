interface ProgressBarProps {
  value: number; // 0..100
  onInk?: boolean;
  label?: string;
  trailing?: string;
}

export function ProgressBar({ value, onInk = false, label, trailing }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      {(label || trailing) && (
        <div className={`flex justify-between text-xs mb-2 ${onInk ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
          {label && <span>{label}</span>}
          {trailing && (
            <span className={`font-medium ${onInk ? 'text-[var(--gold-300)]' : 'text-brand-text'}`}>{trailing}</span>
          )}
        </div>
      )}
      <div className={`h-1.5 w-full rounded-pill overflow-hidden ${onInk ? 'bg-white/20' : 'bg-border-default'}`}>
        <div
          className="h-full rounded-pill progress-fill"
          style={{
            width: `${clamped}%`,
            background: 'linear-gradient(90deg, var(--orange-500), var(--gold-500))',
          }}
        />
      </div>
    </div>
  );
}
