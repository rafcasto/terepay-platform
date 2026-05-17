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
        <div className={`flex justify-between text-xs mb-2 ${onInk ? 'text-white/60' : 'text-muted'}`}>
          {label && <span>{label}</span>}
          {trailing && <span className={onInk ? 'text-accent font-medium' : 'text-accent-2 font-medium'}>{trailing}</span>}
        </div>
      )}
      <div className={`h-1.5 w-full rounded-full overflow-hidden ${onInk ? 'bg-white/20' : 'bg-border'}`}>
        <div
          className="h-full rounded-full progress-fill"
          style={{
            width: `${clamped}%`,
            background: 'linear-gradient(90deg, #f5a623, #f59412)',
          }}
        />
      </div>
    </div>
  );
}
