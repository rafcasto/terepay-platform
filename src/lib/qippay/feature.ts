import { AppError } from '@/lib/utils/api-error';
import { qippayEnabled } from '@/lib/flags/flags';

/**
 * Is the Qippay integration switched on?
 *
 * Fails closed: if flag evaluation throws for any reason we treat Qippay as
 * disabled, so a flag outage can never start lodging real bank mandates.
 * See `qippayEnabled` in src/lib/flags/flags.ts for what each mode means.
 */
export async function isQippayEnabled(): Promise<boolean> {
  try {
    return await qippayEnabled();
  } catch (err) {
    // Next.js signals "render this dynamically" by throwing from `headers()`
    // during prerender — that is not a flag outage, so let it propagate.
    if (isDynamicServerUsage(err)) throw err;
    console.warn('[qippay] flag evaluation failed — treating Qippay as disabled', err);
    return false;
  }
}

/**
 * Guard for API routes that only make sense while Qippay is on (consent,
 * early repayment, payment polling, SetPay scheduling). Throws a 404 so the
 * surface is indistinguishable from a route that does not exist.
 */
export async function assertQippayEnabled(): Promise<void> {
  if (!(await isQippayEnabled())) {
    throw new AppError('FEATURE_DISABLED', 404, 'Qippay payments are not enabled');
  }
}

/**
 * Guard for routes that only make sense while Qippay is OFF (manual repayment
 * recording). While Qippay owns the instalment state a lender must not
 * overwrite what the bank reported.
 */
export async function assertManualRepaymentsMode(): Promise<void> {
  if (await isQippayEnabled()) {
    throw new AppError(
      'FEATURE_DISABLED',
      409,
      'Repayments are collected by Qippay on this environment and cannot be recorded manually',
    );
  }
}

function isDynamicServerUsage(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { digest?: unknown; message?: unknown };
  return (
    e.digest === 'DYNAMIC_SERVER_USAGE' ||
    (typeof e.message === 'string' && e.message.includes('Dynamic server usage'))
  );
}
