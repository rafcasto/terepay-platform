import { arrearsAutoEnabled } from '@/lib/flags/flags';

/**
 * Does the payment-refresh sweep run the arrears engine on its own?
 *
 * Fails closed: if flag evaluation throws, automatic assessment is treated as
 * OFF — a flag outage must never start charging fees or emailing borrowers
 * without a lender's say-so. The lender's manual trigger
 * (POST /api/applications/[id]/arrears/assess) works in either mode.
 * See `arrearsAutoEnabled` in src/lib/flags/flags.ts.
 */
export async function isArrearsAutoEnabled(): Promise<boolean> {
  try {
    return await arrearsAutoEnabled();
  } catch (err) {
    // Next.js signals "render this dynamically" by throwing from `headers()`
    // during prerender — that is not a flag outage, so let it propagate.
    if (isDynamicServerUsage(err)) throw err;
    console.warn('[arrears] flag evaluation failed — treating automatic arrears as disabled', err);
    return false;
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
