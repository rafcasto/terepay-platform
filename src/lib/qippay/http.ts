import { AppError } from '@/lib/utils/api-error';

// Shared low-level HTTP plumbing for the Qippay APIs (SetPay + PayBy). Both
// integrations authenticate with the same Bearer client secret against the
// same base URL and share the `{ success, data, error }` response envelope, so
// the fetch/parse/error-mapping logic lives here once.

export function getQippayBaseUrl(): string {
  const baseUrl = process.env.QIPPAY_BASE_URL ?? '';
  if (!baseUrl) {
    throw new AppError('QIPPAY_NOT_CONFIGURED', 500, 'QIPPAY_BASE_URL is not configured');
  }
  return baseUrl.replace(/\/$/, '');
}

export function getQippayClientSecret(): string {
  const secret = process.env.QIPPAY_CLIENT_SECRET ?? '';
  if (!secret) {
    throw new AppError('QIPPAY_NOT_CONFIGURED', 500, 'QIPPAY_CLIENT_SECRET is not configured');
  }
  return secret;
}

/** Max chars of a Qippay error response body kept in logs/error details. */
const QIPPAY_LOG_BODY_MAX = 500;

export type QippayEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string } | string;
};

export async function qippayFetch<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const baseUrl = getQippayBaseUrl();
  const secret = getQippayClientSecret();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new AppError(
      'QIPPAY_UPSTREAM',
      502,
      'Bank payment service temporarily unavailable',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  }

  // Read the body once as text so a non-JSON error page (e.g. a bare
  // "Internal Server Error" from a gateway) is still available for logging.
  const rawBody = await res.text().catch(() => '');
  let envelope: QippayEnvelope<T> | undefined;
  try {
    envelope = JSON.parse(rawBody) as QippayEnvelope<T>;
  } catch {
    // Non-JSON response — fall through to status-based mapping below.
  }

  if (!res.ok || !envelope?.success || !envelope.data) {
    const errMsg =
      typeof envelope?.error === 'string'
        ? envelope.error
        : envelope?.error?.message ?? res.statusText ?? 'Qippay request failed';
    const errCode = typeof envelope?.error === 'object' ? envelope.error?.code : undefined;
    const code = res.status >= 500 || res.status === 0 ? 'QIPPAY_UPSTREAM' : 'QIPPAY_BAD_REQUEST';
    const details = {
      qippayStatus: res.status,
      ...(errCode ? { qippayCode: errCode } : {}),
    };
    // Surface upstream failures in server logs — callers often persist just
    // the message (e.g. an instalment's failureReason) and swallow the error.
    // The raw body stays here (not in `details`, which errorResponse() sends
    // to the client). Response body only — the request can carry PII.
    console.error(`[qippay] ${init.method} ${path} failed`, {
      code,
      message: errMsg,
      ...details,
      body: rawBody.slice(0, QIPPAY_LOG_BODY_MAX),
    });
    throw new AppError(code, 502, errMsg, details);
  }

  return envelope.data;
}
