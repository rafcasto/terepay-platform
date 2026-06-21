'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { AuthShell } from '../_components/auth-shell';
import { AuthIcon } from '../_components/auth-icons';
import { Field, InputShell, EyeToggle, SubmitButton, Checkbox, ErrorAlert } from '../_components/auth-ui';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIAL_CODES = [
  { flag: '🇳🇿', code: '+64', country: 'NZ' },
  { flag: '🇦🇺', code: '+61', country: 'AU' },
  { flag: '🇺🇸', code: '+1', country: 'US' },
  { flag: '🇬🇧', code: '+44', country: 'GB' },
  { flag: '🇵🇭', code: '+63', country: 'PH' },
  { flag: '🇮🇳', code: '+91', country: 'IN' },
  { flag: '🇨🇦', code: '+1', country: 'CA' },
  { flag: '🇸🇬', code: '+65', country: 'SG' },
];

const PASSWORD_RULES = [
  { label: '8 characters', test: (p: string) => p.length >= 8 },
  { label: '1 upper case', test: (p: string) => /[A-Z]/.test(p) },
  { label: '1 lower case', test: (p: string) => /[a-z]/.test(p) },
  { label: '1 number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'special char', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

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

// ---------------------------------------------------------------------------
// Password strength meter (DS four-bar style)
// ---------------------------------------------------------------------------

function PasswordStrength({ password }: { password: string }) {
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

// ---------------------------------------------------------------------------
// Main signup page
// ---------------------------------------------------------------------------

export default function SignupPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [dialCode, setDialCode] = useState('+64');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim()) errs.lastName = 'Last name is required';
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Valid email address is required';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 6) errs.phone = 'Valid phone number is required';
    if (PASSWORD_RULES.some((r) => !r.test(password))) errs.password = 'Password does not meet all requirements.';
    if (password !== confirmPassword) errs.confirm = 'Passwords do not match.';
    if (!agreedToTerms) errs.terms = 'You must accept the loan agreement terms and privacy policy.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [firstName, lastName, email, phone, password, confirmPassword, agreedToTerms]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setApiError('');
    setLoading(true);

    let firebaseUser = null;
    try {
      // 1. Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(clientAuth, email.trim().toLowerCase(), password);
      firebaseUser = cred.user;

      // 2. Get ID token to prove identity to the signup API
      const idToken = await firebaseUser.getIdToken(true);

      // 3. Create Firestore profile and set role: 'applicant' custom claim
      const recaptchaToken = executeRecaptcha ? await executeRecaptcha('signup') : undefined;
      const fullPhone = `${dialCode} ${phone}`.trim();
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phone: fullPhone, idToken, ...(recaptchaToken ? { recaptchaToken } : {}) }),
      });

      if (!res.ok) {
        const body = await res.json();
        // Clean up orphaned Firebase account
        await deleteUser(firebaseUser).catch(() => {});
        setApiError(body.error?.message ?? 'Registration failed. Please try again.');
        return;
      }

      // 4. Sign in to get a fresh token that includes the role claim, creates session cookie
      await login(email.trim().toLowerCase(), password);
      router.push('/applicant/onboarding');
    } catch (err: unknown) {
      if (firebaseUser) await deleteUser(firebaseUser).catch(() => {});
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') {
        setErrors((prev) => ({ ...prev, email: 'An account with this email already exists. Please sign in instead.' }));
      } else {
        setApiError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [firstName, lastName, email, dialCode, phone, password, confirmPassword, agreedToTerms, executeRecaptcha, login, router, validate]);

  return (
    <AuthShell
      mode="register"
      eyebrow="Get started"
      title="Create your account"
      subtitle="A few details to get going. You’ll complete your full loan application after signing in."
    >
      <form
        className="flex flex-col gap-[18px]"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field htmlFor="firstName" label="First name" required error={errors.firstName}>
            <InputShell
              id="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="Rafael"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              invalid={!!errors.firstName}
            />
          </Field>
          <Field htmlFor="lastName" label="Last name" required error={errors.lastName}>
            <InputShell
              id="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Castillo"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              invalid={!!errors.lastName}
            />
          </Field>
        </div>

        <Field htmlFor="email" label="Email address" required error={errors.email}>
          <InputShell
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            prefix={AuthIcon.mail}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((p) => ({ ...p, email: '' }));
            }}
            invalid={!!errors.email}
          />
          {errors.email?.toLowerCase().includes('already exists') && (
            <Link href="/auth/login" className="text-[12.5px] font-semibold text-[var(--text-link)] underline">
              Sign in instead
            </Link>
          )}
        </Field>

        <Field htmlFor="phone" label="Mobile number" required error={errors.phone}>
          <div
            className={`flex h-12 items-center rounded-[10px] border bg-white transition-[border-color,box-shadow] duration-150 ${
              errors.phone
                ? 'border-[var(--danger-500)] focus-within:shadow-[0_0_0_3px_rgba(220,38,38,0.16)]'
                : 'border-[var(--border-default)] hover:border-[var(--slate-300)] focus-within:border-[var(--orange-500)] focus-within:shadow-[0_0_0_3px_rgba(240,128,0,0.18)]'
            }`}
          >
            <select
              aria-label="Country dial code"
              value={dialCode}
              onChange={(e) => setDialCode(e.target.value)}
              className="h-full shrink-0 rounded-l-[10px] border-0 border-r border-[var(--border-default)] bg-transparent px-2.5 text-[14px] text-[var(--text-strong)] outline-none"
            >
              {DIAL_CODES.map((d) => (
                <option key={`${d.country}-${d.code}`} value={d.code}>
                  {d.flag} {d.code}
                </option>
              ))}
            </select>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="21 123 4567"
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-3.5 text-[15px] text-[var(--text-strong)] outline-none placeholder:text-[var(--slate-400)]"
            />
          </div>
        </Field>

        <Field
          htmlFor="password"
          label="Password"
          required
          hint="At least 8 characters. Use a mix of letters, numbers and symbols."
          error={errors.password}
        >
          <InputShell
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Create a password"
            prefix={AuthIcon.lock}
            suffix={<EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!errors.password}
          />
          {password && <PasswordStrength password={password} />}
        </Field>

        <Field htmlFor="confirmPassword" label="Confirm password" required error={errors.confirm}>
          <InputShell
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            prefix={AuthIcon.lock}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            invalid={!!errors.confirm}
          />
        </Field>

        <div className="pt-1">
          <Checkbox id="terms" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}>
            I agree to the <a href="/terms">loan agreement terms</a> and <a href="/privacy">privacy policy</a>. All loans are
            charged interest and an admin fee, shown in full before you sign.
          </Checkbox>
          {errors.terms && <p className="mt-1.5 text-[12.5px] font-medium text-[var(--text-danger)]">{errors.terms}</p>}
        </div>

        {apiError && <ErrorAlert>{apiError}</ErrorAlert>}

        <div className="mt-2">
          <SubmitButton type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
            {!loading && AuthIcon.arrow}
          </SubmitButton>
        </div>

        <p className="text-center text-[14.5px] text-[var(--text-muted)]">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-[var(--text-link)] hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
