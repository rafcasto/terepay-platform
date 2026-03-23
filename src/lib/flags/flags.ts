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
  decide: () => false,
});

// Keep lazy-getter aliases for backward compatibility
export const getNewApplicantDashboard = () => newApplicantDashboard;
export const getPaymentTrackingV2 = () => paymentTrackingV2;
export const getAutoUnderwriting = () => autoUnderwriting;
