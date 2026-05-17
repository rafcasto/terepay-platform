'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, sendEmailVerification, type User } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';

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

  // ── Send verification email ─────────────────────────────────────────────
  const sendVerification = useCallback(async (currentUser: User) => {
    try {
      const continueUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/applicant/onboarding/verify-email`
        : '/applicant/onboarding/verify-email';
      await sendEmailVerification(currentUser, { url: continueUrl, handleCodeInApp: false });
      setSent(true);
      startCooldown();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait before requesting another email.');
        // Still mark as sent so the UI shows the waiting state
        setSent(true);
      } else {
        setError('Failed to send verification email. Please try again.');
      }
    }
  }, [startCooldown]);

  // ── Advance after verification ──────────────────────────────────────────
  const handleVerified = useCallback(async (currentUser: User) => {
    setVerified(true);
    if (pollRef.current) clearInterval(pollRef.current);
    // Refresh session cookie — the /api/auth/session endpoint already sets
    // emailVerified: true in Firestore when email_verified claim is present.
    try {
      const idToken = await currentUser.getIdToken(true);
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
    } catch { /* non-critical — session refresh failure won't block navigation */ }
    router.push('/applicant/onboarding/verify-mobile');
  }, [router]);

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
      await sendVerification(currentUser);
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    await sendVerification(user);
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
      await sendVerification(refreshed);
    } catch {
      setEmailUpdateError('Network error. Please check your connection.');
    } finally {
      setEmailUpdateLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full py-10 px-4">
      <div className="w-full max-w-md text-center">
        {verified ? (
          /* ── Verified state ── */
          <div>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text mb-1">Email verified!</h2>
            <p className="text-sm text-muted">Redirecting you to the next step…</p>
          </div>
        ) : (
          /* ── Waiting state ── */
          <>
            {/* Envelope icon */}
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-text mb-2">Check your inbox</h2>
            <p className="text-muted text-sm mb-1">
              {sent ? 'We sent a verification link to' : 'Sending a verification link to'}
            </p>
            {user?.email && (
              <p className="font-semibold text-text text-sm mb-6">{user.email}</p>
            )}

            <p className="text-muted/70 text-xs mb-8 leading-relaxed">
              Click the link in the email to verify your address.
              <br />This page will automatically move forward once you do.
            </p>

            {/* Spinner — waiting indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted/70 mb-8">
              <svg className="animate-spin h-4 w-4 text-accent-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Waiting for verification…
            </div>

            {error && (
              <p className="text-xs text-danger bg-danger-soft border border-danger/40 rounded-xl px-4 py-3 mb-4">
                {error}
              </p>
            )}

            <button
              onClick={handleResend}
              disabled={cooldown > 0}
              className="text-sm text-accent-2 hover:text-accent-2 disabled:text-muted/70 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
            </button>

            <p className="text-xs text-muted/70 mt-4">
              Can&apos;t find it? Check your spam or junk folder.
            </p>

            {/* ── Wrong email? update form ─────────────────────────── */}
            <div className="mt-6 border-t border-border-2 pt-5">
              {!showEmailForm ? (
                <button
                  onClick={() => { setShowEmailForm(true); setEmailUpdateError(''); }}
                  className="text-xs text-muted/70 hover:text-muted transition-colors underline underline-offset-2"
                >
                  Wrong email address?
                </button>
              ) : (
                <form onSubmit={handleEmailUpdate} className="text-left space-y-3">
                  <p className="text-sm font-medium text-text">Update your email address</p>
                  <p className="text-xs text-muted">
                    Enter the correct email address. We&apos;ll send a new verification link there, and it will also become your login email.
                  </p>
                  <input
                    type="email"
                    value={newEmailInput}
                    onChange={(e) => { setNewEmailInput(e.target.value); setEmailUpdateError(''); }}
                    placeholder="new@example.com"
                    autoComplete="email"
                    required
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-accent focus:border-accent focus:outline-none transition-colors bg-white"
                  />
                  {emailUpdateError && (
                    <p className="text-xs text-danger bg-danger-soft border border-danger/40 rounded-xl px-3 py-2">
                      {emailUpdateError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={emailUpdateLoading || !newEmailInput.trim()}
                      className="flex-1 bg-accent hover:bg-accent-2 disabled:opacity-60 text-white text-sm font-semibold rounded-full py-2.5 transition-colors"
                    >
                      {emailUpdateLoading ? 'Updating…' : 'Update email'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowEmailForm(false); setNewEmailInput(''); setEmailUpdateError(''); }}
                      className="flex-1 border border-border text-muted text-sm font-medium rounded-full py-2.5 hover:bg-surface-2 transition-colors"
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
