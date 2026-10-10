'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { applyActionCode } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';

/**
 * Branded Firebase email action handler.
 *
 * Replaces Firebase's generic, unbranded hosted action page. Our verification
 * emails point here (`/auth/action?mode=verifyEmail&oobCode=...`) so the whole
 * journey stays in the TerePay brand.
 *
 * Cross-tab coordination: when verification succeeds we broadcast on the
 * `terepay-email-verify` channel. If another open TerePay tab (the page that
 * is waiting for verification) acknowledges, this tab steps aside and closes
 * itself, so the user isn't left with two TerePay tabs open.
 */

const CHANNEL = 'terepay-email-verify';

type Status = 'working' | 'success' | 'error';

function shouldHandoff(continueUrl: string): string {
  // Default destination if no continueUrl provided.
  return continueUrl || '/applicant/onboarding/verify-email';
}

function ActionInner() {
  const params = useSearchParams();
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  const continueUrl = shouldHandoff(params.get('continueUrl') ?? '');

  const [status, setStatus] = useState<Status>('working');
  const [message, setMessage] = useState('');
  const [handedOff, setHandedOff] = useState(false);
  const ranRef = useRef(false);

  const goContinue = useCallback(() => {
    const u = clientAuth.currentUser;
    window.location.href = u ? continueUrl : '/auth/login';
  }, [continueUrl]);

  useEffect(() => {
    if (ranRef.current) return; // guard against double-invoke in dev/StrictMode
    ranRef.current = true;

    let ackReceived = false;
    let channel: BroadcastChannel | null = null;

    (async () => {
      if (mode !== 'verifyEmail' || !oobCode) {
        setStatus('error');
        setMessage('This link is invalid or incomplete. Please request a new verification email.');
        return;
      }

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
  }, [mode, oobCode, goContinue]);

  return (
    <main className="min-h-screen bg-[var(--slate-50,#F6F8FB)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image src="/brand/terepay-logo.png" alt="TerePay" width={150} height={36} priority className="h-9 w-auto" />
        </div>

        <div className="tp-card p-8 text-center">
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
              <a href="/applicant/onboarding/verify-email" className={primaryBtn}>
                Request a new link
              </a>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          All loans are charged interest and an admin fee, shown in full before you sign.
        </p>
      </div>
    </main>
  );
}

const primaryBtn =
  'inline-flex w-full items-center justify-center rounded-full bg-[#B45600] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8f4400]';

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
