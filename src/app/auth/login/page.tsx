'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginInput } from '@/lib/validation/schemas';
import { Suspense } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';

// ---------------------------------------------------------------------------
// Left brand panel (shared design with signup)
// ---------------------------------------------------------------------------

const SLIDES = [
  {
    heading: 'Welcome back.',
    body: 'Manage your applications, track approvals, and stay on top of your loan journey.',
  },
  {
    heading: 'Your data, protected.',
    body: 'End-to-end encryption and strict access controls protect your data at every step.',
  },
  {
    heading: 'Fast decisions.',
    body: 'Our lending partners review applications within 24 hours so you never wait long.',
  },
];

function BrandPanel() {
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="hidden md:flex flex-col justify-between bg-[#0D1B2A] text-white px-10 py-12 w-[42%] min-h-screen relative overflow-hidden">
      {/* Background geometric pattern */}
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

      {/* Illustration + headline */}
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

      <div className="relative z-10 text-xs text-white/40 mt-8">
        © {new Date().getFullYear()} TerePay
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3.5 py-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:bg-white transition-all';

function LoginFormInner() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const [showPassword, setShowPassword] = useState(false);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = useCallback(async (data: LoginInput) => {
    try {
      const recaptchaToken = executeRecaptcha ? await executeRecaptcha('login') : undefined;
      const user = await login(data.email, data.password, recaptchaToken);
      const dest = redirectTo ?? (user?.role === 'lender' ? '/lender/dashboard' : '/applicant/dashboard');
      router.push(dest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password';
      setError('root', { message: msg });
    }
  }, [executeRecaptcha, login, redirectTo, router, setError]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          className={inputCls}
          placeholder="you@example.com"
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <a href="/auth/forgot-password" className="text-xs text-[#F5A523] hover:text-[#E08B00]">
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            {...register('password')}
            className={`${inputCls} pr-14`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {errors.root.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 px-4 bg-[#F5A523] hover:bg-[#E08B00] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-gray-500 pt-1">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="text-[#F5A523] hover:text-[#E08B00] font-medium">
          Sign up
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <BrandPanel />

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 overflow-y-auto">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo */}
          <div className="md:hidden mb-8">
            <span className="text-2xl font-extrabold text-[#F5A523]">TerePay</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to your account</p>

          <Suspense>
            <LoginFormInner />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

