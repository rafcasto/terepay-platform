import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Lazily initialize Redis — avoids build-time errors when env vars are absent.
function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('[rate-limit] Upstash Redis env vars not set. Rate limiting is disabled.');
    return null;
  }
  return new Redis({ url, token });
}

const redis = createRedis();

function makeLimiter(limiter: Ratelimit['limiter'], prefix: string) {
  if (!redis) return null;
  return new Ratelimit({ redis, limiter, prefix });
}

export const authLoginLimiter = makeLimiter(Ratelimit.slidingWindow(5, '1 m'), 'rl:auth:login');
export const authSignupLimiter = makeLimiter(Ratelimit.slidingWindow(3, '5 m'), 'rl:auth:signup');
export const authVerifyEmailLimiter = makeLimiter(Ratelimit.slidingWindow(5, '15 m'), 'rl:auth:verify-email');
export const kycSmsLimiter = makeLimiter(Ratelimit.slidingWindow(3, '10 m'), 'rl:kyc:sms');
export const paymentLimiter = makeLimiter(Ratelimit.slidingWindow(5, '1 m'), 'rl:payments');
export const defaultLimiter = makeLimiter(Ratelimit.fixedWindow(60, '1 m'), 'rl:default');

/**
 * Apply a rate limiter to an identifier (e.g. IP address).
 * Returns `true` if the request is allowed, `false` if it should be blocked.
 * Gracefully allows the request through when Redis is unavailable.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<boolean> {
  if (!limiter) return true; // fail open when Redis is not configured
  const { success } = await limiter.limit(identifier);
  return success;
}
