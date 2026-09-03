import { flag } from '@vercel/flags/next';

// Re-export for convenience
export { flag } from '@vercel/flags/next';

// ---------------------------------------------------------------------------
// Feature Flag Definitions
// ---------------------------------------------------------------------------

export const newApplicantDashboard = flag<boolean>({
  key: 'new_applicant_dashboard',
  decide: () => false,
});

export const paymentTrackingV2 = flag<boolean>({
  key: 'payment_tracking_v2',
  decide: () => false,
});

export const autoUnderwriting = flag<boolean>({
  key: 'auto_underwriting',
  decide: () => false,
});

export const disableSmsOtp = flag<boolean>({
  key: 'disable-sms-otp',
  decide: () => true,
});

/**
 * Environment reset — allows the admin to wipe all Firestore data and
 * non-admin Auth users from the admin console.
 *
 * DEFAULT OFF. Must be enabled explicitly in the Vercel dashboard before the
 * reset button becomes active. Intended for dev/staging environments only.
 * Never enable this on production.
 *
 * Local override: set ENV_RESET_ENABLED=true in .env.local.
 * Vercel override: toggle the `env_reset_enabled` flag in the Vercel dashboard
 * (Flags section) for your dev/staging project.
 */
export const envResetEnabled = flag<boolean>({
  key: 'env_reset_enabled',
  description: 'Allow full environment data reset from admin console (dev/staging only — never enable on production)',
  decide: () => process.env.ENV_RESET_ENABLED === 'true',
});

/**
 * Disable reCAPTCHA v3 — development only.
 *
 * When on, the client skips loading the reCAPTCHA script (no token is minted)
 * and `verifyRecaptcha()` short-circuits to `true` on the server. Lets you work
 * locally without real reCAPTCHA keys.
 *
 * DEFAULT OFF. Opt in with DISABLE_RECAPTCHA=true in .env.local.
 *
 * HARD GUARD: `decide` returns `false` whenever the app is running as
 * production, regardless of DISABLE_RECAPTCHA. There is no env var and no
 * dashboard toggle that can switch reCAPTCHA off in production.
 */
export const recaptchaDisabled = flag<boolean>({
  key: 'recaptcha_disabled',
  description: 'Skip reCAPTCHA v3 verification (local dev only — cannot be turned on in production)',
  decide: () => {
    const isProduction =
      process.env.NEXT_PUBLIC_ENVIRONMENT === 'production' || process.env.VERCEL_ENV === 'production';
    if (isProduction) return false;
    return process.env.DISABLE_RECAPTCHA === 'true';
  },
});

// Keep lazy-getter aliases for backward compatibility
export const getNewApplicantDashboard = () => newApplicantDashboard;
export const getPaymentTrackingV2 = () => paymentTrackingV2;
export const getAutoUnderwriting = () => autoUnderwriting;
export const getDisableSmsOtp = () => disableSmsOtp;
export const getRecaptchaDisabled = () => recaptchaDisabled;
