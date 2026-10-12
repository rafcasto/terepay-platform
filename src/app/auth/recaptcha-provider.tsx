'use client';

import { createContext, useContext } from 'react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';

/**
 * Whether reCAPTCHA is active for this render tree. Driven by the
 * `recaptcha_disabled` feature flag, evaluated on the server in the auth layout.
 */
const RecaptchaEnabledContext = createContext(false);

/**
 * Site key, trimmed. A stray trailing newline/space in the env var (easy to
 * introduce when piping values into `vercel env add`) is invisible in the
 * dashboard but fatal at runtime: the browser strips it from the `api.js?render=`
 * URL so the badge renders, yet `grecaptcha.execute("KEY\n")` throws
 * "Invalid site key or not loaded in api.js".
 */
const SITE_KEY = (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '').trim();

export function RecaptchaProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) {
    // No provider, no script tag, no network call to Google.
    return <RecaptchaEnabledContext value={false}>{children}</RecaptchaEnabledContext>;
  }

  return (
    <RecaptchaEnabledContext value={true}>
      <GoogleReCaptchaProvider
        reCaptchaKey={SITE_KEY}
        scriptProps={{ async: true, defer: true }}
      >
        {children}
      </GoogleReCaptchaProvider>
    </RecaptchaEnabledContext>
  );
}

/**
 * Returns a function that mints a reCAPTCHA token for an action, or `undefined`
 * when reCAPTCHA is disabled or not ready. Always use this instead of calling
 * `useGoogleReCaptcha()` directly — the raw hook throws when the provider is
 * absent, which is exactly what happens with the flag on.
 */
export function useRecaptchaToken() {
  const enabled = useContext(RecaptchaEnabledContext);
  const { executeRecaptcha } = useGoogleReCaptcha();

  return async (action: string): Promise<string | undefined> => {
    if (!enabled || !executeRecaptcha) return undefined;
    return executeRecaptcha(action);
  };
}
