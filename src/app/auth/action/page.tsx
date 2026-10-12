'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';
import { AuthIcon } from '../_components/auth-icons';
import { Field, InputShell, EyeToggle, SubmitButton, ErrorAlert } from '../_components/auth-ui';
import { PASSWORD_HINT, PasswordStrength, meetsPasswordPolicy } from '../_components/password-strength';

/**
 * Branded Firebase email action handler.
 *
 * Replaces Firebase's generic, unbranded hosted action page. Our emails point
 * here so the whole journey stays in the TerePay brand:
 *
 *   - `/auth/action?mode=verifyEmail&oobCode=...`    — email verification
 *   - `/auth/action?mode=resetPassword&oobCode=...`  — password reset
 *
 * Email verification does cross-tab coordination: on success we broadcast on
 * the `terepay-email-verify` channel. If another open TerePay tab (the page
 * waiting for verification) acknowledges, this tab steps aside and closes
 * itself, so the user isn't left with two TerePay tabs open.
 *
 * Password reset verifies the code first (`verifyPasswordResetCode`), then
 * collects a new password that must satisfy the same policy as registration,
 * and finally calls `confirmPasswordReset`. The user is sent to the login
 * page with a success banner — we deliberately do not sign them in here.
 */

const CHANNEL = 'terepay-email-verify';
const LOGIN_PATH = '/auth/login';
const FORGOT_PASSWORD_PATH = '/auth/forgot-password';
const VERIFY_EMAIL_PATH = '/applicant/onboarding/verify-email';

/** Only ever follow same-origin relative paths from `continueUrl` (no open redirects). */
function safeContinuePath(value: string | null, fallback: string): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return fallback;
}

const primaryBtn =
  'inline-flex w-full items-center justify-center rounded-full bg-[#B45600] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f4400]';

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function ActionInner() {
  const params = useSearchParams();
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  const continueUrl = params.get('continueUrl');

  if (!oobCode) return <InvalidLink />;
  if (mode === 'verifyEmail') {
    return <VerifyEmailAction oobCode={oobCode} continueUrl={safeContinuePath(continueUrl, VERIFY_EMAIL_PATH)} />;
  }
  if (mode === 'resetPassword') return <ResetPasswordAction oobCode={oobCode} />;
  return <InvalidLink />;
}

function InvalidLink() {
  return (
    <Card>
      <ErrorMark />
      <h1 className="font-display text-xl font-semibold text-[#16263B] mt-5 mb-2">This link isn&rsquo;t valid</h1>
      <p className="text-sm text-slate-500 mb-6">
        The link is incomplete or has expired. Please go back and request a new one.
      </p>
      <Link href={LOGIN_PATH} className={primaryBtn}>
        Back to sign in
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

type VerifyStatus = 'working' | 'success' | 'error';

function VerifyEmailAction({ oobCode, continueUrl }: { oobCode: string; continueUrl: string }) {
  const [status, setStatus] = useState<VerifyStatus>('working');
  const [message, setMessage] = useState('');
  const [handedOff, setHandedOff] = useState(false);
  const ranRef = useRef(false);

  const goContinue = useCallback(() => {
    const u = clientAuth.currentUser;
    window.location.href = u ? continueUrl : LOGIN_PATH;
  }, [continueUrl]);

  useEffect(() => {
    if (ranRef.current) return; // guard against double-invoke in dev/StrictMode
    ranRef.current = true;

    let ackReceived = false;
    let channel: BroadcastChannel | null = null;

    (async () => {
      try {
        channel = new BroadcastChannel(CHANNEL);
        channel.onmessage = (e: MessageEvent) => {
          if (e.data?.type === 'verify-ack') ackReceived = true;
        };
      } catch {
        channel = null;
      }

      try {
        await applyActionCode(clientAuth, oobCode);
        setStatus('success');
        setMessage('Your email address has been verified.');

        // Refresh our own session if this tab is signed in, so the rest of the
        // app immediately sees email_verified: true.
        const u = clientAuth.currentUser;
        if (u) {
          try {
            await u.reload();
            const idToken = await u.getIdToken(true);
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            });
          } catch {
            /* non-critical */
          }
        }

        // Tell any waiting TerePay tab that verification is done.
        channel?.postMessage({ type: 'email-verified' });

        // Give the other tab a moment to acknowledge, then decide who drives.
        window.setTimeout(() => {
          if (ackReceived) {
            // Another tab has taken over navigation — close this extra tab.
            setHandedOff(true);
            window.close(); // only works for script-opened tabs; fallback UI below
          } else {
            goContinue();
          }
        }, 1400);
      } catch (err) {
        const code = (err as { code?: string }).code;
        setStatus('error');
        setMessage(
          code === 'auth/invalid-action-code' || code === 'auth/expired-action-code'
            ? 'This verification link has already been used or has expired. Please request a new one.'
            : 'We couldn’t verify your email. Please request a new verification email and try again.',
        );
      }
    })();

    return () => channel?.close();
  }, [oobCode, goContinue]);

  return (
    <Card>
      {status === 'working' && (
        <>
          <Spinner />
          <h1 className="font-display text-xl font-semibold text-[#16263B] mt-5 mb-2">Verifying your email</h1>
          <p className="text-sm text-slate-500">Just a moment while we confirm your address&hellip;</p>
        </>
      )}

      {status === 'success' && (
        <>
          <SuccessMark />
          <h1 className="font-display text-xl font-semibold text-[#16263B] mt-5 mb-2">Email verified</h1>
          <p className="text-sm text-slate-500 mb-6">{message}</p>
          {handedOff ? (
            <>
              <p className="text-sm text-slate-500 mb-4">
                You&rsquo;ve been signed in on your other TerePay tab. You can safely close this one.
              </p>
              <button type="button" onClick={goContinue} className={primaryBtn}>
                Continue here instead
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-4">Taking you to the next step&hellip;</p>
              <button type="button" onClick={goContinue} className={primaryBtn}>
                Continue now
              </button>
            </>
          )}
        </>
      )}

      {status === 'error' && (
        <>
          <ErrorMark />
          <h1 className="font-display text-xl font-semibold text-[#16263B] mt-5 mb-2">Verification failed</h1>
          <p className="text-sm text-slate-500 mb-6">{message}</p>
          <a href={VERIFY_EMAIL_PATH} className={primaryBtn}>
            Request a new link
          </a>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

type ResetPhase = 'verifying' | 'form' | 'done' | 'error';

/** Map Firebase action-code failures to safe, user-facing copy. */
function resetLinkErrorMessage(err: unknown): string {
  const code = (err as { code?: string }).code;
  switch (code) {
    case 'auth/expired-action-code':
      return 'This password reset link has expired. Please request a new one.';
    case 'auth/invalid-action-code':
      return 'This password reset link is invalid or has already been used. Please request a new one.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    default:
      return 'We couldn’t verify this password reset link. Please request a new one.';
  }
}

function ResetPasswordAction({ oobCode }: { oobCode: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<ResetPhase>('verifying');
  const [email, setEmail] = useState('');
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState('');
  // Stays true from submit through the redirect so the button can't be fired twice.
  const [saving, setSaving] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // guard against double-invoke in dev/StrictMode
    ranRef.current = true;

    verifyPasswordResetCode(clientAuth, oobCode)
      .then((address) => {
        setEmail(address);
        setPhase('form');
      })
      .catch((err: unknown) => {
        setLinkError(resetLinkErrorMessage(err));
        setPhase('error');
      });
  }, [oobCode]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;

    const errs: { password?: string; confirm?: string } = {};
    if (!meetsPasswordPolicy(password)) errs.password = 'Password does not meet all requirements.';
    if (password !== confirm) errs.confirm = 'Passwords do not match.';
    setFieldErrors(errs);
    if (errs.password || errs.confirm) return;

    setFormError('');
    setSaving(true);
    try {
      await confirmPasswordReset(clientAuth, oobCode, password);
      setPhase('done');
      window.setTimeout(() => {
        router.push(`${LOGIN_PATH}?reset=success`);
      }, 1600);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/weak-password') {
        setFieldErrors({ password: 'Please choose a stronger password.' });
        setSaving(false);
        return;
      }
      if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
        setLinkError(resetLinkErrorMessage(err));
        setPhase('error');
        return;
      }
      setFormError('We couldn’t update your password. Please try again.');
      setSaving(false);
    }
  };

  if (phase === 'verifying') {
    return (
      <Card>
        <Spinner />
        <h1 className="font-display text-xl font-semibold text-[#16263B] mt-5 mb-2">Checking your link</h1>
        <p className="text-sm text-slate-500">Just a moment&hellip;</p>
      </Card>
    );
  }

  if (phase === 'error') {
    return (
      <Card>
        <ErrorMark />
        <h1 className="font-display text-xl font-semibold text-[#16263B] mt-5 mb-2">Reset link not valid</h1>
        <p className="text-sm text-slate-500 mb-6">{linkError}</p>
        <Link href={FORGOT_PASSWORD_PATH} className={primaryBtn}>
          Request a new link
        </Link>
      </Card>
    );
  }

  if (phase === 'done') {
    return (
      <Card>
        <SuccessMark />
        <h1 className="font-display text-xl font-semibold text-[#16263B] mt-5 mb-2">Password updated</h1>
        <p className="text-sm text-slate-500 mb-6">You can now sign in with your new password.</p>
        <p className="text-sm text-slate-500 mb-4">Taking you to sign in&hellip;</p>
        <Link href={`${LOGIN_PATH}?reset=success`} className={primaryBtn}>
          Sign in now
        </Link>
      </Card>
    );
  }

  return (
    <Card centered={false}>
      <h1 className="font-display text-xl font-semibold text-[#16263B] mb-2">Choose a new password</h1>
      <p className="text-sm text-slate-500 mb-6">
        for <span className="font-semibold text-[#16263B] break-all">{email}</span>
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-[18px]" noValidate aria-busy={saving}>
        <Field htmlFor="new-password" label="New password" required hint={PASSWORD_HINT} error={fieldErrors.password}>
          <InputShell
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Create a password"
            prefix={AuthIcon.lock}
            suffix={<EyeToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!fieldErrors.password}
            disabled={saving}
          />
          {password && <PasswordStrength password={password} />}
        </Field>

        <Field htmlFor="confirm-password" label="Confirm new password" required error={fieldErrors.confirm}>
          <InputShell
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            prefix={AuthIcon.lock}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={!!fieldErrors.confirm}
            disabled={saving}
          />
        </Field>

        {formError && <ErrorAlert>{formError}</ErrorAlert>}

        <div className="mt-2">
          <SubmitButton type="submit" disabled={saving} aria-busy={saving}>
            {saving ? 'Updating password…' : 'Update password'}
            {!saving && AuthIcon.arrow}
          </SubmitButton>
        </div>

        <Link href={LOGIN_PATH} className="text-center text-[14px] font-semibold text-[var(--text-link)] hover:underline">
          Back to sign in
        </Link>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

function Card({ children, centered = true }: { children: ReactNode; centered?: boolean }) {
  return (
    <main className="min-h-screen bg-[var(--slate-50,#F6F8FB)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image src="/brand/terepay-logo.png" alt="TerePay" width={150} height={36} priority className="h-9 w-auto" />
        </div>

        <div className={`tp-card p-8 ${centered ? 'text-center' : ''}`}>{children}</div>

        <p className="mt-6 text-center text-xs text-slate-400">
          All loans are charged interest and an admin fee, shown in full before you sign.
        </p>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg className="mx-auto h-10 w-10 animate-spin text-[#F08000]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function SuccessMark() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-50,#E7F6EE)]">
      <svg className="h-8 w-8 text-[var(--success-700,#137a43)]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    </div>
  );
}

function ErrorMark() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-50,#FCEBEA)]">
      <svg className="h-8 w-8 text-[var(--danger-700,#B4231C)]" fill="none" viewBox="0 0 24 24" strokeWidth={2.25} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--slate-50,#F6F8FB)] flex items-center justify-center">
          <Spinner />
        </main>
      }
    >
      <ActionInner />
    </Suspense>
  );
}
