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
 */
export const envResetEnabled = flag<boolean>({
  key: 'env_reset_enabled',
  description: 'Allow full environment data reset from admin console (dev/staging only — never enable on production)',
  decide: () => false,
});

// Keep lazy-getter aliases for backward compatibility
export const getNewApplicantDashboard = () => newApplicantDashboard;
export const getPaymentTrackingV2 = () => paymentTrackingV2;
export const getAutoUnderwriting = () => autoUnderwriting;
export const getDisableSmsOtp = () => disableSmsOtp;
