'use client';

import { useState, useCallback, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginInput } from '@/lib/validation/schemas';
import { AuthShell } from '../_components/auth-shell';
import { AuthIcon } from '../_components/auth-icons';
import { Field, InputShell, EyeToggle, SubmitButton, ErrorAlert, Divider } from '../_components/auth-ui';

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

  const onSubmit = useCallback(
    async (data: LoginInput) => {
      try {
        const recaptchaToken = executeRecaptcha ? await executeRecaptcha('login') : undefined;
        const user = await login(data.email, data.password, recaptchaToken);
        const dest =
          redirectTo ??
          (user?.role === 'admin'
            ? '/admin/dashboard'
            : user?.role === 'lender'
              ? '/lender/dashboard'
              : '/applicant/dashboard');
        router.push(dest);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid email or password';
        setError('root', { message: msg });
      }
    },
    [executeRecaptcha, login, redirectTo, router, setError],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]" noValidate>
      <Field htmlFor="email" label="Email address" required error={errors.email?.message}>
        <InputShell
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          prefix={AuthIcon.mail}
          invalid={!!errors.email}
          {...register('email')}
        />
      </Field>

      <Field htmlFor="password" label="Password" required error={errors.password?.message}>
        <InputShell
          id="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Enter your password"
          prefix={AuthIcon.lock}
          suffix={<EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          invalid={!!errors.password}
          {...register('password')}
        />
      </Field>

      <div className="flex items-center justify-end">
        <Link href="/auth/forgot-password" className="text-[14px] font-semibold text-[var(--text-link)] hover:underline">
          Forgot password?
        </Link>
      </div>

      {errors.root && <ErrorAlert>{errors.root.message}</ErrorAlert>}

      <div className="mt-2">
        <SubmitButton type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
          {!isSubmitting && AuthIcon.arrow}
        </SubmitButton>
      </div>

      <Divider>New to TerePay?</Divider>

      <Link
        href="/auth/signup"
        className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--slate-300)] bg-white font-display text-[15px] font-semibold text-[var(--text-strong)] transition-colors hover:bg-[var(--slate-50)] active:bg-[var(--slate-100)]"
      >
        Create an account
      </Link>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      mode="signin"
      eyebrow="Welcome back"
      title="Sign in to your account"
      subtitle="Enter your details to access your TerePay account."
    >
      <Suspense>
        <LoginFormInner />
      </Suspense>
    </AuthShell>
  );
}
