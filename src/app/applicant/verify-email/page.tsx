'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { sendEmailVerification, reload } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleResend = async () => {
    const firebaseUser = clientAuth.currentUser;
    if (!firebaseUser) return;
    try {
      await sendEmailVerification(firebaseUser);
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#F5A523]">TerePay</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          {/* Email icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
            <svg className="h-8 w-8 text-[#F5A523]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">Verify your email</h2>
          <p className="text-gray-500 text-sm mb-1">
            We sent a verification link to
          </p>
          <p className="font-medium text-gray-800 text-sm mb-6">
            {user?.email ?? 'your email address'}
          </p>

          <p className="text-xs text-gray-400 mb-8">
            Click the link in the email to verify your account. You must verify your email before you can submit a loan application.
          </p>

          {/* Check verification */}
          <button
            onClick={handleCheckVerification}
            disabled={checkStatus === 'checking'}
            className="w-full py-2.5 px-4 bg-[#F5A523] text-white text-sm font-medium rounded-lg hover:bg-[#E08B00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-3"
          >
            {checkStatus === 'checking' ? 'Checking…' : "I've verified my email"}
          </button>

          {checkStatus === 'error' && (
            <p className="text-xs text-red-600 mb-3">
              Email not verified yet. Please click the link in your inbox first.
            </p>
          )}

          {/* Resend */}
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
          </button>

          {resendStatus === 'sent' && resendCooldown > 0 && (
            <p className="mt-2 text-xs text-green-600">Verification email sent!</p>
          )}
          {resendStatus === 'error' && (
            <p className="mt-2 text-xs text-red-600">Could not resend. Please try again.</p>
          )}

          <p className="mt-6 text-xs text-gray-400">
            Wrong email?{' '}
            <a href="/api/auth/logout" className="text-[#F5A523] hover:underline">
              Sign out
            </a>{' '}
            and register again.
          </p>
        </div>
      </div>
    </div>
  );
}
