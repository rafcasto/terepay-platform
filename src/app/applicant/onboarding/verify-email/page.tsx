'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';
import { Icons } from '@/components/ui';
import { Spinner } from '../_components/Spinner';
import { obField, obPrimaryBtn, obSecondaryBtn, obAlert } from '../_components/onboarding-styles';

const CHANNEL = 'terepay-email-verify';
const NEXT_STEP = '/applicant/onboarding/verify-mobile';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [user, setUser]             = useState<User | null>(null);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState('');
  const [cooldown, setCooldown]     = useState(0);
  const [verified, setVerified]     = useState(false);
  const [showEmailForm, setShowEmailForm]     = useState(false);
  const [newEmailInput, setNewEmailInput]     = useState('');
  const [emailUpdateError, setEmailUpdateError] = useState('');
  const [emailUpdateLoading, setEmailUpdateLoading] = useState(false);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cooldown timer ──────────────────────────────────────────────────────
  const startCooldown = useCallback(() => {
    setCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Advance after verification ──────────────────────────────────────────
  const handleVerified = useCallback(async (currentUser: User) => {
    setVerified(true);
    if (pollRef.current) clearInterval(pollRef.current);
    // Refresh session cookie — the /api/auth/session endpoint sets
    // emailVerified: true in Firestore when the email_verified claim is present.
    try {
      const idToken = await currentUser.getIdToken(true);
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
    } catch { /* non-critical — session refresh failure won't block navigation */ }
    router.push(NEXT_STEP);
  }, [router]);

  // ── Send verification email (branded, via our API) ──────────────────────
  const sendVerification = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/send-verification-email', { method: 'POST' });
      if (!res.ok) {
        if (res.status === 429) {
          setError('Too many requests. Please wait a little before requesting another email.');
          setSent(true);
          return;
        }
        setError('Failed to send verification email. Please try again.');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.alreadyVerified) {
        const current = clientAuth.currentUser;
        if (current) await handleVerified(current);
        return;
      }
      // Dev convenience: when no email provider is configured the API returns
      // the link so the flow can be completed against the emulator.
      if (data?.devVerificationUrl) {
        console.log('[dev] Open this verification link:', data.devVerificationUrl);
      }
      setSent(true);
      startCooldown();
    } catch {
      setError('Failed to send verification email. Please try again.');
    }
  }, [startCooldown, handleVerified]);

  // ── Initialize: wait for Firebase auth, then send email ─────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/auth/login');
        return;
      }
      setUser(currentUser);

      // Already verified (e.g. user clicked link and was redirected back here)
      if (currentUser.emailVerified) {
        await handleVerified(currentUser);
        return;
      }

      // Send on first load only
      await sendVerification();
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for the branded action handler verifying in another tab ───────
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = async (e: MessageEvent) => {
        if (e.data?.type !== 'email-verified') return;
        // Acknowledge so the other tab knows we'll drive — and can close itself.
        channel?.postMessage({ type: 'verify-ack' });
        const current = clientAuth.currentUser;
        if (current) {
          try { await current.reload(); } catch { /* ignore */ }
          const refreshed = clientAuth.currentUser;
          if (refreshed) {
            await handleVerified(refreshed);
            return;
          }
        }
        router.push(NEXT_STEP);
      };
    } catch {
      channel = null;
    }
    return () => channel?.close();
  }, [handleVerified, router]);

  // ── Poll for email verification every 3 seconds ─────────────────────────
  useEffect(() => {
    if (!user || verified) return;

    pollRef.current = setInterval(async () => {
      try {
        await user.reload();
        const refreshed = clientAuth.currentUser;
        if (refreshed?.emailVerified) {
          await handleVerified(refreshed);
        }
      } catch { /* ignore transient network errors */ }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, verified, handleVerified]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleResend = async () => {
    if (cooldown > 0 || !user) return;
    setError('');
    await sendVerification();
  };

  // ── Update email address ────────────────────────────────────────────────
  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmailInput.trim() || !user) return;
    setEmailUpdateError('');
    setEmailUpdateLoading(true);
    try {
      const res = await fetch('/api/users/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmailInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailUpdateError(data?.error?.message ?? 'Failed to update email. Please try again.');
        return;
      }
      // Reload Firebase Auth client state to pick up new email
      await user.reload();
      const refreshed = clientAuth.currentUser;
      if (!refreshed) return;
      setUser(refreshed);
      // Reset verification state and send to new address
      setSent(false);
      setError('');
      setShowEmailForm(false);
      setNewEmailInput('');
      await sendVerification();
    } catch {
      setEmailUpdateError('Network error. Please check your connection.');
    } finally {
      setEmailUpdateLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full py-10 px-4">
      <div className="w-full max-w-md text-center screen-in">
        {verified ? (
          /* ── Verified state ── */
          <div>
            <div className="w-16 h-16 rounded-full bg-success-soft-ds flex items-center justify-center mx-auto mb-4">
              <Icons.CheckCircle size={32} className="text-success-text" />
            </div>
            <h2 className="font-display text-xl font-bold text-ink-strong mb-1">Email verified</h2>
            <p className="text-sm text-[var(--text-muted)]">Redirecting you to the next step…</p>
          </div>
        ) : (
          /* ── Waiting state ── */
          <>
            {/* Envelope icon */}
            <div className="w-16 h-16 rounded-full bg-brand-soft flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-brand-text" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>

            <h2 className="font-display text-2xl font-bold text-ink-strong mb-2">Check your inbox</h2>
            <p className="text-[var(--text-muted)] text-sm mb-1">
              {sent ? 'We sent a verification link to' : 'Sending a verification link to'}
            </p>
            {user?.email && (
              <p className="font-semibold text-ink-strong text-sm mb-6">{user.email}</p>
            )}

            <p className="text-[var(--text-muted)] text-xs mb-8 leading-relaxed">
              Click the link in the email to verify your address.
              <br />This page will automatically move forward once you do.
            </p>

            {/* Spinner — waiting indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)] mb-8">
              <Spinner size={16} className="text-brand-text" />
              Waiting for verification…
            </div>

            {error && <p className={`${obAlert} mb-4`}>{error}</p>}

            <button
              onClick={handleResend}
              disabled={cooldown > 0}
              className="text-sm font-semibold text-brand-text hover:underline disabled:text-[var(--text-disabled)] disabled:no-underline disabled:cursor-not-allowed transition-colors"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
            </button>

            <p className="text-xs text-[var(--text-muted)] mt-4">
              Can&apos;t find it? Check your spam or junk folder.
            </p>

            {/* ── Wrong email? update form ─────────────────────────── */}
            <div className="mt-6 border-t border-border-subtle pt-5">
              {!showEmailForm ? (
                <button
                  onClick={() => { setShowEmailForm(true); setEmailUpdateError(''); }}
                  className="text-xs text-[var(--text-muted)] hover:text-ink-strong transition-colors underline underline-offset-2"
                >
                  Wrong email address?
                </button>
              ) : (
                <form onSubmit={handleEmailUpdate} className="text-left space-y-3">
                  <p className="text-sm font-semibold text-ink-strong">Update your email address</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Enter the correct email address. We&apos;ll send a new verification link there, and it will also become your login email.
                  </p>
                  <input
                    type="email"
                    value={newEmailInput}
                    onChange={(e) => { setNewEmailInput(e.target.value); setEmailUpdateError(''); }}
                    placeholder="new@example.com"
                    autoComplete="email"
                    required
                    className={obField}
                  />
                  {emailUpdateError && <p className={obAlert}>{emailUpdateError}</p>}
                  <div className="flex gap-2.5">
                    <button
                      type="submit"
                      disabled={emailUpdateLoading || !newEmailInput.trim()}
                      className={`${obPrimaryBtn} h-11 flex-1`}
                    >
                      {emailUpdateLoading ? 'Updating…' : 'Update email'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowEmailForm(false); setNewEmailInput(''); setEmailUpdateError(''); }}
                      className={`${obSecondaryBtn} flex-1`}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
