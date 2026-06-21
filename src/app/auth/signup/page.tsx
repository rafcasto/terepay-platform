'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIAL_CODES = [
  { flag: '🇳🇿', code: '+64', country: 'NZ' },
  { flag: '🇦🇺', code: '+61', country: 'AU' },
  { flag: '🇺🇸', code: '+1',  country: 'US' },
  { flag: '🇬🇧', code: '+44', country: 'GB' },
  { flag: '🇵🇭', code: '+63', country: 'PH' },
  { flag: '🇮🇳', code: '+91', country: 'IN' },
  { flag: '🇨🇦', code: '+1',  country: 'CA' },
  { flag: '🇸🇬', code: '+65', country: 'SG' },
];

const SLIDES = [
  { heading: 'Getting funded starts here.', body: 'Apply in minutes and receive a lending decision within 24 hours.' },
  { heading: 'Secure by design.', body: 'End-to-end encryption and strict access controls protect your data at every step.' },
  { heading: 'Transparent terms.', body: 'Clear repayment schedules. No hidden fees. Ever.' },
];

const PASSWORD_RULES = [
  { label: '8 characters', test: (p: string) => p.length >= 8 },
  { label: '1 upper case', test: (p: string) => /[A-Z]/.test(p) },
  { label: '1 lower case', test: (p: string) => /[a-z]/.test(p) },
  { label: '1 number',     test: (p: string) => /[0-9]/.test(p) },
  { label: 'special char', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

const inputCls =
  'w-full px-3.5 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:bg-white transition-all';
const errorCls = 'mt-1 text-xs text-red-500';

// ---------------------------------------------------------------------------
// Brand panel
// ---------------------------------------------------------------------------

function BrandPanel() {
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hidden md:flex flex-col justify-between bg-[#0D1B2A] text-white px-10 py-12 w-[42%] min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <svg viewBox="0 0 400 500" className="absolute bottom-0 right-0 w-full h-full opacity-[0.07]" fill="none" xmlns="http://www.w3.org/2000/svg">
          {Array.from({ length: 6 }).map((_, row) =>
            Array.from({ length: 5 }).map((_, col) => {
              const x = col * 80 + (row % 2) * 40 + 10;
              const y = row * 80 + 20;
              return <circle key={`${row}-${col}`} cx={x} cy={y} r="3" fill="#F5A523" />;
            }),
          )}
          {Array.from({ length: 5 }).map((_, row) =>
            Array.from({ length: 4 }).map((_, col) => {
              const x1 = col * 80 + (row % 2) * 40 + 10;
              const y1 = row * 80 + 20;
              const x2 = (col + 1) * 80 + (row % 2) * 40 + 10;
              const y2 = y1;
              const x3 = col * 80 + ((row + 1) % 2) * 40 + 10;
              const y3 = (row + 1) * 80 + 20;
              return (
                <g key={`l-${row}-${col}`}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F5A523" strokeWidth="0.8" />
                  <line x1={x1} y1={y1} x2={x3} y2={y3} stroke="#F5A523" strokeWidth="0.8" />
                </g>
              );
            }),
          )}
        </svg>
      </div>

      <div className="relative z-10">
        <span className="text-2xl font-extrabold text-[#F5A523] tracking-tight">TerePay</span>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center gap-8 mt-12">
        <svg viewBox="0 0 220 180" className="w-48 mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="110" cy="155" rx="80" ry="12" fill="#F5A523" fillOpacity="0.15" />
          <rect x="90" y="80" width="40" height="70" rx="4" fill="#F5A523" fillOpacity="0.25" />
          <rect x="96" y="60" width="28" height="30" rx="3" fill="#F5A523" fillOpacity="0.4" />
          <rect x="102" y="44" width="16" height="22" rx="2" fill="#F5A523" fillOpacity="0.7" />
          <rect x="44" y="110" width="36" height="40" rx="3" fill="#F5A523" fillOpacity="0.2" />
          <rect x="50" y="96" width="24" height="20" rx="2" fill="#F5A523" fillOpacity="0.35" />
          <rect x="140" y="100" width="36" height="50" rx="3" fill="#F5A523" fillOpacity="0.2" />
          <rect x="146" y="82" width="24" height="24" rx="2" fill="#F5A523" fillOpacity="0.35" />
          <circle cx="110" cy="40" r="6" fill="#F5A523" />
          <circle cx="60" cy="90" r="4" fill="#F5A523" fillOpacity="0.7" />
          <circle cx="160" cy="76" r="4" fill="#F5A523" fillOpacity="0.7" />
          <line x1="110" y1="44" x2="60" y2="90" stroke="#F5A523" strokeWidth="1" strokeOpacity="0.4" />
          <line x1="110" y1="44" x2="160" y2="76" stroke="#F5A523" strokeWidth="1" strokeOpacity="0.4" />
        </svg>

        <div className="relative text-center h-[100px] flex flex-col items-center justify-center">
          {SLIDES.map((slide, i) => (
            <div key={i} className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-700"
              style={{ opacity: i === slideIdx ? 1 : 0 }} aria-hidden={i !== slideIdx}>
              <h2 className="text-2xl font-bold leading-snug max-w-xs mx-auto">{slide.heading}</h2>
              <p className="mt-2 text-sm text-white/60 max-w-xs mx-auto leading-relaxed">{slide.body}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mt-8">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setSlideIdx(i)} aria-label={`Go to slide ${i + 1}`}
              className="transition-all duration-300 border-0 p-0"
              style={{ width: i === slideIdx ? 24 : 8, height: 8, borderRadius: 99, background: i === slideIdx ? '#F5A523' : 'rgba(255,255,255,0.3)', cursor: 'pointer' }} />
          ))}
        </div>
      </div>

      <div className="relative z-10 text-xs text-white/40 mt-8">© {new Date().getFullYear()} TerePay</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password strength badges
// ---------------------------------------------------------------------------

function PasswordStrengthBadges({ password }: { password: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <span key={rule.label} className={`flex items-center gap-1 text-xs font-medium transition-colors ${ok ? 'text-green-600' : 'text-gray-400'}`}>
            <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border text-[9px] transition-all ${ok ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-transparent'}`}>✓</span>
            {rule.label}
          </span>
        );
      })}
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
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [dialCode, setDialCode]   = useState('+64');
  const [phone, setPhone]         = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim())  errs.lastName  = 'Last name is required';
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Valid email address is required';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 6) errs.phone = 'Valid phone number is required';
    if (PASSWORD_RULES.some((r) => !r.test(password))) errs.password = 'Password does not meet all requirements.';
    if (password !== confirmPassword) errs.confirm = 'Passwords do not match.';
    if (!agreedToTerms) errs.terms = 'You must accept the Terms of Service and Privacy Policy.';
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
    <div className="flex min-h-screen">
      <BrandPanel />

      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 overflow-y-auto">
        <div className="w-full max-w-md mx-auto">
          <div className="md:hidden mb-8">
            <span className="text-2xl font-extrabold text-[#F5A523]">TerePay</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 mb-7">Fill in your details to get started</p>

          <div className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  First name <span className="text-red-500">*</span>
                </label>
                <input id="firstName" type="text" autoComplete="given-name" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} className={inputCls} placeholder="Rafael" />
                {errors.firstName && <p className={errorCls}>{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Last name <span className="text-red-500">*</span>
                </label>
                <input id="lastName" type="text" autoComplete="family-name" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} className={inputCls} placeholder="Castillo" />
                {errors.lastName && <p className={errorCls}>{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address <span className="text-red-500">*</span>
              </label>
              <input id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                className={inputCls} placeholder="you@example.com" />
              {errors.email && (
                <p className={errorCls}>
                  {errors.email}{' '}
                  {errors.email.toLowerCase().includes('already exists') && (
                    <Link href="/auth/login" className="underline font-medium">Sign in instead</Link>
                  )}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Mobile number <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-[#F5A523] focus-within:border-[#F5A523] overflow-hidden transition-all bg-gray-50 focus-within:bg-white">
                <select aria-label="Country dial code" value={dialCode} onChange={(e) => setDialCode(e.target.value)}
                  className="bg-transparent border-r border-gray-200 px-2 py-3 text-sm text-gray-700 outline-none shrink-0">
                  {DIAL_CODES.map((d) => (
                    <option key={`${d.country}-${d.code}`} value={d.code}>{d.flag} {d.code}</option>
                  ))}
                </select>
                <input id="phone" type="tel" inputMode="numeric" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 px-3 py-3 text-sm outline-none bg-transparent" placeholder="21 123 4567" />
              </div>
              {errors.phone && <p className={errorCls}>{errors.phone}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pr-14`} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {password && <PasswordStrengthBadges password={password} />}
              {errors.password && <p className={errorCls}>{errors.password}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm password <span className="text-red-500">*</span>
              </label>
              <input id="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputCls} placeholder="••••••••" />
              {errors.confirm && <p className={errorCls}>{errors.confirm}</p>}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3 pt-1">
              <input id="terms" type="checkbox" checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#F5A523]" />
              <label htmlFor="terms" className="text-sm text-gray-600 leading-snug">
                I agree to the{' '}
                <a href="/terms" className="text-[#F5A523] hover:text-[#E08B00] underline">Terms of Service</a>{' '}
                and{' '}
                <a href="/privacy" className="text-[#F5A523] hover:text-[#E08B00] underline">Privacy Policy</a>
              </label>
            </div>
            {errors.terms && <p className={errorCls}>{errors.terms}</p>}

            {apiError && (
              <p role="alert" className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {apiError}
              </p>
            )}

            <button onClick={handleSubmit} disabled={loading}
              className="w-full py-3 px-4 bg-[#F5A523] hover:bg-[#E08B00] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <p className="text-center text-sm text-gray-500 pt-1">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-[#F5A523] hover:text-[#E08B00] font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
