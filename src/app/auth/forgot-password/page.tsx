'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validation/schemas';
import { useRecaptchaToken } from '../recaptcha-provider';
import { useSiteContent } from '@/lib/content/SiteContentContext';
import { AuthShell } from '../_components/auth-shell';
import { AuthIcon } from '../_components/auth-icons';
import { Field, InputShell, SubmitButton, ErrorAlert } from '../_components/auth-ui';

const formSchema = forgotPasswordSchema.pick({ email: true });
type FormValues = Pick<ForgotPasswordInput, 'email'>;

const secondaryBtn =
  'inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--slate-300)] bg-white font-display text-[15px] font-semibold text-[var(--text-strong)] transition-colors hover:bg-[var(--slate-50)] active:bg-[var(--slate-100)]';

export default function ForgotPasswordPage() {
  const c = useSiteContent('auth.forgotPassword');
  const getRecaptchaToken = useRecaptchaToken();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = async ({ email }: FormValues) => {
    try {
      const recaptchaToken = await getRecaptchaToken('forgot_password');
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(recaptchaToken ? { recaptchaToken } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          res.status === 429
            ? 'Too many reset requests. Please wait a few minutes and try again.'
            : (data?.error?.message ?? 'We couldn’t send the reset link. Please try again.'),
        );
      }
      // Dev convenience: with no email provider configured the API returns the
      // link so the flow can be completed against the Firebase emulator.
      setDevResetUrl(typeof data?.devResetUrl === 'string' ? data.devResetUrl : null);
      setSentTo(email);
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'We couldn’t send the reset link. Please try again.' });
    }
  };

  const startOver = () => {
    setSentTo(null);
    setDevResetUrl(null);
    reset();
  };

  const heading = sentTo
    ? { eyebrow: c.sentEyebrow, title: c.sentTitle, subtitle: c.sentBody }
    : { eyebrow: c.eyebrow, title: c.title, subtitle: c.subtitle };

  return (
    <AuthShell mode="signin" heading={heading}>
      {sentTo ? (
        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border-default)] bg-[var(--slate-50)] px-4 py-3.5 text-[14px]">
            <span className="inline-flex text-[var(--text-muted)] [&_svg]:h-[18px] [&_svg]:w-[18px]">{AuthIcon.mail}</span>
            <span className="min-w-0 break-all font-semibold text-[var(--text-strong)]">{sentTo}</span>
          </div>

          {devResetUrl && (
            <p className="rounded-[10px] border border-[var(--orange-200)] bg-[var(--surface-brand-soft)] px-4 py-3 text-[13px] leading-snug text-[var(--orange-900)]">
              Development only — no email provider is configured.{' '}
              <a href={devResetUrl} className="font-semibold underline">
                Open the reset link
              </a>
              .
            </p>
          )}

          <Link href="/auth/login" className={secondaryBtn}>
            {c.backToLogin}
          </Link>

          <button
            type="button"
            onClick={startOver}
            className="text-center text-[14px] font-semibold text-[var(--text-link)] hover:underline"
          >
            {c.tryAnotherEmail}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]" noValidate aria-busy={isSubmitting}>
          <Field htmlFor="email" label="Email address" required error={errors.email?.message}>
            <InputShell
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              prefix={AuthIcon.mail}
              invalid={!!errors.email}
              disabled={isSubmitting}
              {...register('email')}
            />
          </Field>

          {errors.root && <ErrorAlert>{errors.root.message}</ErrorAlert>}

          <div className="mt-2">
            <SubmitButton type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? c.submittingCta : c.submitCta}
              {!isSubmitting && AuthIcon.arrow}
            </SubmitButton>
          </div>

          <Link href="/auth/login" className="text-center text-[14px] font-semibold text-[var(--text-link)] hover:underline">
            {c.backToLogin}
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
