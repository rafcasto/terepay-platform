'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/client';

type AppUser = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'applicant' | 'lender';
  profileComplete: boolean;
  emailVerified: boolean;
  isExistingCustomer?: boolean;
};

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  // Hydrate user from session on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then(({ user }) => setState({ user, loading: false, error: null }))
      .catch(() => setState({ user: null, loading: false, error: null }));
  }, []);

  // Keep client SDK and session in sync (optional: handles token refresh)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        // Firebase says logged out but session might be valid (cookie-based)
        // Don't clear state here — rely on /api/auth/me for ground truth.
        return;
      }
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string, recaptchaToken?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const cred = await signInWithEmailAndPassword(clientAuth, email, password);
      const idToken = await cred.user.getIdToken(true); // force-refresh to include latest custom claims

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, ...(recaptchaToken ? { recaptchaToken } : {}) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Login failed');
      }

      // Refresh user state from server
      const meRes = await fetch('/api/auth/me');
      const { user } = await meRes.json();
      setState({ user, loading: false, error: null });
      return user as AppUser;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState((s) => ({ ...s, loading: false, error: message }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await signOut(clientAuth).catch(() => {/* ignore client sign-out errors */});
    setState({ user: null, loading: false, error: null });
  }, []);

  return { ...state, login, logout };
}
