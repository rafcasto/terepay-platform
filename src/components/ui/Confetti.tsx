'use client';

const COLORS = ['#f5a623', '#16a34a', '#2563eb', '#dc2626', '#f59412', '#0ea5e9'];

// Deterministic pseudo-random in [0,1) based on a seed — avoids Math.random()
// during render (a React purity violation) while still spraying the confetti
// across the canvas. Stability across renders is fine: it's a one-shot
// celebration animation.
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function Confetti({ count = 24 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    left: rand(i + 1) * 100,
    cx: (rand(i + 17) - 0.5) * 240,
    bg: COLORS[i % COLORS.length],
    delay: 700 + rand(i + 31) * 400,
    rot: rand(i + 47) * 360,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: 0,
            background: p.bg,
            ['--cx' as string]: `${p.cx}px`,
            animationDelay: `${p.delay}ms`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}
