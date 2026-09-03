'use client';

import { createContext, useContext } from 'react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';

/**
 * Whether reCAPTCHA is active for this render tree. Driven by the
 * `recaptcha_disabled` feature flag, evaluated on the server in the auth layout.
 */
const RecaptchaEnabledContext = createContext(false);

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
        reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''}
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
