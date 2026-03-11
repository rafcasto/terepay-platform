'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sendEmailVerification } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Step1Data {
  firstName: string;
  lastName: string;
  email: string;
  dialCode: string;
  phone: string;
}

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

// ---------------------------------------------------------------------------
// Left brand panel — slides
// ---------------------------------------------------------------------------

const SLIDES = [
  {
    heading: 'Getting funded starts here.',
    body: 'Apply in minutes and receive a lending decision within 24 hours.',
  },
  {
    heading: 'Secure by design.',
    body: 'End-to-end encryption and strict access controls protect your data at every step.',
  },
  {
    heading: 'Transparent terms.',
    body: 'Clear repayment schedules. No hidden fees. Ever.',
  },
];

function BrandPanel({ step }: { step: number }) {
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hidden md:flex flex-col justify-between bg-[#0D1B2A] text-white px-10 py-12 w-[42%] min-h-screen relative overflow-hidden">
      {/* Background geometric illustration */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <svg
          viewBox="0 0 400 500"
          className="absolute bottom-0 right-0 w-full h-full opacity-[0.07]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
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

      {/* Logo */}
      <div className="relative z-10">
        <span className="text-2xl font-extrabold text-[#F5A523] tracking-tight">TerePay</span>
      </div>

      {/* Central illustration + headline */}
      <div className="relative z-10 flex-1 flex flex-col justify-center gap-8 mt-12">
        <svg
          viewBox="0 0 220 180"
          className="w-48 mx-auto"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
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

        {/* Rotating slides */}
        <div className="relative text-center h-[100px] flex flex-col items-center justify-center">
          {SLIDES.map((slide, i) => (
            <div
              key={i}
              className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-700"
              style={{ opacity: i === slideIdx ? 1 : 0 }}
              aria-hidden={i !== slideIdx}
            >
              <h2 className="text-2xl font-bold leading-snug max-w-xs mx-auto">{slide.heading}</h2>
              <p className="mt-2 text-sm text-white/60 max-w-xs mx-auto leading-relaxed">{slide.body}</p>
            </div>
          ))}
        </div>

        {/* Slide dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIdx(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="transition-all duration-300 border-0 p-0"
              style={{
                width: i === slideIdx ? 24 : 8,
                height: 8,
                borderRadius: 99,
                background: i === slideIdx ? '#F5A523' : 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 text-xs text-white/40 mt-8">Step {step} of 3</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ step }: { step: number }) {
  return (
    <div
      className="flex gap-1.5 mb-8"
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={1}
      aria-valuemax={3}
      aria-label={`Step ${step} of 3`}
    >
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className="h-1 flex-1 rounded-full transition-colors duration-300"
          style={{ background: s <= step ? '#F5A523' : '#E5E7EB' }}
        />
      ))}
    </div>
  );
}

const inputCls =
  'w-full px-3.5 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:bg-white transition-all';

const errorCls = 'mt-1 text-xs text-red-500';

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------

const PASSWORD_RULES = [
  { label: '8 characters', test: (p: string) => p.length >= 8 },
  { label: '1 upper case', test: (p: string) => /[A-Z]/.test(p) },
  { label: '1 lower case', test: (p: string) => /[a-z]/.test(p) },
  { label: '1 number',     test: (p: string) => /[0-9]/.test(p) },
  { label: 'special char', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

function PasswordStrengthBadges({ password }: { password: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <span
            key={rule.label}
            className={`flex items-center gap-1 text-xs font-medium transition-colors ${ok ? 'text-green-600' : 'text-gray-400'}`}
          >
            <span
              className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border text-[9px] transition-all ${ok ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-transparent'}`}
            >
              ✓
            </span>
            {rule.label}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OTP inputs
// ---------------------------------------------------------------------------

function OtpInputs({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (!digits.length) return;
    e.preventDefault();
    const next = [...value];
    digits.forEach((d, i) => { next[i] = d; });
    onChange(next);
    refs.current[Math.min(digits.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`Digit ${i + 1} of 6`}
          className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-gray-50 text-gray-900 outline-none transition-all ${
            digit ? 'border-[#F5A523] bg-[#FEF7E9]' : 'border-gray-200 focus:border-[#F5A523] focus:bg-white'
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main signup page
// ---------------------------------------------------------------------------

export default function SignupPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);

  // Step 1
  const [step1, setStep1] = useState<Step1Data>({ firstName: '', lastName: '', email: '', dialCode: '+64', phone: '' });
  const [step1Errors, setStep1Errors] = useState<Partial<Record<keyof Step1Data, string>>>({});
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1ApiError, setStep1ApiError] = useState('');

  // Step 2
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationToken, setVerificationToken] = useState('');
  const [devCode, setDevCode] = useState('');

  // Step 3
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step3Errors, setStep3Errors] = useState<Partial<{ password: string; confirm: string; terms: string }>>({});
  const [step3Loading, setStep3Loading] = useState(false);
  const [step3ApiError, setStep3ApiError] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Step 1 submit
  const validateStep1 = () => {
    const errs: typeof step1Errors = {};
    if (!step1.firstName.trim()) errs.firstName = 'First name is required';
    if (!step1.lastName.trim()) errs.lastName = 'Last name is required';
    if (!step1.email.trim() || !/^\S+@\S+\.\S+$/.test(step1.email)) errs.email = 'Valid email address is required';
    if (!step1.phone.trim() || step1.phone.replace(/\D/g, '').length < 6) errs.phone = 'Valid phone number is required';
    setStep1Errors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStep1Continue = useCallback(async () => {
    if (!validateStep1()) return;
    setStep1ApiError('');
    setStep1Loading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: step1.email }),
      });
      const data = await res.json();
      if (!res.ok) { setStep1ApiError(data.error?.message ?? 'Failed to send code.'); return; }
      if (data.code) setDevCode(data.code);
      setResendCooldown(60);
      setStep(2);
    } catch { setStep1ApiError('Network error. Please try again.'); }
    finally { setStep1Loading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step1]);

  // Step 2 verify
  const handleVerify = useCallback(async () => {
    const code = otpDigits.join('');
    if (code.length < 6) { setOtpError('Please enter the complete 6-digit code.'); return; }
    setOtpError('');
    setOtpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: step1.email, code }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error?.message ?? 'Incorrect code. Please try again.'); return; }
      setVerificationToken(data.verificationToken);
      setStep(3);
    } catch { setOtpError('Network error. Please try again.'); }
    finally { setOtpLoading(false); }
  }, [otpDigits, step1.email]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setDevCode('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: step1.email }),
      });
      const data = await res.json();
      if (data.code) setDevCode(data.code);
      setResendCooldown(60);
    } catch { /* ignore */ }
  }, [resendCooldown, step1.email]);

  // Step 3 submit
  const validateStep3 = () => {
    const errs: typeof step3Errors = {};
    if (PASSWORD_RULES.some((r) => !r.test(password))) errs.password = 'Password does not meet all requirements.';
    if (password !== confirmPassword) errs.confirm = 'Passwords do not match.';
    if (!agreedToTerms) errs.terms = 'You must accept the Terms of Service and Privacy Policy.';
    setStep3Errors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateAccount = useCallback(async () => {
    if (!validateStep3()) return;
    setStep3ApiError('');
    setStep3Loading(true);
    try {
      const phone = `${step1.dialCode} ${step1.phone}`.trim();
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: step1.firstName, lastName: step1.lastName, email: step1.email, phone, password, verificationToken }),
      });
      if (!res.ok) {
        const body = await res.json();
        setStep3ApiError(body.error?.message ?? 'Registration failed. Please try again.');
        return;
      }
      await login(step1.email, password);
      const firebaseUser = clientAuth.currentUser;
      if (firebaseUser && !firebaseUser.emailVerified) {
        const continueUrl = `${window.location.origin}/applicant/verify-email`;
        await sendEmailVerification(firebaseUser, { url: continueUrl, handleCodeInApp: false }).catch(() => { /* non-critical */ });
      }
      router.push('/applicant/verify-email');
    } catch (err) {
      setStep3ApiError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally { setStep3Loading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step1, password, verificationToken]);

  return (
    <div className="flex min-h-screen">
      <BrandPanel step={step} />

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 overflow-y-auto">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo */}
          <div className="md:hidden mb-8">
            <span className="text-2xl font-extrabold text-[#F5A523]">TerePay</span>
          </div>

          <ProgressBar step={step} />

          {/* ---- STEP 1 ---- */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
              <p className="text-sm text-gray-500 mb-7">Let&apos;s start with the basics</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <input id="firstName" type="text" autoComplete="given-name" value={step1.firstName}
                      onChange={(e) => setStep1({ ...step1, firstName: e.target.value })}
                      className={inputCls} placeholder="Rafael" />
                    {step1Errors.firstName && <p className={errorCls}>{step1Errors.firstName}</p>}
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Last name <span className="text-red-500">*</span>
                    </label>
                    <input id="lastName" type="text" autoComplete="family-name" value={step1.lastName}
                      onChange={(e) => setStep1({ ...step1, lastName: e.target.value })}
                      className={inputCls} placeholder="Castillo" />
                    {step1Errors.lastName && <p className={errorCls}>{step1Errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email address <span className="text-red-500">*</span>
                  </label>
                  <input id="email" type="email" autoComplete="email" value={step1.email}
                    onChange={(e) => setStep1({ ...step1, email: e.target.value })}
                    className={inputCls} placeholder="you@example.com" />
                  {step1Errors.email && <p className={errorCls}>{step1Errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phone number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      aria-label="Country dial code"
                      value={step1.dialCode}
                      onChange={(e) => setStep1({ ...step1, dialCode: e.target.value })}
                      className="flex-shrink-0 px-3 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] transition-all"
                    >
                      {DIAL_CODES.map((d) => (
                        <option key={`${d.country}-${d.code}`} value={d.code}>{d.flag} {d.code}</option>
                      ))}
                    </select>
                    <input id="phone" type="tel" autoComplete="tel-national" value={step1.phone}
                      onChange={(e) => setStep1({ ...step1, phone: e.target.value })}
                      className={`${inputCls} flex-1`} placeholder="027 123 4567" />
                  </div>
                  {step1Errors.phone && <p className={errorCls}>{step1Errors.phone}</p>}
                </div>

                {step1ApiError && (
                  <p role="alert" className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{step1ApiError}</p>
                )}

                <button onClick={handleStep1Continue} disabled={step1Loading}
                  className="w-full py-3 px-4 bg-[#F5A523] hover:bg-[#E08B00] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                  {step1Loading ? 'Sending code…' : 'Continue'}
                </button>

                <p className="text-center text-sm text-gray-500">
                  Already have an account?{' '}
                  <Link href="/auth/login" className="text-[#F5A523] hover:text-[#E08B00] font-medium">Sign In</Link>
                </p>
              </div>
            </div>
          )}

          {/* ---- STEP 2 ---- */}
          {step === 2 && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Verify your email</h1>
              <p className="text-sm text-gray-500 mb-1">We&apos;ve sent a 6-digit code to</p>
              <p className="text-sm font-semibold text-gray-800 mb-7">{step1.email}</p>

              <OtpInputs value={otpDigits} onChange={setOtpDigits} />

              {otpError && (
                <p role="alert" className="mt-4 text-sm text-red-500 text-center">{otpError}</p>
              )}

              {/* Spam notice */}
              <div className="mt-5 border-l-4 border-[#F5A523] bg-[#FEF7E9] rounded-r-xl px-4 py-3 text-sm text-gray-700">
                <span className="mr-1.5">📬</span>
                <strong>Can&apos;t find the email?</strong> Check your <strong>spam</strong> or <strong>junk</strong> folder — verification emails are sometimes filtered. The code is valid for 10 minutes.
              </div>

              {/* Dev mode banner */}
              {devCode && (
                <div className="mt-3 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-2.5 text-xs text-yellow-800">
                  <strong>DEV MODE</strong> — Your code is:{' '}
                  <span className="font-mono font-bold tracking-widest">{devCode}</span>
                </div>
              )}

              <p className="mt-5 text-center text-sm text-gray-500">
                Didn&apos;t receive it?{' '}
                {resendCooldown > 0 ? (
                  <span className="text-gray-400">Resend in {resendCooldown}s</span>
                ) : (
                  <button onClick={handleResend} className="text-[#F5A523] hover:text-[#E08B00] font-medium underline-offset-2 hover:underline">
                    Resend code
                  </button>
                )}
              </p>

              <div className="flex gap-3 mt-7">
                <button onClick={() => { setStep(1); setOtpDigits(['', '', '', '', '', '']); setOtpError(''); }}
                  className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                  Back
                </button>
                <button onClick={handleVerify} disabled={otpLoading || otpDigits.join('').length < 6}
                  className="flex-1 py-3 bg-[#F5A523] hover:bg-[#E08B00] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {otpLoading ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            </div>
          )}

          {/* ---- STEP 3 ---- */}
          {step === 3 && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">You&apos;re almost done!</h1>
              <p className="text-sm text-gray-500 mb-7">Create a strong password to secure your account</p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Create password</label>
                  <div className="relative">
                    <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className={`${inputCls} pr-14`} placeholder="Create password" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <PasswordStrengthBadges password={password} />
                  {step3Errors.password && <p className={`${errorCls} mt-2`}>{step3Errors.password}</p>}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Re-enter password</label>
                  <input id="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputCls} placeholder="Re-enter password" />
                  {step3Errors.confirm && <p className={errorCls}>{step3Errors.confirm}</p>}
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#F5A523]" />
                  <span className="text-sm text-gray-600">
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#F5A523] hover:text-[#E08B00] font-medium">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#F5A523] hover:text-[#E08B00] font-medium">Privacy Policy</a>
                  </span>
                </label>
                {step3Errors.terms && <p className={errorCls}>{step3Errors.terms}</p>}

                {step3ApiError && (
                  <p role="alert" className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{step3ApiError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setStep(2); setStep3Errors({}); setStep3ApiError(''); }}
                    className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                    Back
                  </button>
                  <button onClick={handleCreateAccount} disabled={step3Loading || !agreedToTerms}
                    className="flex-1 py-3 bg-[#F5A523] hover:bg-[#E08B00] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {step3Loading ? 'Creating account…' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
