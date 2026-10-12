'use client';

/* ---------------------------------------------------------------------------
   Password policy + strength meter shared by registration and password reset,
   so a reset password is held to exactly the same rules as a new one.
   --------------------------------------------------------------------------- */

export const PASSWORD_RULES = [
  { label: '8 characters', test: (p: string) => p.length >= 8 },
  { label: '1 upper case', test: (p: string) => /[A-Z]/.test(p) },
  { label: '1 lower case', test: (p: string) => /[a-z]/.test(p) },
  { label: '1 number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'special char', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

export const PASSWORD_HINT = 'At least 8 characters. Use a mix of upper and lower case letters, numbers and symbols.';

export function meetsPasswordPolicy(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password));
}

const STRENGTH = [
  { label: 'Too short', color: 'var(--slate-300)' },
  { label: 'Weak', color: 'var(--danger-500)' },
  { label: 'Fair', color: 'var(--warning-500)' },
  { label: 'Good', color: 'var(--gold-500)' },
  { label: 'Strong', color: 'var(--success-500)' },
];

function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

/** DS four-bar strength meter. */
export function PasswordStrength({ password }: { password: string }) {
  const score = scorePassword(password);
  const { label, color } = STRENGTH[score];
  return (
    <div className="mt-0.5 flex flex-col gap-1.5" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-[5px] flex-1 rounded-full transition-colors"
            style={{ background: i < score ? color : 'var(--slate-200)' }}
          />
        ))}
      </div>
      <div className="text-[12.5px] text-[var(--text-muted)]">
        Password strength:{' '}
        <b className="font-semibold" style={{ color: score === 0 ? 'var(--text-muted)' : color }}>
          {label}
        </b>
      </div>
    </div>
  );
}
