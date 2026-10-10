'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { reload } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';

const CHANNEL = 'terepay-email-verify';

export default function VerifyEmailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'error'>('idle');

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const refreshSessionAndRedirect = useCallback(async () => {
    const firebaseUser = clientAuth.currentUser;
    if (!firebaseUser) return;
    // Force-refresh the ID token so it includes email_verified: true
    const freshIdToken = await firebaseUser.getIdToken(true);
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: freshIdToken }),
    });
    router.push('/applicant/dashboard');
  }, [router]);

  // Poll every 8 seconds to auto-detect verification
  useEffect(() => {
    const interval = setInterval(async () => {
      const firebaseUser = clientAuth.currentUser;
      if (!firebaseUser) return;
      await reload(firebaseUser).catch(() => null);
      if (firebaseUser.emailVerified) {
        clearInterval(interval);
        await refreshSessionAndRedirect();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [refreshSessionAndRedirect]);

  // Listen for the branded action handler verifying in another tab
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = async (e: MessageEvent) => {
        if (e.data?.type !== 'email-verified') return;
        channel?.postMessage({ type: 'verify-ack' });
        const firebaseUser = clientAuth.currentUser;
        if (firebaseUser) await reload(firebaseUser).catch(() => null);
        await refreshSessionAndRedirect();
      };
    } catch {
      channel = null;
    }
    return () => channel?.close();
  }, [refreshSessionAndRedirect]);

  const handleResend = async () => {
    try {
      const res = await fetch('/api/auth/send-verification-email', { method: 'POST' });
      if (!res.ok) {
        setResendStatus('error');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.alreadyVerified) {
        await refreshSessionAndRedirect();
        return;
      }
      if (data?.devVerificationUrl) {
        console.log('[dev] Open this verification link:', data.devVerificationUrl);
      }
      setResendStatus('sent');
      setResendCooldown(60);
    } catch {
      setResendStatus('error');
    }
  };

  const handleCheckVerification = async () => {
    setCheckStatus('checking');
    const firebaseUser = clientAuth.currentUser;
    if (!firebaseUser) {
      setCheckStatus('error');
      return;
    }
    try {
      await reload(firebaseUser);
      if (firebaseUser.emailVerified) {
        await refreshSessionAndRedirect();
      } else {
        setCheckStatus('error');
      }
    } catch {
      setCheckStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-accent-2">TerePay</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-border p-8 text-center">
          {/* Email icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
            <svg className="h-8 w-8 text-accent-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-text mb-2">Verify your email</h2>
          <p className="text-muted text-sm mb-1">
            We sent a verification link to
          </p>
          <p className="font-medium text-gray-800 text-sm mb-6">
            {user?.email ?? 'your email address'}
          </p>

          <p className="text-xs text-muted/70 mb-8">
            Click the link in the email to verify your account. You must verify your email before you can submit a loan application.
          </p>

          {/* Check verification */}
          <button
            onClick={handleCheckVerification}
            disabled={checkStatus === 'checking'}
            className="w-full py-2.5 px-4 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-3"
          >
            {checkStatus === 'checking' ? 'Checking…' : "I've verified my email"}
          </button>

          {checkStatus === 'error' && (
            <p className="text-xs text-danger mb-3">
              Email not verified yet. Please click the link in your inbox first.
            </p>
          )}

          {/* Resend */}
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="w-full py-2.5 px-4 border border-border text-text text-sm font-medium rounded-lg hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
          </button>

          {resendStatus === 'sent' && resendCooldown > 0 && (
            <p className="mt-2 text-xs text-success">Verification email sent!</p>
          )}
          {resendStatus === 'error' && (
            <p className="mt-2 text-xs text-danger">Could not resend. Please try again.</p>
          )}

          <div className="mt-6 text-xs text-muted/70">
            Wrong email?{' '}
            <form action="/api/auth/logout" method="POST" className="inline">
              <button type="submit" className="text-accent-2 hover:underline">
                Sign out
              </button>
            </form>{' '}
            and register again.
          </div>
        </div>
      </div>
    </div>
  );
}
